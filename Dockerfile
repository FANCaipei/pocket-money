# ---------- 阶段 1：构建前端（React + TailwindCSS） ----------
FROM node:22-alpine AS client-build

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/index.html client/vite.config.js client/public ./
COPY client/src ./src
RUN npm run build

# ---------- 阶段 2：运行时（Express + node:sqlite） ----------
FROM node:22-alpine

# 时区默认东八区，影响"今天"的收益结算与日期分组
ENV TZ=Asia/Shanghai \
    NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app

# 仅安装生产依赖（express）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY scripts ./scripts
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /data

VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "server/index.js"]
