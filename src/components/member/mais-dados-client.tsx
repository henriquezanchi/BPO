"use client";

import { updatePersonalData } from "@/lib/actions/personal-data-actions";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ESCOLARIDADE_OPCOES, ESTADO_CIVIL_OPCOES } from "@/lib/mercurio/personal-data-options";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

interface MaisDadosClientProps {
  memberId: string;
  birthDate: string; // "YYYY-MM-DD" ou ""
  naturalidade: string | null;
  profession: string | null;
  estadoCivil: string | null;
  escolaridade: string | null;
  rgNumero: string | null;
  rgOrgaoEmissor: string | null;
  rgDataEmissao: string;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const LABEL_CLASS = "text-[11px] font-semibold text-gray-800 dark:text-gray-300";

export function MaisDadosClient(props: MaisDadosClientProps) {
  const { memberId } = props;
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ changed: boolean } | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const campo = (k: string) => String(formData.get(k) ?? "").trim();
      const res = await updatePersonalData(memberId, {
        birthDate: campo("birthDate"),
        naturalidade: campo("naturalidade"),
        profession: campo("profession"),
        estadoCivil: campo("estadoCivil"),
        escolaridade: campo("escolaridade"),
        rgNumero: campo("rgNumero"),
        rgOrgaoEmissor: campo("rgOrgaoEmissor"),
        rgDataEmissao: campo("rgDataEmissao"),
      });
      setResult(res);
    });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col border border-gray-200 bg-white sm:my-5 sm:rounded-[28px] dark:border-gray-800 dark:bg-gray-900">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Link
            href="/portal"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-bold text-na-green-dark dark:text-emerald-400">Mais Dados</h1>
        </div>
        <ThemeToggle />
      </header>

      <form action={handleSubmit} autoComplete="on" className="flex flex-1 flex-col gap-4 p-5 text-left">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Esses dados vêm do seu cadastro oficial no Mercúrio e podem ser corrigidos por aqui.
        </p>

        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Data de Nascimento</label>
          <input name="birthDate" type="date" autoComplete="bday" defaultValue={props.birthDate} className={INPUT_CLASS} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Naturalidade</label>
          <input
            name="naturalidade"
            placeholder="Cidade/UF"
            defaultValue={props.naturalidade ?? ""}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>Estado Civil</label>
            <select name="estadoCivil" defaultValue={props.estadoCivil ?? "???"} className={INPUT_CLASS}>
              {ESTADO_CIVIL_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>Escolaridade</label>
            <select name="escolaridade" defaultValue={props.escolaridade ?? "???"} className={INPUT_CLASS}>
              {ESCOLARIDADE_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Profissão</label>
          <input
            name="profession"
            autoComplete="organization-title"
            defaultValue={props.profession ?? ""}
            className={INPUT_CLASS}
          />
        </div>

        <div className="mt-2 mb-1 text-[11px] font-bold text-gray-900 dark:text-gray-100">Identidade (RG)</div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>Número do RG</label>
            <input name="rgNumero" inputMode="numeric" defaultValue={props.rgNumero ?? ""} className={INPUT_CLASS} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>Órgão Emissor</label>
            <input name="rgOrgaoEmissor" placeholder="Ex: SSPPE" defaultValue={props.rgOrgaoEmissor ?? ""} className={INPUT_CLASS} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Data de Emissão do RG</label>
          <input name="rgDataEmissao" type="date" defaultValue={props.rgDataEmissao} className={INPUT_CLASS} />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {isPending ? "Salvando e enviando ao Mercúrio..." : "Salvar Alterações"}
        </button>

        {result?.changed && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-[11px] text-green-800 dark:bg-green-950/30 dark:text-green-300">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>Dados atualizados com sucesso. A alteração pode levar até 24h para ser confirmada no Mercúrio.</span>
          </div>
        )}
      </form>

      <div className="px-5 pb-8">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
