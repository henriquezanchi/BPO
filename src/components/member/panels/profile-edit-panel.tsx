"use client";

import { updateMemberContact } from "@/lib/actions/member-actions";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

interface ProfileEditPanelProps {
  memberId: string;
  name: string;
  whatsapp: string;
  email: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
}

// Classe repetida nos inputs de texto do formulário.
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const LABEL_CLASS = "text-[11px] font-semibold text-gray-800 dark:text-gray-300";

export function ProfileEditPanel(props: ProfileEditPanelProps) {
  const { memberId, name } = props;
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ changed: boolean; alerted: boolean; mercurioSynced: boolean } | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const campo = (k: string) => {
        const v = String(formData.get(k) ?? "").trim();
        return v === "" ? "" : v;
      };
      const res = await updateMemberContact(memberId, {
        whatsapp: campo("whatsapp"),
        email: campo("email"),
        addressStreet: campo("addressStreet"),
        addressNumber: campo("addressNumber"),
        addressComplement: campo("addressComplement"),
        addressNeighborhood: campo("addressNeighborhood"),
        addressCity: campo("addressCity"),
        addressState: campo("addressState").toUpperCase(),
        addressZip: campo("addressZip"),
      });
      setResult(res);
    });
  }

  return (
    // autoComplete="on" + name/autoComplete padronizados (WHATWG Autofill
    // Field Names) em cada input — é isso que faz o teclado do celular
    // (iOS/Android) e o Chrome oferecerem autopreenchimento do endereço
    // salvo no Google/no sistema, em vez de 1 campo de texto livre.
    <form action={handleSubmit} autoComplete="on" className="flex flex-col text-left">
      <p className="mb-4 text-xs text-gray-500">
        Mantenha seus dados atualizados para receber os comunicados e informativos da escola.
      </p>

      <div className="mb-3 flex flex-col gap-1">
        <label className={LABEL_CLASS}>Nome Completo</label>
        <input
          disabled
          defaultValue={name}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-[13px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
        />
      </div>

      <div className="mb-3 flex flex-col gap-1">
        <label className={LABEL_CLASS}>WhatsApp</label>
        <input
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={props.whatsapp}
          className={INPUT_CLASS}
        />
      </div>

      <div className="mb-3 flex flex-col gap-1">
        <label className={LABEL_CLASS}>E-mail</label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={props.email ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      <div className="mb-1 text-[11px] font-bold text-gray-900 dark:text-gray-100">Endereço</div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="col-span-2 flex flex-col gap-1">
          <label className={LABEL_CLASS}>Rua</label>
          <input
            name="addressStreet"
            autoComplete="address-line1"
            defaultValue={props.addressStreet ?? ""}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Número</label>
          <input
            name="addressNumber"
            inputMode="numeric"
            defaultValue={props.addressNumber ?? ""}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-1">
        <label className={LABEL_CLASS}>Complemento</label>
        <input
          name="addressComplement"
          autoComplete="address-line2"
          placeholder="Apto, bloco, ponto de referência..."
          defaultValue={props.addressComplement ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Bairro</label>
          <input
            name="addressNeighborhood"
            autoComplete="address-level3"
            defaultValue={props.addressNeighborhood ?? ""}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>CEP</label>
          <input
            name="addressZip"
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={props.addressZip ?? ""}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="col-span-2 flex flex-col gap-1">
          <label className={LABEL_CLASS}>Cidade</label>
          <input
            name="addressCity"
            autoComplete="address-level2"
            defaultValue={props.addressCity ?? ""}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>UF</label>
          <input
            name="addressState"
            maxLength={2}
            autoComplete="address-level1"
            defaultValue={props.addressState ?? ""}
            className={`${INPUT_CLASS} uppercase`}
          />
        </div>
      </div>

      <Link
        href={`/portal/mais-dados?memberId=${memberId}`}
        className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 p-3 text-[13px] font-medium text-gray-800 transition hover:border-na-gold dark:border-gray-700 dark:text-gray-200"
      >
        Mais Dados
        <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
      </Link>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending && <Loader2 size={14} className="animate-spin" />}
        {isPending ? "Salvando e enviando ao Mercúrio..." : "Salvar Alterações"}
      </button>

      {result?.changed && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-[11px] text-green-800 dark:bg-green-950/30 dark:text-green-300">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>
            Dados atualizados com sucesso.{" "}
            {result.mercurioSynced
              ? "A alteração já foi confirmada no Mercúrio."
              : "A alteração foi enviada e será confirmada no Mercúrio em instantes."}
          </span>
        </div>
      )}

      {result?.alerted && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
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
