"use client";

import { LinhaAtalho, ListaAtalhos } from "@/components/member/lista-atalhos";
import { BookOpenText, Castle, Clapperboard, Library, NotebookPen, PlaySquare } from "lucide-react";

/**
 * Área de Estudos. Acrópole Play e Apostilas só aparecem se a filial liberou (ver recursos-filial.ts).
 * Em listas, no mesmo formato da página inicial (10/11/2026: antes eram três botões verdes, um escuro, um em contorno e
 * dois quadrinhos, cada um de um jeito).
 */
export function StudyAreaPanel({
  mostrarAcropolePlay = false,
  mostrarBastioes = false,
}: {
  mostrarAcropolePlay?: boolean;
  /** Apostilas: aceito e ignorado até haver conteúdo (o botão foi escondido em 26/10/2026). */
  mostrarApostilas?: boolean;
  /** Bastiões: só membros (2º nível em diante, FV, HD, dirigentes, provacionistas); N1 e programa complementar não veem. */
  mostrarBastioes?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Ferramentas de estudo do próprio aluno (2026-10-29): anotações das aulas e livros. O diário fica no GAF. */}
      <ListaAtalhos titulo="Meus estudos">
        <LinhaAtalho icon={<NotebookPen size={16} />} title="Anotações das aulas" subtitle="Anote cada tema, resuma para a prova e compartilhe" href="/estudos/anotacoes" />
        <LinhaAtalho icon={<Library size={16} />} title="Meus livros" subtitle="O que estou lendo e o que já li" href="/estudos/livros" />
      </ListaAtalhos>
      <ListaAtalhos titulo="Conteúdos da Nova Acrópole">
        {mostrarAcropolePlay && (
          <LinhaAtalho icon={<Clapperboard size={16} />} title="Acrópole Play" subtitle="Séries e cursos em vídeo, com o seu login do Portal" href="/api/portal/acropole-play/entrar" externo />
        )}
        {/* Biblioteca da Nova Acrópole Brasil, para todos (29/10/2026; antes o botão levava ao Bastiões, só para membros). */}
        <LinhaAtalho icon={<BookOpenText size={16} />} title="Biblioteca" subtitle="Acervo da Nova Acrópole Brasil" href="https://biblioteca.acropolebrasil.com.br/" externo />
        {mostrarBastioes && <LinhaAtalho icon={<Castle size={16} />} title="Bastiões" subtitle="Artigos e livros para membros" href="https://bastiao.oinabn.com.br/" externo />}
        {/* Apostilas: escondidas até haver conteúdo (26/10/2026). `mostrarApostilas` fica para quando houver. */}
        <LinhaAtalho icon={<PlaySquare size={16} />} title="Canal no YouTube" subtitle="Palestras e vídeos abertos da Nova Acrópole" href="https://www.youtube.com/novaacropole" externo />
      </ListaAtalhos>
    </div>
  );
}
