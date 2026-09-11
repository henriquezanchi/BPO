/**
 * Envio de mensagens via WhatsApp. Placeholder até escolhermos o provedor
 * (Z-API para começar, migrando para a Cloud API oficial da Meta depois —
 * ver conversa sobre o MVP). Por ora só loga; os registros de notificação
 * ficam em ActivityNotification para reenvio quando o envio real existir.
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.WHATSAPP_PROVIDER_TOKEN) {
    console.warn(`[WhatsApp mock] Para ${to}: ${message}`);
    return { ok: true };
  }

  // TODO: chamar o provedor real (Z-API) usando WHATSAPP_PROVIDER_TOKEN / WHATSAPP_PROVIDER_INSTANCE
  console.warn(`[WhatsApp mock] Provedor configurado mas envio real ainda não implementado. Para ${to}: ${message}`);
  return { ok: true };
}
