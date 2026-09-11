"use client";

import { updateMemberContact } from "@/lib/actions/member-actions";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";

export function ProfileEditPanel({
  memberId,
  name,
  whatsapp,
  email,
  address,
}: {
  memberId: string;
  name: string;
  whatsapp: string;
  email: string | null;
  address: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ changed: boolean; alerted: boolean } | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await updateMemberContact(memberId, {
        whatsapp: String(formData.get("whatsapp") ?? ""),
        email: String(formData.get("email") ?? ""),
        address: String(formData.get("address") ?? ""),
      });
      setResult(res);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col text-left">
      <p className="mb-4 text-xs text-gray-500">
        Mantenha seus dados atualizados para receber os comunicados e informativos da escola.
      </p>

      <div className="mb-3 flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-800">Nome Completo</label>
        <input
          disabled
          defaultValue={name}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-[13px] text-gray-500"
        />
      </div>

      <div className="mb-3 flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-800">WhatsApp</label>
        <input
          name="whatsapp"
          defaultValue={whatsapp}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-[13px] outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light"
        />
      </div>

      <div className="mb-3 flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-800">E-mail</label>
        <input
          name="email"
          type="email"
          defaultValue={email ?? ""}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-[13px] outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light"
        />
      </div>

      <div className="mb-5 flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-gray-800">Endereço Completo</label>
        <input
          name="address"
          defaultValue={address ?? ""}
          placeholder="Rua, Número, Bairro - CEP"
          className="w-full rounded-lg border border-gray-200 p-2.5 text-[13px] outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending ? "Salvando..." : "Salvar Alterações"}
      </button>

      {result?.changed && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-[11px] text-green-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>Dados atualizados com sucesso. A alteração também foi enviada para o Mercúrio.</span>
        </div>
      )}

      {result?.alerted && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Como sua contribuição está em atraso, a secretaria de economia foi notificada desta alteração de
            contato.
          </span>
        </div>
      )}
    </form>
  );
}
