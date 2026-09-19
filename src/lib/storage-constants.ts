// Extraído pra fora de accountant-actions.ts ("use server" só pode exportar
// async function — exportar uma const junto quebra TODOS os exports do
// módulo, erro real visto ao vivo: "The module has no exports at all").
export const ACCOUNTANT_DOCS_BUCKET = "contador-docs";
