// Copia variáveis do .env para a Vercel (produção) sem mostrar os valores na tela.
// Uso: node scripts/copiar-env-vercel.mjs NOME1 NOME2 ...
// O valor vai pela entrada padrão do "vercel env add", sem quebra de linha no fim (uma senha com "\n" não funcionaria).
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const nomes = process.argv.slice(2);
if (!nomes.length) throw new Error("Informe os nomes das variáveis.");
const env = new Map(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^"(.*)"$/, "$1")]),
);

for (const nome of nomes) {
  const valor = env.get(nome);
  if (!valor) {
    console.log(`${nome}: não está no .env`);
    continue;
  }
  const codigo = await new Promise((ok) => {
    const p = spawn("npx", ["vercel", "env", "add", nome, "production"], { shell: true, stdio: ["pipe", "ignore", "pipe"] });
    let erro = "";
    p.stderr.on("data", (d) => (erro += d));
    p.on("close", (c) => ok(c === 0 ? 0 : erro.split("\n").filter(Boolean).at(-1) ?? `código ${c}`));
    p.stdin.end(valor);
  });
  console.log(`${nome}: ${codigo === 0 ? "adicionada" : `falhou (${codigo})`}`);
}
