# 修复 503 + CORS：每一步设置说明

当浏览器访问 `https://pos-web-xxx.run.app` 时出现：

- **CORS 报错**：`No 'Access-Control-Allow-Origin' header is present on the requested resource`
- **GET** `https://pos-api-xxx.run.app/api/user` **返回 503** (Service Unavailable)

说明要么请求没进到你的 Node 应用（由 Cloud Run 直接返回 503），要么进了应用但数据库未连接（应用返回 503）。无论哪种，响应没有 CORS 头时，浏览器都会报 CORS。

按下面步骤逐项检查并设置。

---

## 一、MongoDB Atlas 配置

### 1.1 连接串格式

- 格式：`mongodb+srv://<用户名>:<密码>@<主机>/...`
- 密码里不能有多余字符（例如不要把 `**` 写进连接串）。
- 正确示例：`mongodb+srv://erichecan_db_user:你的密码@cluster0.u3msdia.mongodb.net/?appName=Cluster0`
- 若要在连接串里指定数据库名，可写成：  
  `mongodb+srv://用户:密码@cluster0.u3msdia.mongodb.net/pos-db?appName=Cluster0`

### 1.2 网络访问（必须，否则 Cloud Run 连不上）

1. 登录 [MongoDB Atlas](https://cloud.mongodb.com) → 选你的 Project → 左侧 **Network Access**。
2. 点 **Add IP Address**。
3. 选 **Allow Access from Anywhere**（会添加 `0.0.0.0/0`），或按文档配置 VPC 连接。
4. 保存。等状态变为 **Active** 再测。

### 1.3 数据库用户

- 确认该用户的密码与连接串里的完全一致（无多余空格、无 `**`）。
- 用户需对目标数据库（如 `pos-db`）有读写权限。

---

## 二、GCP Cloud Run：pos-api 环境变量

若 **JWT_SECRET** 或 **MONGODB_URI** 未设或错误，应用可能起不来或连不上 DB，Cloud Run 会直接返回 503（无 CORS）。

### 2.1 在 Console 里设置

1. 打开 [Google Cloud Console](https://console.cloud.google.com) → 选项目（如 `allinone-pos`）。
2. 菜单 **Cloud Run** → 点击服务 **pos-api**。
3. 顶部 **Edit & Deploy New Revision**。
4. 切到 **Variables & Secrets**（或 **Container(s)** → **Variables**）。
5. 添加/确认以下变量（名称必须一致）：

| 名称           | 值（示例，按你的实际改） |
|----------------|---------------------------|
| `MONGODB_URI`  | `mongodb+srv://用户:密码@cluster0.u3msdia.mongodb.net/pos-db?appName=Cluster0` |
| `JWT_SECRET`   | 一串随机字符串（如 32 位以上），不要用示例值上生产 |
| `FRONTEND_URL` | `https://pos-web-380253139402.us-central1.run.app`（可选，建议设） |

6. **Deploy** 保存并发布新版本。

### 2.2 用 gcloud 设置（可选）

```bash
gcloud run services update pos-api \
  --region=us-central1 \
  --set-env-vars="MONGODB_URI=mongodb+srv://用户:密码@cluster0.u3msdia.mongodb.net/pos-db?appName=Cluster0,JWT_SECRET=你的密钥,FRONTEND_URL=https://pos-web-380253139402.us-central1.run.app"
```

密码或 URI 里若有 `,`、`=`，需用引号包起来或改用 Console 界面。

---

## 三、确保部署的是“带 CORS 修复”的代码

503 和 CORS 的修复在仓库里已经做了，需要**重新构建并部署** pos-api 才会生效。

### 3.1 本地用 Docker 构建并推送到 Artifact Registry

在项目根目录（或 `pos-backend` 所在目录）执行（把 `REGION`、`PROJECT_ID` 换成你的）：

```bash
export PROJECT_ID=你的项目ID
export REGION=us-central1
export IMAGE_NAME=pos-api

# 登录 GCP
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# 在 pos-backend 目录构建（若 Dockerfile 在 pos-backend 下）
cd pos-backend
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${IMAGE_NAME}:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${IMAGE_NAME}:latest
cd ..
```

### 3.2 部署到 Cloud Run

```bash
gcloud run deploy pos-api \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${IMAGE_NAME}:latest \
  --region=${REGION} \
  --platform=managed \
  --allow-unauthenticated
```

环境变量若已在 Console 里设好，这里不必再写；若用 gcloud 设，见 2.2。

### 3.3 若用 CI/CD（如 GitHub Actions）部署

- 确保触发的是**包含 CORS/503 修复**的那次提交。
- 流水线里构建的是 `pos-backend` 的 Dockerfile，并部署到 pos-api。
- 环境变量在 Cloud Run 服务里配置（Console 或 gcloud），不要写进代码。

---

## 四、验证：是否还出现 503 + CORS

### 4.1 健康接口（不依赖 DB）

在终端执行（替换成你的 pos-api 地址）：

```bash
curl -s -o /dev/null -w "%{http_code}" https://pos-api-380253139402.us-central1.run.app/
```

期望：**200**。若是 502/503，说明容器没正常启动，回去检查环境变量和镜像。

### 4.2 带 Origin 的 GET /api/user（会触发 CORS）

```bash
curl -i -X GET "https://pos-api-380253139402.us-central1.run.app/api/user" \
  -H "Origin: https://pos-web-380253139402.us-central1.run.app"
```

- 若 **DB 已连上**：可能返回 401（未带 cookie）或 200，响应头里应有：  
  `Access-Control-Allow-Origin: https://pos-web-380253139402.us-central1.run.app`
- 若 **DB 未连上**：应返回 **503**，且**同样**带上述 `Access-Control-Allow-Origin`。  
  若此时没有 CORS 头，说明当前运行的镜像还不是“带 503 CORS 修复”的版本，需重新部署（第三节）。

### 4.3 浏览器里再测

1. 打开 `https://pos-web-380253139402.us-central1.run.app`。
2. 打开开发者工具 → Network。
3. 刷新或登录，看 `/api/user` 或 `/api/user/login` 的响应：
   - 状态码 503：看响应头里是否有 `Access-Control-Allow-Origin`。有则 CORS 已修复，问题只剩“为何 DB 未连上”。
   - 仍报 CORS 且无该头：多半是 503 由 Cloud Run 直接返回（应用未启动），或部署的还不是最新镜像。

---

## 五、若仍是 503：查“数据库未连接”

当 **GET /** 返回 200 但 **GET /api/user** 返回 503 时，说明应用已启动，但 MongoDB 未连上。

1. **Cloud Run 日志**  
   Cloud Run → pos-api → **Logs**，看是否有：  
   `Database connection failed: ...` 或 `MongoServerSelectionError`。  
   根据报错检查：
   - **MONGODB_URI** 是否正确（用户名、密码、主机、数据库名）。
   - Atlas **Network Access** 是否已允许 `0.0.0.0/0`（或对应出口 IP）。
2. **密码特殊字符**  
   密码里的 `@`、`#`、`:` 等需 [URL 编码](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding)（如 `@` → `%40`）再放进连接串。
3. **本地用同一连接串测**  
   在本地用 `node` 或 `mongosh` 使用同一 `MONGODB_URI` 连接，确认能连上后再部署。

---

## 六、检查清单（按顺序打勾）

- [ ] Atlas **Network Access** 已加 `0.0.0.0/0`（或等效）。
- [ ] 连接串格式正确：`mongodb+srv://用户:密码@主机/库名?appName=...`，无多余 `**`。
- [ ] Cloud Run **pos-api** 已设置 **MONGODB_URI**、**JWT_SECRET**（**FRONTEND_URL** 建议设）。
- [ ] 已用**包含 CORS/503 修复**的代码重新构建并部署 pos-api。
- [ ] `curl https://pos-api-xxx.run.app/` 返回 **200**。
- [ ] `curl -H "Origin: https://pos-web-xxx.run.app" https://pos-api-xxx.run.app/api/user` 的响应头里包含 **Access-Control-Allow-Origin**（即使状态码是 503）。

按以上步骤做完后，503 的响应会带 CORS 头，浏览器不再报“No 'Access-Control-Allow-Origin'”；若仍为 503，则只需排查数据库连接与 Atlas/环境变量配置即可。
