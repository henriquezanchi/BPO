# Mesma versão do pacote "playwright" do package.json — a imagem precisa
# bater exatamente com a versão instalada, senão o Playwright não acha o
# binário do Chromium (ver playwright.dev/docs/docker).
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Gera o client do Prisma (schema já commitado) antes do build do Next.
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production

# Serviço "web" usa o CMD padrão (next start). Os serviços de worker/cron
# no Railway sobrescrevem isso com o Start Command próprio (ex:
# "npx tsx scripts/process-mercurio-queue.ts") — mesma imagem, comandos
# diferentes por serviço.
CMD ["npm", "start"]
