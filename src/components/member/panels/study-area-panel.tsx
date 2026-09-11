import { BookOpenText, Clapperboard, FileText, LockOpen } from "lucide-react";

export function StudyAreaPanel() {
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <LockOpen size={32} className="text-na-gold" />
      <div>
        <div className="mb-1 text-[15px] font-semibold text-gray-900">Acesso Liberado</div>
        <p className="text-xs text-gray-500">Sua contribuição está em dia. Bons estudos!</p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        <a
          href="https://acropoleplay.com"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green-dark px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Clapperboard size={16} /> Acrópole Play — vídeos e séries
        </a>
        <a
          href="https://biblioteca.acropolebrasil.com.br/"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <BookOpenText size={16} /> Acessar Biblioteca
        </a>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50">
          <FileText size={16} /> Acessar Apostilas
        </button>
      </div>
    </div>
  );
}
