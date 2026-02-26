# GCP 部署说明（allinone-pos）

**项目编号：** 380253139402  
**项目 ID：** allinone-pos  
**区域：** us-central1

## 已部署服务

| 服务 | URL | 说明 |
|------|-----|------|
| 前端 | https://pos-web-380253139402.us-central1.run.app | React SPA（Vite 构建，请求发往后端） |
| 后端 | https://pos-api-380253139402.us-central1.run.app | Node.js / Express，提供 `/api/*` |

## 必须配置（后端才能稳定运行）

后端 `pos-api` 在未配置数据库时会连接失败并退出，需在 GCP 控制台为 **pos-api** 设置环境变量：

1. 打开 [Cloud Run 控制台](https://console.cloud.google.com/run?project=allinone-pos)，选择服务 **pos-api** → **编辑与部署新版本** → **变量与密钥**。
2. 添加/修改：
   - **MONGODB_URI**：你的 MongoDB 连接串（建议 [MongoDB Atlas](https://www.mongodb.com/atlas) 免费集群）。
   - **JWT_SECRET**：一段随机安全字符串（生产环境务必使用强随机值）。
   - **FRONTEND_URL**：`https://pos-web-380253139402.us-central1.run.app`（用于 CORS，允许前端域名访问接口）。
3. 保存并部署新版本。

配置完成后，后端会正常连上数据库，页面登录、下单等即可使用。

## 本地重新部署命令（可选）

```bash
# 后端
cd pos-backend && gcloud run deploy pos-api --source . --region us-central1 --platform managed --allow-unauthenticated

# 前端（会使用 Dockerfile 内默认 VITE_BACKEND_URL 指向上述后端）
cd pos-frontend && gcloud run deploy pos-web --source . --region us-central1 --platform managed --allow-unauthenticated
```

前端若需指向其他后端，构建时传入：  
`--build-arg VITE_BACKEND_URL=https://你的后端地址`（需在 Cloud Build 或本地 build 时配置）。
