# Pendências

## Enviar comprovante por e-mail

Pedido em 2026-10-18 e tirado do ar a pedido do usuário até existir um serviço de e-mail.

**Como ficaria:** um botão "Enviar por e-mail" ao lado de "Baixar PDF" no comprovante (Situação da Contribuição → mês pago). Um clique envia o PDF anexo, com o texto do recibo no corpo, só para o e-mail do cadastro (nunca um endereço digitado na hora). Depois do envio aparece "Comprovante enviado para el•••@gmail.com". Sem e-mail cadastrado, a pessoa vê um aviso para pedir à secretaria.

**Código pronto:** o commit `496f174` tem a implementação completa:
- `src/lib/email.ts`: envio via API REST do Resend, sem SDK.
- `enviarReciboPorEmail` em `src/lib/actions/receipt-actions.ts`.
- O botão em `contribution-status-panel.tsx`.

O gerador de PDF (`src/lib/recibo-pdf.ts`) já ficou compartilhado e funciona no servidor.

**Para reativar:**
1. Criar uma conta no Resend (gratuito até 3.000 e-mails/mês) e verificar o domínio remetente (registros DNS).
2. Definir `RESEND_API_KEY` e `EMAIL_FROM` (ex: `Portal Nova Acrópole <portal@dominio>`) no `.env` e no Vercel.
3. Trazer de volta o código do commit `496f174`.
