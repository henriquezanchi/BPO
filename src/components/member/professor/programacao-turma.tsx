"use client";

import { ProgramacaoDoMes } from "@/components/member/programacao-do-mes";
import type { AgendaItem } from "@/lib/member-data";
import { MESES, itensDoPeriodo, rotuloDoPeriodo } from "@/lib/programacao-mes";
import { useMemo, useState } from "react";

/**
 * Programação da turma (instrutor, 17/11/2026): escolhe o mês e o público e abre a mesma arte + texto da Agenda,
 * para compartilhar no grupo da turma no WhatsApp. Inclui aulas, provas, trabalhos e leituras publicados.
 */
export function ProgramacaoTurma({ items, fuso, escola, hoje, publicos = ["Alunos", "Membros"], descricaoItens = "aulas, provas, trabalhos e leituras publicados para a turma", turmaNoTexto, onde }: { items: AgendaItem[]; fuso: string; escola: string; hoje: string; publicos?: string[]; descricaoItens?: string; /** Como chamar o grupo no texto do WhatsApp (ex.: "turma de Pedagogos"), 24/11/2026. */ turmaNoTexto?: string; /** "Presencial · Sala Platão" ou "Online · link" (24/11/2026). */ onde?: string | null }) {
  const [a0, m0] = hoje.split("-").map(Number);
  const lista = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ ano: a0 + Math.floor((m0 - 1 + i) / 12), mes: ((m0 - 1 + i) % 12) + 1 })), [a0, m0]);
  const [escolhido, setEscolhido] = useState(0);
  // Até (24/11/2026): vários meses numa arte só (GAF quinzenal, secretarias mensais).
  const [ate, setAte] = useState(0);
  const meses = Math.max(1, ate - escolhido + 1);
  const [publico, setPublico] = useState(publicos[0]);
  const { ano, mes } = lista[escolhido];
  const qtd = useMemo(() => itensDoPeriodo(items, ano, mes, meses, fuso).length, [items, ano, mes, meses, fuso]);
  const campo = "min-h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900";
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Mês
          <select value={escolhido} onChange={(e) => { const v = Number(e.target.value); setEscolhido(v); if (ate < v) setAte(v); }} className={campo}>
            {lista.map((m, i) => (
              <option key={i} value={i}>
                {MESES[m.mes - 1]} {m.ano}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
          até
          <select value={ate} onChange={(e) => setAte(Number(e.target.value))} className={campo}>
            {lista.map((m, i) => i >= escolhido && (
              <option key={i} value={i}>
                {MESES[m.mes - 1]} {m.ano}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
          Público
          <select value={publico} onChange={(e) => setPublico(e.target.value)} className={campo}>
            {publicos.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {/* No celular, só o número (pedido do usuário 24/11/2026: menos texto). */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {qtd ? <><span>{qtd} {qtd === 1 ? "compromisso" : "compromissos"} em {rotuloDoPeriodo(ano, mes, meses).curto}</span><span className="hidden sm:inline">: {descricaoItens}</span>.</> : `Nada publicado em ${rotuloDoPeriodo(ano, mes, meses).curto} ainda.`}
      </p>
      <ProgramacaoDoMes items={items} ano={ano} mes={mes} meses={meses} fuso={fuso} publico={publico} escola={escola} turmaNoTexto={turmaNoTexto} onde={onde} />
    </div>
  );
}
