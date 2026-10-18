/** Integração para destinatários do Portal ainda não implementada. CallMeBot de suporte é separado. */
export async function sendWhatsAppMessage(_to: string, _message: string): Promise<{ ok: boolean; error?: string }> {
  void _to; void _message;
  // Não registrar telefone ou conteúdo em um mock e não declarar envio inexistente.
  return { ok: false, error: "WhatsApp dos integrantes ainda não conectado ao Portal." };
}
