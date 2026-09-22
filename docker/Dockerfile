# Node 22 LTS, a linha fixada no package.json: a imagem oficial do Playwright traz Node 24, e o
# better-sqlite3 e o argon2 só têm binário pronto para a linha 22. O Chromium e as bibliotecas de
# sistema vêm do `playwright install --with-deps`, na mesma versão fixada no package.json.
FROM node:22-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# O `prepare` da raiz roda no npm ci; fora de um clone git o script não faz nada.
COPY scripts/setup-hooks.mjs scripts/
RUN npm ci --workspace @auditoria-rf/api --workspace @auditoria-rf/contracts --include-workspace-root

RUN npx playwright install --with-deps chromium

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build --workspace @auditoria-rf/contracts && npm run build --workspace @auditoria-rf/api

ENV NODE_ENV=production
EXPOSE 3333
CMD ["node", "apps/api/dist/server.js"]
