import { db } from "@/lib/db";
import { fetchAcropole } from "@/lib/ponte";

/**
 * Inscritos dos eventos do Ulisses (pedido do usuário 2026-10-27: o "Dia Mundial da Filosofia" de BGA aparecia sem
 * inscritos no Portal, mas tinha inscritos no Ulisses). A inscrição desses eventos é feita no Ulisses; o Portal só
 * importava a parte pública. Aqui o Portal consulta a lista na hora, pela API oficial (rotas /facade, credencial
 * M2M do Auth0 — a mesma que o CRM usa, ULISSES_API_CLIENT_ID/SECRET), sem guardar nome, e-mail ou telefone de quem
 * não é aluno. A presença marcada na recepção vai para o próprio Ulisses (`/facade/compareceu`).
 */
const API = "https://api.acropolebrasil.com.br";
const AUTH0 = "https://acropolebrasil.us.auth0.com/oauth/token";
const CABECALHOS = { accept: "application/json", "user-agent": "PortalNovaAcropole/1.0 (inscritos)", "x-portal-na": "bypass" };

export function ulissesApiConfigurada() {
  return !!(process.env.ULISSES_API_CLIENT_ID && process.env.ULISSES_API_CLIENT_SECRET);
}

let token: { valor: string; ate: number } | null = null;

async function tokenUlisses(): Promise<string> {
  if (token && token.ate - Date.now() > 60_000) return token.valor;
  const r = await fetch(AUTH0, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: process.env.ULISSES_API_CLIENT_ID, client_secret: process.env.ULISSES_API_CLIENT_SECRET, audience: `${API}/`, grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!r.ok || !d.access_token) throw new Error(`Ulisses: token recusado (${r.status}).`);
  token = { valor: d.access_token, ate: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return token.valor;
}

async function facade<T>(caminho: string, corpo?: unknown, method = corpo === undefined ? "GET" : "POST"): Promise<T> {
  const r = await fetchAcropole(`${API}${caminho}`, {
    method,
    headers: { ...CABECALHOS, authorization: `Bearer ${await tokenUlisses()}`, ...(corpo === undefined ? {} : { "content-type": "application/json" }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!r.ok) {
    const texto = await r.text().catch(() => "");
    throw Object.assign(new Error(`Ulisses ${caminho} -> ${r.status}${texto ? `: ${texto.slice(0, 200)}` : ""}`), { status: r.status, texto });
  }
  const texto = await r.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

/** "ulisses:{eventoId}:{filialId}:{produtoId}" (ver ulisses/events.ts). */
export function idsDoEventoUlisses(externalUid: string | null | undefined) {
  const m = /^ulisses:(\d+):(\d+):(.+)$/.exec(externalUid ?? "");
  return m ? { eventoId: Number(m[1]), filialId: Number(m[2]), produto: m[3] } : null;
}

/** Pessoa de `/facade/filtrarEmails`: um cadastro do Ulisses e as inscrições dele. */
export type PessoaUlisses = {
  id?: number;
  nome?: string | null;
  email?: string | null;
  ddd?: string | number | null;
  telefone?: string | number | null;
  emailEventos?: { id: number; compareceu?: boolean | null; evento?: { id?: number } | null; produto?: { id?: number } | null }[] | null;
};

export type InscritoUlisses = {
  /** id da inscrição no Ulisses (emailEvento): é por ele que a presença é marcada. */
  id: number;
  nome: string;
  /** Matrícula do aluno no Portal, quando a pessoa é aluno da escola (casada por e-mail ou celular). */
  aluno: { nome: string; matricula: string | null } | null;
  compareceu: boolean;
};

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** DDD + 8 últimos dígitos: o mesmo celular com ou sem o 9 e com ou sem o 55. */
const chaveTelefone = (v: string) => {
  const d = soDigitos(v).replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : null;
};

/** Inscrições deste evento (e desta data, quando o Ulisses informa o produto), já casadas com os alunos. */
export function inscritosDaLista(
  pessoas: PessoaUlisses[],
  eventoId: number,
  produto: string,
  alunos: { name: string; registrationNo: string | null; email: string | null; whatsapp: string | null }[],
): InscritoUlisses[] {
  const porEmail = new Map(alunos.filter((a) => a.email).map((a) => [a.email!.trim().toLowerCase(), a]));
  const porTelefone = new Map(alunos.flatMap((a) => (a.whatsapp && chaveTelefone(a.whatsapp) ? [[chaveTelefone(a.whatsapp)!, a] as const] : [])));
  const vistos = new Set<number>();
  return pessoas
    .flatMap((p) => {
      const doEvento = (p.emailEventos ?? []).filter((ee) => ee.evento?.id === eventoId);
      const daData = doEvento.filter((ee) => ee.produto?.id !== undefined && String(ee.produto.id) === produto);
      const inscricao = (daData.length ? daData : doEvento)[0];
      if (!inscricao || vistos.has(inscricao.id)) return [];
      vistos.add(inscricao.id);
      const tel = chaveTelefone(`${soDigitos(p.ddd)}${soDigitos(p.telefone)}`);
      const aluno = (p.email && porEmail.get(p.email.trim().toLowerCase())) || (tel && porTelefone.get(tel)) || null;
      const nome = (p.nome ?? "").replace(/\s+/g, " ").trim() || aluno?.name || "Sem nome";
      return [{ id: inscricao.id, nome, aluno: aluno ? { nome: aluno.name, matricula: aluno.registrationNo } : null, compareceu: (daData.length ? daData : doEvento).some((ee) => ee.compareceu === true) }];
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * O Ulisses mudou o campo `ligacoes` duas vezes (visto no CRM, 30/09 e 01/10): tenta ['TODOS'] e, se a recusa for
 * por causa dele, tenta [].
 */
async function filtrarEmails(eventoId: number, filialId: number): Promise<PessoaUlisses[]> {
  const base = { eventoId, filialId, alunos: ["TODOS"], comparecimentos: ["TODOS"], ordenacao: "", pesquisa: "" };
  try {
    return (await facade<PessoaUlisses[]>("/facade/filtrarEmails", { ...base, ligacoes: ["TODOS"] })) ?? [];
  } catch (e) {
    if (!/liga[çc]|NullPointerException|getLigacoes/i.test(e instanceof Error ? e.message : "")) throw e;
    return (await facade<PessoaUlisses[]>("/facade/filtrarEmails", { ...base, ligacoes: [] })) ?? [];
  }
}

const cache = new Map<string, { ate: number; lista: InscritoUlisses[] }>();

/** Inscritos do evento do Ulisses; null quando o evento não é do Ulisses ou a API não está configurada. */
export async function inscritosDoEventoUlisses(evento: { externalUid: string | null; schoolId: string | null }, { fresco = false } = {}): Promise<InscritoUlisses[] | null> {
  const ids = idsDoEventoUlisses(evento.externalUid);
  if (!ids || !evento.schoolId || !ulissesApiConfigurada()) return null;
  const chave = evento.externalUid!;
  const guardado = cache.get(chave);
  if (!fresco && guardado && guardado.ate > Date.now()) return guardado.lista;
  const [pessoas, alunos] = await Promise.all([
    filtrarEmails(ids.eventoId, ids.filialId),
    db.member.findMany({ where: { schoolId: evento.schoolId }, select: { name: true, registrationNo: true, email: true, whatsapp: true } }),
  ]);
  const lista = inscritosDaLista(Array.isArray(pessoas) ? pessoas : [], ids.eventoId, ids.produto, alunos);
  cache.set(chave, { ate: Date.now() + 5 * 60_000, lista });
  return lista;
}

/** Quantos inscritos cada evento do Ulisses tem (painel de eventos); falha ou demora = sem número (null). */
export async function contarInscritosUlisses(eventos: { id: string; externalUid: string | null; schoolId: string | null }[]): Promise<Map<string, number>> {
  const contagem = new Map<string, number>();
  if (!ulissesApiConfigurada()) return contagem;
  await Promise.race([
    Promise.all(
      eventos.map(async (e) => {
        const lista = await inscritosDoEventoUlisses(e).catch((erro) => {
          console.warn("Ulisses: inscritos indisponíveis:", erro instanceof Error ? erro.message : erro);
          return null;
        });
        if (lista) contagem.set(e.id, lista.length);
      }),
    ),
    new Promise((ok) => setTimeout(ok, 6000)),
  ]);
  return contagem;
}

/** Marca (ou desmarca) a presença no próprio Ulisses e atualiza a lista guardada. */
export async function marcarPresencaNoUlisses(externalUid: string, inscricaoId: number, presente: boolean) {
  await facade<unknown>(`/facade/compareceu/${inscricaoId}/${presente ? "true" : "false"}`, undefined, "POST");
  const guardado = cache.get(externalUid);
  if (guardado) guardado.lista = guardado.lista.map((i) => (i.id === inscricaoId ? { ...i, compareceu: presente } : i));
}
