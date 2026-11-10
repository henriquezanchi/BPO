---
target: Portal do Aluno
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Henrique Zanchi\\projetos\\portal-na\\src\\components\\member\\member-portal-client.tsx"
target_fingerprint: "sha256:1e5ee46d79454ce0cffac8e34c5dfd4b9804ec41330334540c19db3cf3fb9191"
target_path: "C:\\Users\\Henrique Zanchi\\projetos\\portal-na\\src\\components\\member\\member-portal-client.tsx"
timestamp: 2026-11-10T14-12-32Z
slug: src-components-member-member-portal-client-tsx
---
Method: dual-agent (A: revisão de design · B: detector automático). Avaliação feita sobre o código-fonte (sem login no app).

Nota 24/40 (Aceitável). H1 3, H2 2, H3 2, H4 2, H5 3, H6 2, H7 3, H8 1, H9 3, H10 3.

Especificidade: identidade da Nova Acrópole no conteúdo e na cor; estrutura genérica (carrossel, grade de ícones, WhatsApp flutuante). Detector: 0 achados em src/components/member e src/app/(member)/portal.

Prioridades:
- [P0] Pagar sem nome nem lugar fixo: cartão de contribuição urgente é slide rotativo (MPC:322), botão "Ver Situação", tile "Economia". Fixar cartão, "Pagar {mês} · R$ X" abrindo o mês em aberto, renomear tile.
- [P1] Home sobrecarregada: 7-13 tiles iguais, vitrine até 12 slides com 2 incondicionais (MPC:392, 452). 4 tiles primários + grupos; vitrine ≤3 sem rotação.
- [P1] "Editar Dados" com três modelos (profile-edit-panel.tsx:240-325). "Meus dados" em leitura + "Pedir correção" por seção + status; labels associados.
- [P1] Upsell do Fortuna e jargão "Mercúrio" no pagamento (contribution-status-panel.tsx ~361, 438). Oferta depois da confirmação; fim humano com recibo.
- [P2] WhatsApp cai no número do aluno (MPC:140); esconder sem número da filial.

Personas: membro 55+, primeiro acesso, celular com uma mão, acessibilidade (texto 9-10px, labels, focus-visible, aria-pressed).

Perguntas: botão único da home; usar dados de uso para organizar; autonomia vs ofertas.
