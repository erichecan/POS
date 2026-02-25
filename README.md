# 🍽️ **Restaurant POS System**  

A full-featured **Restaurant POS System** built using the **MERN Stack** to streamline restaurant operations, enhance customer experience, and manage orders, payments, and inventory with ease.

## ✨ **Features**

- 🍽️ **Order Management**  
  Efficiently manage customer orders with real-time updates and status tracking.

- 🪑 **Table Reservations**  
  Simplify table bookings and manage reservations directly from the POS.

- 🔐 **Authentication**  
  Secure login and role-based access control for admins, staff, and users.

- 💸 **Payment Integration**  
  Integrated with **Stripe** (or other gateways) for seamless online payments.

- 🧾 **Billing & Invoicing**  
  Automatically generate detailed bills and invoices for every order.


## 🏗️ **Tech Stack**

| **Category**             | **Technology**                |
|--------------------------|-------------------------------|
| 🖥️ **Frontend**          | React.js, Redux, Tailwind CSS  |
| 🔙 **Backend**           | Node.js, Express.js           |
| 🗄️ **Database**          | MongoDB                       |
| 🔐 **Authentication**    | JWT, bcrypt                   |
| 💳 **Payment Integration**| Stripe    |
| 📊 **State Management**   | Redux Toolkit                 |
| ⚡ **Data Fetching & Caching** | React Query            |
| 🔗 **APIs**              | RESTful APIs                   |

---

## 📄 **产品与文档**（2026-02-24 CODE_REVIEW I4）

开发与排期以产品需求文档（PRD）为准，请勿在未查阅需求的情况下自行创造需求。

| 文档 | 说明 |
|------|------|
| [docs/PRD_Global_POS_2026.md](docs/PRD_Global_POS_2026.md) | 产品需求文档（能力基线、目标能力、模块说明） |
| [docs/EXPERIENCE_GUIDE_FULL_2026-02-21.md](docs/EXPERIENCE_GUIDE_FULL_2026-02-21.md) | 体验与主流程指南 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南（Fork/Clone、PR、需求基准） |
| [docs/PHASE2_E2E_RUNBOOK.md](docs/PHASE2_E2E_RUNBOOK.md) | Phase2 E2E 测试与运维 |
| [docs/OPS_ONCALL_ESCALATION.md](docs/OPS_ONCALL_ESCALATION.md) | 值班与升级 |
| [SECURITY_KEY_ROTATION.md](SECURITY_KEY_ROTATION.md) | 密钥轮换清单 |
| [docs/SECURITY.md](docs/SECURITY.md) | 安全与合规说明（审计、高风险审批、错误脱敏） |

---

## 🚀 部署（GCP）

要保证 **页面可访问** 且 **数据库可访问**，建议在 GCP 上前后端分开部署：

- **前端**：Firebase Hosting 或 Cloud Storage + CDN，托管 `pos-frontend` 的 Vite 构建产物（`dist/`）。
- **后端**：Cloud Run 运行 `pos-backend`（Node.js），连接 MongoDB（建议 MongoDB Atlas）。

### 1. 部署后端（pos-backend）到 Cloud Run

- **代码目录**：`pos-backend/`
- **构建与运行**：使用 Dockerfile 或直接 `gcloud run deploy` 指定 Node 运行时；启动命令为 `node app.js` 或 `npm start`。
- **必要环境变量**（在 Cloud Run 服务中配置）：
  - `NODE_ENV=production`
  - `PORT=8080`（Cloud Run 默认 8080，或按控制台要求）
  - `MONGODB_URI=<MongoDB 连接串，如 Atlas URI>`
  - `JWT_SECRET=<随机安全字符串>`
  - `FRONTEND_URL=https://你的前端域名`  
    （后端 CORS 使用 `config.frontendUrl`，须与前端实际域名一致）
  - 如需支付：`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET` 等。

部署后得到后端 URL，例如：`https://pos-api-xxxx.run.app`，其下提供 `/api/...`。验证：请求根路径或登录接口返回合理状态码，且日志无 MongoDB 连接错误。

### 2. 部署前端（pos-frontend）到 GCP

- **构建**：在 `pos-frontend/` 下执行 `npm run build`，产出在 `dist/`。
- **托管方式示例**：
  - **Firebase Hosting**：在项目根或 `pos-frontend` 配置 `firebase.json`（`public` 指向 `pos-frontend/dist`），并配置 **rewrites**：`"source": "**", "destination": "/index.html"`，保证 SPA 路由刷新不 404。
  - **Cloud Storage + Load Balancer**：将 `dist/` 上传到 Bucket，并配置 404 回退到 `index.html`（或通过 CDN 配置）。
- **环境变量**：构建前设置 `VITE_BACKEND_URL=https://pos-api-xxxx.run.app`（即上一步的后端 URL），再执行 `npm run build`，前端会把所有 API 请求发往该地址。

部署完成后访问前端 URL，在浏览器中确认：页面加载正常、API 请求指向后端且无 CORS/5xx、登录与下单等操作在数据库中可见。

只要后端环境变量（含 `MONGODB_URI`、`FRONTEND_URL`）正确，前端构建时 `VITE_BACKEND_URL` 指向该后端，页面与数据库即可在 GCP 上稳定联通。

<br>

## 📺 **YouTube Playlist**

🎬 Follow the complete tutorial series on building this Restaurant POS System on YouTube:  
👉 [Watch the Playlist](https://www.youtube.com/playlist?list=PL9OdiypqS7Nk0DHnSNFIi8RgEFJCIWB6X)  

## 📁 **Assets**

- 📦 **Project Assets:** [Google Drive](https://drive.google.com/drive/folders/193N-F1jpzyfPCRCLc9wCyaxjYu2K6PC_)

---

## 📋 **Flow Chart for Project Structure**

- 🗺️ **Visualize the Project Structure:** [View Flow Chart](https://app.eraser.io/workspace/IcU1b6EHu9ZyS9JKi0aY?origin=share)

---

## 🎨 **Design Inspiration**

- 💡 **UI/UX Design Reference:** [Behance Design](https://www.behance.net/gallery/210280099/Restaurant-POS-System-Point-of-Sale-UIUX-Design)

---

## 🖼️ **Project Screenshots**

<table>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/ibjxvy5o1ikbsdebrjky.png" alt="Screenshot 1" width="300"/></td>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502773/ietao6dnw6yjsh4f71zn.png" alt="Screenshot 2" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/vesokdfpa1jb7ytm9abi.png" alt="Screenshot 3" width="300"/></td>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/setoqzhzbwbp9udpri1f.png" alt="Screenshot 4" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/fc4tiwzdoisqwac1j01y.png" alt="Screenshot 5" width="300"/></td>
  </tr>
</table>


✨ Feel free to explore, contribute, and enhance the project! 🚀

💡 To contribute, please check out the **CONTRIBUTING.md** for guidelines.

⭐ If you find this project helpful, don't forget to **star** the repository! 🌟
