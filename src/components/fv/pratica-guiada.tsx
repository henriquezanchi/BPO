"use client";

import { ETAPAS_TEMPLO } from "@/lib/fv/comum";
import { CheckCircle2, Music, Shapes, Sparkles, Landmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Práticas guiadas do diário de FV (2026-10-31), como no diário antigo (PracticeOverlay.jsx e App.jsx):
 * - Câmara de Purificação: Ária de Bach (~5 min); termina com a música; "Finalizar" a partir de 3 min.
 * - Templo Interior: Beethoven (~8 min 30 s); ao fim, até qual etapa a pessoa se manteve consciente.
 * - Recitar Código de Dignidade, Recitar 7 Fases da ED e Formas Geométricas: tela de foro íntimo, sem texto, tela acesa.
 * Encerrar antes não registra. O Tratak tem tela própria (components/diario/tratak.tsx).
 */
export type PraticaGuiadaChave = "camara" | "templo" | "recitarHonra" | "recitar7Fases" | "formasGeometricas";

type Fase = "intro" | "pratica" | "fim";
const FINALIZAR_CAMARA_MS = 180_000;

type TravaTela = { release: () => Promise<void> };
async function manterTelaAcesa(): Promise<TravaTela | null> {
  const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<TravaTela> } }).wakeLock;
  return wl ? wl.request("screen").catch(() => null) : null;
}

export function PraticaGuiada({
  chave,
  etapasFeitas,
  aoConcluir,
  aoFechar,
}: {
  chave: PraticaGuiadaChave;
  etapasFeitas: string[];
  aoConcluir: (etapas?: string[]) => Promise<string | null>; // devolve o erro, se houver
  aoFechar: () => void;
}) {
  const recitacao = chave === "recitarHonra" || chave === "recitar7Fases" || chave === "formasGeometricas";
  const [fase, setFase] = useState<Fase>(recitacao ? "pratica" : "intro");
  const [podeFinalizar, setPodeFinalizar] = useState(false);
  const [etapas, setEtapas] = useState<string[]>(etapasFeitas);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const trava = useRef<TravaTela | null>(null);

  const soltar = () => {
    trava.current?.release().catch(() => {});
    trava.current = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    if (fase !== "pratica") return;
    manterTelaAcesa().then((t) => (trava.current = t));
    if (chave !== "camara") return;
    const t = setTimeout(() => setPodeFinalizar(true), FINALIZAR_CAMARA_MS);
    return () => clearTimeout(t);
  }, [fase, chave]);

  useEffect(() => () => soltar(), []);

  function iniciar() {
    setFase("pratica");
    document.documentElement.requestFullscreen?.().catch(() => {});
    audio.current?.play().catch(() => {});
  }

  function encerrar() {
    audio.current?.pause();
    soltar();
    aoFechar();
  }

  function terminar() {
    audio.current?.pause();
    soltar();
    setFase("fim");
  }

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    const e = await aoConcluir(chave === "templo" ? etapas : undefined);
    setSalvando(false);
    if (e) return setErro(e);
    aoFechar();
  }

  const botao = "flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-[15px] font-bold transition";
  const voltar = (
    <button onClick={encerrar} className="min-h-11 text-[14px] text-white/70 underline">
      {recitacao ? "Cancelar e voltar" : "Voltar"}
    </button>
  );
  const titulo = { camara: "Câmara de Purificação", templo: "Templo Interior", recitarHonra: "Código de Dignidade", recitar7Fases: "7 Fases da ED", formasGeometricas: "Formas Geométricas" }[chave];
  const Icone = chave === "camara" ? Music : chave === "templo" ? Landmark : chave === "formasGeometricas" ? Shapes : Sparkles;

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#05100e] px-6 py-10 text-[#f3ead2]">
      {(chave === "camara" || chave === "templo") && <audio ref={audio} src={chave === "templo" ? "/fv/beethoven.mp3" : "/fv/aria-bach.mp3"} preload="none" onEnded={terminar} />}
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        {fase !== "fim" && <Icone size={44} className="text-na-gold" />}

        {fase === "intro" && chave === "camara" && (
          <>
            <h2 className="text-[26px] font-black text-na-gold">Câmara de Purificação</h2>
            <div className="flex flex-col gap-3 rounded-2xl border border-na-gold/25 bg-na-gold/5 p-5 text-[15px] leading-relaxed">
              <p>Sente-se de forma confortável, feche os olhos e respire profundamente.</p>
              <p>Ao iniciar, a Ária de Bach começará a tocar. Deixe a música lavar seus pensamentos.</p>
            </div>
            <p className="text-[13px] text-white/70 italic">A prática terminará automaticamente ao fim da melodia (~5 min).</p>
            <button onClick={iniciar} className={`${botao} bg-na-gold text-[#1b1400]`}>
              Iniciar Purificação
            </button>
            {voltar}
          </>
        )}

        {fase === "intro" && chave === "templo" && (
          <>
            <h2 className="text-[26px] font-black text-na-gold">Templo Interior</h2>
            <div className="flex flex-col gap-3 rounded-2xl border border-na-gold/25 bg-na-gold/5 p-5 text-[15px] leading-relaxed">
              <p>Feche os olhos e inicie sua jornada para dentro de si.</p>
              <p>Ao som de Beethoven, avance o quanto puder pelas etapas do Templo.</p>
            </div>
            <p className="text-[13px] text-white/70 italic">Duração: ~8 minutos e 30 segundos. Ao final da sinfonia, você registrará seu progresso.</p>
            <button onClick={iniciar} className={`${botao} bg-na-gold text-[#1b1400]`}>
              Adentrar o Templo
            </button>
            {voltar}
          </>
        )}

        {fase === "pratica" && (chave === "camara" || chave === "templo") && (
          <>
            <p className="text-[20px] font-semibold text-white/85">{chave === "camara" ? "Respire e ouça..." : "Caminhando pelo Templo..."}</p>
            {chave === "camara" && podeFinalizar && (
              <button onClick={terminar} className={`${botao} bg-na-gold text-[#1b1400]`}>
                Finalizar Purificação
              </button>
            )}
            <button onClick={encerrar} className="min-h-11 text-[14px] text-white/70 underline">
              Encerrar prática
            </button>
            <p className="text-[12px] text-white/70">Encerrar antes do fim não registra a prática.</p>
          </>
        )}

        {fase === "pratica" && recitacao && (
          <>
            <h2 className="text-[26px] font-black text-na-gold">{titulo}</h2>
            <div className="flex flex-col gap-3 rounded-2xl border border-na-gold/25 bg-na-gold/5 p-5 text-[15px] leading-relaxed">
              {chave === "formasGeometricas" ? (
                <p>Visualize e trace mentalmente as formas geométricas básicas (círculo, quadrado, triângulo) com atenção plena, sustentando cada forma na mente antes de passar à seguinte.</p>
              ) : (
                <p>Esta é uma prática de foro íntimo e sagrado. Faça sua recitação com atenção plena e propósito.</p>
              )}
              <p className="text-[13px] text-white/70">A tela permanecerá ativa para que o celular não bloqueie durante sua prática.</p>
            </div>
            {erro && <p role="alert" className="text-[13px] font-semibold text-na-laranja">{erro}</p>}
            <button onClick={confirmar} disabled={salvando} className={`${botao} bg-na-gold text-[#1b1400] disabled:opacity-60`}>
              {salvando ? "Registrando..." : chave === "formasGeometricas" ? "Prática concluída" : "Recitação concluída"}
            </button>
            {voltar}
          </>
        )}

        {fase === "fim" && (
          <>
            <CheckCircle2 size={60} className="text-na-gold" />
            {chave === "camara" ? (
              <>
                <h2 className="text-[26px] font-black">Purificação concluída</h2>
                <p className="text-[15px] text-white/80">Sua mente agora está serena e limpa como um espelho d&apos;água.</p>
              </>
            ) : (
              <>
                <h2 className="text-[26px] font-black">Jornada concluída</h2>
                <p className="text-[15px] text-white/80">Até qual etapa você conseguiu se manter consciente hoje?</p>
                <div className="flex w-full flex-col gap-2 text-left">
                  {ETAPAS_TEMPLO.map((e) => (
                    <label key={e.chave} className="flex min-h-11 items-center gap-3 rounded-xl border border-na-gold/25 px-4">
                      <input type="checkbox" checked={etapas.includes(e.chave)} onChange={() => setEtapas((a) => (a.includes(e.chave) ? a.filter((x) => x !== e.chave) : [...a, e.chave]))} className="size-5 accent-[#ffca00]" />
                      <span className="text-[15px]">{e.rotulo}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {erro && <p role="alert" className="text-[13px] font-semibold text-na-laranja">{erro}</p>}
            <button onClick={confirmar} disabled={salvando} className={`${botao} bg-na-gold text-[#1b1400] disabled:opacity-60`}>
              {salvando ? "Registrando..." : chave === "camara" ? "Confirmar prática" : "Confirmar progresso"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
