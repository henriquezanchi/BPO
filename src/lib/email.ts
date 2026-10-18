/**
 * Envio de e-mail transacional via Resend (API REST, sem SDK). Precisa de
 * RESEND_API_KEY e EMAIL_FROM (remetente num domínio verificado no Resend,
 * ex: "Portal Nova Acrópole <portal@dominio>"). Sem isso, lança erro
 * amigável — a UI mostra a mensagem em vez de fingir que enviou.
 */
export async function enviarEmail(opts: {
  para: string;
  assunto: string;
  texto: string;
  anexos?: { nomeArquivo: string; conteudoBase64: string }[];
}) {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_FROM;
  if (!chave || !remetente) throw new Error("O envio por e-mail ainda não está disponível. Use o Baixar PDF por enquanto.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remetente,
      to: [opts.para],
      subject: opts.assunto,
      text: opts.texto,
      attachments: opts.anexos?.map((a) => ({ filename: a.nomeArquivo, content: a.conteudoBase64 })),
    }),
  });
  if (!res.ok) {
    console.error("Falha no envio de e-mail (Resend):", res.status, await res.text().catch(() => ""));
    throw new Error("Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.");
  }
}

/** "henrique@gmail.com" → "he•••@gmail.com" — pra confirmar o destino sem expor o endereço inteiro na tela. */
export function mascararEmail(email: string) {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return email;
  return `${usuario.slice(0, 2)}•••@${dominio}`;
}
