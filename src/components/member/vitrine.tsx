"use client";

import { estadoDoDiarioHoje } from "@/lib/actions/diario-actions";
import { SERIES_PLAY } from "@/lib/acropole-play/series";
import { ChevronRight, Clapperboard, Lock, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Vitrine do Portal (pedido do usuário 2026-10-29): no centro da página inicial, um destaque por vez, trocando a cada
 * 5 segundos — série da Acrópole Play, próximos eventos, contribuição, Criança para o Bem, Fortuna, diário, GAF e
 * voluntariado. Para ao passar o mouse, ao focar com o teclado ou ao tocar; dá para pausar e escolher pelos pontos.
 */
const INTERVALO_MS = 5000;

export type Destaque = { id: string; conteudo: ReactNode };

export function Vitrine({ destaques }: { destaques: Destaque[] }) {
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [parado, setParado] = useState(false); // mouse em cima, foco dentro ou aba escondida
  const toque = useRef<number | null>(null);
  const n = destaques.length;
  const i = n ? atual % n : 0;

  useEffect(() => {
    if (n < 2 || pausado || parado) return;
    const t = setInterval(() => setAtual((a) => a + 1), INTERVALO_MS);
    return () => clearInterval(t);
  }, [n, pausado, parado]);

  useEffect(() => {
    const mudou = () => setParado(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", mudou);
    return () => document.removeEventListener("visibilitychange", mudou);
  }, []);

  if (!n) return null;
  const ir = (passo: number) => setAtual((a) => (((a + passo) % n) + n) % n);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="flex flex-col gap-2"
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setParado(false)}
      onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const inicio = toque.current;
        toque.current = null;
        if (inicio === null) return;
        const dx = e.changedTouches[0].clientX - inicio;
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
      }}
    >
      <div className="grid">
        {destaques.map((d, k) => (
          <div
            key={d.id}
            role="group"
            aria-roledescription="destaque"
            aria-label={`${k + 1} de ${n}`}
            aria-hidden={k !== i}
            inert={k !== i}
            className={`[grid-area:1/1] transition duration-500 motion-reduce:transition-none ${k === i ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-2 opacity-0"}`}
          >
            {d.conteudo}
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-1">
          {destaques.map((d, k) => (
            <button
              key={d.id}
              onClick={() => setAtual(k)}
              aria-label={`Ver destaque ${k + 1} de ${n}`}
              aria-current={k === i}
              className="flex h-6 items-center px-0.5"
            >
              <span className={`block h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-na-green" : "w-1.5 bg-gray-300 dark:bg-gray-700"}`} />
            </button>
          ))}
          <button
            onClick={() => setPausado(!pausado)}
            aria-label={pausado ? "Continuar a troca dos destaques" : "Pausar a troca dos destaques"}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {pausado ? <Play size={11} /> : <Pause size={11} />}
          </button>
        </div>
      )}
    </section>
  );
}

type Tom = "claro" | "verde" | "ouro" | "noite";
const TONS: Record<Tom, { caixa: string; rotulo: string; titulo: string; texto: string; icone: string; acao: string }> = {
  claro: {
    caixa: "border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
    rotulo: "text-na-green-dark dark:text-emerald-400",
    titulo: "text-gray-900 dark:text-gray-100",
    texto: "text-gray-600 dark:text-gray-400",
    icone: "bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400",
    acao: "text-na-green-dark dark:text-emerald-400",
  },
  verde: {
    caixa: "bg-gradient-to-br from-na-green-dark to-na-green text-white",
    rotulo: "text-na-gold",
    titulo: "text-white",
    texto: "text-white/85",
    icone: "bg-white/15 text-white",
    acao: "text-white",
  },
  ouro: {
    caixa: "border border-na-gold/40 bg-na-gold/10 dark:border-amber-900 dark:bg-amber-950/20",
    rotulo: "text-na-gold-dark dark:text-amber-300",
    titulo: "text-gray-900 dark:text-gray-100",
    texto: "text-gray-700 dark:text-gray-300",
    icone: "bg-na-gold/20 text-na-gold-dark dark:text-amber-300",
    acao: "text-na-gold-dark dark:text-amber-300",
  },
  noite: {
    caixa: "border border-na-gold/30 bg-[radial-gradient(120%_140%_at_0%_0%,#0d4a41_0%,#06231f_45%,#020d0b_100%)] text-white",
    rotulo: "text-na-gold",
    titulo: "text-white",
    texto: "text-white/80",
    icone: "border border-na-gold/40 bg-black/30 text-na-gold",
    acao: "text-na-gold",
  },
};

/** Um destaque: ícone (ou capa), rótulo, título, texto e a chamada. Link interno, link externo ou botão. */
export function Anuncio({
  tom = "claro",
  icone,
  capa,
  rotulo,
  titulo,
  texto,
  acao,
  href,
  externo,
  onClick,
  extra,
}: {
  tom?: Tom;
  icone?: ReactNode;
  capa?: ReactNode;
  rotulo: string;
  titulo: string;
  texto?: ReactNode;
  acao: string;
  href?: string;
  externo?: boolean;
  onClick?: () => void;
  extra?: ReactNode;
}) {
  const c = TONS[tom];
  const corpo = (
    <>
      {capa ?? (icone && <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.icone}`}>{icone}</span>)}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[10px] font-bold tracking-wide uppercase ${c.rotulo}`}>{rotulo}</span>
        <span className={`text-[15px] leading-snug font-bold text-balance ${c.titulo}`}>{titulo}</span>
        {texto && <span className={`text-[12px] leading-relaxed ${c.texto}`}>{texto}</span>}
        {extra}
        <span className={`mt-1 flex items-center gap-0.5 text-[12px] font-semibold ${c.acao}`}>
          {acao} <ChevronRight size={13} />
        </span>
      </span>
    </>
  );
  const classe = `flex h-full min-h-[132px] w-full items-center gap-3.5 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 ${c.caixa}`;
  if (href && externo)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classe}>
        {corpo}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={classe}>
        {corpo}
      </Link>
    );
  return (
    <button onClick={onClick} className={classe}>
      {corpo}
    </button>
  );
}

/** Uma série da Acrópole Play por dia, na ordem da lista; o clique entra com o login do Portal. */
export function DestaquePlay() {
  const [dia] = useState(() => Math.floor(Date.now() / 864e5));
  const [semCapa, setSemCapa] = useState(false);
  const serie = SERIES_PLAY[dia % SERIES_PLAY.length];
  return (
    <Anuncio
      tom="verde"
      rotulo={`Acrópole Play · ${serie.colecao}`}
      titulo={serie.titulo}
      texto="Assista quando quiser. Você entra direto, com o seu login do Portal."
      acao="Assistir agora"
      href="/api/portal/acropole-play/entrar"
      externo
      capa={
        serie.capa && !semCapa ? (
          // eslint-disable-next-line @next/next/no-img-element -- capa servida pelo site da Acrópole Play
          <img src={serie.capa} alt="" onError={() => setSemCapa(true)} className="h-[104px] w-[74px] shrink-0 rounded-lg object-cover shadow-md ring-1 ring-white/20" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Clapperboard size={22} />
          </span>
        )
      }
    />
  );
}

/** Diário (só quem participa de GAF): convida sem mostrar nada do que foi escrito. */
export function DestaqueDiario() {
  const [estado, setEstado] = useState<Awaited<ReturnType<typeof estadoDoDiarioHoje>>>(null);
  useEffect(() => {
    estadoDoDiarioHoje()
      .then(setEstado)
      .catch(() => {});
  }, []);
  const pendente = !estado ? null : !estado.prologo ? "O Prólogo de hoje te espera." : !estado.epilogo ? "Falta o Epílogo de hoje." : "Prólogo e Epílogo feitos hoje.";
  return (
    <Anuncio
      tom="noite"
      icone={<Lock size={20} />}
      rotulo="Meu diário"
      titulo="Um lugar onde só a sua consciência entra"
      texto={
        <>
          {pendente ?? "Prólogo pela manhã, Epílogo à noite."}
          {estado && estado.sequencia > 0 && ` Fogo Interno: ${estado.sequencia} ${estado.sequencia === 1 ? "dia" : "dias"} seguidos.`}
        </>
      }
      acao="Abrir o diário"
      href="/diario"
    />
  );
}
