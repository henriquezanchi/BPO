"use client";

import { cancelarInstagram, conectarInstagram, contratarInstagram } from "@/lib/actions/redes-actions";
import { formatDateBR } from "@/lib/format";
import { Check, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Situacao = "nao_contratada" | "contratada" | "conectada" | "desconectada" | "cancelada";
export type InstagramFilial = { schoolId: string; filial: string; status: Situacao; usuario: string | null; desde: string | null };

const VANTAGENS = [
  "Os eventos da filial vão para o feed e o story direto do Portal, com a arte padrão da Nova Acrópole.",
  "A publicação pode ser agendada para o melhor horário.",
  "Todas as filiais com o mesmo padrão visual, sem montar arte à mão.",
];

/** Pacote opcional do Instagram da filial (R$ 49/mês), na área da Difusão e Comunicação. */
export function OfertaInstagram({ filiais }: { filiais: InstagramFilial[] }) {
  const retorno = useSearchParams()?.get("instagram");
  const [escolhida, setEscolhida] = useState(filiais[0].schoolId);
  const [confirmar, setConfirmar] = useState<"contratar" | "cancelar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const f = filiais.find((x) => x.schoolId === escolhida) ?? filiais[0];
  const contratada = f.status === "contratada" || f.status === "conectada" || f.status === "desconectada";

  function executar(acao: () => Promise<string | void>) {
    setErro(null);
    iniciar(async () => {
      try {
        const link = await acao();
        if (link) window.location.href = link;
        setConfirmar(null);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-na-green-dark dark:text-emerald-400">Instagram da filial</h2>
        <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">Opcional · R$ 49/mês</span>
      </div>

      {filiais.length > 1 && (
        <select
          value={escolhida}
          onChange={(e) => {
            setEscolhida(e.target.value);
            setConfirmar(null);
          }}
          className="mt-3 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          {filiais.map((x) => (
            <option key={x.schoolId} value={x.schoolId}>
              {x.filial}
            </option>
          ))}
        </select>
      )}

      {retorno === "conectado" && f.status === "conectada" && <p className="mt-3 text-sm font-semibold text-na-green-dark dark:text-emerald-400">Instagram conectado.</p>}
      {retorno === "nao-conectado" && f.status !== "conectada" && (
        <p className="mt-3 text-sm text-na-danger-dark dark:text-red-400">A conta não foi conectada. Confira se o Instagram é comercial ou de criador e tente de novo.</p>
      )}

      {f.status === "conectada" ? (
        <p className="mt-3 flex gap-2 text-sm text-gray-800 dark:text-gray-200">
          <Check size={16} className="mt-0.5 shrink-0 text-na-green" />
          <span>
            Instagram {f.usuario && <strong>@{f.usuario.replace(/^@/, "")}</strong>} conectado{f.desde ? ` desde ${formatDateBR(new Date(f.desde))}` : ""}.
          </span>
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            {VANTAGENS.map((v) => (
              <li key={v} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-na-green" />
                {v}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">
            Precisa de uma conta comercial ou de criador no Instagram. A mensalidade é cobrada da filial por Pix ou boleto, com nota fiscal, à parte
            das contribuições. Dá para cancelar quando quiser.
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!contratada &&
          (confirmar === "contratar" ? (
            <>
              <button
                onClick={() => executar(() => contratarInstagram(f.schoolId))}
                disabled={pendente}
                className="inline-flex items-center gap-1.5 rounded-lg bg-na-green px-4 py-2 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
              >
                {pendente && <Loader2 size={14} className="animate-spin" />} Confirmar: R$ 49/mês para {f.filial.replace(/^Nova Acrópole - /, "")}
              </button>
              <button onClick={() => setConfirmar(null)} className="px-2 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Voltar
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmar("contratar")} className="rounded-lg bg-na-green px-4 py-2 text-sm font-semibold text-white hover:bg-na-green-dark">
              Contratar e conectar
            </button>
          ))}

        {(f.status === "contratada" || f.status === "desconectada") && (
          <>
            <p className="w-full text-sm text-gray-700 dark:text-gray-300">
              {f.status === "contratada" ? "Contratado. Falta conectar a conta do Instagram da filial." : "A conexão com o Instagram caiu. Conecte de novo."}
            </p>
            <button
              onClick={() => executar(() => conectarInstagram(f.schoolId))}
              disabled={pendente}
              className="inline-flex items-center gap-1.5 rounded-lg bg-na-green px-4 py-2 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
            >
              {pendente && <Loader2 size={14} className="animate-spin" />} Conectar o Instagram
            </button>
          </>
        )}

        {contratada &&
          (confirmar === "cancelar" ? (
            <>
              <button
                onClick={() => executar(() => cancelarInstagram(f.schoolId))}
                disabled={pendente}
                className="rounded-lg border border-na-danger px-3 py-2 text-sm font-semibold text-na-danger-dark disabled:opacity-60 dark:text-red-400"
              >
                Confirmar cancelamento
              </button>
              <button onClick={() => setConfirmar(null)} className="px-2 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Voltar
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmar("cancelar")} className="px-2 py-2 text-[12px] font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
              Cancelar o pacote
            </button>
          ))}
      </div>

      {erro && <p className="mt-2 text-sm text-na-danger-dark dark:text-red-400">{erro}</p>}
    </section>
  );
}
