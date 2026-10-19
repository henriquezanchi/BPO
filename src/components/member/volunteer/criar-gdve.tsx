"use client";

import { FormGrupo } from "@/components/grupos/form-grupo";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Botão "Criar GDVE" do Portal do Voluntário — só aparece para FV. */
export function CriarGdve({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setAberto(!aberto)}
        className="flex min-h-10 w-fit items-center gap-1.5 rounded-lg border border-na-green/40 bg-white px-3.5 text-[13px] font-semibold text-na-green-dark hover:bg-na-green-light dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-300"
      >
        {aberto ? <X size={15} /> : <Plus size={15} />} {aberto ? "Fechar" : "Criar GDVE"}
      </button>
      {aberto && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-5 dark:border-gray-700 dark:bg-gray-900">
          <FormGrupo tipo="GDVE" schoolId={schoolId} onSalvo={(id) => router.push(`/grupos/${id}`)} onCancelar={() => setAberto(false)} />
        </section>
      )}
    </div>
  );
}
