"use client";

import { aprovarEspelho, ignorarEspelho, marcarFeitoManual } from "@/lib/actions/espelho-mercury-actions";
import { PROCEDIMENTOS } from "@/lib/espelho-mercury/manual";
import type { TipoAcao } from "@/lib/espelho-mercury/tipos";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Hand, Loader2, PauseCircle } from "lucide-react";
import { useState, useTransition } from "react";

export type ItemTela = {
  id: string;
  tipo: string;
  area: string;
  matricula: string | null;
  nome: string | null;
  resumo: string;
  dados: Record<string, string>;
  robo: boolean;
  revisao: boolean;
  status: string;
  ultimoErro: string | null;
  observacao: string | null;
  criadoEm: string;
  feitoEm: string | null;
  persiste: boolean;
};

const STATUS: Record<string, string> = {
  feito_robo: "Feito pelo robô",
  feito_manual: "Feito à mão",
  resolvido: "Resolvido no antigo",
  ignorado: "Não fazer",
};
const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

/**
 * Lista do que falta copiar do Mercúrio novo para o antigo. Três filas: o robô faz (com aprovação), a secretaria faz à
 * mão (com o passo a passo de manual.ts) e revisão. Tudo o que o robô não conseguir cai na fila manual.
 */
export function PainelEspelho(props: { schoolId: string; emEspera: boolean; modo: string; desde: string | null; rodada: string | null; erroRodada: string | null; itens: ItemTela[] }) {
  const { itens } = props;
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const paraRobo = itens.filter((i) => i.status === "pendente" && i.robo && !i.revisao);
  const naFila = itens.filter((i) => i.status === "aprovado");
  const revisao = itens.filter((i) => i.status === "pendente" && i.revisao);
  const aMao = itens.filter((i) => (i.status === "pendente" && !i.robo && !i.revisao) || i.status === "erro");
  const historico = itens.filter((i) => STATUS[i.status]).sort((a, b) => (b.feitoEm ?? b.criadoEm).localeCompare(a.feitoEm ?? a.criadoEm));

  function executar(fn: () => Promise<{ ok: true; alterados: number } | { ok: false; error: string }>, sucesso: string) {
    setMsg(null);
    iniciar(async () => {
      const r = await fn();
      setMsg(r.ok ? sucesso : r.error);
      if (r.ok) setMarcados(new Set());
    });
  }

  if (props.emEspera) {
    return (
      <section className="flex max-w-2xl gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <PauseCircle size={20} className="mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">Em espera</p>
          <p>
            Quando a filial passar a lançar no Mercúrio novo, esta página vai listar toda noite o que precisa ser copiado para o Mercúrio antigo, para os
            dirigentes continuarem vendo os dados. Até lá, nada é lido nem gravado.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <p className="text-[13px] text-gray-600 dark:text-gray-400">
        Comparação de toda noite entre o Mercúrio novo (que vale) e o antigo, a partir de {props.desde?.split("-").reverse().join("/")}. Última:{" "}
        {props.rodada ? quando(props.rodada) : "ainda não rodou"}. Modo: {props.modo === "automatico" ? "o robô faz sozinho o que sabe" : props.modo === "aprovacao" ? "o robô faz o que for aprovado" : "só lista"}.
      </p>
      {props.erroRodada && (
        <p className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> A última comparação falhou: {props.erroRodada}. A lista abaixo é da rodada anterior.
        </p>
      )}
      {msg && <p className="rounded-xl bg-gray-100 p-3 text-[13px] text-gray-800 dark:bg-gray-800 dark:text-gray-200">{msg}</p>}

      <Bloco icone={<Bot size={18} />} titulo="O robô pode fazer" vazio="Nada para o robô." quantos={paraRobo.length}>
        {paraRobo.length > 0 && props.modo !== "relatorio" && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={ocupado || marcados.size === 0}
              onClick={() => executar(() => aprovarEspelho(props.schoolId, [...marcados]), "Aprovado. O robô grava no Mercúrio antigo nos próximos minutos.")}
              className="inline-flex items-center gap-2 rounded-lg bg-na-green px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {ocupado && <Loader2 size={14} className="animate-spin" />} Aprovar {marcados.size || ""} selecionado{marcados.size === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={() => setMarcados(new Set(paraRobo.map((i) => i.id)))} className="text-[13px] font-semibold text-na-green-dark dark:text-emerald-400">
              Selecionar todos
            </button>
          </div>
        )}
        {paraRobo.map((i) => (
          <Item key={i.id} item={i} marcado={marcados.has(i.id)} aoMarcar={props.modo === "relatorio" ? undefined : (v) => setMarcados((m) => { const n = new Set(m); if (v) n.add(i.id); else n.delete(i.id); return n; })} schoolId={props.schoolId} executar={executar} ocupado={ocupado} />
        ))}
      </Bloco>

      <Bloco icone={<Hand size={18} />} titulo="Fazer à mão no Mercúrio antigo" vazio="Nada para fazer à mão." quantos={aMao.length}>
        {aMao.map((i) => <Item key={i.id} item={i} schoolId={props.schoolId} executar={executar} ocupado={ocupado} />)}
      </Bloco>

      <Bloco icone={<AlertTriangle size={18} />} titulo="Conferir antes" vazio="Nada para conferir." quantos={revisao.length}>
        {revisao.map((i) => <Item key={i.id} item={i} schoolId={props.schoolId} executar={executar} ocupado={ocupado} />)}
      </Bloco>

      {naFila.length > 0 && (
        <Bloco icone={<Loader2 size={18} />} titulo="Na fila do robô" vazio="" quantos={naFila.length}>
          {naFila.map((i) => <Item key={i.id} item={i} schoolId={props.schoolId} executar={executar} ocupado={ocupado} />)}
        </Bloco>
      )}

      <Bloco icone={<CheckCircle2 size={18} />} titulo="Últimos 30 dias" vazio="Nada ainda." quantos={historico.length}>
        {historico.slice(0, 100).map((i) => (
          <div key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 py-1.5 text-[13px] last:border-0 dark:border-gray-800">
            <span className="min-w-0 text-gray-800 dark:text-gray-200">
              {i.nome ? <b>{i.nome}</b> : null} {i.nome ? "· " : ""}
              {i.resumo}
              {i.observacao ? <span className="text-gray-500"> — {i.observacao}</span> : null}
              {i.persiste && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">(a diferença ainda aparece no antigo: conferir)</span>}
            </span>
            <span className="text-[12px] text-gray-500">{STATUS[i.status]} {quando(i.feitoEm)}</span>
          </div>
        ))}
      </Bloco>
    </div>
  );
}

function Bloco({ icone, titulo, vazio, quantos, children }: { icone: React.ReactNode; titulo: string; vazio: string; quantos: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-gray-900 dark:text-gray-100">
        <span className="text-na-green-dark dark:text-emerald-400">{icone}</span> {titulo}
        <span className="rounded-full bg-gray-100 px-2 text-[12px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{quantos}</span>
      </h2>
      {quantos === 0 ? <p className="text-[13px] text-gray-500">{vazio}</p> : children}
    </section>
  );
}

function Item({
  item,
  schoolId,
  executar,
  ocupado,
  marcado,
  aoMarcar,
}: {
  item: ItemTela;
  schoolId: string;
  executar: (fn: () => Promise<{ ok: true; alterados: number } | { ok: false; error: string }>, sucesso: string) => void;
  ocupado: boolean;
  marcado?: boolean;
  aoMarcar?: (v: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");
  const proc = PROCEDIMENTOS[item.tipo as TipoAcao];
  const podeDecidir = item.status !== "aprovado";

  return (
    <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <div className="flex items-start gap-2.5">
        {aoMarcar && <input type="checkbox" checked={marcado} onChange={(e) => aoMarcar(e.target.checked)} className="mt-1 h-4 w-4 accent-[#086357]" aria-label="Selecionar" />}
        <button type="button" onClick={() => setAberto((a) => !a)} className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left">
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">
              {item.nome ?? proc?.titulo ?? item.tipo}
              {item.matricula && <span className="font-normal text-gray-500"> · {item.matricula}</span>}
            </span>
            <span className="block text-[13px] text-gray-700 dark:text-gray-300">{item.resumo}</span>
            {item.status === "erro" && <span className="mt-1 block text-[12px] text-red-700 dark:text-red-400">O robô não conseguiu: {item.ultimoErro}</span>}
          </span>
          <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </div>

      {aberto && (
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            {Object.entries(item.dados).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-500">{k}</dt>
                <dd className="min-w-0 break-words font-medium text-gray-900 dark:text-gray-100">{v}</dd>
              </div>
            ))}
          </dl>
          {proc && (
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-gray-500">Como fazer à mão: {proc.titulo}</p>
              <ol className="list-decimal space-y-1 pl-5 text-[13px] text-gray-800 dark:text-gray-200">
                {proc.passos.map((p) => <li key={p}>{p}</li>)}
              </ol>
            </div>
          )}
          {podeDecidir && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Observação (ex.: nº do recibo no antigo)" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              <button type="button" disabled={ocupado} onClick={() => executar(() => marcarFeitoManual(schoolId, item.id, nota), "Marcado como feito.")} className="rounded-lg bg-na-green px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                Fiz no antigo
              </button>
              {item.robo && item.revisao && (
                <button type="button" disabled={ocupado} onClick={() => executar(() => aprovarEspelho(schoolId, [item.id]), "Conferido e mandado para o robô.")} className="rounded-lg border border-na-green px-3 py-2 text-[13px] font-semibold text-na-green-dark disabled:opacity-50 dark:text-emerald-400">
                  Conferi: robô pode fazer
                </button>
              )}
              <button type="button" disabled={ocupado} onClick={() => executar(() => ignorarEspelho(schoolId, item.id, nota), "Marcado para não fazer.")} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-gray-600 disabled:opacity-50 dark:text-gray-300">
                Não fazer (escreva o motivo)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
