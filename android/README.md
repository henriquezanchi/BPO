# App Android do Portal (Trusted Web Activity)

App leve que abre o Portal (`https://portal-na-one.vercel.app`) em tela cheia, sem barra de endereço, usando o Chrome do celular. Não tem código próprio: toda mudança no site já vale no app. Pedido do usuário em 23/11/2026.

- **Pacote:** `br.org.acropole.portal`. Domínio em `app/build.gradle` (`HOST`).
- **Tela cheia** depende de `public/.well-known/assetlinks.json` no Portal, com a impressão SHA-256 do certificado de assinatura. Sem ela, o app abre com uma barra de endereço no topo.
- **Chave de assinatura:** fica FORA do repositório (`C:\Users\Henrique Zanchi\Android\portal-na-release.jks`); a senha está no `.env` como `ANDROID_KEYSTORE_SENHA`. **Sem essa chave e essa senha não há atualização do app.** Guardar cópia em lugar seguro.
- **Gerar o APK:** `npx tsx --env-file=.env scripts/gerar-apk.ts` (compila, assina e copia para `public/app/portal-nova-acropole.apk`). A cada nova versão, aumentar `versionCode` em `app/build.gradle`.
- **Trocar de domínio:** mudar `HOST`, gerar de novo e publicar o `assetlinks.json` no domínio novo.
- **Página de download:** `/app` no Portal.
