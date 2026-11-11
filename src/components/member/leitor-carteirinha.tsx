"use client";

import jsQR from "jsqr";
import { Camera, CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  presencaPorCarteirinha,
  type ResultadoLeitura,
} from "@/lib/actions/carteirinha-actions";

/**
 * Leitor da carteirinha digital na recepção (07/11/2026). Abre a câmera traseira, lê o QR (jsQR) e marca a presença.
 * Depois de cada leitura espera 2,5 s, para a mesma carteirinha não ser lida duas vezes seguidas.
 */
export function LeitorCarteirinha({ eventId }: { eventId: string }) {
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLeitura | null>(null);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!aberto) return;
    let parar = false;
    let fluxo: MediaStream | null = null;
    let pausaAte = 0;
    const tela = document.createElement("canvas");
    const ctx = tela.getContext("2d", { willReadFrequently: true });

    const ler = async () => {
      if (parar) return;
      const v = video.current;
      if (
        v &&
        ctx &&
        v.readyState === v.HAVE_ENOUGH_DATA &&
        Date.now() > pausaAte
      ) {
        tela.width = v.videoWidth;
        tela.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, tela.width, tela.height);
        const qr = jsQR(
          ctx.getImageData(0, 0, tela.width, tela.height).data,
          tela.width,
          tela.height,
          { inversionAttempts: "dontInvert" },
        );
        if (qr?.data) {
          pausaAte = Date.now() + 2500;
          setEnviando(true);
          const r = await presencaPorCarteirinha(eventId, qr.data);
          setEnviando(false);
          setResultado(r);
          if (r.ok) {
            navigator.vibrate?.(80);
            router.refresh();
          }
        }
      }
      requestAnimationFrame(() => void ler());
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (parar) return s.getTracks().forEach((t) => t.stop());
        fluxo = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        void ler();
      })
      .catch(() =>
        setErroCamera(
          "Não foi possível abrir a câmera. Libere o acesso à câmera no navegador ou procure a pessoa na lista.",
        ),
      );

    return () => {
      parar = true;
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, [aberto, eventId, router]);

  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => {
          setResultado(null);
          setErroCamera(
            navigator.mediaDevices
              ? null
              : "Este navegador não abre a câmera. Procure a pessoa na lista.",
          );
          setAberto(true);
        }}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-na-green px-4 transition hover:bg-na-green-dark text-sm font-semibold text-white"
      >
        <Camera size={17} /> Ler carteirinha
      </button>
    );

  return (
    <section
      className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Aponte para o QR da carteirinha</h2>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar a câmera"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X size={16} />
        </button>
      </div>
      {erroCamera ? (
        <p className="text-[13px] text-red-600">{erroCamera}</p>
      ) : (
        <video
          ref={video}
          playsInline
          muted
          className="aspect-square w-full max-w-sm self-center rounded-xl bg-black object-cover"
        />
      )}
      {enviando && (
        <p className="flex items-center gap-2 text-[13px] text-gray-600">
          <Loader2 size={14} className="animate-spin" /> Conferindo...
        </p>
      )}
      {resultado && !enviando && (
        <p
          className={`flex items-start gap-2 rounded-lg p-2 text-[13px] font-semibold ${resultado.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"}`}
        >
          {resultado.ok ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <XCircle size={16} className="shrink-0" />
          )}{" "}
          {resultado.mensagem}
        </p>
      )}
    </section>
  );
}
