# node:22-slim — NUNCA alpine: better-sqlite3 não tem prebuild musl e o build
# de fonte (node-gyp/python) inflaria o deploy a cada merge (RESEARCH Pitfall 5).
FROM node:22-slim

WORKDIR /app

# Dependências primeiro (camada cacheável) — lock congelado pelo npm ci (T-01-SC).
COPY package.json package-lock.json ./
# --ignore-scripts: o npm ci roda o node-gyp rebuild default do binding.gyp do
# better-sqlite3 e exigiria python3/make/g++ (build de fonte a cada deploy) — mas
# o tarball do better-sqlite3 13 já traz prebuilds/linux-x64.node, carregado em
# runtime (testado neste exato node:22-slim). Pular scripts também endurece a
# supply chain: nenhum lifecycle script de terceiro roda no build.
RUN npm ci --omit=dev --ignore-scripts

# Código-fonte (tsx roda TS direto — sem etapa de build; CSVs do seed vendados em src/db/seed/)
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

# tsx resolve do node_modules local (instalado acima como dependency) —
# nunca npx, que baixaria pacote em runtime.
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
