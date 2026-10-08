# Mesma versão do pacote "playwright" do package.json — a imagem precisa
# bater exatamente com a versão instalada, senão o Playwright não acha o
# binário do Chromium (ver playwright.dev/docs/docker).
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package*.json ./
# O "postinstall" do package.json roda "prisma generate", que precisa do
# schema — copia ele ANTES do npm ci, senão o postinstall falha (bug real
# encontrado no primeiro build: schema.prisma não existia ainda nesse ponto).
COPY prisma ./prisma
RUN npm ci

COPY . .

# NEXT_PUBLIC_* precisam existir NO BUILD (o Next grava o valor direto no
# JS do navegador em `next build` — diferente das outras variáveis, que só
# são lidas em runtime). O Railway injeta as variáveis do serviço como
# build args automaticamente quando declaradas com ARG aqui (bug real
# descoberto ao vivo: sem isso, o login quebrava com "Your project's URL
# and API key are required to create a Supabase client").
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Mesmo motivo, achado real em 2026-10-08: `src/lib/supabase/admin.ts`
# (supabaseAdmin, usado por avatar-url.ts) é importado num caminho que o
# `next build` analisa estaticamente ao coletar dados da página /diretor —
# sem essa variável também como ARG, o build quebra com "supabaseKey is
# required" mesmo a variável existindo no serviço (ela só não chega em
# build time sem isso, igual às duas de cima).
ARG SUPABASE_SERVICE_ROLE_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

RUN npm run build

ENV NODE_ENV=production

# Serviço "web" usa o CMD padrão (next start). Os serviços de worker/cron
# no Railway sobrescrevem isso com o Start Command próprio (ex:
# "npx tsx scripts/process-mercurio-queue.ts") — mesma imagem, comandos
# diferentes por serviço.
CMD ["npm", "start"]
