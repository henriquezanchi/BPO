import { db } from "@/lib/db";
import { ulissesOccurrences, type UlissesEvent } from "@/lib/ulisses/events";

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

async function pedir<T>(caminho: string): Promise<T> {
  const r = await fetch(`${API}${caminho}`, {
    headers: { accept: "application/json", "user-agent": "PortalNovaAcropole/1.0 (eventos publicos)" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!r.ok) throw Object.assign(new Error(`GET ${caminho} -> ${r.status}`), { status: r.status });
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
        linha.eventos++;
        for (const ocorrencia of ulissesOccurrences(detalhe, filialId, escola.id)) {
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
          ? `Ulisses recusou a chamada (${status}): provável bloqueio do Cloudflare para servidores.`
          : e instanceof Error
            ? e.message
            : String(e);
    }
  }
  return resultado;
}
