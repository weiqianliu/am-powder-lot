# ---------- 构建阶段 ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 优先使用预编译二进制；装编译链作为下载失败时的兜底
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---------- 运行阶段 ----------
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
