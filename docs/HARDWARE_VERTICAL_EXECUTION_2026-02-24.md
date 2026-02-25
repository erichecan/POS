# 硬件接入与业态模板执行文档（2026-02-24）

## 1. 调研结论（Toast / Square，北美优先）

### 1.1 必备硬件能力

1. 前台收银主机（POS Terminal）
2. 移动点单终端（Mobile POS）
3. 支付终端（EMV/NFC）
4. 前台小票机（Receipt Printer）
5. 厨房出单（Kitchen Printer / KDS）
6. 现金抽屉（Cash Drawer）
7. 自助点餐机（Kiosk）
8. 叫号屏（Queue Display）
9. 菜单/广告屏（Digital Signage）

### 1.2 北美/欧洲落地约束

1. 支付硬件需按国家合规配置（设备与商户账户匹配）。
2. Square/Toast 的硬件 SKU 与可用能力存在国家差异，必须模板化配置。
3. 叫号/大屏建议走扩展层（Web Player + 事件流），不和核心交易耦合。

## 2. 系统设计

### 2.1 硬件目录（Catalog）

按国家、供应商、能力、设备类型筛选；支持 Toast / Square / Custom 扩展。

### 2.2 门店硬件画像（Store Hardware Profile）

每个 `locationId` 保存门店的设备组合、优先供应商、能力覆盖目标，并做配置校验。

### 2.3 业态模板（Vertical Template）

模板覆盖：

1. 奶茶店
2. 寿司
3. 广式早茶
4. 西餐
5. 中式快餐
6. 美甲店
7. 火锅店

模板包含经营模式、菜单选项模型、桌台规则、硬件能力建议。

## 3. 本次已完成开发（v1）

### 3.1 后端新增模型

1. `StoreHardwareProfile`
   - 文件：`/Users/eric/Desktop/secondme/projects/POS/pos-backend/models/storeHardwareProfileModel.js`
2. `StoreVerticalProfile`
   - 文件：`/Users/eric/Desktop/secondme/projects/POS/pos-backend/models/storeVerticalProfileModel.js`

### 3.2 后端新增配置与服务

1. 硬件目录配置
   - `/Users/eric/Desktop/secondme/projects/POS/pos-backend/config/hardwareCatalog.js`
2. 业态模板配置
   - `/Users/eric/Desktop/secondme/projects/POS/pos-backend/config/verticalTemplateCatalog.js`
3. 硬件目录服务（过滤、校验）
   - `/Users/eric/Desktop/secondme/projects/POS/pos-backend/utils/hardwareCatalogService.js`
4. 业态模板服务（筛选、解析、覆盖）
   - `/Users/eric/Desktop/secondme/projects/POS/pos-backend/utils/verticalTemplateService.js`

### 3.3 后端新增接口

#### 设备域

1. `GET /api/device/catalog`
2. `GET /api/device/profiles`
3. `GET /api/device/profiles/:locationId`
4. `PUT /api/device/profiles/:locationId`

#### 组织域（业态模板）

1. `GET /api/organization/vertical-templates/catalog`
2. `GET /api/organization/vertical-templates/profiles`
3. `GET /api/organization/vertical-templates/profiles/:locationId`
4. `PUT /api/organization/vertical-templates/profiles/:locationId`

### 3.4 前端 API 包装（已预留）

文件：`/Users/eric/Desktop/secondme/projects/POS/pos-frontend/src/https/index.js`

新增：

1. `getHardwareCatalog` / `getStoreHardwareProfiles` / `upsertStoreHardwareProfile`
2. `getVerticalTemplateCatalog` / `getStoreVerticalProfiles` / `upsertStoreVerticalProfile`

## 4. 自动化测试（本次新增）

1. `hardwareCatalogService.test.js`
2. `verticalTemplateService.test.js`

路径：

1. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/tests/hardwareCatalogService.test.js`
2. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/tests/verticalTemplateService.test.js`

## 5. 下一步开发（v2）

1. Dashboard 增加“硬件中心”和“业态模板中心”可视化配置页。（已完成）
2. 模板选型与门店初始化流程联动（创建门店时可一键套用）。（已完成）
3. 设备健康告警（离线阈值、打印失败率、KDS 心跳异常）。（待开发）
4. Kiosk/Queue/Signage 事件流联调（订单状态 -> 叫号屏/广告屏）。（待开发）

## 6. 第二批开发进度（已完成）

### 6.1 Dashboard 可视化模块

1. `Hardware` 标签页：硬件目录查询 + 门店硬件画像配置（可保存/可回读）
2. `Templates` 标签页：业态模板目录查询 + 门店模板画像配置（支持 JSON 覆盖）

对应文件：

1. `/Users/eric/Desktop/secondme/projects/POS/pos-frontend/src/components/dashboard/HardwareCenter.jsx`
2. `/Users/eric/Desktop/secondme/projects/POS/pos-frontend/src/components/dashboard/VerticalTemplateCenter.jsx`
3. `/Users/eric/Desktop/secondme/projects/POS/pos-frontend/src/pages/Dashboard.jsx`
4. `/Users/eric/Desktop/secondme/projects/POS/pos-frontend/src/App.jsx`
5. `/Users/eric/Desktop/secondme/projects/POS/pos-frontend/src/pages/More.jsx`

### 6.2 可访问路由

1. `/dashboard/hardware`
2. `/dashboard/templates`
3. `/dashboard/channels`（保留原入口）

### 6.3 回归状态

1. `npm run build`（frontend）通过
2. `npm run test:e2e:playwright`（fullstack）通过

### 6.4 门店初始化联动（本次新增）

1. 门店创建支持 `provisioning` 参数，在 `createStore` 时可自动落库：
   - `StoreVerticalProfile`
   - `StoreHardwareProfile`
2. 新增门店初始化预览接口（不落库）：
   - `POST /api/organization/stores/provisioning-preview`
3. 新增自动硬件选型能力：
   - 按模板 `requiredCapabilities/recommendedCapabilities` 推导能力目标
   - 按 `providerPriority`（如 `SQUARE,TOAST,CUSTOM`）自动选设备
   - 输出缺失能力告警（missingCapabilities/warnings）
4. Dashboard（Templates）新增“Store Provisioning Preview”可视化预览模块。

本次新增核心文件：

1. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/utils/storeProvisioningService.js`
2. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/utils/hardwareCatalogService.js`
3. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/controllers/organizationController.js`
4. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/routes/organizationRoute.js`
5. `/Users/eric/Desktop/secondme/projects/POS/pos-frontend/src/components/dashboard/VerticalTemplateCenter.jsx`

本次新增测试：

1. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/tests/storeProvisioningService.test.js`
2. `/Users/eric/Desktop/secondme/projects/POS/pos-backend/tests/hardwareCatalogService.test.js`（扩展）
