"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import {
  buscarCandidatosMandato,
  buscarMembrosEscala,
  confirmarLeituraSecretaria,
  desativarMandatoSecretaria,
  salvarMandatoSecretaria,
  salvarPublicacaoSecretaria,
  type CandidatoEscala,
  type CandidatoMandato,
} from "@/lib/actions/secretarias-rede-actions";
import { salvarEscalaSecretaria } from "@/lib/actions/aberturas-actions";
import type { PaginaSecretariasRede } from "@/lib/secretarias-rede/dados";
import type { TipoPublicacao } from "@/lib/secretarias-rede/acesso";
import { Check, Edit3, LoaderCircle, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

const INICIAL = { ok: false, mensagem: "" };
const ROTULO_TIPO: Record<TipoPublicacao, string> = {
  material: "Material",
  aviso: "Aviso",
  reuniao: "Reunião",
  ideia: "Ideia",
  plano: "Plano",
};
const GRUPOS_MANDATO = [
  { escopo: "nacional", titulo: "Administração nacional", descricao: "Mandatos nacionais desta secretaria." },
  { escopo: "regional", titulo: "Administração regional", descricao: "Mandatos regionais desta secretaria." },
  { escopo: "local", titulo: "Administração local", descricao: "Mandatos locais desta secretaria." },
] as const;

type Publicacao = PaginaSecretariasRede["publicacoes"][number];
type Escala = PaginaSecretariasRede["escalas"][number];

function rotuloTerritorio(pub: Pick<Publicacao, "schoolIds" | "ufs">, data: PaginaSecretariasRede) {
  const escolas = data.escolas.filter((escola) => pub.schoolIds.includes(escola.id)).map((escola) => escola.name);
  const partes = [...escolas, ...pub.ufs.map((uf) => `UF ${uf}`)];
  return partes.length ? partes.join(" · ") : "Nacional";
}

function opcoesDeTerritorio(nome: string, data: PaginaSecretariasRede) {
  const config = data.territoriosPublicacao.find((item) => item.nome === nome);
  const todos = data.podePublicarLivre || !!config?.livre || config?.territorios.some((t) => !t.schoolIds.length && !t.ufs.length);
  if (todos) return { escolas: data.escolas, ufs: data.ufs };
  const territorios = config?.territorios ?? [];
  const escolas = data.escolas.filter((escola) => territorios.some((t) => {
    if (t.schoolIds.length && !t.schoolIds.includes(escola.id)) return false;
    if (t.ufs.length && (!escola.uf || !t.ufs.includes(escola.uf.toUpperCase()))) return false;
    return true;
  }));
  const ufs = [...new Set(territorios.flatMap((t) => t.ufs))].sort();
  return { escolas, ufs };
}

function MultiSelect({
  label,
  name,
  values,
  options,
  onChange,
}: {
  label: string;
  name: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
      {label}
      <select
        multiple
        name={name}
        value={values}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}
        className="min-h-24 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="font-normal text-gray-400">Use Ctrl ou Command para escolher mais de uma opção.</span>
    </label>
  );
}

function CompositorPublicacao({
  data,
  publicacao,
  aoSalvar,
  aoCancelar,
}: {
  data: PaginaSecretariasRede;
  publicacao: Publicacao | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [state, formAction, pending] = useActionState(salvarPublicacaoSecretaria, INICIAL);
  const secretaria = data.secretariaAtual;
  const territorioInicial = data.territoriosPublicacao.find((item) => item.nome === secretaria)?.territorios[0];
  const [schoolIds, setSchoolIds] = useState<string[]>(publicacao?.schoolIds ?? territorioInicial?.schoolIds ?? []);
  const [ufs, setUfs] = useState<string[]>(publicacao?.ufs ?? territorioInicial?.ufs ?? []);
  const [tipo, setTipo] = useState<TipoPublicacao>((publicacao?.tipo as TipoPublicacao) ?? "material");
  const opciones = useMemo(() => opcoesDeTerritorio(secretaria, data), [secretaria, data]);

  useEffect(() => {
    if (state.ok) aoSalvar();
  }, [state.ok, aoSalvar]);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-na-green/30 bg-na-green-light/30 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <input type="hidden" name="publicacaoId" value={publicacao?.id ?? ""} />
      <input type="hidden" name="secretaria" value={secretaria} />
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{publicacao ? "Editar publicação" : "Nova publicação"}</h3>
        <button type="button" onClick={aoCancelar} aria-label="Fechar" className="rounded-lg p-1 text-gray-500 hover:bg-white/70 dark:hover:bg-gray-800"><X size={17} /></button>
      </div>
      <p className="text-xs font-semibold text-na-green-dark dark:text-emerald-400">Secretaria: {secretaria}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          Tipo
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPublicacao)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
            {Object.entries(ROTULO_TIPO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        Título
        <input name="titulo" required maxLength={180} defaultValue={publicacao?.titulo ?? ""} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        {tipo === "plano" ? "Responsável, prazo e plano de ação (texto)" : tipo === "reuniao" ? "Detalhes da reunião" : "Texto"}
        <textarea name="conteudo" required maxLength={20000} rows={5} defaultValue={publicacao?.conteudo ?? ""} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
        <span className="font-normal text-gray-400">O texto é exibido como texto simples. Não cole código HTML.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          Link HTTPS (opcional)
          <input name="url" type="url" pattern="https://.*" placeholder="https://…" defaultValue={publicacao?.url ?? ""} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
        </label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
          <input type="checkbox" name="exigeLeitura" defaultChecked={publicacao?.exigeLeitura ?? false} />
          Pedir confirmação de leitura
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          Início (opcional)
          <input name="inicio" type="datetime-local" defaultValue={publicacao?.inicio ? publicacao.inicio.slice(0, 16) : ""} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          Fim / prazo (opcional)
          <input name="fim" type="datetime-local" defaultValue={publicacao?.fim ? publicacao.fim.slice(0, 16) : ""} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
        </label>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Território da publicação</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <MultiSelect label="Escolas" name="schoolIds" values={schoolIds} options={opciones.escolas.map((escola) => ({ value: escola.id, label: `${escola.name}${escola.uf ? ` · ${escola.uf}` : ""}` }))} onChange={setSchoolIds} />
          <MultiSelect label="Estados / UFs" name="ufs" values={ufs} options={opciones.ufs.map((uf) => ({ value: uf, label: uf }))} onChange={setUfs} />
        </div>
        <p className="mt-1 text-[11px] text-gray-400">Sem seleção, o alcance é nacional e exige mandato nacional.</p>
      </div>
      {tipo === "reuniao" && <p className="text-[11px] text-gray-500 dark:text-gray-400">A reunião fica registrada na biblioteca. Este formulário não envia convites ou avisos externos.</p>}
      {state.mensagem && <p role="status" className={`text-xs ${state.ok ? "text-na-green-dark dark:text-emerald-300" : "text-na-danger-dark dark:text-red-300"}`}>{state.mensagem}</p>}
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-na-green px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
        {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
        {publicacao ? "Salvar nova versão" : "Publicar"}
      </button>
    </form>
  );
}

function ConfirmacaoLeitura({ publicacao }: { publicacao: Publicacao }) {
  const [state, formAction, pending] = useActionState(confirmarLeituraSecretaria, INICIAL);
  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="publicacaoId" value={publicacao.id} />
        <input type="hidden" name="versao" value={publicacao.versao} />
        <button disabled={pending || publicacao.lida} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60 ${publicacao.lida ? "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}>
          {pending ? <LoaderCircle size={12} className="animate-spin" /> : <Check size={12} />}
          {publicacao.lida ? "Leitura confirmada" : publicacao.exigeLeitura ? "Confirmar leitura" : "Marcar como lida"}
        </button>
      </form>
      {state.mensagem && <span role="status" className={`text-[11px] ${state.ok ? "text-na-green-dark dark:text-emerald-300" : "text-na-danger-dark dark:text-red-300"}`}>{state.mensagem}</span>}
    </div>
  );
}

function CardPublicacao({ publicacao, data, aoEditar }: { publicacao: Publicacao; data: PaginaSecretariasRede; aoEditar: () => void }) {
  const urlSegura = publicacao.url?.startsWith("https://") ? publicacao.url : null;
  const periodo = [
    publicacao.inicio ? `Início ${new Date(publicacao.inicio).toLocaleString("pt-BR")}` : null,
    publicacao.fim ? `Fim ${new Date(publicacao.fim).toLocaleString("pt-BR")}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
        <span className="rounded-full bg-na-green-light px-2.5 py-1 text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">{ROTULO_TIPO[publicacao.tipo as TipoPublicacao] ?? publicacao.tipo}</span>
        {publicacao.exigeLeitura && <span className={`rounded-full px-2.5 py-1 ${publicacao.lida ? "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"}`}>{publicacao.lida ? "Lida" : "Leitura pendente"}</span>}
        <span className="text-gray-400">Versão {publicacao.versao}</span>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-na-green-dark dark:text-emerald-400">{publicacao.secretaria}</p>
          <h3 className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100">{publicacao.titulo}</h3>
        </div>
        {publicacao.podeGerir && <button onClick={aoEditar} aria-label="Editar publicação" className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"><Edit3 size={14} /></button>}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-300">{publicacao.conteudo}</p>
      {urlSegura && <a href={urlSegura} target="_blank" rel="noopener noreferrer" className="w-fit text-xs font-semibold text-na-green-dark underline underline-offset-2 dark:text-emerald-400">Abrir material</a>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span>Território: {rotuloTerritorio(publicacao, data)}</span>
        {periodo && <span>{periodo}</span>}
        <span>Publicado por {publicacao.autorNome}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <span className="text-[10px] text-gray-400">Atualizado {new Date(publicacao.atualizadoEm).toLocaleDateString("pt-BR")}</span>
        <ConfirmacaoLeitura publicacao={publicacao} />
      </div>
    </article>
  );
}

function SeletorMembro({
  secretaria,
  escopo,
  schoolIds,
  ufs,
}: {
  secretaria: string;
  escopo: string;
  schoolIds: string[];
  ufs: string[];
}) {
  const [consulta, setConsulta] = useState("");
  const [selecionado, setSelecionado] = useState<CandidatoMandato | null>(null);
  const [resultados, setResultados] = useState<CandidatoMandato[]>([]);
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const termo = consulta.trim();
    if (termo.length < 2) return;
    const timer = setTimeout(() => {
      setErro("");
      startTransition(async () => {
        try {
          setResultados(await buscarCandidatosMandato({ consulta: termo, secretaria, escopo, schoolIds, ufs }));
        } catch {
          setErro("Não foi possível buscar pessoas neste território.");
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [consulta, secretaria, escopo, schoolIds, ufs]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        Pessoa ativa
        <span className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-950">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input value={selecionado ? `${selecionado.nome} · ${selecionado.matricula ?? selecionado.escola}` : consulta} onChange={(event) => {
            setSelecionado(null);
            setConsulta(event.target.value);
            if (event.target.value.trim().length < 2) setResultados([]);
          }} placeholder="Buscar por nome ou matrícula" className="w-full bg-transparent py-2 text-sm outline-none" />
          {pending && <LoaderCircle size={14} className="animate-spin text-gray-400" />}
        </span>
      </label>
      <input type="hidden" name="memberId" value={selecionado?.id ?? ""} />
      {resultados.length > 0 && !selecionado && (
        <ul className="max-h-44 overflow-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
          {resultados.map((pessoa) => (
            <li key={pessoa.id}>
              <button type="button" onClick={() => { setSelecionado(pessoa); setConsulta(""); setResultados([]); }} className="w-full border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100">{pessoa.nome}</span>
                <span className="block text-[10px] text-gray-500 dark:text-gray-400">{[pessoa.matricula, pessoa.escola, pessoa.uf].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {consulta.trim().length >= 2 && !pending && resultados.length === 0 && <p className="text-[11px] text-gray-400">Nenhuma pessoa ativa encontrada dentro do território.</p>}
      {selecionado && <button type="button" onClick={() => setSelecionado(null)} className="w-fit text-[11px] text-gray-500 underline">Remover seleção</button>}
      {erro && <p className="text-[11px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      <p className="text-[10px] text-gray-400">A busca mostra apenas membros ativos que pertencem ao escopo escolhido.</p>
    </div>
  );
}

function CompositorMandato({ data }: { data: PaginaSecretariasRede }) {
  const [state, formAction, pending] = useActionState(salvarMandatoSecretaria, INICIAL);
  const [escopo, setEscopo] = useState(data.escoposMandatoPermitidos[0] ?? "local");
  const escolaLocalInicial = data.escolasMandatoLocal.includes(data.escolaIdUsuario) ? data.escolaIdUsuario : data.escolasMandatoLocal[0];
  const [schoolIds, setSchoolIds] = useState<string[]>(escopo === "local" && escolaLocalInicial ? [escolaLocalInicial] : []);
  const [ufs, setUfs] = useState<string[]>([]);

  const escolaOptions = escopo === "local" ? data.escolas.filter((escola) => data.escolasMandatoLocal.includes(escola.id)) : data.escolas;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <input type="hidden" name="secretaria" value={data.secretariaAtual} />
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Atribuir ou atualizar mandato</h3>
      <p className="text-xs font-semibold text-na-green-dark dark:text-emerald-400">Secretaria: {data.secretariaAtual}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          Escopo
          <select name="escopo" value={escopo} onChange={(event) => {
            const novoEscopo = event.target.value as typeof escopo;
            setEscopo(novoEscopo);
            setSchoolIds(novoEscopo === "local" && escolaLocalInicial ? [escolaLocalInicial] : []);
            setUfs([]);
          }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
            {data.escoposMandatoPermitidos.map((item) => <option key={item} value={item}>{item === "nacional" ? "Nacional" : item === "regional" ? "Regional" : "Local"}</option>)}
          </select>
        </label>
      </div>
      {escopo !== "nacional" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <MultiSelect label="Escolas" name="schoolIds" values={schoolIds} options={escolaOptions.map((escola) => ({ value: escola.id, label: `${escola.name}${escola.uf ? ` · ${escola.uf}` : ""}` }))} onChange={setSchoolIds} />
          {escopo === "regional" ? (
            <MultiSelect label="Estados / UFs" name="ufs" values={ufs} options={data.ufs.map((uf) => ({ value: uf, label: uf }))} onChange={setUfs} />
          ) : <p className="self-center text-[11px] text-gray-500 dark:text-gray-400">Mandato local vale somente para escolas chefiadas pelo diretor.</p>}
        </div>
      )}
      <SeletorMembro key={`${data.secretariaAtual}|${escopo}|${schoolIds.join(",")}|${ufs.join(",")}`} secretaria={data.secretariaAtual} escopo={escopo} schoolIds={schoolIds} ufs={ufs} />
      {state.mensagem && <p role="status" className={`text-xs ${state.ok ? "text-na-green-dark dark:text-emerald-300" : "text-na-danger-dark dark:text-red-300"}`}>{state.mensagem}</p>}
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-na-green px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
        {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
        Salvar mandato
      </button>
    </form>
  );
}

function BotaoDesativarMandato({ mandatoId }: { mandatoId: string }) {
  const [state, formAction, pending] = useActionState(desativarMandatoSecretaria, INICIAL);
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="mandatoId" value={mandatoId} />
        <button disabled={pending} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          {pending ? "Salvando…" : "Desativar"}
        </button>
      </form>
      {state.mensagem && <span role="status" className={`text-[10px] ${state.ok ? "text-na-green-dark dark:text-emerald-300" : "text-na-danger-dark dark:text-red-300"}`}>{state.mensagem}</span>}
    </div>
  );
}

function PainelMandatos({ data }: { data: PaginaSecretariasRede }) {
  return (
    <details className="group rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-gray-800 marker:hidden dark:text-gray-100">
        <span className="flex items-center justify-between gap-3">Administrar mandatos <span className="text-[11px] font-normal text-gray-500">{data.mandatos.length} cadastrados</span></span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-gray-200 p-4 dark:border-gray-800">
        <p className="text-[11px] leading-5 text-gray-500 dark:text-gray-400">Os escopos disponíveis dependem da sua função. Estados e escolas são conferidos no servidor.</p>
        <CompositorMandato data={data} />
        {GRUPOS_MANDATO.map((grupo) => {
          const mandatos = data.mandatos.filter((mandato) => mandato.escopo === grupo.escopo);
          if (!data.escoposMandatoPermitidos.includes(grupo.escopo) && !mandatos.length) return null;
          return (
            <section key={grupo.escopo} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">{grupo.titulo}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{grupo.descricao}</p>
              </div>
              {mandatos.length > 0 ? (
                <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                  {mandatos.map((mandato) => (
                    <li key={mandato.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{mandato.nomeMembro}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{[...data.escolas.filter((e) => mandato.schoolIds.includes(e.id)).map((e) => e.name), ...mandato.ufs.map((uf) => `UF ${uf}`)].join(" · ") || "Nacional"}{mandato.ativo ? " · ativo" : " · inativo"}</p>
                      </div>
                      {mandato.ativo ? <BotaoDesativarMandato mandatoId={mandato.id} /> : <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">Inativo · salve de novo no formulário para reativar</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[11px] text-gray-500 dark:text-gray-400">Nenhum mandato cadastrado neste escopo.</p>}
            </section>
          );
        })}
      </div>
    </details>
  );
}

function horaMinuto(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function SeletorPessoaEscala({
  secretaria,
  schoolId,
}: {
  secretaria: string;
  schoolId: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [selecionado, setSelecionado] = useState<CandidatoEscala | null>(null);
  const [resultados, setResultados] = useState<CandidatoEscala[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const termo = consulta.trim();
    if (termo.length < 2 || !secretaria || !schoolId) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        setResultados(await buscarMembrosEscala({ consulta: termo, secretaria, schoolId }));
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [consulta, secretaria, schoolId]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        Pessoa da escola
        <span className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-950">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input value={selecionado ? `${selecionado.nome} · ${selecionado.matricula ?? selecionado.escola}` : consulta} onChange={(event) => {
            setSelecionado(null);
            setConsulta(event.target.value);
            if (event.target.value.trim().length < 2) setResultados([]);
          }} placeholder="Buscar por nome ou matrícula" className="w-full bg-transparent py-2 text-sm outline-none" />
          {pending && <LoaderCircle size={14} className="animate-spin text-gray-400" />}
        </span>
      </label>
      <input type="hidden" name="memberId" value={selecionado?.id ?? ""} />
      {resultados.length > 0 && !selecionado && (
        <ul className="max-h-44 overflow-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
          {resultados.map((pessoa) => (
            <li key={pessoa.id}>
              <button type="button" onClick={() => { setSelecionado(pessoa); setConsulta(""); setResultados([]); }} className="w-full border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100">{pessoa.nome}</span>
                <span className="block text-[10px] text-gray-500 dark:text-gray-400">{[pessoa.matricula, pessoa.escola].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {consulta.trim().length >= 2 && !pending && resultados.length === 0 && <p className="text-[11px] text-gray-400">Nenhuma pessoa ativa encontrada nesta escola.</p>}
      {selecionado && <button type="button" onClick={() => setSelecionado(null)} className="w-fit text-[11px] text-gray-500 underline">Remover seleção</button>}
    </div>
  );
}

function FormularioEscala({ data }: { data: PaginaSecretariasRede }) {
  const router = useRouter();
  const secretaria = data.secretariaAtual;
  const [schoolId, setSchoolId] = useState(data.escolasEscala[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(async (_previous: typeof INICIAL, formData: FormData) => {
    const result = await salvarEscalaSecretaria(formData);
    if (result.ok) router.refresh();
    return { ok: result.ok, mensagem: result.ok ? "Turno registrado." : ("error" in result ? result.error : "Não foi possível registrar o turno.") };
  }, INICIAL);
  const podeExibir = data.escolasEscala.length > 0 && (data.podeGerirEscalaLivre || data.secretariasEscala.includes(secretaria));
  if (!podeExibir) return null;
  return (
    <form action={formAction} className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2">
      <input type="hidden" name="secretaria" value={secretaria} />
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 sm:col-span-2">Cadastrar escala da secretaria</h3>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        Escola
        <select name="schoolId" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
          {data.escolasEscala.map((escola) => <option key={escola.id} value={escola.id}>{escola.name}{escola.uf ? ` · ${escola.uf}` : ""}</option>)}
        </select>
      </label>
      <SeletorPessoaEscala key={`${secretaria}|${schoolId}`} secretaria={secretaria} schoolId={schoolId} />
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        Função
        <input name="funcao" required maxLength={100} placeholder="Ex.: recepção" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        Dia
        <select name="diaSemana" defaultValue="1" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950">
          {DIAS_SEMANA.map((dia, i) => <option key={dia} value={i}>{dia}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">Início<input type="time" name="inicio" required defaultValue="18:30" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">Fim<input type="time" name="fim" required defaultValue="21:30" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /></label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">Válida desde<input type="date" name="validaDe" required defaultValue={data.hoje} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">Válida até<input type="date" name="validaAte" required defaultValue={data.validadeEscalaAte} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" /></label>
      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 sm:col-span-2"><input type="checkbox" name="confirmado" value="true" />Turno confirmado pela pessoa</label>
      {state.mensagem && <p role="status" className={`text-xs sm:col-span-2 ${state.ok ? "text-na-green-dark dark:text-emerald-300" : "text-na-danger-dark dark:text-red-300"}`}>{state.mensagem}</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-na-green px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{pending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}Registrar escala</button>
      </div>
    </form>
  );
}

function ListaEscalas({ escalas }: { escalas: Escala[] }) {
  if (!escalas.length) return <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">Não há escalas visíveis nesta área.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {escalas.map((escala) => (
        <article key={escala.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><CollapsibleSection title={<h3 className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">{escala.memberName}</h3>}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-na-green-dark dark:text-emerald-400">{escala.secretaria} · {escala.schoolName}</p>

              <p className="text-xs text-gray-600 dark:text-gray-400">{escala.funcao} · {DIAS_SEMANA[escala.diaSemana] ?? "Dia não informado"} · {horaMinuto(escala.inicioMinuto)}–{horaMinuto(escala.fimMinuto)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${escala.confirmado ? "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"}`}>{escala.confirmado ? "Confirmada" : "Pendente"}</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Válida de {escala.validaDe} até {escala.validaAte}</p>
        </CollapsibleSection></article>
      ))}
    </div>
  );
}

function PainelEscalas({ data }: { data: PaginaSecretariasRede }) {
  if (!data.escalas.length && !data.escolasEscala.length) return null;
  return (
    <details className="group rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-gray-800 dark:text-gray-100">
        <span className="flex items-center justify-between gap-3">Escalas de secretaria <span className="text-[11px] font-normal text-gray-500">{data.escalas.length} visíveis</span></span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-gray-200 p-4 dark:border-gray-800">
        <p className="text-[11px] leading-5 text-gray-500 dark:text-gray-400">As escalas listadas pertencem apenas a escolas e secretarias do seu território autorizado.</p>
        <FormularioEscala data={data} />
        <ListaEscalas escalas={data.escalas} />
      </div>
    </details>
  );
}

export function SecretariasRede({ data }: { data: PaginaSecretariasRede }) {
  const [tipo, setTipo] = useState("todos");
  const [compositor, setCompositor] = useState<Publicacao | null | undefined>(undefined);
  const publicacoes = useMemo(() => data.publicacoes.filter((publicacao) => tipo === "todos" || publicacao.tipo === tipo), [data.publicacoes, tipo]);
  const podeCriar = data.podePublicarLivre || data.secretariasPublicaveis.includes(data.secretariaAtual);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">{data.secretariaAtual}</h1>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-gray-400"><span className="font-semibold">Orientações e gestão.</span> Materiais, avisos, reuniões, ideias e planos desta secretaria, com visibilidade conforme a autorização e o território de cada pessoa.</p>
      </header>

      {data.podeGerirMandatos && <PainelMandatos data={data} />}
      <PainelEscalas data={data} />

      {podeCriar && compositor === undefined && (
        <button onClick={() => setCompositor(null)} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-na-green px-4 py-2 text-xs font-bold text-white hover:bg-na-green-dark">
          <Plus size={15} /> Nova publicação
        </button>
      )}
      {compositor !== undefined && <CompositorPublicacao key={compositor?.id ?? "nova"} data={data} publicacao={compositor} aoSalvar={() => setCompositor(undefined)} aoCancelar={() => setCompositor(undefined)} />}

      <div className="max-w-xs">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          Tipo
          <select value={tipo} onChange={(event) => setTipo(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <option value="todos">Todos os tipos</option>
            {Object.entries(ROTULO_TIPO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>{publicacoes.length} {publicacoes.length === 1 ? "publicação" : "publicações"}</span>
        {tipo !== "todos" && <button onClick={() => setTipo("todos")} className="underline underline-offset-2">Limpar filtro</button>}
      </div>
      {publicacoes.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {publicacoes.map((publicacao) => (
            <CardPublicacao key={publicacao.id} publicacao={publicacao} data={data} aoEditar={() => setCompositor(publicacao)} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Ainda não há publicações visíveis neste filtro.</p>
      )}
      {data.podePublicarLivre && <p className="text-[10px] text-gray-400">Conteúdos novos aparecem publicados imediatamente. Ao editar, uma nova versão é criada e as confirmações de leitura da versão anterior permanecem no histórico.</p>}
    </div>
  );
}

