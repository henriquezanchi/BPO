"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Enquadramento da foto de perfil (25/11/2026, pedido do usuário): a pessoa arrasta e aproxima a imagem dentro de um
 * círculo e confirma. Sai um JPEG quadrado de 640 px (uns 60 KB), já pronto para subir. Funciona com toque e mouse.
 */
const SAIDA = 640;
const MOLDURA = 280; // px na tela

export function RecorteFoto({ arquivo, aoConfirmar, aoCancelar }: { arquivo: File; aoConfirmar: (f: File) => void; aoCancelar: () => void }) {
  const [imagem, setImagem] = useState<ImageBitmap | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // deslocamento do centro, em px da tela
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    createImageBitmap(arquivo)
      .then((b) => {
        if (vivo) setImagem(b);
        else b.close();
      })
      .catch(() => setErro("Não deu para abrir essa imagem. Tente outra."));
    return () => {
      vivo = false;
    };
  }, [arquivo]);

  // Escala base: a menor dimensão da imagem preenche a moldura.
  const base = imagem ? MOLDURA / Math.min(imagem.width, imagem.height) : 1;
  const escala = base * zoom;

  function limitar(p: { x: number; y: number }, z = zoom) {
    if (!imagem) return p;
    const e = base * z;
    const maxX = Math.max(0, (imagem.width * e - MOLDURA) / 2);
    const maxY = Math.max(0, (imagem.height * e - MOLDURA) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !imagem) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, MOLDURA, MOLDURA);
    const w = imagem.width * escala;
    const h = imagem.height * escala;
    ctx.drawImage(imagem, MOLDURA / 2 - w / 2 + pos.x, MOLDURA / 2 - h / 2 + pos.y, w, h);
    // Escurece fora do círculo.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, MOLDURA, MOLDURA);
    ctx.arc(MOLDURA / 2, MOLDURA / 2, MOLDURA / 2, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.restore();
  }, [imagem, escala, pos]);

  function inicioArrasto(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }
  function moverArrasto(e: React.PointerEvent) {
    const a = arrasto.current;
    if (!a) return;
    setPos(limitar({ x: a.px + (e.clientX - a.x), y: a.py + (e.clientY - a.y) }));
  }
  function fimArrasto() {
    arrasto.current = null;
  }
  function mudarZoom(z: number) {
    setZoom(z);
    setPos((p) => limitar(p, z));
  }

  async function confirmar() {
    if (!imagem) return;
    const saida = document.createElement("canvas");
    saida.width = SAIDA;
    saida.height = SAIDA;
    const ctx = saida.getContext("2d")!;
    const f = SAIDA / MOLDURA;
    const w = imagem.width * escala * f;
    const h = imagem.height * escala * f;
    ctx.drawImage(imagem, SAIDA / 2 - w / 2 + pos.x * f, SAIDA / 2 - h / 2 + pos.y * f, w, h);
    const blob = await new Promise<Blob | null>((ok) => saida.toBlob(ok, "image/jpeg", 0.86));
    if (!blob) return setErro("Não deu para preparar a foto. Tente de novo.");
    aoConfirmar(new File([blob], "foto.jpg", { type: "image/jpeg" }));
  }

  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && aoCancelar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 bottom-3 z-[101] mx-auto w-auto max-w-sm rounded-[24px] bg-white p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-black text-gray-900 dark:text-gray-100">Enquadre sua foto</Dialog.Title>
            <button type="button" onClick={aoCancelar} aria-label="Cancelar" className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={18} />
            </button>
          </div>
          <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">Arraste para posicionar. O que ficar no círculo é a sua foto.</p>
          <div className="mt-3 flex justify-center">
            <canvas
              ref={canvasRef}
              width={MOLDURA}
              height={MOLDURA}
              className="touch-none rounded-2xl bg-gray-100 select-none dark:bg-gray-800"
              style={{ width: MOLDURA, height: MOLDURA, cursor: "grab" }}
              onPointerDown={inicioArrasto}
              onPointerMove={moverArrasto}
              onPointerUp={fimArrasto}
              onPointerCancel={fimArrasto}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
            <ZoomIn size={16} className="shrink-0" />
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => mudarZoom(Number(e.target.value))} className="w-full accent-na-green" aria-label="Aproximar" />
          </label>
          {erro && <p className="mt-2 text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={aoCancelar} className="min-h-11 flex-1 rounded-2xl border border-gray-300 text-[13px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={!imagem} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-na-green text-[13px] font-bold text-white disabled:opacity-60">
              <Check size={16} /> Usar esta foto
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
