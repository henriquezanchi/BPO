/**
 * Importa o diário de FV antigo (Firebase, projeto diario-filosofico: fvData/{uid} e entries.fvDaily) para o diário de
 * FV do Portal (pedido do usuário 2026-10-31). Só leitura no Firebase. Sem a parte de IA.
 *
 * Uso:
 *   npx tsx --env-file=.env --env-file=.env.local scripts/importar-diario-fv.ts [--somente <matrícula,...>] [--aceitar <matrícula,...>] [--vincular "<nome no diário antigo>=<matrícula>"] [--gravar]
 * Sem --gravar, só conta. Mesmas regras de pareamento de scripts/importar-diario-firebase.ts (e-mail confirmado;
 * --aceitar e --vincular só com a confirmação da própria pessoa).
 *
 * Nada é sobrescrito: dia de FV escrito no Portal fica; dia que veio de outra conta fica; ficha preenchida no Portal
 * fica (só completa campos vazios). O Tratak vai para as práticas do diário comum (só acrescenta, nunca tira).
 * Log só com contagens: nenhum texto, nenhum e-mail.
 */
import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";

const args = process.argv.slice(2);
const gravar = args.includes("--gravar");
const lista = (flag: string) => new Set(args.includes(flag) ? args[args.indexOf(flag) + 1].split(",").map((m) => m.trim()) : []);
const somente = lista("--somente");
const aceitar = lista("--aceitar");
const vinculos = args.flatMap((a, i) => (a === "--vincular" && args[i + 1]?.includes("=") ? [args[i + 1].split("=").map((x) => x.trim()) as [string, string]] : []));
const chave = args.includes("--chave") ? args[args.indexOf("--chave") + 1] : "C:/Users/Henrique Zanchi/Downloads/diario-filosofico-firebase-adminsdk-fbsvc-7303b6efc8.json";

const ITENS = ["item1", "item2", "item2_instintos", "item2_idade", "item2_enfermidade", "item2_animo", "item2_humor", "item2_ideias", "item2_sentimentos", "item2_ambiente", "item34", "item5", "item6", "item7"];
const PRATICAS = ["recitarHonra", "recitar7Fases", "camara", "formasGeometricas", "porta", "patioAberto", "patioColunas", "santuario"];
const PRESENCAS: Record<string, string> = { aulaRegularPresenca: "aulaRegular", reuniaoRaioPresenca: "reuniaoRaio", aulaMinistradaPresenca: "aulaMinistrada", crmPresenca: "crm", aulaEdPresenca: "aulaEd" };

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : null);
const data = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const minutos = (v: unknown) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof v === "string" ? v.trim() : "");
  const n = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  return n > 0 ? n : null;
};

type FvDaily = Record<string, unknown> & { praticas?: Record<string, boolean>; gdveTasksStatus?: Record<string, number | boolean>; gdveAttendance?: boolean };

async function main() {
  const app = initializeApp({ credential: cert(JSON.parse(readFileSync(chave, "utf8"))) });
  const auth = getAuth(app);
  const fs = getFirestore(app);

  const usuarios = [];
  for (let pagina: string | undefined; ; ) {
    const r = await auth.listUsers(1000, pagina);
    usuarios.push(...r.users);
    if (!r.pageToken) break;
    pagina = r.pageToken;
  }
  const membros = (await db.member.findMany({ where: { email: { not: null } }, select: { id: true, email: true, mercurioId: true } })).filter((m) => !somente.size || (m.mercurioId && somente.has(m.mercurioId)));
  const porEmail = new Map<string, string[]>();
  for (const m of membros) {
    const e = m.email!.trim().toLowerCase();
    porEmail.set(e, [...(porEmail.get(e) ?? []), m.id]);
  }
  const emailsAceitos = new Set(membros.filter((m) => m.mercurioId && aceitar.has(m.mercurioId)).map((m) => m.email!.trim().toLowerCase()));
  const vinculadas = new Map<string, string>();
  for (const [nome, matricula] of vinculos) {
    const achadas = usuarios.filter((u) => u.displayName?.trim() === nome);
    const pessoa = await db.member.findFirst({ where: { mercurioId: matricula }, select: { id: true } });
    if (achadas.length !== 1 || !pessoa) throw new Error(`--vincular "${nome}=${matricula}": ${achadas.length !== 1 ? `${achadas.length} contas com esse nome` : "matrícula sem cadastro no Portal"}.`);
    vinculadas.set(achadas[0].uid, pessoa.id);
  }

  const c = { contasComFv: 0, naoConfirmado: 0, semCadastro: 0, ambiguo: 0, pareadas: 0, fichasCriadas: 0, fichasCompletadas: 0, dias: 0, diasSemConteudo: 0, diasDoPortalMantidos: 0, diasDeOutraContaMantidos: 0, diasGravados: 0, tratak: 0 };
  const fvDocs = new Map((await fs.collection("fvData").get()).docs.map((d) => [d.id, d.data()]));
  const comDiarioFv = new Set((await fs.collection("entries").get()).docs.filter((d) => d.data().fvDaily).map((d) => d.data().userId as string));

  for (const u of usuarios) {
    if (!fvDocs.has(u.uid) && !comDiarioFv.has(u.uid)) continue;
    c.contasComFv++;
    const email = u.email?.trim().toLowerCase() ?? "";
    const vinculada = vinculadas.get(u.uid);
    if (!vinculada && (!email || (!u.emailVerified && !emailsAceitos.has(email)))) { c.naoConfirmado++; continue; }
    const ids = vinculada ? [vinculada] : (porEmail.get(email) ?? []);
    if (!ids.length) { c.semCadastro++; continue; }
    if (ids.length > 1) { c.ambiguo++; continue; }
    c.pareadas++;
    const memberId = ids[0];

    // Ficha (fvData/{uid}): cria; se já existe, só completa campos vazios (nunca troca o que foi preenchido no Portal).
    const f = fvDocs.get(u.uid) as Record<string, unknown> | undefined;
    if (f) {
      const cal = (f.fvCalendar ?? {}) as Record<string, unknown>;
      const ficha = {
        unidade: txt(f.fvUnidade),
        condicao: txt(f.fvCondicao),
        mestre: txt(f.fvMasterName ?? f.masterName),
        ultimoEncontro: data(f.fvLastMeetingDate ?? f.lastMeetingDate),
        ultimaCarta: data(f.lastCartaDate ?? f.fvLastCartaDate),
        proximaCarta: data(f.nextCartaDate ?? f.fvNextCartaDate),
        proximaReuniao: txt(f.fvGdveReuniao ?? f.gdveReuniao),
      };
      const calendario = { ...cal, reuniaoRaioDia: cal.reuniaoRaioDia ?? cal.reunioesRaioDia } as Prisma.InputJsonValue;
      const tarefas = ((f.gdveTasks ?? []) as { id?: string; name?: string; target?: number; isCycle?: boolean }[])
        .filter((t) => t.id && txt(t.name))
        .map((t) => ({ id: t.id!, nome: txt(t.name)!.slice(0, 160), meta: Math.min(Math.max(Number(t.target) || 1, 1), 10), ciclo: !!t.isCycle }));
      const ciclo = (f.gdveCycleStatus ?? {}) as Prisma.InputJsonValue;
      const existente = await db.diarioFvFicha.findUnique({ where: { memberId } });
      if (!existente) {
        c.fichasCriadas++;
        if (gravar) await db.diarioFvFicha.create({ data: { memberId, ...ficha, calendario, tarefas, ciclo, origemId: u.uid } });
      } else {
        const vazios = Object.fromEntries(Object.entries(ficha).filter(([k, v]) => v && !existente[k as keyof typeof ficha]));
        const extra = {
          ...(Object.keys(existente.calendario as object).length ? {} : { calendario }),
          ...((existente.tarefas as unknown[]).length ? {} : { tarefas, ciclo }),
        };
        if (Object.keys(vazios).length || Object.keys(extra).length) {
          c.fichasCompletadas++;
          if (gravar) await db.diarioFvFicha.update({ where: { memberId }, data: { ...vazios, ...extra } });
        }
      }
    }

    // Dias (entries.fvDaily).
    const entradas = await fs.collection("entries").where("userId", "==", u.uid).get();
    for (const doc of entradas.docs) {
      const e = doc.data() as { date?: string; fvDaily?: FvDaily };
      const fv = e.fvDaily;
      const dia = e.date ?? doc.id.split("_").pop() ?? "";
      if (!fv || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
      c.dias++;
      const itens = Object.fromEntries(ITENS.flatMap((k) => (txt(fv[k]) ? [[k, txt(fv[k])!]] : [])));
      const praticas = Object.fromEntries(PRATICAS.filter((k) => fv.praticas?.[k] === true).map((k) => [k, true]));
      const presencas = Object.fromEntries(Object.entries(PRESENCAS).flatMap(([de, para]) => (fv[de] === "Sim" || fv[de] === "Não" ? [[para, fv[de]]] : [])));
      const gdveTarefas = Object.fromEntries(Object.entries(fv.gdveTasksStatus ?? {}).flatMap(([k, v]) => (v === true ? [[k, 1]] : typeof v === "number" && v > 0 ? [[k, v]] : [])));
      const tratak = fv.praticas?.tratack === true || fv.praticas?.tratak === true;
      const dados = {
        itens,
        praticas,
        presencas,
        minutosVoluntariado: minutos(fv.horasVoluntariado),
        minutosAulaAssistida: minutos(fv.horasAulaAssistida),
        minutosAulaMinistrada: minutos(fv.horasAulaMinistrada),
        gdveTarefas,
        gdvePresenca: fv.gdveAttendance === true,
      };
      const temConteudo = Object.keys(itens).length || Object.keys(praticas).length || Object.keys(presencas).length || dados.minutosVoluntariado || dados.minutosAulaAssistida || dados.minutosAulaMinistrada || Object.keys(gdveTarefas).length || dados.gdvePresenca || tratak;
      if (!temConteudo) { c.diasSemConteudo++; continue; }

      if (tratak) {
        c.tratak++;
        if (gravar) {
          const comum = await db.diarioDia.findUnique({ where: { memberId_data: { memberId, data: dia } }, select: { praticas: true } });
          const atuais = (comum?.praticas ?? {}) as Record<string, boolean>;
          if (!atuais.tratak) {
            const valor = { ...atuais, tratak: true } as Prisma.InputJsonValue;
            await db.diarioDia.upsert({ where: { memberId_data: { memberId, data: dia } }, update: { praticas: valor }, create: { memberId, data: dia, praticas: valor, origem: "firebase", origemId: doc.id } });
          }
        }
      }

      const existente = await db.diarioFvDia.findUnique({ where: { memberId_data: { memberId, data: dia } }, select: { origem: true, origemId: true } });
      if (existente?.origem === "portal") { c.diasDoPortalMantidos++; continue; }
      if (existente?.origemId && existente.origemId !== doc.id) { c.diasDeOutraContaMantidos++; continue; }
      c.diasGravados++;
      if (!gravar) continue;
      await db.diarioFvDia.upsert({
        where: { memberId_data: { memberId, data: dia } },
        update: { ...dados, origem: "firebase", origemId: doc.id },
        create: { memberId, data: dia, ...dados, origem: "firebase", origemId: doc.id },
      });
    }
  }
  console.log(gravar ? "Importação gravada:" : "Simulação (nada gravado; use --gravar):", c);
}

main()
  .catch((e) => console.error("Importação do diário de FV falhou:", e instanceof Error ? e.message : e))
  .finally(() => process.exit(0));
