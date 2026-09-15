// Fora de reaction-actions.ts de propósito: um arquivo "use server" só pode
// exportar funções async — exportar esta constante lá quebrava o módulo
// inteiro (erro real: "A 'use server' file can only export async
// functions, found object"), derrubando qualquer página que importasse
// dele, mesmo sem chamar a action.
export const EMOJIS_PERMITIDOS = ["👍", "❤️", "😂", "😮", "🙏"];
