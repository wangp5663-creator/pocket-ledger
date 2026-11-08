# 小账本 v1.1：用款计划与账目分区 设计文档

- 日期：2026-11-08
- 状态：待实施
- 目标版本：v1.1.0（Android versionCode 5）

## 1. 背景与问题

当前 app 有三个一级页面：餐补、补回账、统计。随着使用深入，三个问题浮现：

1. 餐补页把「周期记录」整段列表铺在主页，页面越来越长。
2. 补回账的未补齐事项和已补齐事项混在一起，事项一多页面杂乱；已补齐事项没有归档入口。
3. 「汇入」只有一个列表，历史汇入和本月汇入混排。
4. 缺少面向未来的收支规划：现有补回账记的是已发生的支出/补回，不能提前排「哪个月花、哪个月补」。
5. 统计页补回账图表只能看「净变化」，看不到支出、补回、汇入各自的月度趋势。

同时，新功能的候选命名（事项 / 计划事项 / 已完成事项、最近汇入 / 已汇入）区分度太低，需要统一命名。

## 2. 目标与非目标

### 目标

- 餐补主页只保留核心信息，周期记录移入子页。
- 补回账按「待补回 / 已补回」分区，已补回按支出月份归档。
- 汇入按自然月拆分：本月汇入留在主页，往期汇入进「汇入记录」子页。
- 新增独立的「用款计划」台账：表格 + 月度时间轴，不参与实际余额计算。
- 统计页补回账图表支持「净变化 / 支出 / 补回 / 汇入」切换。
- 统一命名，避免概念混淆。

### 非目标

- 不把用款计划与实际事项、余额、统计联动（用户已确认「独立台账」）。
- 不调整 `PlanningEvent` 数据结构，不做历史数据迁移。
- 不新增底部导航 tab。
- 不做跨设备同步、消息提醒、计划执行状态。
- 不重命名表单和详情页里的「事项」实体，只调整分区和入口命名。

## 3. 命名约定

| 概念 | 名称 | 位置 |
|---|---|---|
| 实际账本 tab（原「规划账」） | **补回账** | 底部导航、余额卡、统计切换、设置、返回链接 |
| 需要补回的大额支出 | 事项 | 表单、详情页保持不变 |
| 未补齐的事项分区 | **待补回** | 补回账主页 |
| 已补齐的事项分区入口 | **已补回** | 补回账主页入口卡 → 子页 |
| 未来收支规划模块 | **用款计划** | 补回账主页入口卡 → 子页 |
| 自然月内的汇入 | **本月汇入** | 补回账主页 |
| 本月之前的汇入 | **汇入记录** | 补回账主页入口卡 → 子页 |
| 餐补周期列表 | **历史周期** | 餐补主页入口卡 → 子页 |

## 4. 功能设计

### 4.1 餐补页

#### 4.1.1 余额负值提醒

数据来源：`MealStatus`（`currentMealStatus` 的返回值）。

定义：

- 超支金额 `over = -status.balance`（单位：分，仅当 `status.balance < 0`）
- 当前每日额度 `allowance = status.dailyAllowance`（正常模式为正常额度，保底模式为保底额度）
- 剩余天数 `days`：
  - 今天已记录 → `listDates(addDays(today, 1), status.endDate).length`
  - 今天未记录 → `listDates(today, status.endDate).length`
  - 最小为 0
- 每日需减 `perDay = over / days`（分，浮点）

判定顺序：

| 条件 | 结果 |
|---|---|
| `status.balance >= 0` | 不提醒，沿用现有文案 |
| `days === 0`（含 `endDate < today`） | `本周期已结束，超支 ¥X 不会结转` |
| `perDay > allowance` | `即使每天不花，本周期仍将超支 ¥X`，其中 `X = over - days × allowance` |
| `perDay < 100`（不足 1 元） | `超支 ¥A，剩 N 天，每天额度平均需减少不足 1 元` |
| 其他 | `超支 ¥A，剩 N 天，每天额度至少需减少 ¥Y`，`Y = ceil(perDay / 100)` 元 |

说明：

- 金额展示统一使用现有 `formatYuan`。
- 「至少」对应向上取整语义，避免提示过小而补不平。
- 提醒替换余额卡里现有的负值文案（`有点超支了…`）；`balance >= 0` 时原文案不变。
- 余额为负时，该提醒优先于保底模式的「没有多余的钱可以随意消费」文案。
- `perDay === allowance` 时仍可通过每天花 0 元刚好补平，走「至少需减少」分支，不判定为无解。
- 保底模式下余额同样可能为负，规则一致，基准额度取保底额度。
- 缺记日期按 0 花费参与余额计算；补记后提示会随余额变化，这是预期行为。

实现位置：

- `src/domain/mealV2.ts` 新增纯函数 `mealDeficitHint(status, today)`，返回结构化的 hint。
- 同文件新增 `formatMealDeficitHint(hint)`，便于单测文案。
- `MealPage` 只负责渲染，不内联算术。

hint 类型：

```ts
export type MealDeficitHint =
  | { kind: 'none' }
  | { kind: 'ended'; over: number }
  | { kind: 'impossible'; over: number; remainingOver: number }
  | { kind: 'lessThanOne'; over: number; days: number }
  | { kind: 'reduce'; over: number; days: number; perDayYuan: number };
```

#### 4.1.2 历史周期子页

- 主页删除现有的「周期记录」列表区块。
- 新增入口卡，放在摘要卡之后：
  - 文案：`历史周期` + `N 个周期 · 最近 11月1日–11月30日`
  - `N` = `startDate <= today` 的周期数（含当前周期）
  - 无周期时：`历史周期` + `还没有周期记录`
  - 整卡可点击 → `/meal/records`
- 子页 `MealRecordsPage`：
  - 顶部返回链接 `‹ 餐补`
  - 渲染逻辑与现有周期卡片一致：`buildMealTimeline` 过滤 `startDate <= today`，倒序展示
  - 保留现有的保底徽标、周期汇总、逐日记录、编辑/删除交互
- 提取现有周期卡片为可复用组件 `PeriodCard`（`src/ui/components/PeriodCard.tsx`），主页不再使用，子页使用。

### 4.2 补回账主页

#### 4.2.1 事项分区

新增派生函数（`src/domain/planning.ts`）：

- `firstSpendMonth(state, eventId): string | undefined`：该事项最早一笔支出的月份。
- `isEventCompleted(state, eventId): boolean`：`spent > 0 && replenished >= spent`。
- `partitionEvents(state)`：返回 `{ ongoing: PlanningEvent[]; completed: PlanningEvent[] }`，均为派生结果，不落库。

分区规则：

- **待补回**：不满足完成条件的事项。
  - 有支出：按首笔支出月份倒序；同月按 `createdAt` 倒序。
  - 无支出：排在最后，按 `createdAt` 倒序。
  - 未支出但有补回的异常事项留在待补回，保留现有「多补」徽标。
- **已补回**：`spent > 0 && replenished >= spent`（多补也算完成）。
  - 主页不直接展示列表，只放入口卡：`已补回 · N 个 ›` → `/planning/completed`。
  - 数量为 0 时不显示入口卡。

主页「事项」区块改名为 **待补回**，只渲染 `ongoing`。

#### 4.2.2 月份徽标

- 每张事项卡显示首笔支出月份徽标：
  - 与今天同年：`11月`
  - 跨年：`2025年12月`
  - 无支出：`未支出`
- 徽标放在事项卡标题行，与「待补 / 多补 / 已补齐」徽标并列。
- 月份缩写统一由 `formatShortMonth(month, today)` 提供（`src/domain/dates.ts`），补回账主页、已补回子页、用款计划表格共用。

#### 4.2.3 已补回子页

- 路由：`/planning/completed`
- 顶部返回 `‹ 补回账`
- 按首笔支出月份分组，月份倒序。
- 组头：`2026年11月 · 支出 ¥X · 补回 ¥Y · N 个`
- 组内按最近一笔补回日期倒序；同日按 `createdAt` 倒序。
- 每组下复用事项卡样式，点击进入现有事项详情页，仍可编辑/删除；若编辑后不再满足完成条件，返回主页时该事项会重新出现在待补回。
- 无已补回事项时显示空态：`还没有已补回的事项`。

新增派生函数：

```ts
export interface CompletedEventGroup {
  month: string;
  events: PlanningEvent[];
  spends: number;
  replenishes: number;
}
export function completedEventGroups(state: PlanningState): CompletedEventGroup[];
```

#### 4.2.4 汇入拆分

- **本月汇入**：`monthOf(entry.date) === monthOf(today)`，按日期倒序、同日按 `createdAt` 倒序。
- **汇入记录**：其余汇入（主要是往月；未来日期也归入此类，避免数据不可见），按日期倒序。
  - 主页入口卡：`汇入记录 · N 笔 ›` → `/planning/inflows`
  - N 为 0 时不显示入口卡。
- 子页 `InflowsPage`：
  - 顶部返回 `‹ 补回账`
  - 按月分组，组头 `2026年10月 · 3 笔`
  - 行样式复用现有汇入列表（日期、备注、金额、编辑、删除）
  - 编辑复用 `EntrySheet`，`kind` 锁定为 `inflow`；删除复用 `ConfirmDialog`
- 新增派生函数：

```ts
export function partitionInflows(state: PlanningState, today: string): {
  currentMonth: InflowEntry[];
  archived: InflowEntry[];
};
```

#### 4.2.5 用款计划入口

- 在补回账主页事项/汇入区块之后新增入口卡：`用款计划` + `未来几个月的支出与回补安排` → `/planning/plans`
- 始终显示，不依赖数据量。

### 4.3 用款计划子页

#### 4.3.1 数据模型

```ts
export interface PlanItem {
  id: string;
  spendMonth: string;      // YYYY-MM
  title: string;           // 事件内容
  amount: number;          // 分，整数且大于 0
  replenishMonth: string;  // YYYY-MM，单月必填
  createdAt: string;       // ISO
}

export interface PlanState {
  items: PlanItem[];
}
```

规则：

- 回补月份单月必填；分多个月回补就建多条。
- 不强制「回补月份 ≥ 支出月份」，允许任意组合。
- 不存储累计值、汇总值，全部派生计算。

#### 4.3.2 存储

- 新文件 `src/storage/planItemsStorage.ts`
- key：`planned-ledger.plan-items.v1`（与 `planned-ledger.v1` 同域）
- 复用 `loadJson` / `saveJson`
- 校验：
  - `items` 为数组
  - 每项 `id`/`title`/`createdAt` 为字符串
  - `spendMonth`/`replenishMonth` 通过 `isValidMonthKey`
  - `amount` 为大于 0 的整数
- 默认值 `{ items: [] }`
- 读取失败或格式异常时返回默认值 + 错误文案，沿用现有 storage 行为

#### 4.3.3 Store

- 新文件 `src/state/PlanStore.tsx`
- 提供 `items`、`storageError`、`dismissError`、`addItem`、`updateItem`、`deleteItem`
- 每次状态变化写回 storage
- 在 `src/main.tsx` 中与 `MealProvider`、`PlanningProvider` 一起挂载
- `App.tsx` 的 `StorageBanner` 纳入 `usePlan()` 的存储错误

#### 4.3.4 页面结构

路由：`/planning/plans`，顶部返回 `‹ 补回账`。

从上到下：

1. **时间范围汇总条**
   - 范围 = 从本月起、长度为 `timelineLength` 的连续月份
   - 展示：计划支出 / 计划回补 / 净额 / 累计
   - 累计取时间轴最后一个月（范围终点）的累计值；长度为 1 时即当月的净额
   - 标题：`近 N 个月`
2. **范围控制**
   - `−` 按钮、`近 N 个月`、`+` 按钮
   - 默认 3 个月，范围 1–24，步长 1
   - 只在会话内保存，不落库
3. **排序切换**（`SegmentedControl`）
   - `按支出月份`（默认）：`spendMonth` 升序，同月按 `createdAt` 升序
   - `按写入顺序`：`createdAt` 升序
4. **表格**（默认表格模式，`table-wrap` 允许横向滚动）
   - 列：支出月份 / 事件内容 / 金额 / 回补月份
   - 月份单元格使用同一个 `formatShortMonth(month, today)`
   - 点击行打开编辑 Sheet
   - 新建按钮：右上角 `＋ 新建`，打开空白表单
5. **时间轴**
   - 横向滚动的月份卡
   - 每卡：月份、支出、回补、净额、累计
   - 累计口径：从范围起点（本月）0 开始逐月累加；调整长度不改变已显示月份的累计值
6. **空态**
   - 无计划条目时：显示空态 `还没有用款计划` + 提示 `把未来几个月的支出和回补排进来。`
   - 隐藏汇总条、范围控制和时间轴，仅保留新建按钮

#### 4.3.5 表单

新组件 `src/ui/components/PlanForm.tsx`：

- 字段：支出月份（`type=month`）、事件内容（文本）、金额（`MoneyInput`）、回补月份（`type=month`）
- 新建默认值：支出月份 = 当前月，回补月份 = 下月，金额与内容为空
- 校验：
  - 事件内容去空格后非空
  - 金额可解析为大于 0 的分
  - 两个月份均为合法 `YYYY-MM`
- 错误用现有 `.form-error` 展示
- 编辑 Sheet 底部提供 `删除` 按钮，二次确认后删除

#### 4.3.6 派生计算

新文件 `src/domain/planItems.ts`：

```ts
export interface PlanMonthBucket {
  month: string;
  spend: number;
  replenish: number;
  net: number;        // replenish - spend
  cumulative: number; // 从范围起点累计
}

export function planMonthBuckets(
  items: PlanItem[],
  startMonth: string,
  length: number,
): PlanMonthBucket[];

export function summarizePlanRange(
  items: PlanItem[],
  startMonth: string,
  length: number,
): { spend: number; replenish: number; net: number; cumulative: number };

export function sortPlanItems(
  items: PlanItem[],
  mode: 'spendMonth' | 'createdAt',
): PlanItem[];
```

- `planMonthBuckets` 月份使用 `addMonths(startMonth, index)`
- 某月的 `spend` 汇总 `spendMonth === month` 的金额；`replenish` 汇总 `replenishMonth === month` 的金额
- `net = replenish - spend`
- `cumulative` 从 0 起逐月相加
- 同一 `createdAt` 时按 `id` 升序，保证排序稳定
- 范围外的计划仍保留在表格中，只是不进入时间轴和汇总条

### 4.4 统计页

- 新增 `PlanningMetric = 'net' | 'spend' | 'replenish' | 'inflow'`
- 仅当 `ledger === 'planning'` 时，在图表上方显示 `SegmentedControl`：
  - `净变化`（默认）→ `row.net`
  - `支出` → `row.spends`
  - `补回` → `row.replenishes`
  - `汇入` → `row.inflows`
- 图表标题随指标变化：`每月净变化 / 每月支出 / 每月补回 / 每月汇入`
- 配色沿用补回账主色，不新增配色体系
- 下方逐月表格保持现状不变

### 4.5 设置页

- 数据卡片新增 `清空用款计划` 按钮，二次确认后清空 PlanStore；确认文案：`删除所有用款计划条目，且无法恢复。`
- 现有 `清空补回账数据` 只清空 PlanningState，不影响用款计划。
- 关于行简化为 `小账本 v{版本号}`，去掉「数据版本 v2」。
- 存储错误文案统一为第 11 节的定义。
- 所有可见文案按第 11 节规范调整。

## 5. 路由与导航

新增路由：

| 路由 | 页面 |
|---|---|
| `/meal/records` | `MealRecordsPage` |
| `/planning/completed` | `CompletedEventsPage` |
| `/planning/inflows` | `InflowsPage` |
| `/planning/plans` | `PlansPage` |

- 底部导航不新增 tab。
- `/planning/*` 子页会让「补回账」tab 保持高亮（现有 NavLink 未设 `end`）。
- `/meal/records` 与现有 `/meal/backfill` 一样，不点亮任何底部 tab；页面内提供返回链接。
- 路由路径、localStorage key、组件名保持现有英文命名（`planning` / `planned-ledger`），只改用户可见文案，不做存储迁移。

## 6. 组件与文件边界

新增：

- `src/domain/planItems.ts`
- `src/domain/planItems.test.ts`
- `src/state/PlanStore.tsx`
- `src/storage/planItemsStorage.ts`
- `src/storage/planItemsStorage.test.ts`
- `src/ui/components/PlanForm.tsx`
- `src/ui/components/PeriodCard.tsx`
- `src/ui/pages/MealRecordsPage.tsx`（+ 测试）
- `src/ui/pages/CompletedEventsPage.tsx`（+ 测试）
- `src/ui/pages/InflowsPage.tsx`（+ 测试）
- `src/ui/pages/PlansPage.tsx`（+ 测试）

修改：

- `src/domain/mealV2.ts`：`mealDeficitHint`、`formatMealDeficitHint`
- `src/domain/dates.ts`：新增 `formatShortMonth(month, today)`
- `src/domain/planning.ts`：分区、首笔支出月份、已补回分组、汇入拆分
- `src/ui/pages/MealPage.tsx`：移除周期列表、加历史周期入口、接提醒
- `src/ui/pages/PlanningPage.tsx`：分区、徽标、入口卡
- `src/ui/pages/StatsPage.tsx`：补回账指标切换、文案规范
- `src/ui/pages/SettingsPage.tsx`：新增清空用款计划、文案规范
- `src/ui/pages/EventDetailPage.tsx`、`BackfillPage.tsx`、`Onboarding.tsx`：文案规范
- `src/ui/components/EntrySheet.tsx`、`EventForm.tsx`、`ConfirmDialog.tsx`、`BarChart.tsx`：文案与 aria 规范
- `src/App.tsx`：路由、导航标签、`StorageBanner` 纳入 PlanStore
- `src/main.tsx`：挂载 `PlanProvider`
- `src/storage/jsonStorage.ts`：存储错误文案
- `src/ui/styles.css`：入口卡、计划表格、时间轴等样式
- `src/domain/mealV2.test.ts`、`src/domain/planning.test.ts`、`src/ui/pages/*.test.tsx`：补充测试

## 7. 错误处理

- 存储读取失败：沿用 `loadJson`，主页顶部 banner 提示；新增用款计划纳入同一个 banner。
- 表单非法输入：行内 `.form-error`，不写库。
- 删除计划条目：`ConfirmDialog` 二次确认。
- 不存在的计划条目 / 事项：返回空态或关闭 Sheet，不抛错。
- 时间轴长度为 0 的情况不会出现（范围钳制 1–24）。

## 8. 测试策略

单元测试：

- `mealDeficitHint`：
  - 余额 ≥ 0 → none
  - 今天未记录，含今天
  - 今天已记录，从明天算
  - 不足 1 元
  - 无法补平（`perDay >= allowance`）
  - 剩余 0 天 / 周期已结束
  - 向上取整到元
- 补回账分区：
  - 首笔支出月份取最早一笔
  - 完成条件（含多补）
  - 待补回排序（月份倒序、未支出最后）
  - 已补回分组与组内排序
  - 汇入按自然月拆分
- 用款计划：
  - 月份桶、支出/回补/净额/累计
  - 范围汇总
  - 两种排序
  - 表单校验（空内容、非法金额、非法月份）
- 存储：
  - 合法数据加载
  - 非法数据重置并返回错误
- 统计：
  - 默认净变化
  - 切换四项后图表标题与数据正确

页面测试：

- 餐补主页入口卡与提醒文案；历史周期子页渲染
- 补回账待补回/已补回入口/月份徽标/汇入分区
- 已补回子页分组
- 汇入记录子页编辑与删除
- 用款计划新建/编辑/删除/排序/长度 ±/时间轴累计
- 全量测试保持绿色

## 9. 发布

1. `npm run test:run` 全量通过。
2. `package.json` 版本升到 `1.1.0`（当前 `1.0.3`）。
3. Android `versionCode` 升到 `5`（当前 `4`），`versionName` 升到 `1.1.0`。
4. `npm run build` → `npx cap sync android` → Gradle 签名打包，复制到 `Desktop`。
5. 提交并推送，触发 GitHub Pages 部署。
6. 验证线上包版本号、字体缩放、四个新子页路由。

## 10. 已确认的决策

| 决策 | 结论 |
|---|---|
| 用款计划与补回账关系 | 独立台账，不影响余额与现有统计 |
| 余额提醒归属 | 餐补页余额卡 |
| 剩余天数口径 | 今天已记录从明天算，未记录含今天 |
| 取整方式 | 向上取整到元；不足 1 元单独文案；无解单独文案 |
| 补回账统计 | 现有统计页保留，另加图表指标切换 |
| 支出月份来源 | 事项首笔实际支出月份 |
| 已完成条件 | 已补回 ≥ 已支出且已支出 > 0 |
| 汇入口径 | 自然月；跨月自动进汇入记录 |
| 回补结构 | 单月必填，多月就建多条 |
| 时间轴内容 | 支出 + 回补 + 净额 + 累计 |
| 时间轴范围 | 本月起，默认 3 个月，± 调 1–24 |
| 入口位置 | 补回账页内入口 + 子页 |
| 命名方案 | 补回系 |
| 界面文案与标识 | 按第 11 节统一；「规划账」改为「补回账」，路由与存储 key 不变 |

## 11. 术语与文案规范

### 11.1 全局术语

| 术语 | 含义 | 使用位置 |
|---|---|---|
| 小账本 | 应用名 | 启动页、设置关于 |
| 餐补 | 月度餐饮预算账 | 底部导航、统计切换 |
| 补回账 | 记录大额支出与补回的实际账本（原「规划账」） | 底部导航、余额卡、统计切换、设置、返回链接 |
| 事项 | 补回账中一笔需要补回的大额支出事件 | 新建/编辑、详情、删除确认 |
| 支出 / 补回 / 汇入 | 补回账的三类记录 | 表单、列表、统计表头 |
| 待补回 / 已补回 / 多补回 | 事项的三种状态 | 分区、徽标 |
| 用款计划 | 未来收支规划模块 | 入口卡、子页 |
| 计划条目 | 用款计划中的一行 | 新建/编辑、删除确认 |
| 本月汇入 / 汇入记录 | 当月 / 非当月汇入 | 分区与子页 |
| 周期 / 历史周期 | 餐补的预算周期 | 餐补页、设置、统计 |
| 开始日期 / 结束日期 | 应用或周期的起止日期 | 设置、启动页 |
| 周期起始日 | 每月几号开始新周期（1–31） | 设置 |
| 正常额度 / 保底额度 / 自由额度 | 每日正常金额 / 每日保底金额 / 可自由支配缓冲 | 餐补设置与卡片 |
| 正常阶段 / 保底阶段 | 当前额度模式 | 餐补卡片、设置、统计 |
| 结余 | 额度减花费后的累计值 | 餐补卡片、周期记录 |
| 结转 | 周期结束时正结余带入下期 | 周期记录、设置 |
| 补记 | 补录缺失日期的餐补花费 | 餐补页、补记页 |

### 11.2 状态与徽标

- 事项：`待补回 ¥X`、`多补回 ¥X`、`已补回`、`未支出`、`超计划 ¥X`
- 餐补：`自由额度已用完`、`进行中`、`已清零`
- 不再使用「待补」「多补」「已补齐」「暂无支出」等旧词

### 11.3 分区与页面标题

| 位置 | 标题 |
|---|---|
| 底部导航 | 餐补 / 补回账 / 统计 / 设置 |
| 餐补主页入口 | 历史周期 |
| 补回账主页 | 待补回 / 本月汇入 |
| 补回账入口卡 | 已补回 / 汇入记录 / 用款计划 |
| 子页 h1 | 历史周期 / 已补回 / 汇入记录 / 用款计划 |
| 返回链接 | `‹ 返回餐补` / `‹ 返回补回账` |

### 11.4 按钮与操作

- 新建事项：`新建事项` → 提交 `创建事项`
- 编辑事项：`保存修改`
- 新建计划条目：`＋ 新建` → 提交 `创建计划`
- 编辑计划条目：`保存修改`
- 记账主操作：`记一笔`
- 事项详情：`记录支出` / `记录补回`
- 餐补今日记录：`保存`
- 餐补编辑记录：`保存修改`
- 设置：`保存设置`
- 周期：`保存周期`
- 删除：`删除`；确认框 `确认删除`；取消 `取消`
- 恢复：`立即恢复周期`；确认 `确认恢复`
- 清空：`清空餐补数据` / `清空补回账数据` / `清空用款计划`

### 11.5 空态

| 位置 | 标题 | 提示 |
|---|---|---|
| 餐补历史周期 | 还没有周期记录 | — |
| 补回账待补回 | 还没有待补回事项 | 新建一个事项，记录支出和补回的过程。 |
| 已补回子页 | 还没有已补回的事项 | — |
| 本月汇入 | 本月还没有汇入 | 工资、红包等额外资金可以记在这里。 |
| 汇入记录子页 | 还没有历史汇入 | — |
| 用款计划 | 还没有用款计划 | 把未来几个月的支出和回补排进来。 |

### 11.6 确认框

- 必须使用具体标题，禁止「确认操作」「确认」这类无信息标题。
- 删除：`删除这笔支出？` / `删除这笔补回？` / `删除这笔汇入？` / `删除这个事项？` / `删除这条计划？`
- 修改会改变餐补阶段：`确认修改？`
- 恢复周期：`立即恢复周期？`
- 清空：`清空餐补数据？` / `清空补回账数据？` / `清空用款计划？`
- 消息体必须说明后果：是否重算余额、是否无法恢复、负数是否清零、正数是否结转。

### 11.7 金额、日期与计数

- 金额：`¥123.45`；带符号 `+¥123.45` / `-¥123.45`
- 餐补花费允许 0；补回账所有金额必须大于 0
- 日期：`11月1日`；范围 `11月1日 – 11月30日`
- 月份：`2026年11月`；同年缩写 `11月`，跨年 `2025年12月`
- 计数：事项/周期用 `个`，记录/汇入用 `笔`，计划条目用 `条`，月份用 `个月`
- 分隔符：`·`；返回 `‹`；进入 `›`；区间 `–`；省略号 `…`
- 标点统一中文全角

### 11.8 错误提示

| 场景 | 文案 |
|---|---|
| 餐补金额（允许 0） | 请输入有效金额 |
| 账目金额（必须 > 0） | 请输入大于 0 的金额 |
| 事项计划总支出 | 请输入大于 0 的计划总支出 |
| 月份 | 请选择有效的月份 |
| 事项名称 | 请填写事项名称 |
| 计划事件内容 | 请填写事件内容 |
| 日期晚于今天 | 日期不能晚于今天 |
| 读取失败 | 无法读取本机数据 |
| 格式异常 | 本机数据格式异常，已重置 |
| 保存失败 | 无法保存数据，请检查本机存储空间或应用权限 |

### 11.9 标识与内部命名

- 用户可见名称按本节规范；路由、localStorage key、组件名保持稳定，避免迁移。
- `planning` / `planned-ledger` 仅作为代码内部命名保留（路由 `/planning`、`PlanningStore`、存储 key）。
- 新模块代码使用 `Plan*` / `PlanItem` 命名，与 `Planning*` 区分。
- 图表 `ariaLabel` 必须描述数据，例如 `餐补周期结余趋势`、`补回账月度支出趋势`。
- 所有图标按钮必须有中文 `aria-label`；输入框 `aria-label` 与可见字段名一致。
- 页面 h1 与底部导航文案一致；子页 h1 使用本表标题。

### 11.10 文案改动清单

| 旧文案 | 新文案 |
|---|---|
| 规划账 | 补回账 |
| 规划账余额 | 补回账余额 |
| 返回规划账 | ‹ 返回补回账 |
| 最近汇入 | 本月汇入 |
| 已汇入 | 汇入记录 |
| 还没有汇入 | 本月还没有汇入 |
| 删除后规划账余额会重新计算。 | 删除后补回账余额会重新计算。 |
| 事项（分区标题） | 待补回 |
| 还没有事项 | 还没有待补回事项 |
| 待补 | 待补回 |
| 多补 | 多补回 |
| 已补齐 | 已补回 |
| 暂无支出 | 未支出 |
| 已花 / 已补 | 已支出 / 已补回 |
| 当前可用余额 | 当前结余 |
| 花（记录行） | 花费 |
| 当日 | 当日结余 |
| 累计 | 累计结余 |
| 结束余额 | 期末余额 |
| 开始额度 | 每日正常额度 |
| 日均正常 / 日均保底 | 正常 ¥X/天 / 保底 ¥X/天 |
| 当前阶段值为「正常 ¥X」 | 正常阶段 ¥X/天 |
| 当前阶段值为「保底 ¥X」 | 保底阶段 ¥X/天 |
| 自由额度用完 / 自由额度用完了 | 自由额度已用完 |
| 没有多余的钱可以随意消费 | 自由额度已用完 |
| 起始日期 | 开始日期 |
| 修改流水 | 修改记录 |
| 删除这笔流水？ | 删除这笔支出？ / 删除这笔补回？ |
| 来回补的过程 | 支出与补回记录 |
| 当时待补 | 当时待补回 |
| 记支出 / 记补回 | 记录支出 / 记录补回 |
| 确认操作 | 按场景使用具体标题 |
| 计划总花费 | 计划总支出 |
| 更新今日记录 | 保存 |
| 每期结余 | 每周期结余 |
| 清空规划账数据 | 清空补回账数据 |
| 立即恢复正常额度 | 立即恢复周期 |
| 已恢复正常额度 | 周期已恢复 |
| 数据只保存在本机浏览器中，清除浏览器数据会丢失记录。 | 数据只保存在本机，清除应用数据会丢失记录。 |
| 数据只保存在这台手机上。 | 数据只保存在本机。 |
| 无法保存数据，请检查浏览器存储权限 | 无法保存数据，请检查本机存储空间或应用权限 |
| 小账本 vX · 数据版本 v2 | 小账本 vX |
| 本周期额度 | 本周期总额度 |

## 12. 未纳入范围

- 用款计划与实际事项的自动关联或一键转事项。
- 计划条目的提醒推送、执行状态、完成勾选。
- 备份/导入导出。
- 底部导航新增 tab。
- 已补回事项的批量归档/清理。
