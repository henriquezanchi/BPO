"use client";

import {
  buscarPessoasMerlinJanos,
  desmarcarVoluntarioInfantojuvenil,
  marcarVoluntarioInfantojuvenil,
  registrarCertidaoInfantojuvenil,
} from "@/lib/actions/infantojuvenil-actions";
import type { RegistroInfantojuvenil } from "@/lib/infantojuvenil";
import { NOME_PROGRAMA, ROTULO_SITUACAO, type Programa, type Situacao } from "@/lib/infantojuvenil-comum";
import { ChevronDown, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

type Sugestao = { memberId: string; nome: string; filial: string; programa: Programa; funcao: string };
type Achado = { memberId: string; nome: string; matricula: string | null; filial: string; programas: Programa[] };

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const ORDEM: Situacao[] = ["vencida", "sem", "vencendo", "emDia"];
const COR: Record<Situacao, string> = {
  vencida: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  sem: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  vencendo: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  emDia: "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300",
};
const campo = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const botao = "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60";

export function MerlinJanosPanel({
  registros,
  sugestoes,
  programas,
  variasFiliais,
}: {
  registros: RegistroInfantojuvenil[];
  sugestoes: Sugestao[];
  programas: Programa[];
  variasFiliais: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [programa, setPrograma] = useState("");
  const [situacao, setSituacao] = useState<Situacao | "">("");
  const [filial, setFilial] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filiais = useMemo(() => [...new Set(registros.map((r) => r.filial))].sort((a, b) => a.localeCompare(b, "pt-BR")), [registros]);
  const contagem = useMemo(() => {
    const c: Record<Situacao, number> = { vencida: 0, sem: 0, vencendo: 0, emDia: 0 };
    for (const r of registros) c[r.situacao]++;
    return c;
  }, [registros]);
  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return registros
      .filter(
        (r) =>
          (!q || normalizar(r.nome).includes(q) || (r.matricula ?? "").includes(q)) &&
          (!programa || r.programa === programa) &&
          (!situacao || r.situacao === situacao) &&
          (!filial || r.filial === filial),
      )
      .sort((a, b) => ORDEM.indexOf(a.situacao) - ORDEM.indexOf(b.situacao) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [registros, busca, programa, situacao, filial]);

  function executar(chave: string, acao: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) {
    setErro(null);
    setOcupado(chave);
    startTransition(async () => {
      const r = await acao();
      setOcupado(null);
      if (!r.ok) return setErro(r.error ?? "Não foi possível salvar.");
      depois?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {ORDEM.map((s) => (
          <button
            key={s}
            onClick={() => setSituacao(situacao === s ? "" : s)}
            aria-pressed={situacao === s}
            className={`${botao} ${COR[s]} ${situacao === s ? "ring-2 ring-na-green/50" : ""}`}
          >
            {ROTULO_SITUACAO[s]} · {contagem[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 dark:border-gray-700">
          <Search size={14} className="text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome ou matrícula" className="w-full bg-transparent text-sm outline-none" />
        </label>
        {(programas.length > 1 || (variasFiliais && filiais.length > 1)) && (
          <div className="flex flex-wrap gap-2">
            {programas.length > 1 && (
              <select value={programa} onChange={(e) => setPrograma(e.target.value)} aria-label="Filtrar por programa" className={`${campo} min-w-0 flex-1`}>
                <option value="">Merlin e Janos</option>
                {programas.map((p) => (
                  <option key={p} value={p}>
                    {NOME_PROGRAMA[p]}
                  </option>
                ))}
              </select>
            )}
            {variasFiliais && filiais.length > 1 && (
              <select value={filial} onChange={(e) => setFilial(e.target.value)} aria-label="Filtrar por filial" className={`${campo} min-w-0 flex-1`}>
                <option value="">Todas as filiais</option>
                {filiais.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {erro && <p className="text-xs text-na-danger-dark dark:text-red-300">{erro}</p>}

      {filtrados.length > 0 ? (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 px-3 dark:divide-gray-800 dark:border-gray-700">
          {filtrados.map((r) => (
            <li key={r.id} className="py-2.5">
              <button onClick={() => setAberto(aberto === r.id ? null : r.id)} aria-expanded={aberto === r.id} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{r.nome}</span>
                  <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {[NOME_PROGRAMA[r.programa], ...(variasFiliais ? [r.filial] : []), r.matricula ? `Matrícula ${r.matricula}` : null, r.ativo ? null : "inativo no Mercúrio"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR[r.situacao]}`}>
                    {r.situacao === "sem" ? ROTULO_SITUACAO.sem : `${r.situacao === "vencida" ? "Venceu" : "Vale até"} ${dataBr(r.certidaoValidade)}`}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition ${aberto === r.id ? "rotate-180" : ""}`} />
                </span>
              </button>
              {aberto === r.id && <Detalhe r={r} ocupado={ocupado} executar={executar} fechar={() => setAberto(null)} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">{registros.length ? "Ninguém encontrado com esses filtros." : "Ninguém marcado ainda. Adicione abaixo ou confirme as sugestões."}</p>
      )}

      <Adicionar programas={programas} ocupado={ocupado} executar={executar} />

      {sugestoes.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">Sugestões pela função no Mercúrio</h2>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 px-3 dark:divide-gray-800 dark:border-gray-700">
            {sugestoes.map((s) => (
              <li key={`${s.memberId}:${s.programa}`} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.nome}</span>
                  <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{[...(variasFiliais ? [s.filial] : []), s.funcao.toLowerCase()].join(" · ")}</span>
                </span>
                <button
                  onClick={() => executar(`s:${s.memberId}:${s.programa}`, () => marcarVoluntarioInfantojuvenil(s.memberId, s.programa))}
                  disabled={ocupado === `s:${s.memberId}:${s.programa}`}
                  className={`${botao} shrink-0 border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800`}
                >
                  {ocupado === `s:${s.memberId}:${s.programa}` ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  {NOME_PROGRAMA[s.programa]}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Executar = (chave: string, acao: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) => void;

function Detalhe({ r, ocupado, executar, fechar }: { r: RegistroInfantojuvenil; ocupado: string | null; executar: Executar; fechar: () => void }) {
  const [data, setData] = useState("");
  const [orgao, setOrgao] = useState(r.certidaoOrgao ?? "");
  const [observacao, setObservacao] = useState(r.observacao ?? "");
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60">
      {r.certidaoEm ? (
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Última certidão: {dataBr(r.certidaoEm)}
          {r.certidaoOrgao ? ` · ${r.certidaoOrgao}` : ""} · vale até {dataBr(r.certidaoValidade)}.
        </p>
      ) : (
        <p className="text-xs text-gray-600 dark:text-gray-300">Nenhuma certidão registrada.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executar(`c:${r.id}`, () => registrarCertidaoInfantojuvenil(r.id, { data, orgao, observacao }), fechar);
        }}
        className="grid gap-2 sm:grid-cols-2"
      >
        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
          Data da nova certidão
          <input type="date" required max={hoje} value={data} onChange={(e) => setData(e.target.value)} className={`${campo} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
          Tribunal
          <input value={orgao} onChange={(e) => setOrgao(e.target.value)} maxLength={120} placeholder="Ex.: TJGO, TJDFT, Justiça Federal" className={`${campo} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-gray-600 sm:col-span-2 dark:text-gray-400">
          Observação (opcional)
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} placeholder="Sem dados da certidão; só o que ajuda a organizar" className={`${campo} mt-1`} />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="submit" disabled={ocupado === `c:${r.id}`} className={`${botao} bg-na-green text-white hover:bg-na-green-dark`}>
            {ocupado === `c:${r.id}` && <Loader2 size={12} className="animate-spin" />}
            Registrar certidão
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">A validade é calculada: 6 meses depois da data.</span>
        </div>
      </form>
      <div className="border-t border-gray-200 pt-2 dark:border-gray-800">
        {confirmarRemover ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            Tirar {r.nome.split(" ")[0]} do {NOME_PROGRAMA[r.programa]}? O registro da certidão também sai.
            <button
              onClick={() => executar(`d:${r.id}`, () => desmarcarVoluntarioInfantojuvenil(r.id))}
              disabled={ocupado === `d:${r.id}`}
              className={`${botao} bg-red-600 text-white hover:bg-red-700`}
            >
              Sim, tirar
            </button>
            <button onClick={() => setConfirmarRemover(false)} className={`${botao} border border-gray-300 dark:border-gray-700`}>
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmarRemover(true)} className="text-[11px] font-semibold text-gray-500 underline-offset-2 hover:underline dark:text-gray-400">
            Não é mais voluntário do {NOME_PROGRAMA[r.programa]}
          </button>
        )}
      </div>
    </div>
  );
}

function Adicionar({ programas, ocupado, executar }: { programas: Programa[]; ocupado: string | null; executar: Executar }) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<Achado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultima = useRef("");

  function digitar(valor: string) {
    setTermo(valor);
    if (espera.current) clearTimeout(espera.current);
    const q = valor.trim();
    ultima.current = q;
    if (q.length < 3) {
      setAchados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    espera.current = setTimeout(async () => {
      const r = await buscarPessoasMerlinJanos(q);
      if (ultima.current !== q) return;
      setAchados(r);
      setBuscando(false);
    }, 300);
  }

  return (
    <section className="rounded-2xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
        <UserPlus size={14} /> Adicionar voluntário
      </h2>
      <input value={termo} onChange={(e) => digitar(e.target.value)} placeholder="Nome ou matrícula (3 letras ou mais)" className={`${campo} mt-2`} />
      {buscando && <p className="mt-2 text-[11px] text-gray-500">Buscando…</p>}
      {!buscando && termo.trim().length >= 3 && achados.length === 0 && <p className="mt-2 text-[11px] text-gray-500">Ninguém encontrado nas filiais que você acompanha.</p>}
      {achados.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
          {achados.map((a) => (
            <li key={a.memberId} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm text-gray-900 dark:text-gray-100">{a.nome}</span>
                <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{[a.filial, a.matricula ? `Matrícula ${a.matricula}` : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                {a.programas
                  .filter((p) => programas.includes(p))
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => executar(`a:${a.memberId}:${p}`, () => marcarVoluntarioInfantojuvenil(a.memberId, p), () => digitar(""))}
                      disabled={ocupado === `a:${a.memberId}:${p}`}
                      className={`${botao} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800`}
                    >
                      {ocupado === `a:${a.memberId}:${p}` ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      {NOME_PROGRAMA[p]}
                    </button>
                  ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
