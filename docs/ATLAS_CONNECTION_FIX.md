# Atlas "bad auth" 修复指南

当 `node scripts/seed.js` 或 `npm run db:test` 报 `bad auth : authentication failed` 时，按以下顺序排查。

## 1. 检查 Network Access（IP 白名单）

**路径**：Atlas 控制台 → 左侧 **Network Access** → **Add IP Address**

- 点击 **Add Current IP Address** 添加当前机器 IP
- 或临时添加 **0.0.0.0/0** 允许所有 IP（仅开发测试用）

## 2. 检查 Database Access（用户权限）

**路径**：Atlas 控制台 → 左侧 **Database Access** → 找到对应用户

- 用户状态需为 **Active**
- 权限选择 **Read and write to any database**（不要选 “Read and write to a specific database”）
- 若不确定，可 **Edit** 该用户，确认权限为 “Atlas admin” 或 “Read and write to any database”

## 3. 检查集群状态

**路径**：Atlas 控制台 → 左侧 **Database** → 选择集群

- M0 免费集群 **30 天无连接** 会自动暂停
- 若为 Paused 状态，点击 **Resume** 恢复

## 4. 使用新用户测试

若仍无法连接，建议新建一个测试用户：

1. Database Access → **Add New Database User**
2. Authentication: **Password**
3. 用户名：如 `pos_test_user`
4. 密码：**仅使用字母和数字**（避免 `@:#!%` 等）
5. Database User Privileges：**Read and write to any database**
6. 创建后，在 `.env` 中更新 `MONGODB_URI` 为新用户与密码

## 5. 使用 Atlas 生成的连接串

在 Atlas 控制台 → Database → **Connect** → **Drivers**，复制 Node.js 连接串，替换 `.env` 中的 `MONGODB_URI`。此方式可确认连接串格式正确。

## 诊断命令

```bash
cd pos-backend
npm run db:test
```

该脚本会尝试连接并输出简要诊断信息。
