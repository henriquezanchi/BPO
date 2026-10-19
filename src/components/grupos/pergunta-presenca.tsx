"use client";

import { registrarPresenca } from "@/lib/actions/grupos-actions";
import { useState, useTransition } from "react";

const CAMPO = "min-h-10 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-[13px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

/** "Você participou?" — motivo opcional e "prefiro não informar". Também usado nos avisos do Portal. */
export function PerguntaPresenca({
  meetingId,
  atual,
  onSalvo,
}: {
  meetingId: string;
  atual: { participou: boolean; motivo: string | null; naoInformou: boolean } | null;
  onSalvo?: () => void;
}) {
  const [resposta, setResposta] = useState(atual);
  const [motivoAberto, setMotivoAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  function enviar(participou: boolean, naoInformou = false) {
    setErro(null);
    iniciar(async () => {
      const r = await registrarPresenca(meetingId, participou, participou || naoInformou ? null : motivo, naoInformou);
      if (!r.ok) return setErro(r.error);
      setResposta({ participou, motivo: participou || naoInformou ? null : motivo.trim() || null, naoInformou });
      setMotivoAberto(false);
      onSalvo?.();
    });
  }
  if (resposta && !motivoAberto)
    return (
      <p className="text-[12px] text-gray-600 dark:text-gray-400">
        {resposta.participou ? "✓ Você participou." : `Você não participou${resposta.motivo ? `: ${resposta.motivo}` : "."}`}{" "}
        <button onClick={() => (setResposta(null), setMotivo(""))} className="font-semibold text-na-green-dark underline-offset-2 hover:underline dark:text-emerald-400">
          Alterar
        </button>
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      {!motivoAberto ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-gray-700 dark:text-gray-300">Você participou?</span>
          <button disabled={pendente} onClick={() => enviar(true)} className="min-h-9 rounded-lg bg-na-green px-3 text-[12px] font-semibold text-white disabled:opacity-60">
            Participei
          </button>
          <button disabled={pendente} onClick={() => setMotivoAberto(true)} className="min-h-9 rounded-lg border border-gray-300 px-3 text-[12px] font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-300">
            Não participei
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-gray-700 dark:text-gray-300">
            Quer contar o motivo? (opcional, só os responsáveis veem)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={600} className={`${CAMPO} mt-1`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={pendente} onClick={() => enviar(false)} className="min-h-9 rounded-lg bg-na-green px-3 text-[12px] font-semibold text-white disabled:opacity-60">
              Enviar
            </button>
            <button disabled={pendente} onClick={() => enviar(false, true)} className="min-h-9 rounded-lg border border-gray-300 px-3 text-[12px] font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-300">
              Prefiro não informar
            </button>
            <button onClick={() => setMotivoAberto(false)} className="min-h-9 px-2 text-[12px] text-gray-500">
              Voltar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-[11px] text-na-danger-dark">{erro}</p>}
    </div>
  );
}
