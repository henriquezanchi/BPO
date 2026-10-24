"use client";

import type { SlideTela } from "@/lib/telas-eventos";
import { MapPin, Ticket, Users, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import s from "./tela-tv.module.css";

const TROCA_MS = 10_000;
const ATUALIZA_MS = 5 * 60_000; // dados novos e cartazes com link renovado
const RECARREGA_MS = 6 * 60 * 60_000; // pega versões novas do Portal
const FUSO = "America/Sao_Paulo";

function classeTitulo(titulo: string) {
  if (titulo.length <= 40) return s.tituloCurto;
  if (titulo.length <= 80) return s.tituloMedio;
  return s.tituloLongo;
}

// Relógio: instante arredondado a 15 s (valor estável entre leituras); no servidor não há hora.
const assinarRelogio = (aviso: () => void) => {
  const t = setInterval(aviso, 15_000);
  return () => clearInterval(t);
};
const instante = () => Math.floor(Date.now() / 15_000) * 15_000;

function Relogio() {
  const marca = useSyncExternalStore(assinarRelogio, instante, () => null);
  if (marca === null) return null;
  const agora = new Date(marca);
  return (
    <div className={s.relogio}>
      <span>{agora.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" })}</span>
      <strong>{agora.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" })}</strong>
    </div>
  );
}

// Níveis de aperto do bloco do meio quando o evento não cabe (título longo + descrição + muitos dados):
// 1 descrição em 2 linhas, 2 sem descrição, 3 título em 2 linhas. Assim o QR nunca desce sobre o rodapé.
const NIVEIS_APERTO = 3;

function useCaber() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ajustar = () => {
      for (let nivel = 0; nivel <= NIVEIS_APERTO; nivel++) {
        el.dataset.aperto = String(nivel);
        if (el.scrollHeight <= el.clientHeight + 1) break;
      }
    };
    ajustar();
    document.fonts?.ready.then(ajustar);
    const observador = new ResizeObserver(ajustar);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return ref;
}

function Slide({ e, ativo }: { e: SlideTela; ativo: boolean }) {
  const corpo = useCaber();
  return (
    <section className={`${s.slide} ${ativo ? s.ativo : ""}`} aria-hidden={!ativo}>
      <div className={s.cartaz}>
        {e.cartaz ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- cartaz externo (Ulisses) ou link assinado; sem otimização */}
            <img className={s.desfoque} src={e.cartaz} alt="" />
            <div className={s.moldura}>
              {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
              <img className={s.imagem} src={e.cartaz} alt={`Cartaz: ${e.titulo}`} />
            </div>
          </>
        ) : (
          <div className={s.semCartaz}>
            <div className={s.marca} role="img" aria-label="Nova Acrópole" />
          </div>
        )}
      </div>

      <div className={s.dados}>
        <div className={`${s.quando} ${s.entra}`}>
          <span className={s.dia}>{e.dia}</span>
          <div className={s.calendario}>
            <span className={s.mes}>{e.mes}</span>
            <span className={s.semana}>{e.semana}</span>
            {e.hora && <span className={s.hora}>{e.hora}</span>}
          </div>
        </div>

        <div ref={corpo} className={`${s.corpo} ${s.entra}`}>
          <h1 className={`${s.titulo} ${classeTitulo(e.titulo)}`}>{e.titulo}</h1>
          {e.descricao && <p className={s.descricao}>{e.descricao}</p>}
          <ul className={s.meta}>
            {e.local && (
              <li>
                <MapPin aria-hidden /> {e.local}
              </li>
            )}
            <li>
              <Ticket aria-hidden /> {e.preco}
            </li>
            <li>
              <Users aria-hidden /> {e.publico}
            </li>
            {e.lanche && (
              <li>
                <UtensilsCrossed aria-hidden /> Lanche compartilhado
              </li>
            )}
          </ul>
        </div>

        <div className={`${s.inscricao} ${s.entra}`}>
          {/* SVG gerado no servidor pela biblioteca qrcode (só caminhos, sem texto vindo de fora). */}
          <div className={s.qr} dangerouslySetInnerHTML={{ __html: e.qrSvg }} />
          <div className={s.chamada}>
            <strong>Inscreva-se pelo celular</strong>
            <span>{e.inscricaoNoPortal ? "Aponte a câmera para o código e entre no Portal do Aluno." : "Aponte a câmera para o código."}</span>
            <span className={s.endereco}>{e.linkVisivel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Tela de TV da filial: eventos em rotação a cada 10 s (pedido do usuário 2026-10-24). */
export function TelaTv({ slides, filial }: { slides: SlideTela[]; filial: string }) {
  const router = useRouter();
  const [atual, setAtual] = useState(0);
  const total = slides.length;
  const indice = total ? atual % total : 0;

  useEffect(() => {
    if (total < 2) return;
    const t = setInterval(() => setAtual((i) => (i + 1) % total), TROCA_MS);
    return () => clearInterval(t);
  }, [total]);

  useEffect(() => {
    const dados = setInterval(() => router.refresh(), ATUALIZA_MS);
    const pagina = setTimeout(() => window.location.reload(), RECARREGA_MS);
    // Mantém a tela acesa em navegadores de TV que suportam (sem suporte, segue normal).
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = () =>
      (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        ?.request("screen")
        .then((w) => (trava = w))
        .catch(() => {});
    pedir();
    const aoVoltar = () => document.visibilityState === "visible" && pedir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(dados);
      clearTimeout(pagina);
      document.removeEventListener("visibilitychange", aoVoltar);
      trava?.release().catch(() => {});
    };
  }, [router]);

  const assinatura = (
    <div className={s.assinatura}>
      <div className={s.marca} role="img" aria-label="Nova Acrópole" />
      <span>{filial}</span>
    </div>
  );

  if (!total) {
    return (
      <main className={s.tela}>
        <div className={s.vazio}>
          <div className={s.marca} role="img" aria-label="Nova Acrópole" />
          <h1>Novos eventos em breve</h1>
          <p>{filial}</p>
          <footer className={s.rodape}>
            <span />
            <Relogio />
          </footer>
        </div>
      </main>
    );
  }

  // Monta só o slide atual, o anterior (saindo) e o próximo (cartaz já carregando).
  const visiveis = new Set([indice, (indice + 1) % total, (indice - 1 + total) % total]);

  return (
    <main className={s.tela}>
      {slides.map((e, i) => (visiveis.has(i) ? <Slide key={e.id} e={e} ativo={i === indice} /> : null))}
      <footer className={s.rodape}>
        {assinatura}
        <Relogio />
        {total > 1 && (
          <div className={s.progresso}>
            <i key={atual} style={{ animationDuration: `${TROCA_MS}ms` }} />
          </div>
        )}
      </footer>
    </main>
  );
}
