"use client";

import type { AgendaItem } from "@/lib/member-data";
import { ulissesOccurrences, type UlissesEvent } from "@/lib/ulisses/events";
import { useEffect, useState } from "react";

/**
 * Eventos públicos do Ulisses lidos PELO NAVEGADOR do aluno (19/10/2026).
 *
 * O Cloudflare do Ulisses recusa chamadas vindas de servidores (Vercel
 * testado: 403), mas a API pública é feita para navegadores — responde com
 * Access-Control-Allow-Origin: * e é a mesma que alimenta o site de eventos.
 * Então a Agenda lê o catálogo público da filial direto daqui, sem servidor
 * e sem credencial. Nada é gravado no banco: o que vem do navegador só é
 * exibido para quem abriu a página (ninguém consegue injetar evento para os
 * outros). Quando a importação diária no servidor for liberada (exceção no
 * Cloudflare — ver docs/EVENTOS-PORTAL.md), os eventos já gravados têm
 * prioridade e estes só completam o que faltar.
 */
const API = "https://api.acropolebrasil.com.br";
const VALIDADE_CACHE_MS = 6 * 60 * 60 * 1000;
const UM_DIA = 24 * 60 * 60 * 1000;

type Cache = { em: number; eventos: UlissesEvent[] };

async function pedir<T>(caminho: string): Promise<T> {
  const r = await fetch(`${API}${caminho}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw Object.assign(new Error(`GET ${caminho} -> ${r.status}`), { status: r.status });
  return r.json() as Promise<T>;
}

async function catalogoDaFilial(filialId: number): Promise<UlissesEvent[]> {
  const chave = `ulisses:catalogo:${filialId}`;
  try {
    const salvo = JSON.parse(localStorage.getItem(chave) ?? "null") as Cache | null;
    if (salvo && Date.now() - salvo.em < VALIDADE_CACHE_MS) return salvo.eventos;
  } catch {}
  const catalogo = await pedir<{ eventoId: number }[]>(`/eventos/${filialId}`);
  const ids = [...new Set((Array.isArray(catalogo) ? catalogo : []).map((c) => c.eventoId).filter(Number.isSafeInteger))];
  // Itens antigos do catálogo (listas de espera) respondem 400 no detalhe: ficam de fora.
  const detalhes = await Promise.all(ids.map((id) => pedir<UlissesEvent>(`/evento/${id}`).catch(() => null)));
  const eventos = detalhes.filter((d): d is UlissesEvent => d !== null);
  try {
    localStorage.setItem(chave, JSON.stringify({ em: Date.now(), eventos } satisfies Cache));
  } catch {}
  return eventos;
}

type EventoAgenda = Extract<AgendaItem, { kind: "evento" }>;

function paraAgenda(eventos: UlissesEvent[], filialId: number, schoolId: string): EventoAgenda[] {
  const limite = Date.now() - UM_DIA;
  return eventos.flatMap((e) => {
    try {
      return ulissesOccurrences(e, filialId, schoolId)
        .filter((o) => o.status === "publicado" && o.startsAt.getTime() >= limite)
        .map(
          (o): EventoAgenda => ({
            kind: "evento",
            id: o.externalUid,
            externalUid: o.externalUid,
            title: o.title,
            date: o.startsAt,
            endsAt: null,
            allDay: false,
            price: 0,
            reactions: [],
            minhaInscricao: null,
            posterUrl: o.imageUrl,
            source: "ulisses",
            status: "publicado",
            registrationUrl: o.registrationUrl,
            scope: "filial",
            description: o.description || null,
            location: o.location,
          }),
        );
    } catch {
      return [];
    }
  });
}

/**
 * Junta à Agenda os eventos públicos da filial que ainda não estão no banco.
 * Falha de rede ou bloqueio: a Agenda segue só com o que veio do servidor.
 */
export function useAgendaComUlisses(itens: AgendaItem[], filialId: number | null | undefined, schoolId: string): AgendaItem[] {
  const [extras, setExtras] = useState<EventoAgenda[]>([]);

  useEffect(() => {
    if (!filialId) return;
    let cancelado = false;
    catalogoDaFilial(filialId)
      .then((eventos) => {
        if (!cancelado) setExtras(paraAgenda(eventos, filialId, schoolId));
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [filialId, schoolId]);

  if (extras.length === 0) return itens;
  const jaNoBanco = new Set(itens.flatMap((i) => (i.kind === "evento" && i.externalUid ? [i.externalUid] : [])));
  const novos = extras.filter((e) => !jaNoBanco.has(e.externalUid!));
  if (novos.length === 0) return itens;
  return [...itens, ...novos].sort((a, b) => a.date.getTime() - b.date.getTime());
}
