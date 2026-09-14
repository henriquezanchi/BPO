"use client";

import { updatePersonalData } from "@/lib/actions/personal-data-actions";
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
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light";

export function MaisDadosClient(props: MaisDadosClientProps) {
  const { memberId } = props;
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ changed: boolean; mercurioSynced: boolean } | null>(null);

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
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col border border-gray-200 bg-white sm:my-5 sm:rounded-[28px]">
      <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <Link
          href={`/portal?memberId=${memberId}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-bold text-na-green-dark">Mais Dados</h1>
      </header>

      <form action={handleSubmit} autoComplete="on" className="flex flex-1 flex-col gap-4 p-5 text-left">
        <p className="text-xs text-gray-500">
          Esses dados vêm do seu cadastro oficial no Mercúrio e podem ser corrigidos por aqui.
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-800">Data de Nascimento</label>
          <input name="birthDate" type="date" autoComplete="bday" defaultValue={props.birthDate} className={INPUT_CLASS} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-800">Naturalidade</label>
          <input
            name="naturalidade"
            placeholder="Cidade/UF"
            defaultValue={props.naturalidade ?? ""}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-800">Estado Civil</label>
            <select name="estadoCivil" defaultValue={props.estadoCivil ?? "???"} className={INPUT_CLASS}>
              {ESTADO_CIVIL_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-800">Escolaridade</label>
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
          <label className="text-[11px] font-semibold text-gray-800">Profissão</label>
          <input
            name="profession"
            autoComplete="organization-title"
            defaultValue={props.profession ?? ""}
            className={INPUT_CLASS}
          />
        </div>

        <div className="mt-2 mb-1 text-[11px] font-bold text-gray-900">Identidade (RG)</div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-800">Número do RG</label>
            <input name="rgNumero" inputMode="numeric" defaultValue={props.rgNumero ?? ""} className={INPUT_CLASS} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-800">Órgão Emissor</label>
            <input name="rgOrgaoEmissor" placeholder="Ex: SSPPE" defaultValue={props.rgOrgaoEmissor ?? ""} className={INPUT_CLASS} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-800">Data de Emissão do RG</label>
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
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-[11px] text-green-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              Dados atualizados com sucesso.{" "}
              {result.mercurioSynced
                ? "A alteração já foi confirmada no Mercúrio."
                : "A alteração foi enviada e será confirmada no Mercúrio em instantes."}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
