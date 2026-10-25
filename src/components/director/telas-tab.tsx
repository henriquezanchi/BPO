"use client";

import { atualizarCartao, atualizarTela, conectarTv, criarCartao, criarTela, excluirCartao, excluirTela, trocarLinkTela, type DadosCartao, type DadosTela } from "@/lib/actions/telas-actions";
import { CONTEUDOS_PADRAO, CONTEUDOS_TELA, ORIENTACOES_TELA, PUBLICOS_TELA, TIPOS_CARTAO, type ConteudoTela, type OrientacaoTela, type PublicoTela, type TipoCartao } from "@/lib/telas-publicos";
import { FrasesTela } from "./frases-tela";
import { Check, Copy, ExternalLink, Link2, Pencil, Plus, RefreshCw, Trash2, Tv } from "lucide-react";
import { useState, useTransition } from "react";

export type TelaResumo = { id: string; nome: string; publicos: string[]; conteudos: string[]; orientacao: string; token: string };
export type CartaoResumo = { id: string; tipo: string; titulo: string; texto: string | null; link: string | null; ate: string | null };

type Resultado = { ok: true } | { ok: false; error: string };

const CAMPO = "w-full rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-700";
const BOTAO = "rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";

function useAcao() {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (acao: () => Promise<Resultado>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null);
      const r = await acao();
      if (!r.ok) setErro(r.error);
      else depois?.();
    });
  return { erro, pendente, rodar };
}

function Chips<K extends string>({ opcoes, valor, onChange, rotulo, bloqueadas = [] }: { opcoes: [K, string][]; valor: string[]; onChange: (v: string[]) => void; rotulo: string; bloqueadas?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={rotulo}>
      {opcoes.map(([chave, texto]) => {
        const marcado = valor.includes(chave);
        const bloqueada = bloqueadas.includes(chave);
        return (
          <button
            key={chave}
            type="button"
            aria-pressed={marcado}
            disabled={bloqueada && !marcado}
            onClick={() => onChange(marcado ? valor.filter((p) => p !== chave) : [...valor, chave])}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-na-green disabled:cursor-not-allowed disabled:opacity-40 ${
              marcado ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:border-na-green hover:text-na-green-dark dark:border-gray-600 dark:text-gray-200"
            }`}
          >
            {marcado && <Check size={14} aria-hidden />}
            {texto}
          </button>
        );
      })}
    </div>
  );
}

const OPCOES_PUBLICO = Object.entries(PUBLICOS_TELA) as [PublicoTela, string][];
const OPCOES_CONTEUDO = Object.entries(CONTEUDOS_TELA) as [ConteudoTela, string][];

/** Nome, públicos, conteúdos e orientação — o mesmo formulário para criar e editar. */
function CamposTela({ dados, onChange }: { dados: DadosTela; onChange: (d: DadosTela) => void }) {
  const aberta = dados.publicos.includes("aberto_publico");
  return (
    <div className="space-y-4">
      <input value={dados.nome} onChange={(e) => onChange({ ...dados, nome: e.target.value })} maxLength={60} placeholder="Nome da tela (ex.: TV da recepção)" aria-label="Nome da tela" className={CAMPO} />
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Eventos que aparecem nesta TV</p>
        <Chips
          opcoes={OPCOES_PUBLICO}
          valor={dados.publicos}
          rotulo="Públicos exibidos"
          onChange={(publicos) => onChange({ ...dados, publicos, conteudos: publicos.includes("aberto_publico") ? dados.conteudos.filter((c) => c !== "aniversariantes") : dados.conteudos })}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Entre os eventos, mostrar também</p>
        <Chips opcoes={OPCOES_CONTEUDO} valor={dados.conteudos} rotulo="Conteúdos exibidos" bloqueadas={aberta ? ["aniversariantes"] : []} onChange={(conteudos) => onChange({ ...dados, conteudos })} />
        {aberta && <p className="text-xs text-gray-500">Aniversariantes só em TV interna (sem “Aberto ao público”).</p>}
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-gray-500">Posição da TV</span>
        <select value={dados.orientacao} onChange={(e) => onChange({ ...dados, orientacao: e.target.value })} className={CAMPO}>
          {(Object.entries(ORIENTACOES_TELA) as [OrientacaoTela, string][]).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        {dados.orientacao !== "auto" && <span className="block text-xs text-gray-500">Se a imagem aparecer de cabeça para baixo na TV, escolha o outro lado.</span>}
      </label>
    </div>
  );
}

function ConectarAqui({ schoolId, telaId }: { schoolId: string; telaId: string }) {
  const [codigo, setCodigo] = useState("");
  const [ok, setOk] = useState(false);
  const { erro, pendente, rodar } = useAcao();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        rodar(() => conectarTv(schoolId, telaId, codigo), () => (setOk(true), setCodigo("")));
      }}
    >
      <label className="text-sm font-semibold" htmlFor={`codigo-${telaId}`}>
        Conectar uma TV
      </label>
      <input
        id={`codigo-${telaId}`}
        value={codigo}
        onChange={(e) => (setOk(false), setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6)))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="código da TV"
        className="w-32 rounded-lg border border-gray-300 bg-transparent px-2 py-1.5 text-center text-sm font-bold tracking-widest dark:border-gray-700"
      />
      <button type="submit" disabled={pendente || codigo.length !== 6} className="inline-flex items-center gap-1 rounded-lg border border-na-green px-3 py-1.5 text-sm font-semibold text-na-green-dark disabled:opacity-50 dark:text-emerald-400">
        <Link2 size={14} aria-hidden /> Conectar
      </button>
      {ok && <span className="text-sm text-na-green-dark dark:text-emerald-400">TV conectada.</span>}
      {erro && <span className="w-full text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</span>}
    </form>
  );
}

function CartaoTela({ schoolId, tela, origem }: { schoolId: string; tela: TelaResumo; origem: string }) {
  const inicial: DadosTela = { nome: tela.nome, publicos: tela.publicos, conteudos: tela.conteudos, orientacao: tela.orientacao };
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState(inicial);
  const [copiado, setCopiado] = useState(false);
  const { erro, pendente, rodar } = useAcao();
  const link = `${origem}/tv/${tela.token}`;
  const resumo = [
    tela.publicos.map((p) => PUBLICOS_TELA[p as PublicoTela] ?? p).join(" · "),
    tela.conteudos.length ? `+ ${tela.conteudos.map((c) => CONTEUDOS_TELA[c as ConteudoTela] ?? c).join(", ").toLowerCase()}` : null,
    tela.orientacao !== "auto" ? "TV vertical (girada)" : null,
  ].filter(Boolean);

  return (
    <li className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
      {editando ? (
        <div className="space-y-3">
          <CamposTela dados={dados} onChange={setDados} />
          <div className="flex gap-2">
            <button type="button" disabled={pendente} onClick={() => rodar(() => atualizarTela(schoolId, tela.id, dados), () => setEditando(false))} className={BOTAO}>
              Salvar
            </button>
            <button type="button" onClick={() => (setEditando(false), setDados(inicial))} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-bold">
              <Tv size={18} className="text-na-green dark:text-emerald-400" aria-hidden /> {tela.nome}
            </p>
            {resumo.map((r) => (
              <p key={r} className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {r}
              </p>
            ))}
          </div>
          <button type="button" onClick={() => setEditando(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-na-green-dark hover:bg-na-green-light dark:text-emerald-400 dark:hover:bg-emerald-950/40">
            <Pencil size={14} aria-hidden /> Editar
          </button>
        </div>
      )}

      <ConectarAqui schoolId={schoolId} telaId={tela.id} />

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-na-bg px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">{link}</code>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(link).then(() => (setCopiado(true), setTimeout(() => setCopiado(false), 2000)))}
          className="inline-flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-sm font-semibold text-white"
        >
          {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copiado ? "Copiado" : "Copiar link"}
        </button>
        <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold dark:border-gray-600">
          <ExternalLink size={14} aria-hidden /> Ver tela
        </a>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          disabled={pendente}
          onClick={() => confirm("Trocar o link? As TVs conectadas a esta tela voltam para a tela de conexão e precisam ser conectadas de novo.") && rodar(() => trocarLinkTela(schoolId, tela.id))}
          className="inline-flex items-center gap-1 font-semibold text-gray-600 hover:text-na-green-dark disabled:opacity-50 dark:text-gray-300"
        >
          <RefreshCw size={13} aria-hidden /> Trocar link
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => confirm(`Excluir a tela "${tela.nome}"?`) && rodar(() => excluirTela(schoolId, tela.id))}
          className="inline-flex items-center gap-1 font-semibold text-na-danger-dark hover:underline disabled:opacity-50 dark:text-na-danger-light"
        >
          <Trash2 size={13} aria-hidden /> Excluir
        </button>
      </div>
      {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
    </li>
  );
}

// ---------- Cartões da filial ----------

const OPCOES_TIPO = Object.entries(TIPOS_CARTAO) as [TipoCartao, (typeof TIPOS_CARTAO)[TipoCartao]][];
const VAZIO: DadosCartao = { tipo: "aviso", titulo: "", texto: "", link: "", ate: "" };

function CamposCartao({ dados, onChange }: { dados: DadosCartao; onChange: (d: DadosCartao) => void }) {
  const tipo = TIPOS_CARTAO[dados.tipo as TipoCartao] ?? TIPOS_CARTAO.aviso;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1">
        <span className="text-xs text-gray-500">Tipo</span>
        <select value={dados.tipo} onChange={(e) => onChange({ ...dados, tipo: e.target.value })} className={CAMPO}>
          {OPCOES_TIPO.map(([v, t]) => (
            <option key={v} value={v}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs text-gray-500">Mostrar até (opcional)</span>
        <input type="date" value={dados.ate} onChange={(e) => onChange({ ...dados, ate: e.target.value })} className={CAMPO} />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs text-gray-500">Título</span>
        <input value={dados.titulo} onChange={(e) => onChange({ ...dados, titulo: e.target.value })} maxLength={90} placeholder={tipo.exemploTitulo} className={CAMPO} />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs text-gray-500">Texto (opcional, até 220 letras)</span>
        <textarea value={dados.texto} onChange={(e) => onChange({ ...dados, texto: e.target.value })} maxLength={220} rows={2} className={CAMPO} />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs text-gray-500">Link do QR code (opcional)</span>
        <input value={dados.link} onChange={(e) => onChange({ ...dados, link: e.target.value })} inputMode="url" placeholder={tipo.exemploLink || "https://…"} className={CAMPO} />
      </label>
    </div>
  );
}

function ItemCartao({ schoolId, c }: { schoolId: string; c: CartaoResumo }) {
  const inicial: DadosCartao = { tipo: c.tipo, titulo: c.titulo, texto: c.texto ?? "", link: c.link ?? "", ate: c.ate ?? "" };
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState(inicial);
  const { erro, pendente, rodar } = useAcao();
  const vencido = c.ate && c.ate < new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return (
    <li className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      {editando ? (
        <>
          <CamposCartao dados={dados} onChange={setDados} />
          <div className="flex gap-2">
            <button type="button" disabled={pendente} onClick={() => rodar(() => atualizarCartao(schoolId, c.id, dados), () => setEditando(false))} className={BOTAO}>
              Salvar
            </button>
            <button type="button" onClick={() => (setEditando(false), setDados(inicial))} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-na-green-dark dark:text-emerald-400">
              {TIPOS_CARTAO[c.tipo as TipoCartao]?.rotulo ?? c.tipo}
              {c.ate && <span className="ml-2 font-normal normal-case text-gray-500">{vencido ? "encerrado" : `até ${c.ate.split("-").reverse().join("/")}`}</span>}
            </p>
            <p className="font-semibold">{c.titulo}</p>
            {c.texto && <p className="text-sm text-gray-600 dark:text-gray-300">{c.texto}</p>}
            {c.link && <p className="truncate text-xs text-gray-500">{c.link}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setEditando(true)} aria-label="Editar cartão" className="rounded-lg p-1.5 text-na-green-dark hover:bg-na-green-light dark:text-emerald-400 dark:hover:bg-emerald-950/40">
              <Pencil size={15} aria-hidden />
            </button>
            <button type="button" disabled={pendente} onClick={() => confirm(`Excluir o cartão "${c.titulo}"?`) && rodar(() => excluirCartao(schoolId, c.id))} aria-label="Excluir cartão" className="rounded-lg p-1.5 text-na-danger-dark hover:bg-red-50 disabled:opacity-50 dark:text-na-danger-light dark:hover:bg-red-950/40">
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
    </li>
  );
}

function CartoesFilial({ schoolId, cartoes }: { schoolId: string; cartoes: CartaoResumo[] }) {
  const [abrindo, setAbrindo] = useState(false);
  const [novo, setNovo] = useState(VAZIO);
  const { erro, pendente, rodar } = useAcao();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-bold">Avisos e cartões da filial</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">Aparecem nas TVs que mostram o conteúdo correspondente (matrículas abertas; avisos; Círculo de Amigos e doações; Instagram e Acrópole Play).</p>
      </div>
      {cartoes.length > 0 && (
        <ul className="space-y-2">
          {cartoes.map((c) => (
            <ItemCartao key={c.id} schoolId={schoolId} c={c} />
          ))}
        </ul>
      )}
      {abrindo ? (
        <form
          className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
          onSubmit={(e) => {
            e.preventDefault();
            rodar(() => criarCartao(schoolId, novo), () => (setNovo(VAZIO), setAbrindo(false)));
          }}
        >
          <CamposCartao dados={novo} onChange={setNovo} />
          <div className="flex gap-2">
            <button type="submit" disabled={pendente} className={BOTAO}>
              {pendente ? "Salvando…" : "Criar cartão"}
            </button>
            <button type="button" onClick={() => setAbrindo(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
          {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setAbrindo(true)} className="inline-flex items-center gap-1 rounded-lg border border-na-green px-3 py-2 text-sm font-semibold text-na-green-dark dark:text-emerald-400">
          <Plus size={15} aria-hidden /> Novo cartão
        </button>
      )}
    </section>
  );
}

/** Telas de TV da filial (pedido do usuário 2026-10-24): um link por TV, com os públicos e conteúdos escolhidos. */
export function TelasTab({ schoolId, telas, cartoes, frases, origem }: { schoolId: string; telas: TelaResumo[]; cartoes: CartaoResumo[]; frases: Parameters<typeof FrasesTela>[0]; origem: string }) {
  const [dados, setDados] = useState<DadosTela>({ nome: "", publicos: ["aberto_publico", "todos_ativos"], conteudos: CONTEUDOS_PADRAO, orientacao: "auto" });
  const { erro, pendente, rodar } = useAcao();
  const enderecoTv = `${origem.replace(/^https?:\/\//, "")}/tv`;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
        <p>Cada TV mostra os eventos dos próximos 30 dias, trocando a cada 10 segundos, com os conteúdos escolhidos entre eles. A tela se atualiza sozinha.</p>
        <p>
          <strong className="text-gray-800 dark:text-gray-100">Para ligar uma TV só com o controle remoto:</strong> no navegador da TV, abra <strong className="text-na-green-dark dark:text-emerald-400">{enderecoTv}</strong>. Aparece um código: leia o QR com o celular ou digite o código em “Conectar uma TV” abaixo. A TV lembra a escolha ao ser religada.
        </p>
      </div>

      <form
        className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
        onSubmit={(e) => {
          e.preventDefault();
          rodar(() => criarTela(schoolId, dados), () => setDados({ ...dados, nome: "" }));
        }}
      >
        <h2 className="font-bold">Nova tela</h2>
        <CamposTela dados={dados} onChange={setDados} />
        <button type="submit" disabled={pendente} className={BOTAO}>
          {pendente ? "Criando…" : "Criar tela"}
        </button>
        {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
      </form>

      {telas.length > 0 ? (
        <ul className="space-y-3">
          {telas.map((t) => (
            <CartaoTela key={`${t.id}-${t.token}`} schoolId={schoolId} tela={t} origem={origem} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Nenhuma tela criada ainda.</p>
      )}

      <CartoesFilial schoolId={schoolId} cartoes={cartoes} />

      <FrasesTela {...frases} />
    </div>
  );
}
