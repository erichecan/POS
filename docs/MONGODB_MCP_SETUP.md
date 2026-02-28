# MongoDB MCP 自动化连接

已为 POS 项目配置 MongoDB MCP Server，AI 可直接操作 Atlas 数据库，无需手动配置。

## 已完成的配置

1. **启动器** `pos-backend/scripts/run-mongodb-mcp.js`
   - 从 `pos-backend/.env` 读取 `MONGODB_URI`
   - 注入 `MDB_MCP_CONNECTION_STRING` 后启动 mongodb-mcp-server
   - 不在配置中硬编码密码

2. **Cursor MCP** 已添加 `mongodb` 到 `~/.cursor/mcp.json`
   - 使用上述启动器
   - 连接成功后，可在对话中请求「查询/列出集合/执行聚合」等操作

## 使用方式

1. 确保 `pos-backend/.env` 中 `MONGODB_URI` 正确
2. 重启 Cursor（或重新加载 MCP）使配置生效
3. 在对话中直接要求，例如：
   - 「列出 pos_db 的集合」
   - 「执行 seed 的等效操作」
   - 「检查 orders 集合的文档数」

## 本地验证

```bash
cd pos-backend
node scripts/run-mongodb-mcp.js
# 若正常会启动 MCP 进程（stdio 模式会等待输入，Ctrl+C 退出）
```

## 项目路径变更时

若 POS 项目移动，需更新 `~/.cursor/mcp.json` 中 mongodb 的 `args` 和 `cwd` 路径。
