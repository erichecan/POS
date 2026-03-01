# 行业模版消费端落地方案（PRD 7.22）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让客户在初始化时选择的行业模版真正影响前后台功能——菜单、开台、点餐逻辑等根据模版做增减，而非仅做配置存储。

**Architecture:** 在后端已有 StoreVerticalProfile + resolvedTemplate 的基础上，前端通过 React Context 在 POS 主流程加载 profile，各消费端（Menu、Tables、CustomerInfo、BottomNav）根据 profile 动态开关功能与展示。

**Tech Stack:** React 18, React Query, Express, MongoDB, 现有 verticalTemplateCatalog / verticalTemplateService。

**依据文档:** `docs/PRD_Global_POS_2026.md` 第 7.22 节、`pos-backend/config/verticalTemplateCatalog.js`、`docs/HARDWARE_VERTICAL_EXECUTION_2026-02-24.md`。

---

## 一、方案概要

### 1.1 模版影响范围（与 PRD 7.22 对应）

| PRD 条款 | 落地字段 | 消费端 | 行为 |
|---------|----------|--------|------|
| 经营模式：堂食/外带/外卖/预约 | `operatingModes` | CustomerInfo、点餐流程 | 按模式切换：堂食显示桌号/人数，外带显示取餐时间，外卖显示配送信息 |
| 菜单选项模型 | `menuOptionProfile.optionModel` | MenuContainer、CartInfo | 控制修饰项/套餐/多轮加单的展示与交互 |
| 桌台规则 | `tableServiceProfile` | Tables、BottomNav、TableCard | enabled=false 时隐藏桌台入口；supportsSeatSplit/supportsTableMerge 控制并台/拆台/席位分单按钮 |
| 厨房路由 | `requiredCapabilities` (KDS 等) | 后续与 KDS 页联动 | 本阶段仅预留 |
| 硬件建议 | 与硬件中心联动 | 已实现 | 不在此方案修改 |
| 指标看板 | 按业态 KPI | 后续与报表联动 | 本阶段不实施 |

### 1.2 实施阶段划分

- **Phase A（基础）：** Profile 加载、Context 注入、404 兜底
- **Phase B（开台）：** 桌台入口与并台/拆台/席位分单的条件展示
- **Phase C（点餐）：** 经营模式切换、CustomerInfo 差异化
- **Phase D（菜单）：** menuOptionProfile 对菜单选项的影响（轻量 v1）

### 1.3 关键约束

1. **locationId：** 当前 POS 单店场景使用 `"default"`，多店切换留作后续。
2. **404 处理：** Profile 不存在时，后端返回默认 resolved 配置（MILK_TEA），避免前端无数据。
3. **Override：** 门店可覆盖模版（已支持），消费端始终使用 `resolvedTemplate`。

---

## 二、Phase A：Profile 加载与 Context

### Task A1: 后端 - 无 Profile 时返回默认配置

**Files:**
- Modify: `pos-backend/controllers/verticalTemplateController.js:82-105`

**Step 1: 修改 getStoreVerticalProfile**

当 `StoreVerticalProfile` 查不到时，不返回 404，而是构造一个“默认档位”响应，使用 `MILK_TEA` 模版的 resolved 配置，保证 POS 前端总能拿到可用的 profile。

```javascript
// 在 getStoreVerticalProfile 中，当 !profile 时：
const fallbackTemplateCode = "MILK_TEA";
const payload = {
  locationId,
  countryCode: "US",
  templateCode: fallbackTemplateCode,
  profileStatus: "ACTIVE",
  overrides: {},
  isFallback: true,  // 标识为兜底，便于调试
};
if (includeResolved) {
  payload.resolvedTemplate = resolveVerticalTemplateConfig({
    templateCode: fallbackTemplateCode,
    overrides: {},
  });
}
return res.status(200).json({ success: true, data: payload });
```

**Step 2: 运行后端测试**

```bash
cd pos-backend && npm test -- --testPathPattern=verticalTemplate
```

Expected: PASS

**Step 3: Commit**

```bash
git add pos-backend/controllers/verticalTemplateController.js
git commit -m "feat(vertical): return fallback profile when none exists"
```

---

### Task A2: 前端 - 创建 VerticalProfileContext

**Files:**
- Create: `pos-frontend/src/contexts/VerticalProfileContext.jsx`
- Modify: `pos-frontend/src/App.jsx`（在 Layout 内包裹 Provider）

**Step 1: 创建 Context 与 Provider**

```jsx
// pos-frontend/src/contexts/VerticalProfileContext.jsx
// 2026-02-28: 行业模版消费端 - Profile Context
import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoreVerticalProfile } from "../https";

const DEFAULT_LOCATION_ID = "default";

const VerticalProfileContext = createContext({
  profile: null,
  resolved: null,
  isLoading: false,
  isError: false,
  locationId: DEFAULT_LOCATION_ID,
});

export const useVerticalProfile = () => useContext(VerticalProfileContext);

export const VerticalProfileProvider = ({ children, locationId = DEFAULT_LOCATION_ID }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["vertical-profile", locationId],
    queryFn: () => getStoreVerticalProfile(locationId, { includeResolved: true }),
    staleTime: 5 * 60 * 1000,  // 5min
  });

  const payload = data?.data?.data || null;
  const resolved = payload?.resolvedTemplate || null;

  return (
    <VerticalProfileContext.Provider
      value={{
        profile: payload,
        resolved,
        isLoading,
        isError,
        locationId,
      }}
    >
      {children}
    </VerticalProfileContext.Provider>
  );
};
```

**Step 2: 在 App 中包裹 Provider**

在 `Layout` 组件的 `<Routes>` 之外、非 `/auth` 且非 `/dashboard` 的受保护路由外层，包裹 `VerticalProfileProvider`。建议在 `ProtectedRoutes` 内部、具体子路由外侧增加一层，仅对 POS 主流程（`/`、`/menu`、`/tables`、`/orders`）生效，避免 Dashboard 页面不必要的请求。

简化做法：在 `Layout` 中，对 `!hideHeaderRoutes.includes(location.pathname) && !isDashboard` 的分支，用 `VerticalProfileProvider` 包裹 `{!hideHeaderRoutes... && <Header />}` 和 `<Routes>...</Routes>` 的父节点。或者直接在 `Layout` 最外层包裹 Provider（所有非 auth 页面都会请求，可接受）。

**实现：** 在 `Layout` 组件的 return 中，用 `<VerticalProfileProvider>` 包裹 `<>...</>` 根节点（不含 FullScreenLoader 分支）。

**Step 3: 运行前端构建**

```bash
cd pos-frontend && npm run build
```

Expected: Success

**Step 4: Commit**

```bash
git add pos-frontend/src/contexts/VerticalProfileContext.jsx pos-frontend/src/App.jsx
git commit -m "feat(vertical): add VerticalProfileContext and provider"
```

---

### Task A3: Seed 确保 default 有 Profile

**Files:**
- Modify: `pos-backend/scripts/seed.js`（在 seedStoreProfiles 中为 locationId "default" 插入一条 profile）

**Step 1: 修改 seedStoreProfiles**

在 `stores.map` 生成的 profiles 基础上，检查是否已包含 `locationId: "default"`；若无，则 `insertMany` 时追加一条：

```javascript
const profileList = stores.map((s) => ({
  locationId: s.locationId,
  countryCode: "US",
  templateCode: "WESTERN_DINING",
  profileStatus: "ACTIVE",
  overrides: {},
}));
// 确保 default 存在（POS 单店场景）
if (!profileList.some((p) => p.locationId === "default")) {
  profileList.push({
    locationId: "default",
    countryCode: "US",
    templateCode: "WESTERN_DINING",
    profileStatus: "ACTIVE",
    overrides: {},
  });
}
const profiles = await StoreVerticalProfile.insertMany(profileList);
```

**Step 2: 运行 seed 验证**

```bash
cd pos-backend && node scripts/seed.js
```

Expected: 无报错，控制台输出 StoreVerticalProfiles 数量

**Step 3: Commit**

```bash
git add pos-backend/scripts/seed.js
git commit -m "chore(seed): ensure default location has vertical profile"
```

---

## 三、Phase B：桌台功能按模版增减

### Task B1: BottomNav 根据 tableServiceProfile 隐藏桌台入口

**Files:**
- Modify: `pos-frontend/src/components/shared/BottomNav.jsx`
- Modify: `pos-frontend/src/App.jsx`（如需调整路由守卫，见下文）

**Step 1: BottomNav 使用 useVerticalProfile**

```jsx
import { useVerticalProfile } from "../../contexts/VerticalProfileContext";

const BottomNav = () => {
  const { resolved } = useVerticalProfile();
  const tableServiceEnabled = resolved?.tableServiceProfile?.enabled !== false;

  const navItems = [
    { key: "home", ... },
    { key: "orders", ... },
    ...(tableServiceEnabled ? [{ key: "tables", path: "/tables", ... }] : []),
    { key: "more", ... },
  ];
  // ...
};
```

同时调整 `grid-cols-4` 为 `grid-cols-${navItems.length}` 或固定为 `grid-cols-4` 但 tables 不渲染。

**Step 2: 若 Tables 隐藏，禁止直接访问 /tables**

在 `App.jsx` 的 `/tables` 路由处，可增加逻辑：当 `tableServiceEnabled === false` 时重定向到 `/`。或保持路由可访问，仅隐藏入口（后者实现简单，先采用）。

**Step 3: 运行构建**

```bash
cd pos-frontend && npm run build
```

**Step 4: Commit**

```bash
git add pos-frontend/src/components/shared/BottomNav.jsx
git commit -m "feat(vertical): hide Tables nav when tableService disabled"
```

---

### Task B2: Tables 页 - 并台/拆台/席位分单按钮按 profile 显示

**Files:**
- Modify: `pos-frontend/src/pages/Tables.jsx`
- Modify: `pos-frontend/src/components/tables/TableCard.jsx`（若操作按钮在 TableCard 内）

**Step 1: Tables 页读取 profile**

在 `Tables.jsx` 顶部：

```jsx
const { resolved } = useVerticalProfile();
const tsp = resolved?.tableServiceProfile || {};
const supportsMerge = tsp.supportsTableMerge === true;
const supportsSplit = true;  // 拆台通常与 merge 同开
const supportsSeatSplit = tsp.supportsSeatSplit === true;
```

**Step 2: 条件渲染并台/拆台/席位分单入口**

- 合并桌台按钮：仅当 `supportsMerge` 时显示
- 拆台按钮：仅当 `supportsSplit` 时显示
- 按席位分单按钮：仅当 `supportsSeatSplit` 时显示

在 Tables 中查找 `setShowMergeUI`、`setShowSplitUI`、`setShowSplitBySeatUI` 的触发按钮，加一层 `supportsMerge` / `supportsSplit` / `supportsSeatSplit` 判断。

**Step 3: TableCard 操作区**

若 TableCard 接收 `supportsMerge` 等 props，在 Tables 中传入；否则在 TableCard 内部使用 `useVerticalProfile` 读取并判断。为减少重复请求，建议由 Tables 传入。

**Step 4: 构建与 E2E**

```bash
cd pos-frontend && npm run build
cd .. && npm run test:e2e:playwright 2>/dev/null || true
```

**Step 5: Commit**

```bash
git add pos-frontend/src/pages/Tables.jsx pos-frontend/src/components/tables/TableCard.jsx
git commit -m "feat(vertical): conditional merge/split/seat-split by tableServiceProfile"
```

---

## 四、Phase C：点餐流程按经营模式切换

### Task C1: CustomerInfo 按 operatingModes 展示字段

**Files:**
- Modify: `pos-frontend/src/components/menu/CustomerInfo.jsx`

**Step 1: 读取 operatingModes**

```jsx
const { resolved } = useVerticalProfile();
const modes = resolved?.operatingModes || ["DINE_IN"];
const hasDineIn = modes.includes("DINE_IN");
const hasTakeaway = modes.includes("TAKEAWAY") || modes.includes("SELF_PICKUP");
const hasDelivery = modes.includes("DELIVERY");
```

**Step 2: 差异化展示**

- 当 `hasDineIn`：显示桌号、人数、堂食标识（与当前逻辑一致）
- 当 `hasTakeaway` 且无堂食上下文：显示取餐时间、自取编号
- 当 `hasDelivery`：显示配送地址、联系电话（若当前 customer 结构支持）

v1 实现：优先支持 `hasDineIn`，其他模式仅做 UI 占位（如 `#customerInfo.takeaway` / `#customerInfo.delivery`），后续再接真实数据。

**Step 3: 副标题文案**

将 `#customerInfo.orderId` / `#customerInfo.dineIn` 等根据 `hasDineIn` / `hasTakeaway` 切换为「堂食」/「外带」/「外卖」。

**Step 4: 构建**

```bash
cd pos-frontend && npm run build
```

**Step 5: Commit**

```bash
git add pos-frontend/src/components/menu/CustomerInfo.jsx
git commit -m "feat(vertical): CustomerInfo adapts to operatingModes"
```

---

### Task C2: Menu 页入口与 tableService 联动

**Files:**
- Modify: `pos-frontend/src/pages/Menu.jsx`（若从 Tables 进入时依赖桌台）
- Modify: `pos-frontend/src/pages/Home.jsx`（若首页有“快速点餐”入口）

**Step 1: 检查 Menu 入口**

当前从 Tables 点击「前往点餐」会 `navigate("/menu")`，并带上 customer（含 tableId 等）。若 `tableServiceProfile.enabled === false`，用户不会从 Tables 进入，但可能从 Orders 或其他入口进入 Menu。此时 Menu 应支持「无桌台」模式（柜台点餐），不强制要求桌台。

**Step 2: 轻量实现**

Menu 页根据 `resolved?.tableServiceProfile?.enabled`：
- `true`：保持现有桌台/顾客信息展示
- `false`：隐藏或简化桌台相关展示，突出「外带/自取」信息（若 CustomerInfo 已支持）

具体改动点在 `CustomerInfo` 和 `Bill`，本任务可仅做 Menu 页对 `useVerticalProfile` 的消费，将 `tableServiceEnabled` 传给子组件（或由子组件自读）。

**Step 3: Commit**

```bash
git add pos-frontend/src/pages/Menu.jsx
git commit -m "feat(vertical): Menu respects tableService for display"
```

---

## 五、Phase D：菜单选项模型（轻量 v1）

### Task D1: menuOptionProfile 驱动修饰项展示策略

**Files:**
- Modify: `pos-frontend/src/components/menu/MenuContainer.jsx`
- Modify: `pos-frontend/src/components/menu/CartInfo.jsx`
- Modify: `pos-frontend/src/constants/index.js`（若菜单来自 constants，可选）

**Step 1: 定义 optionModel 到前端行为的映射**

| optionModel | 前端行为（v1） |
|-------------|----------------|
| MULTI_MODIFIER | 展示多选修饰项（糖度、冰量等），支持多选 |
| COMBO_AND_MODIFIER | 展示套餐选项 + 修饰项 |
| SMALL_PLATE_MULTI_ROUND | 支持多轮加单入口，展示「加点」按钮 |
| COURSE_AND_MODIFIER | 前菜/主菜/甜点结构，修饰项单选 |
| FAST_COMBO | 套餐+单点+加料，快速编辑 |
| BASE_AND_MULTI_ROUND | 锅底+蘸料+多轮加单 |
| SERVICE_PACKAGE | 服务时长、技师偏好等，非餐饮修饰 |

v1 实现：仅根据 `optionModel` 控制「是否展示修饰项选择器」「是否展示加点/多轮入口」。不改变菜单数据结构（仍用 constants 或现有 API），只做展示层开关。

**Step 2: MenuContainer 使用 profile**

```jsx
const { resolved } = useVerticalProfile();
const mop = resolved?.menuOptionProfile || {};
const optionModel = mop.optionModel || "COMBO_AND_MODIFIER";
const showModifiers = !["SERVICE_PACKAGE"].includes(optionModel);  // 示例
const showMultiRound = ["SMALL_PLATE_MULTI_ROUND", "BASE_AND_MULTI_ROUND"].includes(optionModel);
```

将 `showModifiers`、`showMultiRound` 传给菜品卡片或 CartInfo，控制对应 UI 的显示。

**Step 3: CartInfo 条件渲染**

在 CartInfo 中，若 `showModifiers === false`，则不渲染 modifier 编辑区域；若 `showMultiRound`，则显示「加点」相关入口。

**Step 4: 构建与手动验证**

```bash
cd pos-frontend && npm run build
```

**Step 5: Commit**

```bash
git add pos-frontend/src/components/menu/MenuContainer.jsx pos-frontend/src/components/menu/CartInfo.jsx
git commit -m "feat(vertical): menuOptionProfile drives modifier and multi-round visibility"
```

---

## 六、验收标准与测试

### 6.1 功能验收

1. **Profile 加载：** 登录后进入 POS，可在 Network 中看到 `GET .../vertical-templates/profiles/default?includeResolved=true` 返回 200。
2. **桌台隐藏：** 将 default 的 profile 改为 `MILK_TEA`（tableServiceProfile.enabled=false），刷新后 BottomNav 不显示 Tables，直接访问 `/tables` 可保留（或重定向，按实现为准）。
3. **并台/拆台：** 将 profile 改为 `DIM_SUM`，Tables 页显示合并、拆台、席位分单；改为 `MILK_TEA` 时 Tables 入口隐藏。
4. **CustomerInfo：** 切换模版后，CustomerInfo 副标题与字段展示随 operatingModes 变化。
5. **菜单：** 切换 `menuOptionProfile.optionModel` 后，修饰项与多轮加单入口的显示符合上表。

### 6.2 回归测试

```bash
cd pos-frontend && npm run build
cd pos-backend && npm test
cd .. && npm run test:e2e:playwright  # 若有
```

### 6.3 PRD 7.22 验收条款对应

| 条款 | 实现 |
|------|------|
| 新门店可在创建时选择模板，一键生成默认规则 | 已有（organizationController createStore + provisioning） |
| 模板允许门店覆盖（Override），但保留总部默认继承关系 | 已有（overrides + resolveVerticalTemplateConfig） |
| 同一门店可平滑切换模板版本（含回滚策略） | 本方案实现消费端响应；回滚为重新 upsert overrides |

---

## 七、执行顺序与依赖

```
A1 → A2 → A3  （可并行 A2 与 A3）
    ↓
B1 → B2
    ↓
C1 → C2
    ↓
D1
```

---

## 八、后续扩展（Out of Scope）

1. 多门店切换时动态更新 `locationId`，并重新拉取 profile。
2. 指标看板按业态展示不同 KPI。
3. 厨房路由（KDS）与 `requiredCapabilities` 的深度联动。
4. 菜单数据从后端按 profile 过滤（当前菜单仍为前端 constants / 现有 API）。

---

**Plan complete.** 执行时请按 Task 顺序逐步推进，每完成一 Task 即 commit，便于回溯与 code review。
