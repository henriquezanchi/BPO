"use client";

import { enviarMatricula, situacaoMatricula } from "@/lib/actions/matricula-actions";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const CAMPO = "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-[14px] text-gray-900 outline-none focus:border-na-green dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const ROTULO = "flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300";
const reais = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];
const ESCOLARIDADE = ["Fundamental", "Médio", "Superior incompleto", "Superior completo", "Pós-graduação"];
const COMO = ["Instagram", "Indicação de amigo", "Palestra", "Passei na frente", "Google", "Outro"];

type Pagamento = { invoiceUrl: string; pixPayload: string | null; pixImagem: string | null };

/** Formulário público da matrícula (dados do cadastro do Mercúrio) e o pagamento da 1ª contribuição. */
export function FormMatricula({ token, vagas, valorCentavos }: { token: string; vagas: number; valorCentavos: number | null }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ id: string; pagamento: Pagamento | null } | null>(null);
  const [pago, setPago] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [endereco, setEndereco] = useState({ logradouro: "", bairro: "", cidade: "", uf: "" });

  // Confere o pagamento a cada 5 s enquanto a tela do Pix estiver aberta.
  useEffect(() => {
    if (!feito?.pagamento || pago) return;
    const t = setInterval(async () => {
      const r = await situacaoMatricula(token, feito.id).catch(() => null);
      if (r?.status === "paga" || r?.status === "lancada") setPago(true);
    }, 5000);
    return () => clearInterval(t);
  }, [feito, pago, token]);

  async function buscarCep(cep: string) {
    const n = cep.replace(/\D/g, "");
    if (n.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${n}/json/`);
      const d = (await r.json()) as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (!d.erro) setEndereco({ logradouro: d.logradouro ?? "", bairro: d.bairro ?? "", cidade: d.localidade ?? "", uf: d.uf ?? "" });
    } catch {
      /* sem CEP automático: a pessoa preenche */
    }
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const dados = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
    setErro(null);
    setEnviando(true);
    const r = await enviarMatricula(token, { ...dados, consentimento: f.get("consentimento") === "on" }).catch(() => ({ ok: false as const, error: "Não foi possível enviar agora." }));
    setEnviando(false);
    if (!r.ok) return setErro(r.error);
    setFeito({ id: r.id, pagamento: r.pagamento });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (pago || (feito && !feito.pagamento)) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-2xl border border-na-green/40 bg-white p-6 text-center dark:bg-gray-900">
        <CheckCircle2 size={36} className="text-na-green" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{pago ? "Matrícula confirmada!" : "Matrícula recebida!"}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {pago ? "Recebemos o pagamento da 1ª contribuição. A escola vai entrar em contato com as boas-vindas e os detalhes da primeira aula." : "A escola vai entrar em contato para combinar a 1ª contribuição e confirmar sua vaga."}
        </p>
      </section>
    );
  }

  if (feito?.pagamento) {
    const p = feito.pagamento;
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Falta só o pagamento</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">1ª contribuição{valorCentavos ? `: ${reais(valorCentavos)}` : ""}. A vaga é confirmada assim que o pagamento cair.</p>
        </div>
        {p.pixImagem && (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR do Pix em base64 */}
            <img src={`data:image/png;base64,${p.pixImagem}`} alt="QR code do Pix" className="h-56 w-56 rounded-xl bg-white p-2" />
            {p.pixPayload && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(p.pixPayload!);
                    setCopiado(true);
                  } catch {
                    /* sem área de transferência */
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Copy size={15} /> {copiado ? "Código copiado" : "Copiar código Pix"}
              </button>
            )}
          </div>
        )}
        <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-center text-sm font-semibold text-na-green-dark underline dark:text-emerald-400">
          Pagar com cartão ou boleto
        </a>
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Aguardando a confirmação do pagamento…
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      <p className="rounded-xl bg-na-green-light px-3 py-2 text-[13px] text-na-green-dark dark:bg-emerald-950/30 dark:text-emerald-300">
        {vagas} vaga{vagas === 1 ? "" : "s"} · {valorCentavos ? `1ª contribuição de ${reais(valorCentavos)}, paga ao final` : "a escola combina a 1ª contribuição com você"}
      </p>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-[13px] font-bold text-gray-900 dark:text-gray-100">Seus dados</legend>
        <label className={`${ROTULO} sm:col-span-2`}>Nome completo<input name="nome" required className={CAMPO} autoComplete="name" /></label>
        <label className={ROTULO}>E-mail<input name="email" type="email" required className={CAMPO} autoComplete="email" /></label>
        <label className={ROTULO}>Celular com DDD<input name="celular" required inputMode="tel" className={CAMPO} autoComplete="tel" /></label>
        <label className={ROTULO}>Data de nascimento<input name="nascimento" type="date" required className={CAMPO} /></label>
        <label className={ROTULO}>Sexo<select name="sexo" required className={CAMPO}><option value="">Selecione</option><option value="F">Feminino</option><option value="M">Masculino</option></select></label>
        <label className={ROTULO}>Naturalidade (cidade)<input name="naturalidade" className={CAMPO} /></label>
        <label className={ROTULO}>Nacionalidade<input name="nacionalidade" defaultValue="Brasileira" className={CAMPO} /></label>
        <label className={ROTULO}>Estado civil<select name="estadoCivil" className={CAMPO}><option value="">Selecione</option>{ESTADO_CIVIL.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className={ROTULO}>Escolaridade<select name="escolaridade" className={CAMPO}><option value="">Selecione</option>{ESCOLARIDADE.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className={`${ROTULO} sm:col-span-2`}>Profissão<input name="profissao" className={CAMPO} /></label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-[13px] font-bold text-gray-900 dark:text-gray-100">Documentos</legend>
        <label className={ROTULO}>CPF<input name="cpf" required inputMode="numeric" className={CAMPO} /></label>
        <label className={ROTULO}>RG<input name="rg" className={CAMPO} /></label>
        <label className={ROTULO}>Órgão emissor<input name="rgOrgao" className={CAMPO} /></label>
        <label className={ROTULO}>Data de emissão<input name="rgEmissao" type="date" className={CAMPO} /></label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-[13px] font-bold text-gray-900 dark:text-gray-100">Endereço</legend>
        <label className={ROTULO}>CEP<input name="cep" required inputMode="numeric" onBlur={(e) => buscarCep(e.target.value)} className={CAMPO} autoComplete="postal-code" /></label>
        <label className={ROTULO}>Número<input name="numero" required className={CAMPO} /></label>
        <label className={`${ROTULO} sm:col-span-2`}>Rua<input name="logradouro" required value={endereco.logradouro} onChange={(e) => setEndereco({ ...endereco, logradouro: e.target.value })} className={CAMPO} /></label>
        <label className={ROTULO}>Complemento<input name="complemento" className={CAMPO} /></label>
        <label className={ROTULO}>Bairro<input name="bairro" required value={endereco.bairro} onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })} className={CAMPO} /></label>
        <label className={ROTULO}>Cidade<input name="cidade" required value={endereco.cidade} onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })} className={CAMPO} /></label>
        <label className={ROTULO}>UF<input name="uf" required maxLength={2} value={endereco.uf} onChange={(e) => setEndereco({ ...endereco, uf: e.target.value.toUpperCase() })} className={CAMPO} /></label>
      </fieldset>

      <label className={ROTULO}>Como conheceu a Nova Acrópole?<select name="comoConheceu" className={CAMPO}><option value="">Selecione</option>{COMO.map((x) => <option key={x}>{x}</option>)}</select></label>

      <label className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-gray-300">
        <input type="checkbox" name="consentimento" required className="mt-1 h-4 w-4 accent-na-green" />
        Concordo que a Nova Acrópole use estes dados para a minha matrícula e para falar comigo sobre o curso.
      </label>

      {erro && <p className="rounded-xl bg-na-danger-light px-3 py-2 text-[13px] text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">{erro}</p>}
      <button disabled={enviando} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-na-green px-5 text-[15px] font-bold text-white hover:bg-na-green-dark disabled:opacity-60">
        {enviando && <Loader2 size={16} className="animate-spin" />}
        {valorCentavos ? "Continuar para o pagamento" : "Enviar matrícula"}
      </button>
    </form>
  );
}
