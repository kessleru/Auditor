# Front servido como arquivos estáticos por trás de um nginx que encaminha /api para a API.
# Assim o usuário abre um endereço só (http://localhost:8080) e não precisa de dois servidores.
FROM node:22-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY scripts/setup-hooks.mjs scripts/
RUN npm ci --workspace @auditoria-rf/web --workspace @auditoria-rf/contracts --include-workspace-root --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build --workspace @auditoria-rf/contracts && npm run build --workspace @auditoria-rf/web

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
