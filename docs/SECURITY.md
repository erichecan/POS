# 安全与合规说明（2026-02-24 CODE_REVIEW）

本页为 POS 项目安全与合规相关能力的入口索引，便于合规与审计查阅。

## 密钥与轮换

- **密钥轮换**：见仓库根目录 [SECURITY_KEY_ROTATION.md](../SECURITY_KEY_ROTATION.md)，包含轮换清单与操作说明。

## 审计与日志

- **会话安全事件**：登录失败、Token 无效、权限/数据范围拒绝等由 `sessionSecurityService` 记录，便于审计与异常排查。
- **审计日志**：合规与审计相关查询见 PRD M20 及实现中的审计日志查询、PII 脱敏视图、合规导出请求。

## 高风险操作审批

- **高风险审批**：退款执行、敏感导出、组织与渠道配置变更等关键动作需经高风险审批策略（双人复核、阈值、时效），见 PRD M20 与实现中的 `highRiskApproval` 相关逻辑。
- **合规策略包**：按国家/区域可绑定策略包，自动执行合规规则。

## 生产环境错误信息

- 生产环境下 5xx 错误不向客户端返回内部错误原文，仅返回 "Internal Server Error"；4xx 为业务约定文案。详见 `pos-backend/middlewares/globalErrorHandler.js`。

## 联系方式

安全相关问题请通过仓库 Issue 或内部安全渠道反馈。
