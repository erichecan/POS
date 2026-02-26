# POS Backend for GCP Cloud Run. 2026-02-24
# Project: allinone-pos (380253139402)

FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
# Cloud Run 使用 PORT 环境变量，默认 8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "app.js"]
