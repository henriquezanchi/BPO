"use client";

import { estadoDoDiarioHoje, registrarTratak } from "@/lib/actions/diario-actions";
import { CheckCircle2, Target } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tratak (pedido do usuário 2026-10-31: "igual tinha no antigo diário"): olhar fixo num ponto, sem piscar nem se mover,
 * por 3 minutos. Como no diário antigo: instrução, tela cheia com o círculo e o ponto, e só conta se chegar ao fim —
 * mexer o mouse (ou tocar duas vezes na tela, no celular) interrompe. Concluído, entra nas práticas do dia de hoje.
 */
const DURACAO_MS = 3 * 60 * 1000;
const CARENCIA_MS = 2000; // o clique de "Iniciar" e o ajuste inicial não interrompem

type Fase = "intro" | "pratica" | "interrompida" | "concluida" | "registrada";

export function BotaoTratak({ feitoHoje, variante = "cartao", registrar }: { feitoHoje?: boolean; variante?: "cartao" | "linha"; registrar?: Registrar }) {
  const [aberto, setAberto] = useState(false);
  const [feito, setFeito] = useState(!!feitoHoje);
  // No quadro do GAF a situação de hoje vem do servidor depois de abrir (sem nenhum texto do diário).
  useEffect(() => {
    if (feitoHoje === undefined) estadoDoDiarioHoje().then((e) => e?.tratak && setFeito(true), () => {});
  }, [feitoHoje]);
  return (
    <>
      {variante === "cartao" ? (
        <button
          onClick={() => setAberto(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-na-gold/40 bg-gradient-to-br from-[#0b1f1c] to-na-green-dark p-3.5 text-left text-white shadow-sm transition hover:brightness-110"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-na-gold/50 text-na-gold">
            <Target size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">Tratak</span>
            <span className="block text-[12px] text-white/80">{feito ? "Feito hoje. Pode repetir quando quiser." : "3 minutos de concentração, olhar fixo no ponto"}</span>
          </span>
          {feito && <CheckCircle2 size={18} className="shrink-0 text-na-gold" aria-label="Feito hoje" />}
        </button>
      ) : (
        <button onClick={() => setAberto(true)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left dark:border-gray-700">
          <Target size={18} className={feito ? "shrink-0 text-na-green" : "shrink-0 text-gray-400"} />
          <span className={`flex-1 text-[13px] ${feito ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>Tratak · 3 min</span>
          <span className="text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">{feito ? "Repetir" : "Fazer"}</span>
        </button>
      )}
      {aberto && <PraticaTratak aoFechar={() => setAberto(false)} aoRegistrar={() => setFeito(true)} registrar={registrar} />}
    </>
  );
}

/** Quem grava a prática concluída: o diário (hoje) por padrão; o diário de FV passa a sua (dia escolhido). */
type Registrar = () => Promise<{ ok: true } | { ok: false; error: string }>;

export function PraticaTratak({ aoFechar, aoRegistrar, registrar = registrarTratak }: { aoFechar: () => void; aoRegistrar: () => void; registrar?: Registrar }) {
  const [fase, setFase] = useState<Fase>("intro");
  const [explicar, setExplicar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const tela = useRef<HTMLDivElement>(null);
  const inicio = useRef(0);
  const ultimoToque = useRef(0);
  const trava = useRef<{ release: () => Promise<void> } | null>(null);

  const sairDaTelaCheia = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    trava.current?.release().catch(() => {});
    trava.current = null;
  }, []);

  const interromper = useCallback(() => {
    if (Date.now() - inicio.current < CARENCIA_MS) return;
    sairDaTelaCheia();
    setFase("interrompida");
  }, [sairDaTelaCheia]);

  function comecar() {
    inicio.current = Date.now();
    setFase("pratica");
    tela.current?.requestFullscreen?.().catch(() => {});
    // A tela não pode apagar no meio dos 3 minutos (celular).
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    wl?.request("screen").then((t) => (trava.current = t), () => {});
  }

  useEffect(() => {
    if (fase !== "pratica") return;
    const fim = setTimeout(() => {
      sairDaTelaCheia();
      setFase("concluida");
    }, DURACAO_MS);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && interromper();
    // Saiu da tela cheia (Esc do navegador) ou trocou de aplicativo: interrompe.
    const telaCheia = () => !document.fullscreenElement && Date.now() - inicio.current > CARENCIA_MS && interromper();
    const visibilidade = () => document.hidden && interromper();
    window.addEventListener("keydown", tecla);
    document.addEventListener("fullscreenchange", telaCheia);
    document.addEventListener("visibilitychange", visibilidade);
    return () => {
      clearTimeout(fim);
      window.removeEventListener("keydown", tecla);
      document.removeEventListener("fullscreenchange", telaCheia);
      document.removeEventListener("visibilitychange", visibilidade);
    };
  }, [fase, interromper, sairDaTelaCheia]);

  useEffect(() => sairDaTelaCheia, [sairDaTelaCheia]);

  function tocar() {
    // Dois toques seguidos interrompem; um toque solto (sem querer) não.
    const agora = Date.now();
    if (agora - ultimoToque.current < 600) interromper();
    ultimoToque.current = agora;
  }

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    const r = await registrar().catch(() => ({ ok: false as const, error: "Não foi possível registrar agora. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) return setErro(r.error);
    aoRegistrar();
    setFase("registrada");
  }

  const botao = "flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-[15px] font-bold transition";
  return (
    <div ref={tela} role="dialog" aria-modal="true" aria-label="Prática de Tratak" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05100e] text-[#f3ead2]">
      {fase === "intro" && (
        <div className="flex w-full max-w-md flex-col items-center gap-5 px-6 text-center">
          <Target size={44} className="text-na-gold" />
          <div className="flex items-center gap-3">
            <h2 className="text-[26px] font-black tracking-wide text-na-gold">Prática de Tratak</h2>
            <button onClick={() => setExplicar(!explicar)} aria-expanded={explicar} aria-label="O que é o Tratak?" className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-na-gold/70 text-sm font-bold text-na-gold">
              ?
            </button>
          </div>
          {explicar && (
            <p className="text-[14px] leading-relaxed text-white/80">
              Exercício milenar de concentração: manter o olhar fixo num único ponto, o círculo central, sem piscar e sem mover o corpo. O objetivo é domar a mente agitada pelo
              domínio do corpo.
            </p>
          )}
          <div className="flex flex-col gap-3 rounded-2xl border border-na-gold/25 bg-na-gold/5 p-5 text-[15px] leading-relaxed">
            <p>Posicione o aparelho a cerca de 1 metro de distância, na altura dos olhos.</p>
            <p>Sente-se com a coluna ereta. Respire fundo e toque em iniciar.</p>
          </div>
          <p className="text-[13px] text-white/70 italic">A prática dura 3 minutos. Mantenha o olhar fixo no ponto central.</p>
          <p className="text-[13px] font-semibold text-na-laranja">Para encerrar antes, mova o mouse ou toque duas vezes na tela.</p>
          <button onClick={comecar} className={`${botao} bg-na-gold text-[#1b1400] hover:brightness-105`}>
            Iniciar Tratak
          </button>
          <button onClick={aoFechar} className="min-h-11 text-[14px] text-white/70 underline">
            Voltar
          </button>
        </div>
      )}

      {fase === "pratica" && (
        <div onPointerMove={(e) => e.pointerType === "mouse" && interromper()} onTouchEnd={tocar} className="flex h-full w-full cursor-none items-center justify-center bg-black">
          <div className="flex aspect-square w-[min(85vw,500px)] items-center justify-center rounded-full border-[8px] border-white">
            <div className="aspect-square w-[min(6vw,36px)] rounded-full bg-white" />
          </div>
        </div>
      )}

      {fase === "interrompida" && (
        <div className="flex w-full max-w-md flex-col items-center gap-5 px-6 text-center">
          <h2 className="text-[22px] font-black">Prática interrompida</h2>
          <p className="text-[15px] leading-relaxed text-white/80">Como os 3 minutos não foram completados, esta sessão não entra no seu registro de práticas.</p>
          <button onClick={() => setFase("intro")} className={`${botao} bg-na-gold text-[#1b1400]`}>
            Tentar de novo
          </button>
          <button onClick={aoFechar} className="min-h-11 text-[14px] text-white/70 underline">
            Voltar
          </button>
        </div>
      )}

      {fase === "concluida" && (
        <div className="flex w-full max-w-md flex-col items-center gap-5 px-6 text-center">
          <CheckCircle2 size={64} className="text-na-gold" />
          <h2 className="text-[26px] font-black tracking-wide">Tratak realizado</h2>
          <p className="text-[15px] text-white/80">O foco e a disciplina foram forjados mais um pouco hoje.</p>
          {erro && <p role="alert" className="text-[13px] font-semibold text-na-laranja">{erro}</p>}
          <button onClick={confirmar} disabled={salvando} className={`${botao} bg-na-gold text-[#1b1400] disabled:opacity-60`}>
            {salvando ? "Registrando..." : "Confirmar prática"}
          </button>
        </div>
      )}

      {fase === "registrada" && (
        <div className="flex w-full max-w-md flex-col items-center gap-5 px-6 text-center">
          <CheckCircle2 size={56} className="text-na-gold" />
          <p className="text-[16px] font-semibold">Registrado nas práticas de hoje do seu diário.</p>
          <button onClick={aoFechar} className={`${botao} bg-na-gold text-[#1b1400]`}>
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}
