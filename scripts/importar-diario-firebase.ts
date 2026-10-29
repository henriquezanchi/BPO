/**
 * Importa o histórico do Diário Filosófico (Firebase, projeto diario-filosofico) para o diário do Portal
 * (pedido do usuário 2026-10-29). Só leitura no Firebase.
 *
 * Uso:
 *   npx tsx --env-file=.env --env-file=.env.local scripts/importar-diario-firebase.ts [--chave <arquivo.json>] [--gravar]
 * Sem --gravar, só conta (nada é escrito). A chave é a de conta de serviço do Firebase; fica fora do repositório.
 *
 * Regras (docs/CONTINUIDADE-VOLUNTARIADO-DIARIOS.md):
 * - Pareia a conta do Firebase com a pessoa do Portal pelo e-mail CONFIRMADO no Firebase; e-mail não confirmado,
 *   sem correspondência ou usado por mais de um cadastro do Portal fica de fora e só aparece na contagem.
 * - Dias vazios (gravados pelo salvamento automático do diário antigo, sem Prólogo nem Epílogo) não entram.
 * - Dia já escrito no Portal não é sobrescrito; dia importado antes é atualizado (reexecução sem duplicar).
 * - Log só com contagens: nenhum texto do diário, nenhum e-mail.
 */
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";
import type { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";

const args = process.argv.slice(2);
const gravar = args.includes("--gravar");
const chave = args.includes("--chave") ? args[args.indexOf("--chave") + 1] : "C:/Users/Henrique Zanchi/Downloads/diario-filosofico-firebase-adminsdk-fbsvc-7303b6efc8.json";

type Tarefa = { id?: string; name?: string; recurrence?: string; weekDays?: number[]; monthDay?: number; baseDate?: string };
type Entrada = {
  date?: string;
  morningDone?: boolean;
  eveningDone?: boolean;
  didMorning?: boolean;
  virtue?: string;
  customVirtue?: string;
  intention?: string;
  quote?: { text?: string; author?: string } | null;
  whereIFailed?: string;
  whatIDidWell?: string;
  whatILeftUndone?: string;
  freeEpilogue?: string;
  tasksStatus?: Record<string, boolean>;
  morningTimestamp?: Timestamp;
  eveningTimestamp?: Timestamp;
};

const RECORRENCIA: Record<string, string> = { daily: "diaria", weekly: "semanal", biweekly: "quinzenal", monthly: "mensal" };
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : null);
const quando = (t: Timestamp | undefined, data: string) => (t && typeof t.toDate === "function" ? t.toDate() : new Date(`${data}T12:00:00Z`));

async function main() {
  const app = initializeApp({ credential: cert(JSON.parse(readFileSync(chave, "utf8"))) });
  const auth = getAuth(app);
  const fs = getFirestore(app);

  // Contas do Firebase (uid -> e-mail confirmado).
  const contas: { uid: string; email: string | null; confirmado: boolean }[] = [];
  for (let pagina: string | undefined; ; ) {
    const r = await auth.listUsers(1000, pagina);
    contas.push(...r.users.map((u) => ({ uid: u.uid, email: u.email?.trim().toLowerCase() ?? null, confirmado: !!u.emailVerified })));
    if (!r.pageToken) break;
    pagina = r.pageToken;
  }

  // Cadastros do Portal por e-mail (e-mail repetido em mais de um cadastro = ambíguo).
  const membros = await db.member.findMany({ where: { email: { not: null } }, select: { id: true, email: true } });
  const porEmail = new Map<string, string[]>();
  for (const m of membros) {
    const e = m.email!.trim().toLowerCase();
    porEmail.set(e, [...(porEmail.get(e) ?? []), m.id]);
  }

  const c = { contas: contas.length, semEmail: 0, naoConfirmado: 0, semCadastro: 0, ambiguo: 0, pareadas: 0, comDiario: 0, dias: 0, diasVazios: 0, diasDoPortalMantidos: 0, diasGravados: 0, praticas: 0 };
  for (const conta of contas) {
    if (!conta.email) { c.semEmail++; continue; }
    if (!conta.confirmado) { c.naoConfirmado++; continue; }
    const ids = porEmail.get(conta.email) ?? [];
    if (!ids.length) { c.semCadastro++; continue; }
    if (ids.length > 1) { c.ambiguo++; continue; }
    c.pareadas++;
    const memberId = ids[0];

    // Práticas (customTasks/{uid}) -> DiarioPratica; mapa id antigo -> id novo para as marcações dos dias.
    const tarefas = ((await fs.doc(`customTasks/${conta.uid}`).get()).data()?.tasks ?? []) as Tarefa[];
    const novoId = new Map<string, string>();
    for (const t of tarefas) {
      if (!t.id || !txt(t.name)) continue;
      c.praticas++;
      if (!gravar) continue;
      const recorrencia = RECORRENCIA[t.recurrence ?? ""] ?? "diaria";
      const dados = { nome: txt(t.name)!.slice(0, 120), recorrencia, diasSemana: recorrencia === "semanal" ? (t.weekDays ?? []).filter((d) => d >= 0 && d <= 6) : [], diaMes: recorrencia === "mensal" ? (t.monthDay ?? null) : null, dataBase: /^\d{4}-\d{2}-\d{2}$/.test(t.baseDate ?? "") ? t.baseDate! : "2026-01-01" };
      const p = await db.diarioPratica.upsert({ where: { memberId_origemId: { memberId, origemId: t.id } }, update: dados, create: { memberId, origemId: t.id, ...dados } });
      novoId.set(t.id, p.id);
    }

    // Dias (entries com userId = uid).
    const entradas = await fs.collection("entries").where("userId", "==", conta.uid).get();
    if (!entradas.empty) c.comDiario++;
    for (const doc of entradas.docs) {
      const e = doc.data() as Entrada;
      const data = e.date ?? doc.id.split("_").pop() ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
      c.dias++;
      if (!e.morningDone && !e.eveningDone) { c.diasVazios++; continue; }
      const existente = await db.diarioDia.findUnique({ where: { memberId_data: { memberId, data } }, select: { origem: true } });
      if (existente?.origem === "portal") { c.diasDoPortalMantidos++; continue; }
      if (!gravar) { c.diasGravados++; continue; }
      const praticas = Object.fromEntries(Object.entries(e.tasksStatus ?? {}).filter(([id, feita]) => feita && novoId.has(id)).map(([id]) => [novoId.get(id)!, true]));
      const dados = {
        virtude: txt(e.virtue) ?? txt(e.customVirtue),
        compromisso: txt(e.intention),
        frase: e.quote?.text ? ({ texto: e.quote.text, autor: e.quote.author ?? "" } as Prisma.InputJsonValue) : undefined,
        prologoEm: e.morningDone ? quando(e.morningTimestamp, data) : null,
        semPrologo: !!e.eveningDone && e.didMorning === false,
        falhei: txt(e.whereIFailed),
        fizBem: txt(e.whatIDidWell),
        deixeiDeFazer: txt(e.whatILeftUndone),
        reflexaoLivre: txt(e.freeEpilogue),
        epilogoEm: e.eveningDone ? quando(e.eveningTimestamp, data) : null,
        praticas: praticas as Prisma.InputJsonValue,
        origem: "firebase",
        origemId: doc.id,
      };
      await db.diarioDia.upsert({ where: { memberId_data: { memberId, data } }, update: dados, create: { memberId, data, ...dados } });
      c.diasGravados++;
    }
  }
  console.log(gravar ? "Importação gravada:" : "Simulação (nada gravado; use --gravar):", c);
}

main()
  .catch((e) => console.error("Importação do diário falhou:", e instanceof Error ? e.message : e))
  .finally(() => process.exit(0));
