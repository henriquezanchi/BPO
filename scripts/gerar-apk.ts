/**
 * Gera o app Android do Portal (Trusted Web Activity, projeto em android/) e publica em public/app/ (23/11/2026).
 * Compila o APK, alinha, assina com a chave fora do repositório e copia para public/app/portal-nova-acropole.apk.
 * Requisitos nesta máquina: JDK, Android SDK em ANDROID_HOME (padrão C:\Users\Henrique Zanchi\Android\Sdk),
 * Gradle em ANDROID_GRADLE (padrão C:\Users\Henrique Zanchi\Android\tools\gradle-8.11.1), ANDROID_KEYSTORE_SENHA no .env.
 * Uso: npx tsx --env-file=.env scripts/gerar-apk.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const ANDROID_HOME = process.env.ANDROID_HOME || "C:\\Users\\Henrique Zanchi\\Android\\Sdk";
const GRADLE = path.join(process.env.ANDROID_GRADLE || "C:\\Users\\Henrique Zanchi\\Android\\tools\\gradle-8.11.1", "bin", "gradle.bat");
const KEYSTORE = process.env.ANDROID_KEYSTORE || "C:\\Users\\Henrique Zanchi\\Android\\portal-na-release.jks";
const SENHA = process.env.ANDROID_KEYSTORE_SENHA;
const BUILD_TOOLS = path.join(ANDROID_HOME, "build-tools", "35.0.0");

if (!SENHA) throw new Error("ANDROID_KEYSTORE_SENHA não está no .env.");
if (!existsSync(KEYSTORE)) throw new Error(`Chave de assinatura não encontrada: ${KEYSTORE}`);

const projeto = path.join(RAIZ, "android");
const env = { ...process.env, ANDROID_HOME, ANDROID_SDK_ROOT: ANDROID_HOME };
// .bat precisa de shell no Windows; com shell, caminhos com espaço vão entre aspas.
const q = (s: string) => (/\s/.test(s) ? `"${s}"` : s);
const rodar = (exe: string, args: string[], cwd = RAIZ, extra: Record<string, string> = {}) => {
  const bat = exe.endsWith(".bat");
  execFileSync(bat ? q(exe) : exe, bat ? args.map(q) : args, { cwd, env: { ...env, ...extra }, stdio: "inherit", shell: bat });
};

rodar(GRADLE, ["--no-daemon", "-q", "assembleRelease"], projeto);

const semAssinatura = path.join(projeto, "app", "build", "outputs", "apk", "release", "app-release-unsigned.apk");
const alinhado = path.join(projeto, "app", "build", "alinhado.apk");
const destinoDir = path.join(RAIZ, "public", "app");
const destino = path.join(destinoDir, "portal-nova-acropole.apk");
mkdirSync(destinoDir, { recursive: true });

rodar(path.join(BUILD_TOOLS, "zipalign.exe"), ["-f", "-p", "4", semAssinatura, alinhado]);
// A senha vai pela variável de ambiente, não pela linha de comando.
rodar(path.join(BUILD_TOOLS, "apksigner.bat"), ["sign", "--ks", KEYSTORE, "--ks-key-alias", "portal", "--ks-pass", "env:ANDROID_KEYSTORE_SENHA", "--key-pass", "env:ANDROID_KEYSTORE_SENHA", "--out", destino, alinhado], RAIZ, { ANDROID_KEYSTORE_SENHA: SENHA });
rodar(path.join(BUILD_TOOLS, "apksigner.bat"), ["verify", destino]);
console.log(`APK pronto: ${path.relative(RAIZ, destino)}`);
