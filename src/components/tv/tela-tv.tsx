"use client";

import type { IconeCartao, SlideCartao, SlideEvento, SlideFrase, SlideLista, SlideTela } from "@/lib/telas-eventos";
import type { FraseDaTela } from "@/lib/telas-frases";
import { CalendarDays, Cake, Camera, CircleFadingPlus, CirclePlay, GraduationCap, MapPin, Megaphone, Ticket, Users, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { lembrarTela } from "./parear-tv";
import { tempoDoSlide } from "@/lib/tempo-tela";
import s from "./tela-tv.module.css";

const ATUALIZA_MS = 5 * 60_000; // dados novos e cartazes com link renovado
const RECARREGA_MS = 6 * 60 * 60_000; // pega versões novas do Portal
const FUSO = "America/Sao_Paulo";

const ICONES: Record<IconeCartao | SlideLista["icone"], LucideIcon> = {
  matricula: GraduationCap,
  aviso: Megaphone,
  instagram: Camera,
  play: CirclePlay,
  programacao: CalendarDays,
  aniversariantes: Cake,
};

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

function Data({ dia, mes, semana, hora }: { dia: string; mes: string; semana: string; hora: string | null }) {
  return (
    <div className={`${s.quando} ${s.entra}`}>
      <span className={s.dia}>{dia}</span>
      <div className={s.calendario}>
        <span className={s.mes}>{mes}</span>
        <span className={s.semana}>{semana}</span>
        {hora && <span className={s.hora}>{hora}</span>}
      </div>
    </div>
  );
}

function Inscricao({ qrSvg, chamada, explicacao, endereco }: { qrSvg: string; chamada: string; explicacao: string; endereco: string | null }) {
  return (
    <div className={`${s.inscricao} ${s.entra}`}>
      {/* SVG gerado no servidor pela biblioteca qrcode (só caminhos, sem texto vindo de fora). */}
      <div className={s.qr} dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <div className={s.chamada}>
        <strong>{chamada}</strong>
        <span>{explicacao}</span>
        {endereco && <span className={s.endereco}>{endereco}</span>}
      </div>
    </div>
  );
}

function SlideDeEvento({ e }: { e: SlideEvento }) {
  const corpo = useCaber();
  return (
    <>
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
        <Data {...e} />
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
        <Inscricao qrSvg={e.qrSvg} chamada="Inscreva-se pelo celular" explicacao={e.inscricaoNoPortal ? "Aponte a câmera para o código e entre no Portal do Aluno." : "Aponte a câmera para o código."} endereco={e.linkVisivel} />
      </div>
    </>
  );
}

/** Painel esquerdo dos conteúdos sem cartaz: ícone grande em dourado sobre o verde da marca. */
function Emblema({ icone }: { icone: IconeCartao | SlideLista["icone"] }) {
  const Icone = ICONES[icone] ?? CircleFadingPlus;
  return (
    <div className={`${s.cartaz} ${s.emblema}`}>
      <div className={`${s.emblemaIcone} ${s.entra}`}>
        <Icone aria-hidden strokeWidth={1.4} />
      </div>
    </div>
  );
}

function SlideDeCartao({ c }: { c: SlideCartao }) {
  const corpo = useCaber();
  return (
    <>
      <Emblema icone={c.icone} />
      <div className={s.dados}>
        {c.quando ? <Data {...c.quando} /> : <p className={`${s.rotulo} ${s.entra}`}>{c.rotulo}</p>}
        <div ref={corpo} className={`${s.corpo} ${s.entra}`}>
          <h1 className={`${s.titulo} ${classeTitulo(c.titulo)}`}>{c.titulo}</h1>
          {c.texto && <p className={`${s.descricao} ${s.descricaoCartao}`}>{c.texto}</p>}
        </div>
        {c.qrSvg ? <Inscricao qrSvg={c.qrSvg} chamada={c.chamada} explicacao="Aponte a câmera para o código." endereco={c.linkVisivel} /> : c.chamada ? <p className={`${s.chamadaSolta} ${s.entra}`}>{c.chamada}</p> : <span />}
      </div>
    </>
  );
}

function SlideDeFrase({ f }: { f: FraseDaTela }) {
  return (
    <div className={s.frase}>
      <blockquote className={`${s.entra} ${f.texto.length > 90 ? s.fraseLonga : ""}`}>
        <p>{f.texto}</p>
        <footer>
          <strong>{f.autor}</strong>
          {f.obra && <> · {f.obra}</>}
        </footer>
      </blockquote>
    </div>
  );
}

function SlideDeLista({ l }: { l: SlideLista }) {
  const colunas = l.icone === "aniversariantes" && l.itens.length > 7;
  return (
    <>
      <Emblema icone={l.icone} />
      <div className={s.lista}>
        <h1 className={`${s.titulo} ${s.tituloLista} ${s.entra}`}>{l.titulo}</h1>
        <ul className={`${s.itens} ${colunas ? s.itensColunas : ""} ${s.entra}`}>
          {l.itens.map((i, n) => (
            <li key={n}>
              <span className={s.itemDestaque}>{i.destaque}</span>
              <span className={s.itemTexto}>{i.texto}</span>
              {i.detalhe && <span className={s.itemDetalhe}>{i.detalhe}</span>}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Slide({ slide, ativo, frase }: { slide: SlideTela; ativo: boolean; frase: FraseDaTela | null }) {
  return (
    <section className={`${s.slide} ${slide.tipo === "frase" ? s.slideCheio : ""} ${ativo ? s.ativo : ""}`} aria-hidden={!ativo}>
      {slide.tipo === "evento" ? <SlideDeEvento e={slide} /> : slide.tipo === "cartao" ? <SlideDeCartao c={slide} /> : slide.tipo === "frase" ? frase && <SlideDeFrase f={frase} /> : <SlideDeLista l={slide} />}
    </section>
  );
}

/** Tela de TV da filial: eventos e conteúdos em rotação, cada slide pelo tempo de leitura (pedidos do usuário 2026-10-24/25). */
export function TelaTv({ slides, filial, token }: { slides: SlideTela[]; filial: string; token: string }) {
  const router = useRouter();
  // Contador só cresce: dá o slide (atual % total) e quantas voltas a rotação já deu.
  const [atual, setAtual] = useState(0);
  const total = slides.length;
  const indice = total ? atual % total : 0;
  // Uma frase diferente a cada volta, seguindo a lista a partir de um ponto sorteado pelo servidor.
  // O ponto fica guardado: a atualização dos dados (5 min) não troca a frase no meio da exibição.
  const posFrase = slides.findIndex((x) => x.tipo === "frase");
  const slideFrase = posFrase >= 0 ? (slides[posFrase] as SlideFrase) : null;
  const [inicioFrase] = useState(() => slideFrase?.inicio ?? 0);
  // A volta conta a partir do slide anterior ao da frase, para não trocar o texto enquanto ela pré-carrega ou sai.
  const volta = Math.max(0, Math.floor((atual - posFrase + 1) / Math.max(total, 1)));
  const frase = slideFrase?.frases.length ? slideFrase.frases[(inicioFrase + volta) % slideFrase.frases.length] : null;

  // Cada slide fica o tempo de ler o que mostra (lib/tempo-tela.ts), e não mais 10 s fixos.
  const duracao = tempoDoSlide(slides[indice], frase);
  useEffect(() => {
    if (total < 2) return;
    const t = setTimeout(() => setAtual((i) => i + 1), duracao);
    return () => clearTimeout(t);
  }, [atual, total, duracao]);

  // Guarda esta tela: ao religar, a TV que abre /tv volta direto para cá.
  useEffect(() => lembrarTela(token), [token]);

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
  const cheio = slides[indice]?.tipo === "frase";

  return (
    <main className={s.tela}>
      {slides.map((e, i) => (visiveis.has(i) ? <Slide key={e.id} slide={e} ativo={i === indice} frase={frase} /> : null))}
      <footer className={`${s.rodape} ${cheio ? s.rodapeCheio : ""}`}>
        {assinatura}
        <Relogio />
        {total > 1 && (
          <div className={s.progresso}>
            <i key={atual} style={{ animationDuration: `${duracao}ms` }} />
          </div>
        )}
      </footer>
    </main>
  );
}
