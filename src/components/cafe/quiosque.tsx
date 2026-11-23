"use client";

import { CafeAutoatendimento } from "@/components/member/cafe-autoatendimento";
import { buscarNoQuiosque, cancelarNoQuiosque, comprarNoQuiosque, confirmarNoQuiosque } from "@/lib/actions/cafe-actions";
import type { FortunaProduto } from "@/lib/fortuna/client";
import { Delete, Loader2, Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/**
 * Quiosque da lanchonete (23/11/2026; regras em lib/quiosque.ts). Computador ou tablet da escola: o aluno procura o
 * nome, confirma com os 4 primeiros dígitos do CPF, marca o que pegou e paga com o saldo do Fortuna. Volta sozinho ao
 * começo depois da compra ou de 1 minuto parado.
 */
type Aluno = { nome: string; ref: string };
type Sessao = { sessao: string; nome: string; saldo: number | null };
const PARADO_MS = 60_000;

export function Quiosque(p: { caixa: string; cashierId: number; produtos: FortunaProduto[]; demo?: boolean }) {
  const [texto, setTexto] = useState("");
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [escolhido, setEscolhido] = useState<Aluno | null>(null);
  const [digitos, setDigitos] = useState("");
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const ultimoToque = useRef(0);

  const recomecar = useCallback(() => {
    setTexto("");
    setAlunos([]);
    setEscolhido(null);
    setDigitos("");
    setSessao(null);
    setErro("");
  }, []);

  // Volta ao começo depois de 1 minuto sem toque (ninguém fica logado no aparelho).
  useEffect(() => {
    ultimoToque.current = Date.now();
    const marcar = () => (ultimoToque.current = Date.now());
    window.addEventListener("pointerdown", marcar);
    window.addEventListener("keydown", marcar);
    const t = setInterval(() => {
      if (Date.now() - ultimoToque.current > PARADO_MS) recomecar();
    }, 5000);
    return () => {
      window.removeEventListener("pointerdown", marcar);
      window.removeEventListener("keydown", marcar);
      clearInterval(t);
    };
  }, [recomecar]);

  // Busca enquanto digita (a partir de 3 letras).
  useEffect(() => {
    if (texto.trim().length < 3) return;
    const t = setTimeout(async () => {
      const r = p.demo
        ? { ok: true as const, alunos: ["Maria Silva", "Mariana Costa", "Mário Souza"].filter((n) => n.toLowerCase().includes(texto.trim().toLowerCase().slice(0, 3))).map((nome) => ({ nome, ref: nome })) }
        : await buscarNoQuiosque(texto);
      if (r.ok) setAlunos(r.alunos);
      else setErro(r.error);
    }, 300);
    return () => clearTimeout(t);
  }, [texto, p.demo]);

  const confirmar = (d: string) =>
    iniciar(async () => {
      if (!escolhido) return;
      const r = p.demo
        ? d === "1234"
          ? { ok: true as const, sessao: "demo", nome: escolhido.nome, saldo: 50 }
          : { ok: false as const, error: "Os números não conferem. Na demonstração, use 1234." }
        : await confirmarNoQuiosque(escolhido.ref, d);
      if (r.ok) {
        setSessao({ sessao: r.sessao, nome: r.nome, saldo: r.saldo });
        setErro("");
      } else {
        setErro(r.error);
        setDigitos("");
      }
    });

  const teclar = (t: string) => {
    if (pendente) return;
    if (t === "apagar") return setDigitos((d) => d.slice(0, -1));
    const novo = (digitos + t).slice(0, 4);
    setDigitos(novo);
    if (novo.length === 4) confirmar(novo);
  };

  const topo = (
    <header className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
      <p className="text-sm font-semibold uppercase tracking-wider text-na-green dark:text-emerald-400">Lanchonete · {p.caixa}</p>
      {(escolhido || sessao) && (
        <button type="button" onClick={recomecar} className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold dark:border-gray-700">
          Não sou eu · recomeçar
        </button>
      )}
    </header>
  );

  if (sessao)
    return (
      <main className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6">
        {topo}
        <CafeAutoatendimento
          quiosque
          demo={p.demo}
          cashierId={p.cashierId}
          caixa={`Olá, ${sessao.nome.split(" ")[0]}!`}
          nome={sessao.nome.split(" ")[0]}
          saldo={sessao.saldo}
          produtos={p.produtos}
          comprar={(itens, chave) => comprarNoQuiosque(sessao.sessao, itens, chave)}
          cancelar={(id) => cancelarNoQuiosque(sessao.sessao, id)}
          aoTerminar={recomecar}
        />
      </main>
    );

  if (escolhido)
    return (
      <main className="mx-auto grid max-w-md gap-5 p-6">
        {topo}
        <div className="grid gap-1 text-center">
          <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{escolhido.nome}</p>
          <p className="text-lg text-gray-600 dark:text-gray-400">Digite os <b>4 primeiros números do seu CPF</b></p>
        </div>
        <div className="flex justify-center gap-3" aria-label={`${digitos.length} de 4 números digitados`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`grid size-14 place-items-center rounded-2xl border-2 text-3xl font-black ${i < digitos.length ? "border-na-green bg-na-green-light dark:bg-emerald-950" : "border-gray-300 dark:border-gray-700"}`}>
              {i < digitos.length ? "•" : ""}
            </span>
          ))}
        </div>
        {pendente && <Loader2 className="mx-auto size-6 animate-spin text-na-green motion-reduce:animate-none" aria-label="Conferindo" />}
        {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-center text-base text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "apagar"].map((t, i) =>
            t === "" ? (
              <span key={i} />
            ) : (
              <button key={i} type="button" onClick={() => teclar(t)} disabled={pendente} aria-label={t === "apagar" ? "Apagar" : t} className="grid min-h-16 place-items-center rounded-2xl bg-white text-2xl font-black shadow-sm ring-1 ring-gray-200 active:bg-na-green-light disabled:opacity-50 dark:bg-gray-900 dark:ring-gray-800">
                {t === "apagar" ? <Delete aria-hidden /> : t}
              </button>
            ),
          )}
        </div>
      </main>
    );

  return (
    <main className="mx-auto grid max-w-2xl gap-5 p-6">
      {topo}
      <div className="grid gap-1 text-center">
        <h1 className="text-4xl font-black text-na-green-dark dark:text-emerald-400">Pegou algo? Marque aqui</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Procure o seu nome para pagar com o seu saldo.</p>
        {p.demo && <p className="mx-auto mt-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">DEMONSTRAÇÃO · digite “Mar” e use o CPF 1234 · nada é cobrado</p>}
      </div>
      <label className="flex items-center gap-3 rounded-2xl border-2 border-gray-300 bg-white px-4 focus-within:border-na-green dark:border-gray-700 dark:bg-gray-900">
        <Search className="size-6 text-gray-400" aria-hidden />
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (e.target.value.trim().length < 3) setAlunos([]);
          }}
          placeholder="Digite o seu nome"
          aria-label="Seu nome"
          autoComplete="off"
          className="min-h-16 flex-1 bg-transparent text-2xl outline-none"
        />
      </label>
      {erro && <p role="alert" className="text-center text-red-700 dark:text-red-400">{erro}</p>}
      <ul className="grid gap-2">
        {alunos.map((a) => (
          <li key={a.ref}>
            <button type="button" onClick={() => { setEscolhido(a); setErro(""); }} className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-xl font-bold shadow-sm ring-1 ring-gray-200 active:bg-na-green-light dark:bg-gray-900 dark:ring-gray-800">
              <UserRound className="size-6 text-na-green" aria-hidden /> {a.nome}
            </button>
          </li>
        ))}
        {texto.trim().length >= 3 && !alunos.length && <li className="text-center text-gray-500">Ninguém com esse nome aqui. Confira ou fale com o responsável pela lanchonete.</li>}
      </ul>
    </main>
  );
}
