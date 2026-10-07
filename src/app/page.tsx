import { Calendar, Coffee, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * Antes redirecionava direto pro /portal (que por sua vez manda pro
 * /login se não autenticado) — decisão do usuário 2026-09-28: como o app
 * só é divulgado dentro da escola (não é uma landing pública de
 * marketing), uma página simples de boas-vindas já basta, e serve também
 * de destino pro QR code de cadastro (cartazes, crachás — ver
 * QrCodeCadastroCard no Painel do Diretor).
 */
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-na-bg p-5 dark:bg-gray-950">
      <div className="w-full max-w-[380px] rounded-[28px] border border-gray-200 bg-white p-6 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex justify-center">
          <Image src="/na-logo.png" alt="Nova Acrópole" width={160} height={48} className="h-auto w-36 dark:brightness-0 dark:invert" />
        </div>

        <h1 className="mb-1 text-lg font-black text-na-green-dark dark:text-emerald-400">Portal do Membro</h1>
        <p className="mb-6 text-xs text-gray-500 dark:text-gray-400">
          Tudo o que você precisa da sua jornada na Nova Acrópole, num só lugar.
        </p>

        <div className="mb-6 flex flex-col gap-3 text-left">
          <div className="flex items-center gap-3 rounded-xl bg-na-bg p-3 dark:bg-gray-800">
            <Wallet size={18} className="shrink-0 text-na-green" />
            <span className="text-[12px] text-gray-700 dark:text-gray-300">Pague sua contribuição por PIX, cartão ou débito automático</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-na-bg p-3 dark:bg-gray-800">
            <Coffee size={18} className="shrink-0 text-na-gold-dark" />
            <span className="text-[12px] text-gray-700 dark:text-gray-300">Acompanhe e recarregue sua carteira Fortuna</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-na-bg p-3 dark:bg-gray-800">
            <Calendar size={18} className="shrink-0 text-na-green" />
            <span className="text-[12px] text-gray-700 dark:text-gray-300">Veja a agenda e as novidades da sua turma</span>
          </div>
        </div>

        <Link
          href="/login"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark"
        >
          Entrar no Portal
        </Link>

        <p className="mt-4 text-[10px] text-gray-400 dark:text-gray-500">
          Use o e-mail cadastrado na secretaria. Primeiro acesso? A senha inicial são os 6 primeiros números do seu CPF.
        </p>
      </div>
    </div>
  );
}
