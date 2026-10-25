"use client";

import { useEffect, useState } from "react";
import s from "./tela-tv.module.css";

/** Chave do link da tela guardado na TV: ao religar, /tv volta direto para a mesma tela. */
export const CHAVE_TELA = "portal-tv:token";
const CONSULTA_MS = 3_000;

type Codigo = { codigo: string; segredo: string; expiraEm: string; qrSvg: string; endereco: string };

export function lembrarTela(token: string | null) {
  try {
    if (token) localStorage.setItem(CHAVE_TELA, token);
    else localStorage.removeItem(CHAVE_TELA);
  } catch {
    // navegador de TV sem armazenamento: só não lembra ao religar
  }
}

function telaLembrada() {
  try {
    return localStorage.getItem(CHAVE_TELA);
  } catch {
    return null;
  }
}

/**
 * Tela de conexão da TV (pedido do usuário 2026-10-24): a TV mostra um código de 6 números e
 * um QR; o voluntário lê no celular, escolhe a tela, e a TV muda sozinha. Ver lib/telas-conexao.ts.
 */
export function ParearTv({ nova }: { nova: boolean }) {
  const [codigo, setCodigo] = useState<Codigo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);

  // Pede um código (de novo quando vence ou dá erro).
  useEffect(() => {
    const lembrada = !nova && rodada === 0 ? telaLembrada() : null;
    if (lembrada) {
      window.location.replace(`/tv/${lembrada}`);
      return;
    }
    let vivo = true;
    fetch("/api/tv/conexao", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        if (d.erro) throw Error(d.erro);
        setCodigo(d);
        setErro(null);
      })
      .catch((e) => {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : "Sem conexão com o Portal.");
        setTimeout(() => vivo && setRodada((n) => n + 1), 15_000);
      });
    return () => {
      vivo = false;
    };
  }, [nova, rodada]);

  // Pergunta se o voluntário já escolheu a tela.
  useEffect(() => {
    if (!codigo) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/tv/conexao?s=${encodeURIComponent(codigo.segredo)}`, { cache: "no-store" }).then((x) => x.json());
        if (r.situacao === "conectada") {
          clearInterval(t);
          lembrarTela(r.token);
          window.location.replace(`/tv/${r.token}`);
        } else if (r.situacao === "expirada") {
          clearInterval(t);
          setRodada((n) => n + 1);
        }
      } catch {
        // rede instável: tenta na próxima volta
      }
    }, CONSULTA_MS);
    return () => clearInterval(t);
  }, [codigo]);

  return (
    <main className={s.tela}>
      <div className={s.parear}>
        <div className={s.parearTexto}>
          <div className={s.marcaParear} role="img" aria-label="Nova Acrópole" />
          <p className={s.rotulo}>Conectar esta TV</p>
          {codigo ? (
            <>
              <p className={s.codigo} aria-label={`Código ${codigo.codigo.split("").join(" ")}`}>
                {codigo.codigo.slice(0, 3)}
                <span> </span>
                {codigo.codigo.slice(3)}
              </p>
              <ol className={s.passos}>
                <li>
                  No celular, aponte a câmera para o código ao lado (ou abra <strong>{codigo.endereco}</strong> e digite os números).
                </li>
                <li>Entre no Portal e escolha o que esta TV vai mostrar.</li>
                <li>Pronto: a TV muda sozinha em alguns segundos.</li>
              </ol>
              <p className={s.aviso}>O código muda a cada 15 minutos. Só voluntários da área de Eventos conseguem conectar.</p>
            </>
          ) : (
            <p className={s.passos}>{erro ?? "Gerando o código…"}</p>
          )}
        </div>
        {/* SVG gerado no servidor pela biblioteca qrcode a partir do código (só números). */}
        {codigo && <div className={`${s.qr} ${s.qrParear}`} dangerouslySetInnerHTML={{ __html: codigo.qrSvg }} />}
      </div>
    </main>
  );
}

/** Link trocado ou tela excluída: esquece a tela guardada e volta para a conexão. */
export function TelaVencida() {
  useEffect(() => {
    lembrarTela(null);
    const t = setTimeout(() => window.location.replace("/tv"), 4_000);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className={s.tela}>
      <div className={s.vazio}>
        <div className={s.marca} role="img" aria-label="Nova Acrópole" />
        <h1>Este link foi trocado</h1>
        <p>Abrindo a tela de conexão para escolher de novo…</p>
      </div>
    </main>
  );
}
