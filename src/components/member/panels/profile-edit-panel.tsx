"use client";

import { removerAvatar, uploadAvatar } from "@/lib/actions/avatar-actions";
import { getSolicitacaoContatoPendente, solicitarAlteracaoContato, updateMemberAddress } from "@/lib/actions/member-actions";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Loader2, Pencil, Trash2, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

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
  avatarUrl: string | null;
}

// Classe repetida nos inputs de texto do formulário.
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const LABEL_CLASS = "text-[11px] font-semibold text-gray-800 dark:text-gray-300";

/** Foto de perfil — pedido do usuário 2026-09-30: deixa o Portal mais pessoal e ajuda a diretoria a reconhecer quem é quem. */
function AvatarUploader({ memberId, avatarUrl: inicial }: { memberId: string; avatarUrl: string | null }) {
  const [avatarUrl, setAvatarUrl] = useState(inicial);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await uploadAvatar(memberId, formData);
        setAvatarUrl(res.avatarUrl);
      } catch (err) {
        setErro((err as Error).message);
      }
    });
  }

  function handleRemover() {
    startTransition(async () => {
      await removerAvatar(memberId);
      setAvatarUrl(null);
    });
  }

  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- vem do Supabase Storage, não é um asset local
          <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
        ) : (
          <UserRound size={28} className="text-gray-300 dark:text-gray-600" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {avatarUrl ? "Trocar foto" : "Adicionar foto"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isPending} />
        </label>
        {avatarUrl && (
          <button onClick={handleRemover} disabled={isPending} className="inline-flex w-fit items-center gap-1 text-[11px] text-gray-400 hover:text-red-600">
            <Trash2 size={11} /> Remover foto
          </button>
        )}
        {erro && <span className="text-[10px] text-red-600 dark:text-red-400">{erro}</span>}
      </div>
    </div>
  );
}

/**
 * WhatsApp e e-mail — pedido do usuário 2026-10-08: são os dados sensíveis
 * de contato, não editáveis direto (diferente do endereço). O membro só
 * pode SOLICITAR a correção, informando o valor certo; o Secretário de
 * Escolástica aprova ou rejeita (ver escolastica-panel.tsx) antes de
 * qualquer coisa ser gravada de verdade.
 */
function ContatoSensivelCard({ memberId, whatsapp, email }: { memberId: string; whatsapp: string; email: string | null }) {
  const [editando, setEditando] = useState(false);
  const [pendente, setPendente] = useState<Awaited<ReturnType<typeof getSolicitacaoContatoPendente>>>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getSolicitacaoContatoPendente(memberId).then(setPendente);
  }, [memberId]);

  function handleSolicitar(formData: FormData) {
    startTransition(async () => {
      const novoWhatsapp = String(formData.get("whatsapp") ?? "").trim();
      const novoEmail = String(formData.get("email") ?? "").trim();
      const res = await solicitarAlteracaoContato(memberId, { whatsapp: novoWhatsapp, email: novoEmail });
      if (res.solicitado) {
        setEditando(false);
        getSolicitacaoContatoPendente(memberId).then(setPendente);
      }
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-1">
      {pendente ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <Clock size={14} className="mt-0.5 shrink-0" />
          <span>Você já tem uma solicitação de correção em análise com a secretaria — aguarde a aprovação antes de enviar outra.</span>
        </div>
      ) : editando ? (
        <form action={handleSolicitar} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>WhatsApp correto</label>
            <input name="whatsapp" type="tel" inputMode="tel" defaultValue={whatsapp} className={INPUT_CLASS} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>E-mail correto</label>
            <input name="email" type="email" defaultValue={email ?? ""} className={INPUT_CLASS} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
              {isPending ? <Loader2 size={12} className="animate-spin" /> : "Enviar solicitação"}
            </button>
            <button type="button" onClick={() => setEditando(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="text-[13px]">
            <p className="text-gray-900 dark:text-gray-100">{whatsapp}</p>
            <p className="text-gray-500 dark:text-gray-400">{email || "Sem e-mail cadastrado"}</p>
          </div>
          <button
            onClick={() => setEditando(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Pencil size={11} /> Solicitar correção
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfileEditPanel(props: ProfileEditPanelProps) {
  const { memberId, name, avatarUrl } = props;
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ changed: boolean; alerted: boolean } | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const campo = (k: string) => {
        const v = String(formData.get(k) ?? "").trim();
        return v === "" ? "" : v;
      };
      const res = await updateMemberAddress(memberId, {
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
      <AvatarUploader memberId={memberId} avatarUrl={avatarUrl} />

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

      <ContatoSensivelCard memberId={memberId} whatsapp={props.whatsapp} email={props.email} />

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
        {isPending ? "Salvando e enviando ao Mercúrio..." : "Salvar Endereço"}
      </button>

      {result?.changed && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-[11px] text-green-800 dark:bg-green-950/30 dark:text-green-300">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>Endereço atualizado com sucesso. A alteração pode levar até 24h para ser confirmada no Mercúrio.</span>
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
