// Extraído pra fora de accountant-actions.ts ("use server" só pode exportar
// async function — exportar uma const junto quebra TODOS os exports do
// módulo, erro real visto ao vivo: "The module has no exports at all").
export const ACCOUNTANT_DOCS_BUCKET = "contador-docs";
// Bucket PÚBLICO (diferente do contador-docs) — foto de perfil é baixa
// sensibilidade e precisa aparecer em vários lugares (header do membro,
// detalhe no Painel do Diretor) sem gerar URL assinada toda vez.
export const MEMBER_AVATARS_BUCKET = "member-avatars";
