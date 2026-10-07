"use client";

import { Check, Copy, QrCode } from "lucide-react";
import { useState } from "react";

const URL_PORTAL = "https://portal-na-one.vercel.app";

/**
 * QR code pra materiais físicos (cartaz, crachá, mural) apontando pra
 * página de boas-vindas do Portal (ver src/app/page.tsx) — pedido do
 * usuário 2026-09-28. Gerado via api.qrserver.com (serviço público
 * gratuito, sem chave/conta) em vez de instalar uma lib de QR local —
 * mais barato de manter, e o diretor só precisa baixar/imprimir a
 * imagem, não integrar nada.
 */
export function QrCodeCadastroCard() {
  const [copiado, setCopiado] = useState(false);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(URL_PORTAL)}`;

  function handleCopiar() {
    navigator.clipboard.writeText(URL_PORTAL).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-black text-na-green-dark dark:text-emerald-400">
        <QrCode size={16} /> QR Code de Cadastro
      </h3>
      <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">
        Use em cartazes, crachás ou no mural da escola — aponta pra tela de boas-vindas do Portal.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada dinamicamente por serviço externo, não é um asset local */}
        <img src={qrSrc} alt="QR Code de cadastro do Portal" className="h-40 w-40 rounded-lg border border-gray-200 dark:border-gray-700" />
        <div className="flex flex-1 flex-col gap-2">
          <a href={qrSrc} download="qr-code-portal-na.png" className="rounded-lg border border-gray-300 px-3 py-2 text-center text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            Baixar imagem
          </a>
          <button
            onClick={handleCopiar}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-na-green px-3 py-2 text-[11px] font-semibold text-white hover:bg-na-green-dark"
          >
            {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>
    </div>
  );
}
