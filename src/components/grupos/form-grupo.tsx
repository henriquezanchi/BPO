"use client";

import { SeletorPessoas, type PessoaOpcao } from "@/components/grupos/seletor-pessoas";
import { buscarCandidatos, buscarResponsaveis, criarGrupo, editarGrupo } from "@/lib/actions/grupos-actions";
import { createGroupMeetings } from "@/lib/actions/group-meeting-actions";
import { ehDeAlunos, type TipoDoPortal } from "@/lib/grupos-comum";
import { Loader2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

export type CamposIniciais = {
  nome: string;
  descricao: string | null;
  modalidade: string | null;
  local: string | null;
  linkOnline: string | null;
  permiteAlunos: boolean;
  programa: string | null;
};

const CAMPO = "min-h-10 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-[13px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
const ROTULO = "flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const FREQUENCIA = { "1": "semanal", "2": "quinzenal", "4": "a cada 4 semanas" } as const;
const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Próxima data (AAAA-MM-DD, no relógio do aparelho) do dia da semana pedido; hoje só se o horário ainda não passou. */
function proximaData(dia: number, inicio: string, agora = new Date()) {
  const hora = `${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`;
  let falta = (dia - agora.getDay() + 7) % 7;
  if (falta === 0 && inicio <= hora) falta = 7;
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + falta);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

const TEXTOS = {
  GAF: { titulo: "Novo GAF", nome: "Nome do GAF", exemploNome: "GAF de terça à noite", resp: "Coordenação", respAjuda: "Quem conduz os encontros (instrutor, dirigente).", integ: "Participantes" },
  SEC: { titulo: "Nova secretaria", nome: "Nome da secretaria", exemploNome: "Escolástica", resp: "Secretário(a) e pró-secretários", respAjuda: "Quem responde pela secretaria.", integ: "Equipe de voluntários" },
  GDVE: { titulo: "Novo GDVE", nome: "Nome do GDVE", exemploNome: "GDVE de quinta", resp: "Coordenação (além de você)", respAjuda: "Somente FV.", integ: "Participantes (somente FV)" },
  ESTUDO: { titulo: "Novo grupo de estudo", nome: "Nome do grupo", exemploNome: "Estudo do Bhagavad Gita", resp: "Coordenação", respAjuda: "Quem conduz os encontros (instrutor, dirigente).", integ: "Participantes" },
  PED: { titulo: "Nova turma de pedagogos", nome: "Nome da turma", exemploNome: "Pedagogos de Barra do Garças", resp: "Instrutor dos pedagogos", respAjuda: "Quem recebe as apresentações e revisa os planos de aula.", integ: "Pedagogos (instrutores)" },
  LEITURA: { titulo: "Nova leitura comentada", nome: "Nome da leitura", exemploNome: "Leitura comentada de A Voz do Silêncio", resp: "Coordenação", respAjuda: "Quem conduz a leitura.", integ: "Participantes" },
} as const;

/**
 * Criação e edição de GAF, secretaria e GDVE. As regras (quem pode entrar,
 * quem pode criar) são reconferidas no servidor — grupos-actions.ts.
 */
export function FormGrupo({
  tipo,
  schoolId,
  grupoId,
  inicial,
  sugestaoNome,
  onSalvo,
  onCancelar,
}: {
  tipo: TipoDoPortal;
  schoolId: string;
  grupoId?: string;
  inicial?: CamposIniciais;
  sugestaoNome?: string;
  onSalvo: (id: string) => void;
  onCancelar?: () => void;
}) {
  const t = TEXTOS[tipo];
  const editando = !!grupoId;
  const [modalidade, setModalidade] = useState(inicial?.modalidade ?? (tipo === "SEC" ? "" : "presencial"));
  const [permiteAlunos, setPermiteAlunos] = useState(inicial?.permiteAlunos ?? false);
  const [responsaveis, setResponsaveis] = useState<PessoaOpcao[]>([]);
  const [integrantes, setIntegrantes] = useState<PessoaOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  // Dia e horário dos encontros na criação (pedido do usuário 2026-10-29); depois, em "Reuniões do grupo".
  const [dia, setDia] = useState("");
  const [inicio, setInicio] = useState("19:00");
  const [fim, setFim] = useState("20:00");
  const [frequencia, setFrequencia] = useState<keyof typeof FREQUENCIA>("1");

  const buscarResp = useCallback(
    (termo: string) => (tipo === "GDVE" ? buscarCandidatos({ schoolId, tipo, permiteAlunos: false }, termo) : buscarResponsaveis(schoolId, termo)),
    [schoolId, tipo],
  );
  const buscarInteg = useCallback((termo: string) => buscarCandidatos({ schoolId, tipo, permiteAlunos }, termo), [schoolId, tipo, permiteAlunos]);

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const campos = {
      nome: String(f.get("nome") ?? ""),
      descricao: String(f.get("descricao") ?? ""),
      modalidade,
      local: String(f.get("local") ?? ""),
      linkOnline: String(f.get("linkOnline") ?? ""),
      permiteAlunos,
      programa: String(f.get("programa") ?? ""),
    };
    setErro(null);
    if (!editando && dia && fim <= inicio) return setErro("O término dos encontros deve ser depois do início.");
    iniciar(async () => {
      if (editando) {
        const r = await editarGrupo(grupoId!, campos);
        return r.ok ? onSalvo(grupoId!) : setErro(r.error);
      }
      const r = await criarGrupo({ ...campos, schoolId, tipo, responsaveis: responsaveis.map((p) => p.id), integrantes: integrantes.map((p) => p.id) });
      if (!r.ok) return setErro(r.error);
      if (dia) {
        const data = proximaData(Number(dia), inicio);
        // Se a agenda falhar, o grupo já existe: os encontros podem ser cadastrados em "Reuniões do grupo".
        await createGroupMeetings(r.id, {
          title: `Encontro ${FREQUENCIA[frequencia]}`,
          startsLocal: `${data}T${inicio}`,
          endsLocal: `${data}T${fim}`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          weekly: true,
          intervalWeeks: Number(frequencia),
          publicDetails: "",
          internalDetails: "",
          fullUniform: false,
        }).catch(() => null);
      }
      return onSalvo(r.id);
    });
  }

  const mostraLocal = modalidade === "presencial" || modalidade === "misto";
  const mostraLink = modalidade === "online" || modalidade === "misto";

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {!editando && <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t.titulo}</h3>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className={ROTULO}>
          {t.nome}
          <input name="nome" required maxLength={80} defaultValue={inicial?.nome ?? sugestaoNome ?? ""} placeholder={t.exemploNome} className={CAMPO} />
        </label>
        <label className={ROTULO}>
          {tipo === "SEC" ? "Reuniões da secretaria" : "Como são os encontros"}
          <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className={CAMPO}>
            {tipo === "SEC" && <option value="">A definir</option>}
            <option value="presencial">Presenciais</option>
            <option value="online">Online</option>
            <option value="misto">Presenciais e online</option>
          </select>
        </label>
        {mostraLocal && (
          <label className={ROTULO}>
            Local
            <input name="local" maxLength={160} defaultValue={inicial?.local ?? ""} placeholder="Sala 2, sede da filial" className={CAMPO} />
          </label>
        )}
        {mostraLink && (
          <label className={ROTULO}>
            Link do encontro online
            <input name="linkOnline" type="url" maxLength={300} defaultValue={inicial?.linkOnline ?? ""} placeholder="https://meet.google.com/…" className={CAMPO} />
          </label>
        )}
      </div>

      {!editando && (
        <fieldset className="grid gap-4 md:grid-cols-4">
          <label className={ROTULO}>
            {tipo === "SEC" ? "Dia das reuniões" : "Dia dos encontros"}
            <select value={dia} onChange={(e) => setDia(e.target.value)} className={CAMPO}>
              <option value="">A definir</option>
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          {dia && (
            <>
              <label className={ROTULO}>
                Início
                <input type="time" required value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO} />
              </label>
              <label className={ROTULO}>
                Término
                <input type="time" required value={fim} onChange={(e) => setFim(e.target.value)} className={CAMPO} />
              </label>
              <label className={ROTULO}>
                Frequência
                <select value={frequencia} onChange={(e) => setFrequencia(e.target.value as keyof typeof FREQUENCIA)} className={CAMPO}>
                  {Object.entries(FREQUENCIA).map(([v, rotulo]) => (
                    <option key={v} value={v}>
                      {rotulo[0].toUpperCase() + rotulo.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </fieldset>
      )}

      <label className={ROTULO}>
        {tipo === "SEC" ? "O que a secretaria faz" : "Sobre o grupo"}
        <textarea name="descricao" rows={2} maxLength={2000} defaultValue={inicial?.descricao ?? ""} className={CAMPO} />
      </label>

      {ehDeAlunos(tipo) && (
        <>
          <label className="flex items-start gap-2.5 rounded-lg border border-gray-200 p-3 text-[13px] text-gray-800 dark:border-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={permiteAlunos} onChange={(e) => setPermiteAlunos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-na-green" />
            <span>
              <strong>Alunos também podem participar</strong>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400">Desmarcado, o grupo é só para membros (2º nível em diante).</span>
            </span>
          </label>
          <label className={ROTULO}>
            {tipo === "LEITURA" ? "Obra e trechos" : "Programa de estudos"}
            <textarea
              name="programa"
              rows={4}
              maxLength={8000}
              defaultValue={inicial?.programa ?? ""}
              placeholder="Temas, leituras e a sequência dos encontros. Pode colar o programa ou um link para ele."
              className={CAMPO}
            />
          </label>
        </>
      )}

      {!editando && (
        <div className="grid gap-4 md:grid-cols-2">
          <SeletorPessoas rotulo={t.resp} ajuda={t.respAjuda} buscar={buscarResp} selecionados={responsaveis} onChange={setResponsaveis} />
          <SeletorPessoas
            rotulo={t.integ}
            ajuda={tipo === "PED" ? "Qualquer pessoa da filial. Em branco: entram todos os instrutores ativos." : ehDeAlunos(tipo) ? (permiteAlunos ? "Membros e alunos ativos da filial." : "Membros ativos da filial (2º nível em diante).") : undefined}
            buscar={buscarInteg}
            selecionados={integrantes}
            onChange={setIntegrantes}
            bloqueados={responsaveis.map((r) => r.id)}
          />
        </div>
      )}

      {tipo === "GDVE" && !editando && <p className="text-[11px] text-gray-500 dark:text-gray-400">Você entra como responsável. Só FV veem este grupo.</p>}
      {erro && (
        <p role="alert" className="text-[12px] text-na-danger-dark dark:text-red-400">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={pendente} className="flex min-h-10 items-center gap-2 rounded-lg bg-na-green px-4 text-[13px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60">
          {pendente && <Loader2 size={14} className="animate-spin" />}
          {editando ? "Salvar alterações" : "Criar"}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="min-h-10 rounded-lg px-3 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
