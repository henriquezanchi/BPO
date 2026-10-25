"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import { BookOpenCheck, Globe2, LockKeyhole, NotebookPen } from "lucide-react";
import { FormRegistro } from "./form-registro";
import type { Abertura, PainelAberturas } from "./types";
import { formatarData, formatarCentavos, numero, primeiraChave, texto } from "./utils";

const CARD = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";

export function AprendizadosTab({ data, abertura }: { data: PainelAberturas; abertura: Abertura | null }) {
  const locais = data.aprendizados.filter((item) => item.escopo === "local");
  const agregados = data.aprendizados.filter((item) => item.escopo === "rede");
  const historico = data.relatorios?.historico?.porDiaSemana ?? [];
  const validacoes = data.validacaoAvaliacoes ?? [];
  return (
    <div className="space-y-5">
      <section className={CARD}>
        <CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Experiências que podem ajudar sua escola</h2>}>
        <p className="mt-1 text-sm text-gray-500">Comparações por capacidade e ciclo cultural, somente com dados compartilhados e período acadêmico completo.</p>
        {!data.experienciasRede?.length ? <p className="mt-3 text-sm text-gray-500">Aguardando pelo menos três aberturas e dez interessados em duas escolas por formato. Consulte também os materiais da própria secretaria.</p> : <div className="mt-4 grid gap-4">{data.experienciasRede.map(e=><article key={e.titulo} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-950"><CollapsibleSection title={<h3 className="font-bold">{e.titulo}</h3>}><p className="mt-2 text-sm">{e.aberturas} aberturas · {e.escolas} escolas · {e.interessados} interessados · {e.matriculas} matrículas · {(e.conversaoObservada*100).toFixed(1)}% de conversão observada</p><p className="mt-2 text-sm">{e.sugestao}</p><p className="mt-2 text-xs text-gray-500">{e.ressalva}</p></CollapsibleSection></article>)}</div>}
      </CollapsibleSection></section>
      <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Aprendizados das aberturas</h2>}>
        <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><BookOpenCheck size={18} /></span><div><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Registre ajustes práticos para a próxima turma e consulte registros anteriores.</p></div></div>
        {abertura ? <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950/60"><p className="mb-3 text-xs text-gray-600 dark:text-gray-400">Novo registro em <span className="font-semibold text-gray-900 dark:text-gray-100">{abertura.titulo}</span></p><FormRegistro schoolId={data.schoolId} abertura={abertura} leads={data.crm.leads} matriculas={data.crm.matriculas} eventos={data.eventos} pessoas={data.pessoas} tipoInicial="aprendizado" tiposPermitidos={["aprendizado"]} compartilhamentoPermitido={data.configs?.compartilharAprendizados === true} /></div> : <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Crie uma abertura na aba Planejamento para registrar um aprendizado vinculado ao ciclo.</p>}
      </CollapsibleSection></section>

      <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Registros desta escola</h2>}>
        <div className="mb-3 flex items-center gap-2"><NotebookPen size={17} className="text-gray-500" /><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{locais.length}</span></div>
        {locais.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Ainda não há aprendizados locais registrados.</p> : <div className="space-y-3">{locais.map((item, index) => <AprendizadoLocal key={String(item.registroId ?? index)} item={item} />)}</div>}
      </CollapsibleSection></section>

      <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">O que estamos aprendendo com os contatos</h2>}>
        <div className="mb-3 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><BookOpenCheck size={18} /></span><div><p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">Resultados agregados por grupo de interesse e adequação. Só mostramos a leitura quando a abertura e a janela de observação estiverem concluídas.</p></div></div>
        {validacoes.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Ainda não há uma coorte com janela completa para esta análise. Avaliações individuais não são exibidas aqui.</p> : <div className="space-y-3">{validacoes.map((validacao) => <section key={validacao.aberturaId} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-950/30"><CollapsibleSection title={<h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{data.aberturas.find((item) => item.id === validacao.aberturaId)?.titulo ?? "Abertura"}</h3>}><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Janela de {validacao.janelaDias} dias · até {validacao.ate ? formatarData(validacao.ate) : "em andamento"}{validacao.baseAtualizadaEm ? ` · base de interessados atualizada ${formatarData(validacao.baseAtualizadaEm)}` : ""}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${validacao.coorteConcluida ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>{validacao.coorteConcluida ? "Coorte fechada" : "Acompanhamento em andamento"}</span></div>
          {validacao.aviso && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{validacao.aviso}</p>}
          {validacao.grupos.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhum grupo agregado disponível.</p> : <div className="mt-3 grid gap-2 lg:grid-cols-2">{validacao.grupos.map((grupo, index) => <article key={`${grupo.versao}-${grupo.interesse}-${grupo.adequacao}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">Interesse: {estadoSimples(grupo.interesse)}</span><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">Adequação: {estadoSimples(grupo.adequacao)}</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><NumeroGrupo label="Avaliações" value={grupo.avaliados} /><NumeroGrupo label="Matrículas observadas" value={grupo.matriculados} /><NumeroGrupo label={validacao.coorteConcluida ? "Sem matrícula até a janela" : "Em acompanhamento"} value={validacao.coorteConcluida ? grupo.semMatriculaNoPeriodo : grupo.pendentes} /><NumeroGrupo label="Ações registradas" value={grupo.acoesRegistradas} /></div><div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-gray-500 dark:text-gray-400"><span>Motor {grupo.versao}</span>{validacao.coorteConcluida && grupo.taxaObservada !== null && <span>Matrícula observada no grupo: {new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(grupo.taxaObservada)}</span>}</div></article>)}</div>}
        </CollapsibleSection></section>)}</div>}
        <p className="mt-3 text-[11px] leading-5 text-gray-500 dark:text-gray-400">“Sem matrícula até a janela” descreve apenas o período observado e não prevê uma decisão futura. Registros em acompanhamento aguardam o fechamento da janela. Nenhum resultado individual é mostrado nesta síntese.</p>
      </CollapsibleSection></section>

      <section className={CARD}><CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Referências compartilhadas</h2>}>
        <div className="mb-3 flex items-center gap-2"><Globe2 size={17} className="text-gray-500" /><div><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">A rede exibe somente contagens agregadas; não recebe texto, nomes ou identificadores.</p></div></div>
        {agregados.length === 0 ? <div className="flex gap-2 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"><LockKeyhole size={16} className="mt-0.5 shrink-0" />Ainda não há dados agregados disponíveis. A escola pode habilitar o compartilhamento em Equipe e horários; cada aprendizado também exige opt-in.</div> : <div className="grid gap-3 sm:grid-cols-3">{agregados.map((item, index) => <div key={`${String(item.categoria ?? "rede")}-${index}`} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950/60"><p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Aprendizados compartilhados</p><p className="mt-1 text-lg font-black text-gray-950 dark:text-white">{texto(item.amostras, "0")}</p><p className="mt-1 text-[11px] leading-5 text-gray-500 dark:text-gray-400">Em {texto(item.aberturasAgregadas, "0")} aberturas e {texto(item.leadsAgregados, "0")} interessados agregados.</p><p className="mt-2 text-[10px] text-gray-500">{texto(item.representacao, "contagem agregada sem texto")}</p></div>)}</div>}
      </CollapsibleSection></section>

      <section className={CARD}>
        <CollapsibleSection title={<h2 className="font-black text-gray-950 dark:text-white">Histórico observado por dia</h2>}><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Médias calculadas sobre aberturas concluídas da própria escola. Cada cartão informa o tamanho da amostra.</p>
        {historico.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Não há aberturas concluídas para formar uma amostra histórica.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{historico.map((item, index) => <HistoricoDia key={`${String(item.diaSemana)}-${index}`} item={item} />)}</div>}
      </CollapsibleSection></section>
    </div>
  );
}

function estadoSimples(value: string) {
  const labels: Record<string, string> = { a_confirmar: "a confirmar", conhecer: "conhecer", participar: "participar", inscrever: "inscrever-se", depois: "prefere depois", nao: "não tem interesse", adequada: "adequada", inadequada: "inadequada" };
  return labels[value] ?? value.replaceAll("_", " ");
}

function NumeroGrupo({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-950"><p className="text-[9px] leading-3 text-gray-500 dark:text-gray-400">{label}</p><p className="mt-0.5 text-sm font-black text-gray-900 dark:text-gray-100">{value}</p></div>;
}

function AprendizadoLocal({ item }: { item: PainelAberturas["aprendizados"][number] }) {
  const titulo = texto(primeiraChave(item, ["titulo", "title"]), "Aprendizado sem título");
  const descricao = texto(primeiraChave(item, ["descricao", "description"]), "Sem descrição.");
  const data = primeiraChave(item, ["createdAt", "data"]);
  const compartilhado = item.compartilhar === true;
  return <article className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-950/30"><CollapsibleSection title={<h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{titulo}</h3>}><div className="flex flex-wrap items-start justify-between gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${compartilhado ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{compartilhado ? "Compartilhado" : "Local"}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">{descricao}</p><div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-gray-500 dark:text-gray-400"><span>{texto(item.escolaNome, "Esta escola")}</span>{data !== undefined && data !== null && data !== "" && <span>{formatarData(data)}</span>}</div></CollapsibleSection></article>;
}

function HistoricoDia({ item }: { item: Record<string, unknown> }) {
  const dia = numero(item.diaSemana);
  const nomeDia = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][dia] ?? "Dia";
  const conversao = typeof item.conversaoMatriculaMedia === "number" ? item.conversaoMatriculaMedia * 100 : null;
  const gastoMedio = typeof item.gastoRealMedioCentavos === "number" ? formatarCentavos(item.gastoRealMedioCentavos) : "Sem amostra";
  return <article className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-950/30"><CollapsibleSection title={<h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{nomeDia}</h3>}><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">{texto(item.amostras, "0")} amostra(s)</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs"><p className="rounded-lg bg-white px-2.5 py-2 dark:bg-gray-900"><span className="block text-[10px] text-gray-500">Conversão média</span><span className="font-bold text-gray-900 dark:text-gray-100">{conversao === null ? "Sem dado" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(conversao)}%`}</span></p><p className="rounded-lg bg-white px-2.5 py-2 dark:bg-gray-900"><span className="block text-[10px] text-gray-500">Gasto real médio</span><span className="font-bold text-gray-900 dark:text-gray-100">{gastoMedio}</span></p><p className="rounded-lg bg-white px-2.5 py-2 dark:bg-gray-900"><span className="block text-[10px] text-gray-500">Interessados médios</span><span className="font-bold text-gray-900 dark:text-gray-100">{typeof item.leadsMedios === "number" ? item.leadsMedios.toFixed(1) : "Sem dado"}</span></p><p className="rounded-lg bg-white px-2.5 py-2 dark:bg-gray-900"><span className="block text-[10px] text-gray-500">Matrículas médias</span><span className="font-bold text-gray-900 dark:text-gray-100">{typeof item.matriculasMedias === "number" ? item.matriculasMedias.toFixed(1) : "Sem dado"}</span></p></div></CollapsibleSection></article>;
}
