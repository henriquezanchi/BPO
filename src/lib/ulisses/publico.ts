import { db } from "@/lib/db";
import { ulissesOccurrences, type UlissesEvent } from "@/lib/ulisses/events";
import { fetchAcropole } from "@/lib/ponte";

/**
 * Importação dos eventos PÚBLICOS do Ulisses (pedido do usuário 2026-10-19:
 * importar em nuvem, sem depender de um computador ligado).
 *
 * Usa só as rotas públicas da API — as mesmas que alimentam o site de
 * eventos da Nova Acrópole — e por isso não precisa de credencial:
 *  - GET /eventos/{filialId}: catálogo público da filial;
 *  - GET /evento/{id}: detalhe (sessões por filial, imagem, link de inscrição).
 * As rotas /facade (participantes, inscrições) exigem a credencial do CRM e
 * continuam fora do Portal.
 *
 * Cada escola do Portal aponta para a sua filial no Ulisses
 * (School.ulissesFilialId); o aluno vê os eventos da própria escola.
 */
const API = "https://api.acropolebrasil.com.br";
const UM_DIA = 24 * 60 * 60 * 1000;

type ItemCatalogo = { eventoId: number };

/** "[CÓPIA] ...", "Cópia de ...", "(copia)": evento duplicado no Ulisses e não renomeado. */
export function ehCopia(titulo: string) {
  const t = titulo.normalize("NFC").trim();
  return /^[[(]?\s*c[oó]pia(?=[\s\]):\-–]|$)/i.test(t) || /[[(]\s*c[oó]pia\s*[\])]/i.test(t) || /[-–]\s*c[oó]pia\s*$/i.test(t);
}

async function pedir<T>(caminho: string): Promise<T> {
  // Passa pela ponte na Cloudflare quando configurada (o Cloudflare deles desafia a Vercel — ver lib/ponte.ts).
  const chamar = () =>
    fetchAcropole(`${API}${caminho}`, {
      // Cabeçalho combinado com o Célio para a exceção no Cloudflare (mantido para o acesso direto).
      headers: { accept: "application/json", "user-agent": "PortalNovaAcropole/1.0 (eventos publicos)", "x-portal-na": "bypass" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  // O desafio é intermitente (22/10): mais uma tentativa antes de desistir (a ponte já tenta 3 vezes).
  let r = await chamar();
  for (let t = 1; t <= 1 && r.status === 403 && r.headers.get("cf-mitigated"); t++) {
    await new Promise((ok) => setTimeout(ok, 1500 * t));
    r = await chamar();
  }
  if (!r.ok) {
    // Ray ID e tipo de mitigação ajudam a Acrópole Brasil a achar a regra do Cloudflare que bloqueou.
    const ray = r.headers.get("x-origem-cf-ray") ?? r.headers.get("cf-ray");
    const mitigado = r.headers.get("cf-mitigated");
    const detalhe = [ray && `Ray ID ${ray}`, mitigado && `cf-mitigated: ${mitigado}`, r.headers.get("server") && `server: ${r.headers.get("server")}`].filter(Boolean).join(", ");
    throw Object.assign(new Error(`GET ${caminho} -> ${r.status}${detalhe ? ` (${detalhe})` : ""}`), { status: r.status, detalhe });
  }
  return r.json() as Promise<T>;
}

export type ResultadoUlisses = {
  escolas: { escola: string; filialId: number; eventos: number; ocorrencias: number; arquivadas: number; ignorados: number; erro?: string }[];
};

export async function sincronizarEventosUlisses(): Promise<ResultadoUlisses> {
  const escolas = await db.school.findMany({ where: { ulissesFilialId: { not: null } }, select: { id: true, name: true, ulissesFilialId: true } });
  const resultado: ResultadoUlisses = { escolas: [] };
  const detalhes = new Map<number, UlissesEvent>(); // o mesmo evento aparece em várias filiais

  for (const escola of escolas) {
    const filialId = escola.ulissesFilialId!;
    const linha: ResultadoUlisses["escolas"][number] = { escola: escola.name, filialId, eventos: 0, ocorrencias: 0, arquivadas: 0, ignorados: 0 };
    resultado.escolas.push(linha);
    try {
      const catalogo = await pedir<ItemCatalogo[]>(`/eventos/${filialId}`);
      if (!Array.isArray(catalogo)) throw new Error("Catálogo do Ulisses em formato inesperado.");
      const vistos = new Set<string>();
      const vistosComErro = new Set<number>();
      for (const id of new Set(catalogo.map((c) => c.eventoId).filter(Number.isSafeInteger))) {
        let detalhe = detalhes.get(id);
        if (!detalhe) {
          // Alguns itens do catálogo (listas de espera antigas) respondem 400 no
          // detalhe: pula só o evento. Bloqueio (403/503) derruba a filial.
          try {
            detalhe = await pedir<UlissesEvent>(`/evento/${id}`);
          } catch (e) {
            if ((e as { status?: number }).status !== 400 && (e as { status?: number }).status !== 404) throw e;
            linha.ignorados++;
            vistosComErro.add(id);
            continue;
          }
          detalhes.set(id, detalhe);
        }
        const ocorrencias = ulissesOccurrences(detalhe, filialId, escola.id);
        // Evento duplicado no Ulisses e esquecido com "[CÓPIA]" no título não entra (pedido do usuário 2026-10-22);
        // fora de "vistos", os que já tinham sido importados são arquivados logo abaixo.
        if (ocorrencias.some((o) => ehCopia(o.title))) {
          linha.ignorados++;
          continue;
        }
        linha.eventos++;
        for (const ocorrencia of ocorrencias) {
          if (ocorrencia.startsAt.getTime() < Date.now() - UM_DIA) continue;
          const { externalUid, ...dados } = ocorrencia;
          vistos.add(externalUid);
          await db.event.upsert({ where: { externalUid }, create: { ...dados, externalUid }, update: dados });
          linha.ocorrencias++;
        }
      }
      // Saiu do catálogo público (despublicado ou removido): some da Agenda.
      // Só com o catálogo lido por inteiro — falha de rede não chega aqui.
      const { count } = await db.event.updateMany({
        where: { source: "ulisses", schoolId: escola.id, status: "publicado", startsAt: { gte: new Date() }, externalUid: { notIn: [...vistos] }, NOT: [...vistosComErro].map((id) => ({ externalUid: { startsWith: `ulisses:${id}:` } })) },
        data: { status: "arquivado" },
      });
      linha.arquivadas = count;
    } catch (e) {
      const status = (e as { status?: number }).status;
      linha.erro =
        status === 403 || status === 503
          ? `Ulisses recusou a chamada (${status}): provável bloqueio do Cloudflare para servidores. ${(e as { detalhe?: string }).detalhe ?? ""}`.trim()
          : e instanceof Error
            ? e.message
            : String(e);
    }
  }
  return resultado;
}
