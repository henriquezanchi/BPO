"use client";

import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const nada = () => () => {};

/** Botões do convite: WhatsApp, compartilhar do celular e copiar o link (07/11/2026). "Compartilhar" só aparece onde o
 * aparelho sabe compartilhar (10/11/2026: no computador o botão não fazia nada); lá, "Copiar" ocupa a linha toda. */
export function CompartilharConvite({
  link,
  texto,
}: {
  link: string;
  texto: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const podeCompartilhar = useSyncExternalStore(
    nada,
    () => typeof navigator.share === "function",
    () => false,
  );
  const mensagem = `${texto}\n${link}`;
  const botao =
    "flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold";
  return (
    <div className="flex flex-col gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
        target="_blank"
        rel="noreferrer"
        className={`${botao} bg-na-green text-white transition hover:bg-na-green-dark`}
      >
        <MessageCircle size={17} /> Enviar pelo WhatsApp
      </a>
      <div
        className={`grid gap-2 ${podeCompartilhar ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {podeCompartilhar && (
          <button
            type="button"
            onClick={() =>
              navigator.share?.({ text: texto, url: link }).catch(() => {})
            }
            className={`${botao} border border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100`}
          >
            <Share2 size={16} /> Compartilhar
          </button>
        )}
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
          <Copy size={16} />{" "}
          {copiado ? "Copiado" : podeCompartilhar ? "Copiar" : "Copiar convite"}
        </button>
      </div>
    </div>
  );
}
