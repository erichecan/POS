# POS Frontend for GCP Cloud Run. 2026-02-24
# Stage 1: build
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# 构建时注入后端地址（部署时通过 --build-arg 传入）
ARG VITE_BACKEND_URL=https://pos-api-380253139402.us-central1.run.app
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
RUN npm run build

# Stage 2: serve
FROM node:20-slim

WORKDIR /app
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
# Cloud Run 注入 PORT，默认 8080
EXPOSE 8080

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
