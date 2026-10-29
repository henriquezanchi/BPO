"use client";

import { encerrarOportunidade, responderInteresse, salvarOportunidade, type DadosOportunidade } from "@/lib/actions/oportunidades-actions";
import { formatDateBR, whatsappHref } from "@/lib/format";
import { AREAS_OPORTUNIDADE, quandoDaOportunidade } from "@/lib/oportunidades-comum";
import { CalendarClock, Check, Clock, HandHeart, Loader2, MessageCircle, Pencil, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Gestão das oportunidades de voluntariado (pedido do usuário 2026-10-29). Dados e permissões: voluntario/oportunidades/page.tsx. */
type Interesse = { id: string; nome: string; whatsapp: string; nivel: string | null; recado: string | null; status: string; em: string };
type Oportunidade = Omit<DadosOportunidade, "schoolId"> & {
  id: string;
  responsavel: string;
  aberta: boolean;
  encerrada: boolean;
  interesses: Interesse[];
};
type Oferta = { id: string; nome: string; whatsapp: string; secretarias: string[]; em: string };
type Opcao = { id: string; name: string };

const campo = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const rotulo = "text-[12px] font-semibold text-gray-700 dark:text-gray-300";
const botao = "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:opacity-60";
const nomeCurto = (nome: string) => nome.split(" ").slice(0, 2).join(" ");

export function OportunidadesGestao(props: {
  schoolId: string;
  escolas: Opcao[];
  hoje: string;
  podeCadastrar: boolean;
  euId: string;
  oportunidades: Oportunidade[];
  grupos: (Opcao & { tipo: string })[];
  responsaveis: Opcao[];
  ofertas: Oferta[];
  mostrarOfertas: boolean;
}) {
  const [editando, setEditando] = useState<Oportunidade | "nova" | null>(null);
  const abertas = props.oportunidades.filter((o) => o.aberta);
  const outras = props.oportunidades.filter((o) => !o.aberta);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {props.escolas.length > 1 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Filial">
          {props.escolas.map((e) => (
            <Link
              key={e.id}
              href={`/voluntario/oportunidades?filial=${e.id}`}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium ${e.id === props.schoolId ? "border-na-green bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
            >
              {e.name.replace(/^Nova Acrópole - /, "")}
            </Link>
          ))}
        </nav>
      )}

      {props.podeCadastrar &&
        (editando ? (
          <Formulario {...props} inicial={editando === "nova" ? null : editando} fechar={() => setEditando(null)} />
        ) : (
          <button onClick={() => setEditando("nova")} className={`${botao} self-start bg-na-green px-4 py-2.5 text-sm text-white hover:bg-na-green-dark`}>
            <Plus size={16} /> Nova oportunidade
          </button>
        ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Abertas ({abertas.length})</h2>
        {abertas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nenhuma oportunidade aberta. Enquanto não houver, os membros só conseguem se oferecer por área.
          </p>
        )}
        {abertas.map((op) => (
          <Cartao key={op.id} op={op} grupos={props.grupos} editar={props.podeCadastrar ? () => setEditando(op) : undefined} />
        ))}
      </section>

      {outras.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Encerradas ou com prazo vencido ({outras.length})</summary>
          <div className="mt-3 flex flex-col gap-3">
            {outras.map((op) => (
              <Cartao key={op.id} op={op} grupos={props.grupos} editar={props.podeCadastrar ? () => setEditando(op) : undefined} />
            ))}
          </div>
        </details>
      )}

      {props.mostrarOfertas && (
        <details className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <summary className="cursor-pointer text-sm font-bold text-gray-900 dark:text-gray-100">
            Ofertas por área <span className="font-normal text-gray-500 dark:text-gray-400">({props.ofertas.length} nos últimos 6 meses)</span>
          </summary>
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">Quem se ofereceu pelo quadro Voluntariado escolhendo áreas, sem uma oportunidade específica. Vale um contato.</p>
          {props.ofertas.length === 0 ? (
            <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">Ninguém por enquanto.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {props.ofertas.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{nomeCurto(o.nome)}</span>
                    <span className="block text-[12px] text-gray-500 dark:text-gray-400">
                      {o.secretarias.join(", ")} · {formatDateBR(new Date(o.em))}
                    </span>
                  </span>
                  {o.whatsapp && <Whats numero={o.whatsapp} texto={`Olá, ${o.nome.split(" ")[0]}! Vi que você se ofereceu para ajudar na escola.`} />}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </div>
  );
}

function Whats({ numero, texto }: { numero: string; texto: string }) {
  return (
    <a href={whatsappHref(numero, texto)} target="_blank" rel="noreferrer" className={`${botao} border border-gray-200 text-gray-700 hover:border-na-green dark:border-gray-700 dark:text-gray-300`}>
      <MessageCircle size={13} /> WhatsApp
    </a>
  );
}

function Cartao({ op, grupos, editar }: { op: Oportunidade; grupos: (Opcao & { tipo: string })[]; editar?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const aceitos = op.interesses.filter((i) => i.status === "aceito").length;
  const pendentes = op.interesses.filter((i) => i.status === "pendente").length;
  const grupo = grupos.find((g) => g.id === op.grupoId)?.name;

  function agir(fn: () => Promise<{ ok: true; grupo?: string | null; foraDoGrupo?: string | null } | { ok: false; error: string }>) {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setErro(r.error);
      if (r.grupo) setAviso(`Entrou no grupo ${r.grupo}.`);
      else if (r.foraDoGrupo) setAviso(`Aceito, mas não entrou no grupo: ${r.foraDoGrupo}`);
      router.refresh();
    });
  }

  return (
    <article className={`rounded-2xl border p-4 ${op.aberta ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-[10px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
            {op.area}
            <span className="flex items-center gap-1 font-semibold tracking-normal text-gray-500 normal-case dark:text-gray-400">
              {op.tipo === "pontual" ? <CalendarClock size={11} /> : <Clock size={11} />}
              {quandoDaOportunidade(op)}
            </span>
            {!op.aberta && <span className="rounded-full bg-gray-200 px-2 py-0.5 tracking-normal text-gray-600 normal-case dark:bg-gray-800 dark:text-gray-300">{op.encerrada ? "Encerrada" : "Prazo vencido"}</span>}
          </p>
          <h3 className="mt-1 text-[15px] font-bold text-gray-900 dark:text-gray-100">{op.titulo}</h3>
        </div>
        <div className="flex gap-1">
          {editar && (
            <button onClick={editar} className={`${botao} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`}>
              <Pencil size={13} /> Editar
            </button>
          )}
          <button
            disabled={isPending}
            onClick={() => agir(() => encerrarOportunidade(op.id, !op.encerrada))}
            className={`${botao} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`}
          >
            {op.encerrada ? "Reabrir" : "Encerrar"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-gray-600 dark:text-gray-400">{op.descricao}</p>
      <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">
        Responsável: {nomeCurto(op.responsavel)}
        {op.vagas != null ? ` · ${aceitos} de ${op.vagas} vagas preenchidas` : aceitos ? ` · ${aceitos} aceito${aceitos > 1 ? "s" : ""}` : ""}
        {grupo && ` · quem for aceito entra em ${grupo}`}
        {op.abertaAte && ` · aberta até ${formatDateBR(new Date(`${op.abertaAte}T00:00:00Z`))}`}
      </p>

      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          <Users size={12} /> Interessados ({op.interesses.length}){pendentes > 0 && <span className="rounded-full bg-na-gold/20 px-2 py-0.5 tracking-normal text-na-gold-dark normal-case dark:text-amber-300">{pendentes} aguardando</span>}
        </h4>
        {op.interesses.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">Ninguém se ofereceu ainda.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {op.interesses.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                    {nomeCurto(i.nome)} {i.nivel && <span className="font-normal text-gray-500 dark:text-gray-400">· {i.nivel}</span>}
                  </span>
                  {i.recado && <span className="block text-[12px] text-gray-600 italic dark:text-gray-400">“{i.recado}”</span>}
                  <span className="block text-[11px] text-gray-400">Ofereceu-se em {formatDateBR(new Date(i.em))}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {i.status === "pendente" ? (
                    <>
                      <button disabled={isPending} onClick={() => agir(() => responderInteresse(i.id, "aceito"))} className={`${botao} bg-na-green text-white hover:bg-na-green-dark`}>
                        <Check size={13} /> Aceitar
                      </button>
                      <button disabled={isPending} onClick={() => agir(() => responderInteresse(i.id, "recusado"))} className={`${botao} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`}>
                        <X size={13} /> Recusar
                      </button>
                    </>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${i.status === "aceito" ? "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
                    >
                      {i.status === "aceito" ? "Aceito" : i.status === "recusado" ? "Recusado" : "Desistiu"}
                    </span>
                  )}
                  {i.whatsapp && i.status !== "recusado" && <Whats numero={i.whatsapp} texto={`Olá, ${i.nome.split(" ")[0]}! Obrigado por se oferecer para “${op.titulo}”.`} />}
                </span>
              </li>
            ))}
          </ul>
        )}
        {aviso && <p className="mt-2 text-[12px] text-na-success-dark dark:text-emerald-300">{aviso}</p>}
        {erro && <p className="mt-2 text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      </div>
    </article>
  );
}

function Formulario({
  schoolId,
  hoje,
  euId,
  grupos,
  responsaveis,
  inicial,
  fechar,
}: {
  schoolId: string;
  hoje: string;
  euId: string;
  grupos: (Opcao & { tipo: string })[];
  responsaveis: Opcao[];
  inicial: Oportunidade | null;
  fechar: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [d, setD] = useState<DadosOportunidade>(
    inicial
      ? (({ titulo, area, descricao, tipo, data, horario, vagas, abertaAte, grupoId, responsavelId }) => ({ schoolId, titulo, area, descricao, tipo, data, horario, vagas, abertaAte, grupoId, responsavelId }))(inicial)
      : { schoolId, titulo: "", area: AREAS_OPORTUNIDADE[0], descricao: "", tipo: "pontual", data: null, horario: null, vagas: null, abertaAte: null, grupoId: null, responsavelId: euId },
  );
  const muda = <K extends keyof DadosOportunidade>(k: K, v: DadosOportunidade[K]) => setD((x) => ({ ...x, [k]: v }));

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await salvarOportunidade(d);
      if (!r.ok) return setErro(r.error);
      fechar();
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4 rounded-2xl border border-na-green/30 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-gray-900">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
        <HandHeart size={18} className="text-na-green" /> {inicial ? "Editar oportunidade" : "Nova oportunidade"}
      </h2>
      <label className={rotulo}>
        Título
        <input required maxLength={120} value={d.titulo} onChange={(e) => muda("titulo", e.target.value)} placeholder="Ex.: Recepção na palestra de sábado" className={campo} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={rotulo}>
          Área
          <select value={d.area} onChange={(e) => muda("area", e.target.value)} className={campo}>
            {AREAS_OPORTUNIDADE.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Vagas <span className="font-normal text-gray-400">(em branco = sem limite)</span>
          <input
            type="number"
            min={1}
            max={200}
            value={d.vagas ?? ""}
            onChange={(e) => muda("vagas", e.target.value ? Number(e.target.value) : null)}
            className={campo}
          />
        </label>
      </div>
      <label className={rotulo}>
        O que a pessoa vai fazer
        <textarea required maxLength={1500} rows={3} value={d.descricao} onChange={(e) => muda("descricao", e.target.value)} placeholder="Tarefas, se precisa de alguma habilidade, onde é…" className={campo} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className={rotulo}>Quando</legend>
        <div className="flex gap-2">
          {(["pontual", "continua"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => muda("tipo", t)}
              aria-pressed={d.tipo === t}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${d.tipo === t ? "border-na-green bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}
            >
              {t === "pontual" ? "Um dia" : "Contínua"}
            </button>
          ))}
        </div>
        {d.tipo === "pontual" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={rotulo}>
              Data <span className="font-normal text-gray-400">(em branco = a combinar)</span>
              <input type="date" min={inicial ? undefined : hoje} value={d.data ?? ""} onChange={(e) => muda("data", e.target.value || null)} className={campo} />
            </label>
            <label className={rotulo}>
              Horário
              <input maxLength={80} value={d.horario ?? ""} onChange={(e) => muda("horario", e.target.value || null)} placeholder="Ex.: 19h às 21h" className={campo} />
            </label>
          </div>
        ) : (
          <label className={rotulo}>
            Dias e horários
            <input required maxLength={80} value={d.horario ?? ""} onChange={(e) => muda("horario", e.target.value || null)} placeholder="Ex.: Quintas, 19h às 21h" className={campo} />
          </label>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={rotulo}>
          Aberta até <span className="font-normal text-gray-400">(opcional)</span>
          <input type="date" min={hoje} value={d.abertaAte ?? ""} onChange={(e) => muda("abertaAte", e.target.value || null)} className={campo} />
        </label>
        {responsaveis.length > 1 ? (
          <label className={rotulo}>
            Responsável <span className="font-normal text-gray-400">(recebe os interessados)</span>
            <select value={d.responsavelId} onChange={(e) => muda("responsavelId", e.target.value)} className={campo}>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className={rotulo}>
            Responsável
            <span className="mt-1 block py-2 text-sm font-normal text-gray-600 dark:text-gray-400">Você recebe os interessados.</span>
          </p>
        )}
      </div>
      {grupos.length > 0 && (
        <label className={rotulo}>
          Grupo <span className="font-normal text-gray-400">(opcional: quem for aceito entra nele)</span>
          <select value={d.grupoId ?? ""} onChange={(e) => muda("grupoId", e.target.value || null)} className={campo}>
            <option value="">Nenhum</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {erro && <p className="text-[13px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      <div className="flex gap-2">
        <button disabled={isPending} className={`${botao} bg-na-green px-4 py-2.5 text-sm text-white hover:bg-na-green-dark`}>
          {isPending && <Loader2 size={14} className="animate-spin" />} {inicial ? "Salvar" : "Publicar"}
        </button>
        <button type="button" onClick={fechar} className={`${botao} px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
