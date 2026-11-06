"use client";

import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";

/** Botões do convite: WhatsApp, compartilhar do celular e copiar o link (07/11/2026). */
export function CompartilharConvite({ link, texto }: { link: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensagem = `${texto}\n${link}`;
  const botao = "flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold";
  return (
    <div className="flex flex-col gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer" className={`${botao} bg-na-green-dark text-white`}>
        <MessageCircle size={17} /> Enviar pelo WhatsApp
      </a>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigator.share?.({ text: texto, url: link }).catch(() => {})}
          className={`${botao} border border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100`}
        >
          <Share2 size={16} /> Compartilhar
        </button>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(mensagem).then(
              () => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1800);
              },
              () => {},
            )
          }
          className={`${botao} border border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100`}
        >
          <Copy size={16} /> {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
