"use client";

import { cancelarAtendimento, marcarAtendimento } from "@/lib/actions/atendimento-actions";
import { CalendarClock, CheckCircle2, Loader2, MapPin, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agruparPorDia, horaDe, MODALIDADE_ROTULO, rotuloDia } from "./comum";

type Minha = { id: string; inicio: string; instrutor: string; modalidade: string; local: string | null; linkOnline: string | null; assunto: string | null };
type Instrutor = { id: string; nome: string; turmas: string[]; jaMarcado: boolean; horarios: { inicio: string; modalidade: string; local: string | null }[] };

const CARTAO = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";
const TITULO = "text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300";
const CAMPO = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-na-green dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";
const DIAS_MOSTRADOS = 6;

export function MarcarAtendimento({ fuso, minhas, instrutores }: { fuso: string; minhas: Minha[]; instrutores: Instrutor[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [escolha, setEscolha] = useState<{ instrutor: Instrutor; inicio: string; modalidade: string } | null>(null);
  const [assunto, setAssunto] = useState("");
  const [modalidade, setModalidade] = useState("presencial");

  function rodar(acao: () => Promise<{ ok: boolean; error?: string }>, sucesso: string) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) return setErro(r.error ?? "Não foi possível agora.");
      setFeito(sucesso);
      setEscolha(null);
      setAssunto("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {erro && <p role="alert" className="rounded-xl bg-na-danger-light px-3 py-2 text-[13px] text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">{erro}</p>}
      {feito && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-na-green-light px-3 py-2 text-[13px] font-semibold text-na-green-dark dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={16} /> {feito}
        </p>
      )}

      {minhas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={TITULO}>Minhas conversas</h2>
          {minhas.map((m) => (
            <MinhaConversa key={m.id} m={m} fuso={fuso} pendente={pendente} cancelar={(motivo) => rodar(() => cancelarAtendimento(m.id, motivo), "Conversa cancelada. O instrutor foi avisado.")} />
          ))}
        </section>
      )}

      {instrutores.length === 0 ? (
        <p className={`${CARTAO} text-center text-[13px] text-gray-600 dark:text-gray-300`}>
          Os instrutores aparecem aqui quando você está numa turma no Portal. Se já está numa turma e não vê ninguém, fale com a secretaria da escola.
        </p>
      ) : (
        instrutores.map((i) => {
          const dias = [...agruparPorDia(i.horarios, fuso).entries()].slice(0, DIAS_MOSTRADOS);
          return (
            <section key={i.id} className={`${CARTAO} flex flex-col gap-3`}>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{i.nome}</h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{i.turmas.join(" · ")}</p>
              </div>
              {i.jaMarcado ? (
                <p className="text-[12px] text-gray-600 dark:text-gray-300">Você já tem uma conversa marcada com este instrutor. Depois dela, pode marcar outra.</p>
              ) : dias.length === 0 ? (
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Ainda sem horários abertos nas próximas semanas.</p>
              ) : (
                dias.map(([dia, lista]) => (
                  <div key={dia} className="flex flex-col gap-1.5">
                    <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">{rotuloDia(lista[0].inicio, fuso)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lista.map((h) => {
                        const ativo = escolha?.instrutor.id === i.id && escolha.inicio === h.inicio;
                        return (
                          <button
                            key={h.inicio}
                            onClick={() => {
                              setFeito(null);
                              setEscolha(ativo ? null : { instrutor: i, inicio: h.inicio, modalidade: h.modalidade });
                              setModalidade(h.modalidade === "online" ? "online" : "presencial");
                            }}
                            className={`min-h-9 rounded-lg border px-3 text-[13px] font-semibold tabular-nums transition ${ativo ? "border-na-green bg-na-green text-white" : "border-na-green/50 text-na-green-dark hover:bg-na-green-light/40 dark:text-emerald-400"}`}
                          >
                            {horaDe(h.inicio, fuso)}
                          </button>
                        );
                      })}
                    </div>
                    {escolha?.instrutor.id === i.id && diaDeEscolha(escolha.inicio, lista) && (
                      <div className="mt-1 flex flex-col gap-2 rounded-xl border border-na-green/40 bg-na-green-light/30 p-3 dark:bg-emerald-950/20">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">
                          {rotuloDia(escolha.inicio, fuso)} às {horaDe(escolha.inicio, fuso)} com {i.nome.split(" ")[0]}
                        </p>
                        {escolha.modalidade === "ambos" ? (
                          <div className="flex gap-2 text-[12px] font-semibold">
                            {["presencial", "online"].map((m) => (
                              <button key={m} type="button" onClick={() => setModalidade(m)} className={`rounded-lg border px-3 py-1.5 ${modalidade === m ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200"}`}>
                                {MODALIDADE_ROTULO[m]}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[12px] text-gray-600 dark:text-gray-300">{MODALIDADE_ROTULO[escolha.modalidade]}</p>
                        )}
                        <textarea value={assunto} onChange={(e) => setAssunto(e.target.value)} rows={2} maxLength={500} placeholder="Sobre o que quer conversar? (opcional, só o instrutor vê)" className={CAMPO} />
                        <button
                          disabled={pendente}
                          onClick={() => rodar(() => marcarAtendimento(i.id, escolha.inicio, assunto, modalidade), "Conversa marcada! Está na sua Agenda.")}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-na-green text-[14px] font-bold text-white hover:bg-na-green-dark disabled:opacity-60"
                        >
                          {pendente && <Loader2 size={15} className="animate-spin" />} Marcar conversa
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

const diaDeEscolha = (inicio: string, lista: { inicio: string }[]) => lista.some((h) => h.inicio === inicio);

function MinhaConversa({ m, fuso, pendente, cancelar }: { m: Minha; fuso: string; pendente: boolean; cancelar: (motivo: string) => void }) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  return (
    <article className={`${CARTAO} flex flex-col gap-1.5 !border-na-green/40`}>
      <p className="flex items-center gap-1.5 text-[14px] font-bold text-gray-900 dark:text-gray-100">
        <CalendarClock size={15} className="text-na-green" /> {rotuloDia(m.inicio, fuso)} às {horaDe(m.inicio, fuso)}
      </p>
      <p className="text-[13px] text-gray-700 dark:text-gray-200">com {m.instrutor}</p>
      <p className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
        {m.modalidade === "online" ? <Video size={12} /> : <MapPin size={12} />}
        {MODALIDADE_ROTULO[m.modalidade]}
        {m.local ? ` · ${m.local}` : ""}
      </p>
      {m.linkOnline && (
        <a href={m.linkOnline} target="_blank" rel="noopener noreferrer" className="w-fit text-[12px] font-semibold text-na-green-dark underline dark:text-emerald-400">
          Entrar na chamada
        </a>
      )}
      {cancelando ? (
        <div className="flex flex-col gap-2">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional, o instrutor recebe)" maxLength={300} className={CAMPO} />
          <div className="flex justify-end gap-2 text-[12px] font-semibold">
            <button onClick={() => setCancelando(false)} className="px-2 py-1 text-gray-600 dark:text-gray-300">Voltar</button>
            <button disabled={pendente} onClick={() => cancelar(motivo)} className="rounded-lg bg-red-600 px-3 py-1.5 text-white">Cancelar conversa</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCancelando(true)} className="w-fit text-[12px] font-semibold text-gray-500 hover:underline dark:text-gray-400">Cancelar</button>
      )}
    </article>
  );
}
