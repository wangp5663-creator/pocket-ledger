# 小账本（pocket-ledger）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个安卓手机可安装的 PWA「小账本」，包含餐补结余账、规划支出/补回账，以及两套账的按月统计。

**Architecture:** 纯前端 Vite + React + TypeScript 单页应用，使用 HashRouter 处理页面导航；领域逻辑（金额、日期、余额、统计）为无副作用纯函数并用 Vitest 测试；两套账各用一个 React Context store，数据以带版本号的 JSON 存入 localStorage；`vite-plugin-pwa` 提供离线与主屏幕安装；GitHub Actions 部署到 GitHub Pages。

**Tech Stack:** React 19、TypeScript、Vite 6、react-router-dom 7、Vitest 3、Testing Library、vite-plugin-pwa、GitHub Pages。

**规格文档:** `docs/superpowers/specs/2026-11-06-pocket-ledger-design.md`

---

## 文件结构

```
pocket-ledger/
├─ public/
│  ├─ icon.svg
│  └─ icons/icon-192.png, icon-512.png, icon-maskable-512.png  (脚本生成)
├─ scripts/generate-icons.mjs
├─ src/
│  ├─ main.tsx                    # 挂载 + Providers + HashRouter
│  ├─ App.tsx                     # 路由、底部导航、存储错误条
│  ├─ vite-env.d.ts
│  ├─ domain/
│  │  ├─ money.ts / money.test.ts # 元/分转换与格式化
│  │  ├─ dates.ts / dates.test.ts # 本地日期、月份、区间
│  │  ├─ id.ts                    # createId
│  │  ├─ meal.ts / meal.test.ts   # 餐补领域逻辑
│  │  ├─ planning.ts / planning.test.ts # 规划账领域逻辑
│  │  └─ stats.ts / stats.test.ts # 月度统计序列
│  ├─ storage/
│  │  ├─ jsonStorage.ts / jsonStorage.test.ts
│  │  ├─ mealStorage.ts / mealStorage.test.ts
│  │  └─ planningStorage.ts / planningStorage.test.ts
│  ├─ state/
│  │  ├─ MealStore.tsx            # 餐补 Context + actions
│  │  └─ PlanningStore.tsx        # 规划账 Context + actions
│  ├─ ui/
│  │  ├─ styles.css               # 全局样式、主题、深色模式
│  │  ├─ components/              # MoneyInput, Sheet, ConfirmDialog, ...
│  │  └─ pages/                   # Onboarding, MealPage, BackfillPage, ...
│  └─ test/
│     ├─ setup.ts
│     └─ render.tsx               # 带 Providers 的测试渲染工具
├─ .github/workflows/deploy.yml
├─ package.json
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json
├─ vite.config.ts
├─ index.html
├─ .gitignore
└─ README.md
```

---

### Task 1: 项目脚手架与测试环境

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/ui/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "pocket-ledger",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "icons": "node scripts/generate-icons.mjs"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.4.0",
    "jsdom": "^26.1.0",
    "sharp": "^0.34.1",
    "typescript": "~5.8.3",
    "vite": "^6.3.5",
    "vite-plugin-pwa": "^1.0.0",
    "vitest": "^3.1.3"
  }
}
```

- [ ] **Step 2: 创建 `tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`**

`tsconfig.json`：

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: 创建 `.gitignore`、`vite.config.ts`、`index.html`、`src/vite-env.d.ts`**

`.gitignore`：

```gitignore
node_modules/
dist/
dev-dist/
coverage/
*.local
.DS_Store
```

`vite.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    passWithNoTests: true,
  },
});
```

`index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#10B981" />
    <link rel="icon" type="image/svg+xml" href="%BASE_URL%icon.svg" />
    <title>小账本</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts`：

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: 创建最小可运行的 `src/main.tsx`、`src/App.tsx`、`src/ui/styles.css`、`src/test/setup.ts`**

`src/main.tsx`：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`：

```tsx
export default function App() {
  return (
    <main className="page">
      <h1>小账本</h1>
    </main>
  );
}
```

`src/ui/styles.css`：

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  background: #f7f8f6;
  color: #1f2933;
}
.page { padding: 16px; }
```

`src/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

- [ ] **Step 5: 安装依赖**

Run: `cd ~/pocket-ledger && npm install`
Expected: 安装成功，生成 `package-lock.json`，无报错。

- [ ] **Step 6: 验证构建**

Run: `npm run build`
Expected: `tsc -b` 无错误，`vite build` 输出 `dist/index.html` 等文件，退出码 0。

- [ ] **Step 7: 验证测试环境**

Run: `npm run test:run`
Expected: 无测试文件，因 `passWithNoTests: true`，退出码 0。

- [ ] **Step 8: 提交**

```bash
git add package.json package-lock.json .gitignore index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts src
git commit -m "chore: scaffold Vite + React + TypeScript app with Vitest"
```

---

### Task 2: 金额工具（元/分转换）

**Files:**
- Create: `src/domain/money.ts`
- Test: `src/domain/money.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/money.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { centsToYuan, formatSignedYuan, formatYuan, parseYuanToCents } from './money';

describe('parseYuanToCents', () => {
  it('parses whole and decimal yuan', () => {
    expect(parseYuanToCents('20')).toBe(2000);
    expect(parseYuanToCents('12.3')).toBe(1230);
    expect(parseYuanToCents('0.05')).toBe(5);
    expect(parseYuanToCents('0')).toBe(0);
  });

  it('rejects invalid input', () => {
    expect(parseYuanToCents('')).toBeNull();
    expect(parseYuanToCents('abc')).toBeNull();
    expect(parseYuanToCents('-1')).toBeNull();
    expect(parseYuanToCents('1.234')).toBeNull();
    expect(parseYuanToCents('.5')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats cents as yuan strings', () => {
    expect(centsToYuan(2000)).toBe('20.00');
    expect(centsToYuan(-5)).toBe('-0.05');
    expect(formatYuan(1230)).toBe('¥12.30');
    expect(formatSignedYuan(500)).toBe('+¥5.00');
    expect(formatSignedYuan(-500)).toBe('-¥5.00');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/money.test.ts`
Expected: FAIL，提示无法解析模块 `./money`。

- [ ] **Step 3: 实现 `src/domain/money.ts`**

```ts
export type Cents = number;

export function parseYuanToCents(input: string): Cents | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [yuan, fraction = ''] = trimmed.split('.');
  return Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
}

export function centsToYuan(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const yuan = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sign}${yuan}.${fraction}`;
}

export function formatYuan(cents: Cents): string {
  return `¥${centsToYuan(cents)}`;
}

export function formatSignedYuan(cents: Cents): string {
  return `${cents >= 0 ? '+' : '-'}${formatYuan(Math.abs(cents))}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/domain/money.test.ts`
Expected: PASS（6 个断言组全部通过）。

- [ ] **Step 5: 提交**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat: add money conversion utilities"
```

---

### Task 3: 日期工具

**Files:**
- Create: `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/dates.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  formatDateKey,
  isValidDateKey,
  isValidMonthKey,
  lastNMonths,
  listDates,
  monthEndKey,
  monthOf,
  parseDateKey,
  todayKey,
} from './dates';

describe('dates', () => {
  it('formats and parses local dates', () => {
    expect(formatDateKey(new Date(2026, 10, 6))).toBe('2026-11-06');
    expect(parseDateKey('2026-11-06').getDate()).toBe(6);
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(monthEndKey('2028-02')).toBe('2028-02-29');
  });

  it('lists inclusive dates and month keys', () => {
    expect(listDates('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(monthOf('2026-11-06')).toBe('2026-11');
  });

  it('lists the last n months', () => {
    expect(lastNMonths('2026-02-15', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('validates date and month keys', () => {
    expect(isValidDateKey('2026-11-06')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidMonthKey('2026-12')).toBe(true);
    expect(isValidMonthKey('2026-13')).toBe(false);
  });

  it('todayKey uses the provided date', () => {
    expect(todayKey(new Date(2026, 0, 2))).toBe('2026-01-02');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/dates.test.ts`
Expected: FAIL，模块 `./dates` 不存在。

- [ ] **Step 3: 实现 `src/domain/dates.ts`**

```ts
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return formatDateKey(now);
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

export function listDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = start;
  while (current <= end) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function monthEndKey(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return formatDateKey(new Date(year, monthNumber, 0));
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function lastNMonths(today: string, count: number): string[] {
  const current = monthOf(today);
  const months: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    months.push(addMonths(current, -index));
  }
  return months;
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatDateKey(parseDateKey(value)) === value;
}

export function isValidMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = value.slice(5);
  return month >= '01' && month <= '12';
}

export function formatDisplayDate(key: string): string {
  const [, month, day] = key.split('-').map(Number);
  return `${month}月${day}日`;
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/domain/dates.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/domain/dates.ts src/domain/dates.test.ts
git commit -m "feat: add local date utilities"
```

---

### Task 4: 餐补领域逻辑

**Files:**
- Create: `src/domain/meal.ts`
- Test: `src/domain/meal.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/meal.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildMealRows,
  computeMealBalance,
  dailyBalance,
  defaultMealState,
  mealMonthSummary,
  missingDates,
  type MealRecord,
  type MealState,
} from './meal';

function record(spent: number, allowance = 2000): MealRecord {
  return { spent, allowance, updatedAt: '2026-11-01T00:00:00.000Z' };
}

const settings = { dailyAllowance: 2000, startDate: '2026-11-01' };

describe('meal balance', () => {
  it('sums daily balances and allows overspend', () => {
    const state: MealState = {
      settings,
      records: {
        '2026-11-01': record(1500),
        '2026-11-02': record(2500),
        '2026-11-03': record(2000),
      },
    };
    expect(computeMealBalance(state)).toBe(0);
    expect(dailyBalance(record(2500))).toBe(-500);
  });

  it('keeps allowance snapshots instead of current settings', () => {
    const state: MealState = {
      settings: { dailyAllowance: 2500, startDate: '2026-11-01' },
      records: { '2026-11-01': record(1000, 2000) },
    };
    expect(computeMealBalance(state)).toBe(1000);
  });

  it('defaults to 20 yuan and an empty start date', () => {
    expect(defaultMealState()).toEqual({
      settings: { dailyAllowance: 2000, startDate: '' },
      records: {},
    });
  });
});

describe('missing dates', () => {
  it('lists unrecorded dates from start date to yesterday', () => {
    const state: MealState = {
      settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
      records: { '2026-11-02': record(2000) },
    };
    expect(missingDates(state, '2026-11-05')).toEqual(['2026-11-01', '2026-11-03', '2026-11-04']);
    expect(missingDates(state, '2026-11-01')).toEqual([]);
  });

  it('returns empty before the start date', () => {
    const state: MealState = { settings: { dailyAllowance: 2000, startDate: '' }, records: {} };
    expect(missingDates(state, '2026-11-05')).toEqual([]);
  });
});

describe('meal rows', () => {
  it('sorts by date and accumulates balance', () => {
    const state: MealState = {
      settings,
      records: {
        '2026-11-03': record(2000),
        '2026-11-01': record(1500),
        '2026-11-02': record(2500),
      },
    };
    const rows = buildMealRows(state);
    expect(rows.map((row) => row.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(rows.map((row) => row.cumulative)).toEqual([500, 0, 0]);
  });
});

describe('meal month summary', () => {
  it('aggregates a month and cumulative end balance', () => {
    const state: MealState = {
      settings,
      records: {
        '2026-10-31': record(1000),
        '2026-11-01': record(1000),
        '2026-11-02': record(2500),
        '2026-11-03': record(1500),
      },
    };
    const summary = mealMonthSummary(state, '2026-11', '2026-11-10');
    expect(summary.daysRecorded).toBe(3);
    expect(summary.allowanceTotal).toBe(6000);
    expect(summary.spentTotal).toBe(5000);
    expect(summary.net).toBe(1000);
    expect(summary.endBalance).toBe(2000);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/meal.test.ts`
Expected: FAIL，模块 `./meal` 不存在。

- [ ] **Step 3: 实现 `src/domain/meal.ts`**

```ts
import { addDays, listDates, monthEndKey, monthOf } from './dates';

export interface MealRecord {
  spent: number;
  note?: string;
  allowance: number;
  updatedAt: string;
}

export interface MealSettings {
  dailyAllowance: number;
  startDate: string;
}

export interface MealState {
  settings: MealSettings;
  records: Record<string, MealRecord>;
}

export function defaultMealState(): MealState {
  return { settings: { dailyAllowance: 2000, startDate: '' }, records: {} };
}

export function dailyBalance(record: MealRecord): number {
  return record.allowance - record.spent;
}

export function computeMealBalance(state: MealState): number {
  const { startDate } = state.settings;
  return Object.entries(state.records)
    .filter(([date]) => date >= startDate)
    .reduce((total, [, record]) => total + dailyBalance(record), 0);
}

export function missingDates(state: MealState, today: string): string[] {
  const { startDate } = state.settings;
  if (!startDate) return [];
  const lastMissing = addDays(today, -1);
  if (startDate > lastMissing) return [];
  return listDates(startDate, lastMissing).filter((date) => !state.records[date]);
}

export interface MealRow {
  date: string;
  record: MealRecord;
  daily: number;
  cumulative: number;
}

export function buildMealRows(state: MealState): MealRow[] {
  let cumulative = 0;
  return Object.keys(state.records)
    .filter((date) => date >= state.settings.startDate)
    .sort()
    .map((date) => {
      const record = state.records[date];
      const daily = dailyBalance(record);
      cumulative += daily;
      return { date, record, daily, cumulative };
    });
}

export interface MealMonthSummary {
  month: string;
  daysRecorded: number;
  allowanceTotal: number;
  spentTotal: number;
  net: number;
  endBalance: number;
}

export function mealMonthSummary(state: MealState, month: string, today: string): MealMonthSummary {
  const endDate = month >= monthOf(today) ? today : monthEndKey(month);
  const monthRecords = Object.entries(state.records)
    .filter(([date]) => date >= state.settings.startDate && monthOf(date) === month)
    .map(([, record]) => record);
  const allowanceTotal = monthRecords.reduce((total, record) => total + record.allowance, 0);
  const spentTotal = monthRecords.reduce((total, record) => total + record.spent, 0);
  const endBalance = Object.entries(state.records)
    .filter(([date]) => date >= state.settings.startDate && date <= endDate)
    .reduce((total, [, record]) => total + dailyBalance(record), 0);
  return {
    month,
    daysRecorded: monthRecords.length,
    allowanceTotal,
    spentTotal,
    net: allowanceTotal - spentTotal,
    endBalance,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/domain/meal.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/domain/meal.ts src/domain/meal.test.ts
git commit -m "feat: add meal allowance domain logic"
```

---

### Task 5: 规划账领域逻辑

**Files:**
- Create: `src/domain/id.ts`
- Create: `src/domain/planning.ts`
- Test: `src/domain/planning.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/planning.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  computePlanningBalance,
  emptyPlanningState,
  eventProgress,
  eventTimeline,
  planningMonthSummary,
  removeEvent,
  replenishPlanComparison,
  type PlanningState,
} from './planning';

const createdAt = '2026-11-01T00:00:00.000Z';

const state: PlanningState = {
  events: [
    {
      id: 'e1',
      name: '买电脑',
      plannedTotal: 500000,
      replenishPlan: [
        { month: '2026-12', amount: 300000 },
        { month: '2027-01', amount: 200000 },
      ],
      createdAt,
    },
    { id: 'e2', name: '旅行', replenishPlan: [], createdAt },
  ],
  spends: [
    { id: 's1', eventId: 'e1', date: '2026-11-02', amount: 300000, createdAt },
    { id: 's2', eventId: 'e1', date: '2026-11-03', amount: 250000, createdAt },
    { id: 's3', eventId: 'e2', date: '2026-11-04', amount: 100000, createdAt },
  ],
  replenishes: [
    { id: 'r1', eventId: 'e1', date: '2026-12-05', amount: 150000, createdAt },
    { id: 'r2', eventId: 'e1', date: '2027-01-05', amount: 50000, createdAt },
  ],
  inflows: [{ id: 'i1', date: '2026-11-10', amount: 200000, createdAt }],
};

describe('planning balance', () => {
  it('adds inflows and replenishes, subtracts spends', () => {
    expect(computePlanningBalance(state)).toBe(200000 + 200000 - 650000);
    expect(computePlanningBalance(emptyPlanningState())).toBe(0);
  });
});

describe('event progress', () => {
  it('aggregates multiple spends and replenishes', () => {
    const progress = eventProgress(state, 'e1');
    expect(progress.spent).toBe(550000);
    expect(progress.replenished).toBe(200000);
    expect(progress.outstanding).toBe(350000);
    expect(progress.overPlanned).toBe(50000);
  });

  it('reports negative outstanding when over replenished', () => {
    const over: PlanningState = {
      ...state,
      replenishes: [{ id: 'r3', eventId: 'e2', date: '2026-11-20', amount: 150000, createdAt }],
    };
    expect(eventProgress(over, 'e2').outstanding).toBe(-50000);
  });
});

describe('event timeline', () => {
  it('merges spends and replenishes with running outstanding', () => {
    const timeline = eventTimeline(state, 'e1');
    expect(timeline.map((item) => [item.kind, item.amount, item.outstandingAfter])).toEqual([
      ['spend', 300000, 300000],
      ['spend', 250000, 550000],
      ['replenish', 150000, 400000],
      ['replenish', 50000, 350000],
    ]);
  });
});

describe('replenish plan comparison', () => {
  it('compares planned and actual per month', () => {
    const comparison = replenishPlanComparison(state, 'e1');
    expect(comparison).toEqual([
      { month: '2026-12', planned: 300000, actual: 150000, diff: -150000 },
      { month: '2027-01', planned: 200000, actual: 50000, diff: -150000 },
    ]);
  });
});

describe('planning month summary', () => {
  it('aggregates monthly entries and end balance', () => {
    const summary = planningMonthSummary(state, '2026-11', '2026-12-15');
    expect(summary.spends).toBe(650000);
    expect(summary.replenishes).toBe(0);
    expect(summary.inflows).toBe(200000);
    expect(summary.net).toBe(-450000);
    expect(summary.endBalance).toBe(-450000);
  });
});

describe('remove event', () => {
  it('cascades spends and replenishes but keeps inflows', () => {
    const next = removeEvent(state, 'e1');
    expect(next.events.map((event) => event.id)).toEqual(['e2']);
    expect(next.spends.map((entry) => entry.id)).toEqual(['s3']);
    expect(next.replenishes).toEqual([]);
    expect(next.inflows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/planning.test.ts`
Expected: FAIL，模块 `./planning` 不存在。

- [ ] **Step 3: 实现 `src/domain/id.ts`**

```ts
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 4: 实现 `src/domain/planning.ts`**

```ts
import { monthEndKey, monthOf } from './dates';

export interface ReplenishPlanItem {
  month: string;
  amount: number;
}

export interface PlanningEvent {
  id: string;
  name: string;
  plannedTotal?: number;
  note?: string;
  replenishPlan: ReplenishPlanItem[];
  createdAt: string;
}

export interface EntryBase {
  id: string;
  date: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface SpendEntry extends EntryBase {
  eventId: string;
}

export interface ReplenishEntry extends EntryBase {
  eventId: string;
}

export type InflowEntry = EntryBase;

export interface PlanningState {
  events: PlanningEvent[];
  spends: SpendEntry[];
  replenishes: ReplenishEntry[];
  inflows: InflowEntry[];
}

export function emptyPlanningState(): PlanningState {
  return { events: [], spends: [], replenishes: [], inflows: [] };
}

export function sumAmounts(entries: Array<{ amount: number }>): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

export function computePlanningBalance(state: PlanningState): number {
  return sumAmounts(state.inflows) + sumAmounts(state.replenishes) - sumAmounts(state.spends);
}

export interface EventProgress {
  spent: number;
  replenished: number;
  outstanding: number;
  overPlanned?: number;
}

export function eventProgress(state: PlanningState, eventId: string): EventProgress {
  const event = state.events.find((candidate) => candidate.id === eventId);
  const spent = sumAmounts(state.spends.filter((entry) => entry.eventId === eventId));
  const replenished = sumAmounts(state.replenishes.filter((entry) => entry.eventId === eventId));
  const overPlanned =
    event?.plannedTotal !== undefined && spent > event.plannedTotal ? spent - event.plannedTotal : undefined;
  return { spent, replenished, outstanding: spent - replenished, overPlanned };
}

export type TimelineKind = 'spend' | 'replenish';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: string;
  amount: number;
  note?: string;
  outstandingAfter: number;
}

export function eventTimeline(state: PlanningState, eventId: string): TimelineItem[] {
  const items = [
    ...state.spends
      .filter((entry) => entry.eventId === eventId)
      .map((entry) => ({ ...entry, kind: 'spend' as const })),
    ...state.replenishes
      .filter((entry) => entry.eventId === eventId)
      .map((entry) => ({ ...entry, kind: 'replenish' as const })),
  ].sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));

  let outstanding = 0;
  return items.map((item) => {
    outstanding += item.kind === 'spend' ? item.amount : -item.amount;
    return {
      id: item.id,
      kind: item.kind,
      date: item.date,
      amount: item.amount,
      note: item.note,
      outstandingAfter: outstanding,
    };
  });
}

export interface PlanComparisonRow {
  month: string;
  planned: number;
  actual: number;
  diff: number;
}

export function replenishPlanComparison(state: PlanningState, eventId: string): PlanComparisonRow[] {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) return [];
  const months = new Set<string>();
  event.replenishPlan.forEach((item) => months.add(item.month));
  state.replenishes
    .filter((entry) => entry.eventId === eventId)
    .forEach((entry) => months.add(monthOf(entry.date)));
  return [...months].sort().map((month) => {
    const planned = event.replenishPlan
      .filter((item) => item.month === month)
      .reduce((total, item) => total + item.amount, 0);
    const actual = sumAmounts(
      state.replenishes.filter((entry) => entry.eventId === eventId && monthOf(entry.date) === month),
    );
    return { month, planned, actual, diff: actual - planned };
  });
}

export interface PlanningMonthSummary {
  month: string;
  spends: number;
  replenishes: number;
  inflows: number;
  net: number;
  endBalance: number;
}

export function planningBalanceUntil(state: PlanningState, endDate: string): number {
  const until = (entry: { date: string }) => entry.date <= endDate;
  return (
    sumAmounts(state.inflows.filter(until)) +
    sumAmounts(state.replenishes.filter(until)) -
    sumAmounts(state.spends.filter(until))
  );
}

export function planningMonthSummary(state: PlanningState, month: string, today: string): PlanningMonthSummary {
  const inMonth = (date: string) => monthOf(date) === month;
  const spends = sumAmounts(state.spends.filter((entry) => inMonth(entry.date)));
  const replenishes = sumAmounts(state.replenishes.filter((entry) => inMonth(entry.date)));
  const inflows = sumAmounts(state.inflows.filter((entry) => inMonth(entry.date)));
  const endDate = month >= monthOf(today) ? today : monthEndKey(month);
  return {
    month,
    spends,
    replenishes,
    inflows,
    net: replenishes + inflows - spends,
    endBalance: planningBalanceUntil(state, endDate),
  };
}

export function removeEvent(state: PlanningState, eventId: string): PlanningState {
  return {
    events: state.events.filter((event) => event.id !== eventId),
    spends: state.spends.filter((entry) => entry.eventId !== eventId),
    replenishes: state.replenishes.filter((entry) => entry.eventId !== eventId),
    inflows: state.inflows,
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/domain/planning.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/domain/id.ts src/domain/planning.ts src/domain/planning.test.ts
git commit -m "feat: add planned expense ledger domain logic"
```

---

### Task 6: 月度统计序列

**Files:**
- Create: `src/domain/stats.ts`
- Test: `src/domain/stats.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/stats.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { mealMonthlySeries } from './stats';
import { planningMonthlySeries } from './stats';
import type { MealState } from './meal';
import type { PlanningState } from './planning';

const today = '2026-11-10';

const mealState: MealState = {
  settings: { dailyAllowance: 2000, startDate: '2026-10-01' },
  records: {
    '2026-10-05': { spent: 1500, allowance: 2000, updatedAt: '2026-10-05T00:00:00.000Z' },
    '2026-11-05': { spent: 2500, allowance: 2000, updatedAt: '2026-11-05T00:00:00.000Z' },
  },
};

const planningState: PlanningState = {
  events: [],
  spends: [{ id: 's1', eventId: 'e1', date: '2026-11-02', amount: 300000, createdAt: '2026-11-02T00:00:00.000Z' }],
  replenishes: [{ id: 'r1', eventId: 'e1', date: '2026-11-08', amount: 100000, createdAt: '2026-11-08T00:00:00.000Z' }],
  inflows: [{ id: 'i1', date: '2026-11-09', amount: 50000, createdAt: '2026-11-09T00:00:00.000Z' }],
};

describe('monthly series', () => {
  it('returns the last n meal months ending with the current month', () => {
    const series = mealMonthlySeries(mealState, today, 2);
    expect(series.map((row) => row.month)).toEqual(['2026-10', '2026-11']);
    expect(series[0].net).toBe(500);
    expect(series[1].net).toBe(-500);
    expect(series[1].endBalance).toBe(0);
  });

  it('returns the last n planning months with net and end balance', () => {
    const series = planningMonthlySeries(planningState, today, 2);
    expect(series.map((row) => row.month)).toEqual(['2026-10', '2026-11']);
    expect(series[0].net).toBe(0);
    expect(series[1].net).toBe(-150000);
    expect(series[1].endBalance).toBe(-150000);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/stats.test.ts`
Expected: FAIL，模块 `./stats` 不存在。

- [ ] **Step 3: 实现 `src/domain/stats.ts`**

```ts
import { lastNMonths } from './dates';
import { mealMonthSummary } from './meal';
import { planningMonthSummary } from './planning';
import type { MealMonthSummary, MealState } from './meal';
import type { PlanningMonthSummary, PlanningState } from './planning';

export function mealMonthlySeries(state: MealState, today: string, count = 6): MealMonthSummary[] {
  return lastNMonths(today, count).map((month) => mealMonthSummary(state, month, today));
}

export function planningMonthlySeries(
  state: PlanningState,
  today: string,
  count = 6,
): PlanningMonthSummary[] {
  return lastNMonths(today, count).map((month) => planningMonthSummary(state, month, today));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/domain/stats.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/domain/stats.ts src/domain/stats.test.ts
git commit -m "feat: add monthly statistics series"
```

---

### Task 7: 存储层

**Files:**
- Create: `src/storage/jsonStorage.ts`
- Test: `src/storage/jsonStorage.test.ts`
- Create: `src/storage/mealStorage.ts`
- Test: `src/storage/mealStorage.test.ts`
- Create: `src/storage/planningStorage.ts`
- Test: `src/storage/planningStorage.test.ts`

- [ ] **Step 1: 写失败测试 `src/storage/jsonStorage.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { loadJson, saveJson } from './jsonStorage';

describe('jsonStorage', () => {
  it('returns default when a key is missing', () => {
    expect(loadJson('missing', (value): value is string[] => Array.isArray(value), () => ['default'])).toEqual({
      value: ['default'],
    });
  });

  it('loads valid JSON', () => {
    localStorage.setItem('list', JSON.stringify(['a', 'b']));
    expect(loadJson('list', (value): value is string[] => Array.isArray(value), () => [])).toEqual({
      value: ['a', 'b'],
    });
  });

  it('resets invalid shapes with a warning', () => {
    localStorage.setItem('list', JSON.stringify({ nope: true }));
    expect(loadJson('list', (value): value is string[] => Array.isArray(value), () => [])).toEqual({
      value: [],
      error: '本地数据格式异常，已重置',
    });
  });

  it('resets broken JSON with a warning', () => {
    localStorage.setItem('list', '{broken');
    expect(loadJson('list', (value): value is string[] => Array.isArray(value), () => [])).toEqual({
      value: [],
      error: '无法读取本地数据',
    });
  });

  it('saves JSON and reports failures', () => {
    expect(saveJson('list', ['x'])).toBeNull();
    expect(localStorage.getItem('list')).toBe('["x"]');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveJson('list', ['y'])).toBe('无法保存数据，请检查浏览器存储权限');
    setItemSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/storage/jsonStorage.test.ts`
Expected: FAIL，模块 `./jsonStorage` 不存在。

- [ ] **Step 3: 实现 `src/storage/jsonStorage.ts`**

```ts
export interface LoadResult<T> {
  value: T;
  error?: string;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadJson<T>(
  key: string,
  validate: (value: unknown) => value is T,
  createDefault: () => T,
): LoadResult<T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { value: createDefault() };
    const parsed: unknown = JSON.parse(raw);
    if (!validate(parsed)) return { value: createDefault(), error: '本地数据格式异常，已重置' };
    return { value: parsed };
  } catch {
    return { value: createDefault(), error: '无法读取本地数据' };
  }
}

export function saveJson<T>(key: string, value: T): string | null {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch {
    return '无法保存数据，请检查浏览器存储权限';
  }
}
```

- [ ] **Step 4: 写失败测试 `src/storage/mealStorage.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { MEAL_STORAGE_KEY, isMealState, loadMealState, saveMealState } from './mealStorage';
import { defaultMealState } from '../domain/meal';

describe('mealStorage', () => {
  it('round-trips meal state', () => {
    const state = {
      settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
      records: { '2026-11-01': { spent: 1500, note: '午饭', allowance: 2000, updatedAt: '2026-11-01T00:00:00.000Z' } },
    };
    expect(saveMealState(state)).toBeNull();
    expect(loadMealState()).toEqual({ value: state });
    expect(localStorage.getItem(MEAL_STORAGE_KEY)).toContain('2026-11-01');
  });

  it('rejects invalid shapes', () => {
    expect(isMealState({ settings: { dailyAllowance: 2000 }, records: {} })).toBe(false);
    expect(isMealState({ settings: { dailyAllowance: 2000, startDate: '2026-11-01' }, records: { x: { spent: 1 } } })).toBe(false);
  });

  it('falls back to defaults when storage is empty', () => {
    expect(loadMealState()).toEqual({ value: defaultMealState() });
  });
});
```

- [ ] **Step 5: 实现 `src/storage/mealStorage.ts`**

```ts
import { defaultMealState } from '../domain/meal';
import type { MealState } from '../domain/meal';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';

export const MEAL_STORAGE_KEY = 'meal-allowance.v1';

export function isMealState(value: unknown): value is MealState {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.settings)) return false;
  const { dailyAllowance, startDate } = value.settings;
  if (typeof dailyAllowance !== 'number' || typeof startDate !== 'string') return false;
  if (!isPlainObject(value.records)) return false;
  return Object.values(value.records).every((record) => {
    if (!isPlainObject(record)) return false;
    return (
      typeof record.spent === 'number' &&
      typeof record.allowance === 'number' &&
      typeof record.updatedAt === 'string' &&
      (record.note === undefined || typeof record.note === 'string')
    );
  });
}

export function loadMealState(): LoadResult<MealState> {
  return loadJson(MEAL_STORAGE_KEY, isMealState, defaultMealState);
}

export function saveMealState(state: MealState): string | null {
  return saveJson(MEAL_STORAGE_KEY, state);
}
```

- [ ] **Step 6: 写失败测试 `src/storage/planningStorage.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { PLANNING_STORAGE_KEY, isPlanningState, loadPlanningState, savePlanningState } from './planningStorage';
import { emptyPlanningState } from '../domain/planning';

const state = {
  events: [
    {
      id: 'e1',
      name: '买电脑',
      plannedTotal: 500000,
      replenishPlan: [{ month: '2026-12', amount: 300000 }],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
  spends: [
    { id: 's1', eventId: 'e1', date: '2026-11-02', amount: 500000, createdAt: '2026-11-02T00:00:00.000Z' },
  ],
  replenishes: [],
  inflows: [{ id: 'i1', date: '2026-11-03', amount: 100000, note: '红包', createdAt: '2026-11-03T00:00:00.000Z' }],
};

describe('planningStorage', () => {
  it('round-trips planning state', () => {
    expect(savePlanningState(state)).toBeNull();
    expect(loadPlanningState()).toEqual({ value: state });
    expect(localStorage.getItem(PLANNING_STORAGE_KEY)).toContain('买电脑');
  });

  it('rejects invalid shapes', () => {
    expect(isPlanningState({ events: [], spends: [], replenishes: [] })).toBe(false);
    expect(
      isPlanningState({
        events: [{ id: 'e1', name: 'x', replenishPlan: [{ month: '2026-12', amount: 'bad' }], createdAt: 'now' }],
        spends: [],
        replenishes: [],
        inflows: [],
      }),
    ).toBe(false);
  });

  it('falls back to defaults when storage is empty', () => {
    expect(loadPlanningState()).toEqual({ value: emptyPlanningState() });
  });
});
```

- [ ] **Step 7: 实现 `src/storage/planningStorage.ts`**

```ts
import { emptyPlanningState } from '../domain/planning';
import type { PlanningState } from '../domain/planning';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';

export const PLANNING_STORAGE_KEY = 'planned-ledger.v1';

function isEntryBase(entry: unknown): boolean {
  if (!isPlainObject(entry)) return false;
  return (
    typeof entry.id === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.amount === 'number' &&
    typeof entry.createdAt === 'string' &&
    (entry.note === undefined || typeof entry.note === 'string')
  );
}

function isEventLinkedEntry(entry: unknown): boolean {
  return isEntryBase(entry) && isPlainObject(entry) && typeof entry.eventId === 'string';
}

export function isPlanningState(value: unknown): value is PlanningState {
  if (!isPlainObject(value)) return false;
  const { events, spends, replenishes, inflows } = value;
  if (!Array.isArray(events) || !Array.isArray(spends) || !Array.isArray(replenishes) || !Array.isArray(inflows)) {
    return false;
  }
  const eventsOk = events.every(
    (event) =>
      isPlainObject(event) &&
      typeof event.id === 'string' &&
      typeof event.name === 'string' &&
      typeof event.createdAt === 'string' &&
      (event.plannedTotal === undefined || typeof event.plannedTotal === 'number') &&
      (event.note === undefined || typeof event.note === 'string') &&
      Array.isArray(event.replenishPlan) &&
      event.replenishPlan.every(
        (item) => isPlainObject(item) && typeof item.month === 'string' && typeof item.amount === 'number',
      ),
  );
  return (
    eventsOk &&
    spends.every(isEventLinkedEntry) &&
    replenishes.every(isEventLinkedEntry) &&
    inflows.every(isEntryBase)
  );
}

export function loadPlanningState(): LoadResult<PlanningState> {
  return loadJson(PLANNING_STORAGE_KEY, isPlanningState, emptyPlanningState);
}

export function savePlanningState(state: PlanningState): string | null {
  return saveJson(PLANNING_STORAGE_KEY, state);
}
```

- [ ] **Step 8: 运行存储测试确认通过**

Run: `npx vitest run src/storage`
Expected: PASS，三个测试文件全部通过。

- [ ] **Step 9: 提交**

```bash
git add src/storage
git commit -m "feat: add versioned localStorage repositories"
```

---

### Task 8: 状态管理 Providers

**Files:**
- Create: `src/state/MealStore.tsx`
- Create: `src/state/PlanningStore.tsx`

- [ ] **Step 1: 实现 `src/state/MealStore.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import type { MealSettings, MealState } from '../domain/meal';
import { loadMealState, saveMealState } from '../storage/mealStorage';

interface MealContextValue {
  state: MealState;
  storageError: string | null;
  dismissError: () => void;
  saveRecord: (date: string, spent: number, note: string, allowance: number) => void;
  deleteRecord: (date: string) => void;
  updateSettings: (settings: MealSettings) => string | null;
  clearRecords: () => void;
}

const MealContext = createContext<MealContextValue | null>(null);

export function MealProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadMealState());
  const [state, setState] = useState<MealState>(initial.value);
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    const error = saveMealState(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const saveRecord = useCallback((date: string, spent: number, note: string, allowance: number) => {
    setState((previous) => {
      const existing = previous.records[date];
      return {
        ...previous,
        records: {
          ...previous.records,
          [date]: {
            spent,
            note: note.trim() || undefined,
            allowance: existing ? existing.allowance : allowance,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, []);

  const deleteRecord = useCallback((date: string) => {
    setState((previous) => {
      const records = { ...previous.records };
      delete records[date];
      return { ...previous, records };
    });
  }, []);

  const updateSettings = useCallback(
    (settings: MealSettings): string | null => {
      if (!Number.isInteger(settings.dailyAllowance) || settings.dailyAllowance <= 0) {
        return '每日餐补必须是大于 0 的金额';
      }
      const today = todayKey();
      if (!settings.startDate || settings.startDate > today) return '起始日期不能晚于今天';
      const earliest = Object.keys(state.records).sort()[0];
      if (earliest && settings.startDate > earliest) return '起始日期不能晚于已有记录的最早日期';
      setState((previous) => ({ ...previous, settings }));
      return null;
    },
    [state.records],
  );

  const clearRecords = useCallback(() => {
    setState((previous) => ({
      ...previous,
      settings: { ...previous.settings, startDate: todayKey() },
      records: {},
    }));
  }, []);

  const value = useMemo(
    () => ({ state, storageError, dismissError, saveRecord, deleteRecord, updateSettings, clearRecords }),
    [state, storageError, dismissError, saveRecord, deleteRecord, updateSettings, clearRecords],
  );

  return <MealContext.Provider value={value}>{children}</MealContext.Provider>;
}

export function useMeal(): MealContextValue {
  const value = useContext(MealContext);
  if (!value) throw new Error('useMeal must be used within MealProvider');
  return value;
}
```

- [ ] **Step 2: 实现 `src/state/PlanningStore.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createId } from '../domain/id';
import { emptyPlanningState, removeEvent } from '../domain/planning';
import type {
  InflowEntry,
  PlanningEvent,
  PlanningState,
  ReplenishEntry,
  ReplenishPlanItem,
  SpendEntry,
} from '../domain/planning';
import { loadPlanningState, savePlanningState } from '../storage/planningStorage';

export type EntryKind = 'spend' | 'replenish' | 'inflow';

export interface EntryInput {
  kind: EntryKind;
  date: string;
  amount: number;
  note?: string;
  eventId?: string;
}

export interface EventInput {
  name: string;
  plannedTotal?: number;
  note?: string;
  replenishPlan: ReplenishPlanItem[];
}

interface PlanningContextValue {
  state: PlanningState;
  storageError: string | null;
  dismissError: () => void;
  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, input: EventInput) => void;
  deleteEvent: (id: string) => void;
  addEntry: (input: EntryInput) => void;
  updateEntry: (kind: EntryKind, id: string, input: Omit<EntryInput, 'kind'>) => void;
  deleteEntry: (kind: EntryKind, id: string) => void;
  clearAll: () => void;
}

const PlanningContext = createContext<PlanningContextValue | null>(null);

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadPlanningState());
  const [state, setState] = useState<PlanningState>(initial.value);
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    const error = savePlanningState(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const addEvent = useCallback((input: EventInput) => {
    const event: PlanningEvent = {
      id: createId(),
      name: input.name,
      plannedTotal: input.plannedTotal,
      note: input.note,
      replenishPlan: input.replenishPlan,
      createdAt: new Date().toISOString(),
    };
    setState((previous) => ({ ...previous, events: [...previous.events, event] }));
  }, []);

  const updateEvent = useCallback((id: string, input: EventInput) => {
    setState((previous) => ({
      ...previous,
      events: previous.events.map((event) =>
        event.id === id
          ? {
              ...event,
              name: input.name,
              plannedTotal: input.plannedTotal,
              note: input.note,
              replenishPlan: input.replenishPlan,
            }
          : event,
      ),
    }));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setState((previous) => removeEvent(previous, id));
  }, []);

  const addEntry = useCallback((input: EntryInput) => {
    const base = {
      id: createId(),
      date: input.date,
      amount: input.amount,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    setState((previous) => {
      if (input.kind === 'inflow') {
        const entry: InflowEntry = base;
        return { ...previous, inflows: [...previous.inflows, entry] };
      }
      if (!input.eventId) throw new Error('eventId is required for spend and replenish entries');
      if (input.kind === 'spend') {
        const entry: SpendEntry = { ...base, eventId: input.eventId };
        return { ...previous, spends: [...previous.spends, entry] };
      }
      const entry: ReplenishEntry = { ...base, eventId: input.eventId };
      return { ...previous, replenishes: [...previous.replenishes, entry] };
    });
  }, []);

  const updateEntry = useCallback((kind: EntryKind, id: string, input: Omit<EntryInput, 'kind'>) => {
    setState((previous) => {
      if (kind === 'inflow') {
        return {
          ...previous,
          inflows: previous.inflows.map((entry) =>
            entry.id === id
              ? { ...entry, date: input.date, amount: input.amount, note: input.note }
              : entry,
          ),
        };
      }
      function updateLinked<T extends SpendEntry | ReplenishEntry>(entries: T[]): T[] {
        return entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                date: input.date,
                amount: input.amount,
                note: input.note,
                eventId: input.eventId ?? entry.eventId,
              }
            : entry,
        );
      }
      if (kind === 'spend') return { ...previous, spends: updateLinked(previous.spends) };
      return { ...previous, replenishes: updateLinked(previous.replenishes) };
    });
  }, []);

  const deleteEntry = useCallback((kind: EntryKind, id: string) => {
    setState((previous) => {
      if (kind === 'inflow') return { ...previous, inflows: previous.inflows.filter((entry) => entry.id !== id) };
      if (kind === 'spend') return { ...previous, spends: previous.spends.filter((entry) => entry.id !== id) };
      return { ...previous, replenishes: previous.replenishes.filter((entry) => entry.id !== id) };
    });
  }, []);

  const clearAll = useCallback(() => setState(emptyPlanningState()), []);

  const value = useMemo(
    () => ({
      state,
      storageError,
      dismissError,
      addEvent,
      updateEvent,
      deleteEvent,
      addEntry,
      updateEntry,
      deleteEntry,
      clearAll,
    }),
    [state, storageError, dismissError, addEvent, updateEvent, deleteEvent, addEntry, updateEntry, deleteEntry, clearAll],
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}

export function usePlanning(): PlanningContextValue {
  const value = useContext(PlanningContext);
  if (!value) throw new Error('usePlanning must be used within PlanningProvider');
  return value;
}
```

- [ ] **Step 3: 类型检查与构建**

Run: `npm run build`
Expected: 无 TypeScript 错误，构建成功。

- [ ] **Step 4: 提交**

```bash
git add src/state
git commit -m "feat: add meal and planning state providers"
```

### Task 9: 通用 UI 组件

**Files:**
- Create: `src/ui/components/MoneyInput.tsx`
- Create: `src/ui/components/Sheet.tsx`
- Create: `src/ui/components/ConfirmDialog.tsx`
- Create: `src/ui/components/SegmentedControl.tsx`
- Create: `src/ui/components/ProgressBar.tsx`
- Create: `src/ui/components/BarChart.tsx`
- Create: `src/ui/components/EmptyState.tsx`

- [ ] **Step 1: 创建 `src/ui/components/MoneyInput.tsx`**

```tsx
interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}

export function MoneyInput({ value, onChange, ariaLabel, placeholder = '0.00' }: MoneyInputProps) {
  return (
    <div className="money-input">
      <span className="money-input__prefix">¥</span>
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 2: 创建 `src/ui/components/Sheet.tsx`**

```tsx
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet__header">
          <h2>{title}</h2>
          <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 `src/ui/components/ConfirmDialog.tsx`**

```tsx
import { Sheet } from './Sheet';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认删除',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Sheet open={open} title={title} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <div className="sheet-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="button button--danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: 创建 `src/ui/components/SegmentedControl.tsx`**

```tsx
interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`segmented__item${option.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 创建 `src/ui/components/ProgressBar.tsx`**

```tsx
interface ProgressBarProps {
  value: number;
  tone?: 'green' | 'indigo';
}

export function ProgressBar({ value, tone = 'indigo' }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
```

- [ ] **Step 6: 创建 `src/ui/components/BarChart.tsx`**

```tsx
import type { CSSProperties } from 'react';

interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  color?: string;
}

export function BarChart({ data, color = 'var(--meal-primary)' }: BarChartProps) {
  if (data.length === 0) return null;
  const maxAbs = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  const hasNegative = data.some((item) => item.value < 0);
  const factor = hasNegative ? 50 : 100;

  return (
    <div className={`bar-chart${hasNegative ? ' bar-chart--split' : ''}`} role="img" aria-label="月度趋势图">
      {data.map((item) => {
        const negative = item.value < 0;
        const height = Math.max(2, (Math.abs(item.value) / maxAbs) * factor);
        const style: CSSProperties = {
          height: `${height}%`,
          background: negative ? 'var(--danger)' : color,
        };
        if (negative) {
          style.top = '50%';
        } else {
          style.bottom = hasNegative ? '50%' : 0;
        }
        return (
          <div className="bar-chart__item" key={item.label}>
            <div className="bar-chart__track">
              {hasNegative && <div className="bar-chart__axis" />}
              <div className={`bar-chart__bar${negative ? ' bar-chart__bar--negative' : ''}`} style={style} />
            </div>
            <span className="bar-chart__label">{item.label.slice(5)}月</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: 创建 `src/ui/components/EmptyState.tsx`**

```tsx
interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        ◎
      </div>
      <p>{title}</p>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 8: 构建验证**

Run: `npm run build`
Expected: 无 TypeScript 错误（组件尚未被引用，但会被 tsc 检查）。

- [ ] **Step 9: 提交**

```bash
git add src/ui/components
git commit -m "feat: add shared UI components"
```

---

### Task 10: 全局样式（含深色模式、底部导航）

**Files:**
- Modify: `src/ui/styles.css`

- [ ] **Step 1: 用以下完整内容替换 `src/ui/styles.css`**

```css
:root {
  --bg: #f7f8f6;
  --surface: #ffffff;
  --surface-soft: #f1f5f2;
  --text: #1f2933;
  --muted: #6b7280;
  --border: #e5e7eb;
  --meal-primary: #10b981;
  --meal-primary-dark: #059669;
  --planning-primary: #6366f1;
  --planning-primary-dark: #4f46e5;
  --danger: #e05656;
  --success: #059669;
  --warning-bg: #fff7e6;
  --warning-text: #b45309;
  --shadow: 0 8px 24px rgba(31, 41, 51, 0.06);
  --radius: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f172a;
    --surface: #172033;
    --surface-soft: #1f2b42;
    --text: #e5e7eb;
    --muted: #94a3b8;
    --border: #263247;
    --meal-primary: #34d399;
    --meal-primary-dark: #10b981;
    --planning-primary: #818cf8;
    --planning-primary-dark: #6366f1;
    --danger: #f87171;
    --success: #34d399;
    --warning-bg: #3b2f1b;
    --warning-text: #fbbf24;
    --shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif;
  -webkit-font-smoothing: antialiased;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

h1 {
  font-size: 24px;
  margin: 0;
}

h2 {
  font-size: 16px;
  margin: 0;
}

.muted {
  color: var(--muted);
  font-size: 13px;
}

.positive {
  color: var(--success);
}

.negative {
  color: var(--danger);
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px calc(96px + env(safe-area-inset-bottom));
}

.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.balance-card {
  border-radius: 20px;
  padding: 22px;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.balance-card--green {
  background: linear-gradient(135deg, #34d399, #10b981);
  box-shadow: 0 16px 32px rgba(16, 185, 129, 0.18);
}

.balance-card--indigo {
  background: linear-gradient(135deg, #818cf8, #6366f1);
  box-shadow: 0 16px 32px rgba(99, 102, 241, 0.2);
}

.balance-card__label {
  font-size: 13px;
  opacity: 0.85;
}

.balance-card__amount {
  font-size: 34px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.balance-card__amount.is-negative {
  color: #ffe4e6;
}

.balance-card__meta {
  font-size: 12px;
  opacity: 0.85;
}

.badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 12px;
}

.badge--danger {
  background: #fee2e2;
  color: #b91c1c;
}

.badge--success {
  background: #d1fae5;
  color: #047857;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.summary-grid > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-grid strong {
  font-variant-numeric: tabular-nums;
  font-size: 16px;
}

.button {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  min-height: 44px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.08s ease, filter 0.15s ease;
}

.button:active {
  transform: scale(0.98);
}

.button--primary {
  background: var(--meal-primary);
  color: #fff;
}

.button--secondary {
  background: var(--surface-soft);
  color: var(--text);
}

.button--ghost {
  background: transparent;
  color: var(--muted);
}

.button--danger {
  background: var(--danger);
  color: #fff;
}

.text-button {
  background: none;
  border: none;
  padding: 4px;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
}

.text-button--danger {
  color: var(--danger);
}

.icon-button {
  border: none;
  background: var(--surface-soft);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--muted);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}

.field input,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.field input:focus,
.field select:focus {
  border-color: var(--meal-primary);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.money-input {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  padding: 0 12px;
  min-height: 44px;
}

.money-input:focus-within {
  border-color: var(--meal-primary);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.money-input__prefix {
  color: var(--muted);
  font-size: 14px;
}

.money-input input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 10px 8px;
  min-height: 42px;
  font-variant-numeric: tabular-nums;
}

.form-error {
  color: var(--danger);
  font-size: 13px;
  margin: 0;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
}

.banner--warning {
  background: var(--warning-bg);
  color: var(--warning-text);
}

.storage-banner {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  background: var(--danger);
  color: #fff;
  font-size: 13px;
}

.storage-banner button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  padding: 4px 10px;
  color: #fff;
  cursor: pointer;
}

.list {
  gap: 0;
  padding-top: 4px;
  padding-bottom: 4px;
}

.list-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.list-row:last-child {
  border-bottom: none;
}

.list-row__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.list-row__title {
  font-weight: 600;
  font-size: 14px;
}

.list-row__note {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row__amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.list-row__actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.event-card {
  gap: 10px;
}

.event-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.event-card__head .badge {
  background: var(--surface-soft);
  color: var(--muted);
}

.event-card__head .badge--success {
  background: #d1fae5;
  color: #047857;
}

.event-card__meta {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.progress {
  height: 8px;
  background: var(--surface-soft);
  border-radius: 999px;
  overflow: hidden;
}

.progress__fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.25s ease;
}

.progress__fill--green {
  background: var(--meal-primary);
}

.progress__fill--indigo {
  background: var(--planning-primary);
}

.segmented {
  display: flex;
  padding: 4px;
  background: var(--surface-soft);
  border-radius: 12px;
  gap: 4px;
}

.segmented__item {
  flex: 1;
  border: none;
  background: transparent;
  padding: 9px 10px;
  border-radius: 9px;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  min-height: 40px;
}

.segmented__item.is-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 2px 8px rgba(31, 41, 51, 0.08);
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fade-in 0.15s ease;
}

.sheet {
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--surface);
  border-radius: 22px 22px 0 0;
  padding: 18px 16px calc(20px + env(safe-area-inset-bottom));
  animation: slide-up 0.2s ease;
}

.sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sheet__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sheet-actions {
  display: flex;
  gap: 10px;
}

.sheet-actions .button {
  flex: 1;
}

.confirm-message {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(24px); opacity: 0.6; }
  to { transform: translateY(0); opacity: 1; }
}

.table-wrap {
  overflow-x: auto;
}

.table {
  display: flex;
  flex-direction: column;
  min-width: 100%;
}

.table__row {
  display: grid;
  grid-template-columns: repeat(4, minmax(64px, 1fr));
  gap: 8px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  align-items: center;
}

.table__row:last-child {
  border-bottom: none;
}

.table--stats .table__row {
  grid-template-columns: repeat(6, minmax(68px, 1fr));
}

.table__head {
  color: var(--muted);
  font-size: 12px;
}

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.timeline__item {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  gap: 8px;
  align-items: start;
}

.timeline__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  background: var(--muted);
}

.timeline__dot--spend {
  background: var(--danger);
}

.timeline__dot--replenish {
  background: var(--success);
}

.timeline__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.timeline__actions {
  display: flex;
  gap: 2px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 150px;
  padding-top: 8px;
}

.bar-chart__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.bar-chart__track {
  position: relative;
  width: 100%;
  height: 120px;
}

.bar-chart__axis {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border);
}

.bar-chart__bar {
  position: absolute;
  left: 22%;
  right: 22%;
  border-radius: 6px 6px 0 0;
  min-height: 2px;
}

.bar-chart__bar--negative {
  border-radius: 0 0 6px 6px;
}

.bar-chart__label {
  font-size: 11px;
  color: var(--muted);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  text-align: center;
  color: var(--muted);
}

.empty-state p {
  margin: 0;
}

.empty-state__icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--surface-soft);
  font-size: 20px;
}

.onboarding {
  min-height: 100vh;
  max-width: 480px;
  margin: 0 auto;
  padding: 48px 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
}

.onboarding__hero {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eyebrow {
  margin: 0;
  color: var(--meal-primary);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.08em;
}

.onboarding__hint {
  text-align: center;
}

.action-row {
  display: flex;
  gap: 10px;
}

.action-row .button {
  flex: 1;
}

.plan-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr auto;
  gap: 8px;
  align-items: center;
}

.backfill-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}

.backfill-row > input,
.plan-row > input {
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.backfill-row > input:focus,
.plan-row > input:focus {
  border-color: var(--meal-primary);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-nav__inner {
  width: 100%;
  max-width: 480px;
  display: flex;
}

.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 9px 4px 8px;
  font-size: 11px;
  color: var(--muted);
  min-height: 56px;
  justify-content: center;
}

.bottom-nav__item.is-active {
  color: var(--meal-primary);
  font-weight: 600;
}

.bottom-nav__icon {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
}

.bottom-nav__icon svg {
  width: 22px;
  height: 22px;
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add src/ui/styles.css
git commit -m "style: add global theme, cards, sheets, charts and dark mode"
```

---

### Task 11: 引导页、餐补首页与补记页

**Files:**
- Create: `src/test/render.tsx`
- Create: `src/ui/pages/Onboarding.tsx`
- Create: `src/ui/pages/MealPage.tsx`
- Test: `src/ui/pages/MealPage.test.tsx`
- Create: `src/ui/pages/BackfillPage.tsx`
- Test: `src/ui/pages/BackfillPage.test.tsx`

- [ ] **Step 1: 创建测试渲染工具 `src/test/render.tsx`**

```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { MealState } from '../domain/meal';
import type { PlanningState } from '../domain/planning';
import { MealProvider } from '../state/MealStore';
import { PlanningProvider } from '../state/PlanningStore';
import { MEAL_STORAGE_KEY } from '../storage/mealStorage';
import { PLANNING_STORAGE_KEY } from '../storage/planningStorage';

interface RenderOptions {
  route?: string;
  meal?: MealState;
  planning?: PlanningState;
}

export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  localStorage.clear();
  if (options.meal) localStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(options.meal));
  if (options.planning) localStorage.setItem(PLANNING_STORAGE_KEY, JSON.stringify(options.planning));
  return render(
    <MealProvider>
      <PlanningProvider>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
      </PlanningProvider>
    </MealProvider>,
  );
}
```

- [ ] **Step 2: 写失败测试 `src/ui/pages/MealPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { todayKey } from '../../domain/dates';
import { MEAL_STORAGE_KEY } from '../../storage/mealStorage';
import { renderWithProviders } from '../../test/render';
import { MealPage } from './MealPage';

describe('MealPage', () => {
  const today = todayKey();
  const mealState = { settings: { dailyAllowance: 2000, startDate: today }, records: {} };

  it('saves today spending and updates the balance', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealState });
    await user.type(screen.getByLabelText('今日实际花费'), '15');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/已记录 1 天/)).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.records[today].spent).toBe(1500);
    expect(saved.records[today].allowance).toBe(2000);
  });

  it('shows an error for invalid amounts and does not save', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealState });
    await user.type(screen.getByLabelText('今日实际花费'), 'abc');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入有效金额');
    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.records[today]).toBeUndefined();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/ui/pages/MealPage.test.tsx`
Expected: FAIL，模块 `./MealPage` 不存在。

- [ ] **Step 4: 实现 `src/ui/pages/Onboarding.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayKey } from '../../domain/dates';
import { parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { MoneyInput } from '../components/MoneyInput';

export function Onboarding() {
  const { updateSettings } = useMeal();
  const [allowance, setAllowance] = useState('20');
  const [startDate, setStartDate] = useState(todayKey());
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(allowance);
    if (cents === null || cents <= 0) {
      setError('请输入大于 0 的每日餐补金额');
      return;
    }
    const message = updateSettings({ dailyAllowance: cents, startDate });
    if (message) {
      setError(message);
      return;
    }
    setError('');
  };

  return (
    <div className="onboarding">
      <div className="onboarding__hero">
        <p className="eyebrow">小账本</p>
        <h1>把每天的结余，攒成一笔可用的钱</h1>
        <p className="muted">先设置你的每日餐补和起始日期。</p>
      </div>
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>每日餐补</span>
          <MoneyInput value={allowance} onChange={setAllowance} ariaLabel="每日餐补金额" />
        </label>
        <label className="field">
          <span>起始日期</span>
          <input type="date" value={startDate} max={todayKey()} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary" type="submit">
          开始记账
        </button>
      </form>
      <p className="onboarding__hint muted">数据只保存在这台手机上。</p>
    </div>
  );
}
```

- [ ] **Step 5: 实现 `src/ui/pages/MealPage.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { buildMealRows, computeMealBalance, mealMonthSummary, missingDates } from '../../domain/meal';
import type { MealRow } from '../../domain/meal';
import { centsToYuan, formatSignedYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MoneyInput } from '../components/MoneyInput';
import { Sheet } from '../components/Sheet';

interface RecordRowProps {
  row: MealRow;
  onEdit: (row: MealRow) => void;
  onDelete: (row: MealRow) => void;
}

function RecordRow({ row, onEdit, onDelete }: RecordRowProps) {
  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(row.date)}</span>
        {row.record.note && <span className="list-row__note">{row.record.note}</span>}
      </div>
      <div className="list-row__amounts">
        <span>花 {formatYuan(row.record.spent)}</span>
        <span className={row.daily >= 0 ? 'positive' : 'negative'}>当日 {formatSignedYuan(row.daily)}</span>
        <span className="muted">累计 {formatYuan(row.cumulative)}</span>
      </div>
      <div className="list-row__actions">
        <button type="button" className="text-button" onClick={() => onEdit(row)}>
          编辑
        </button>
        <button type="button" className="text-button text-button--danger" onClick={() => onDelete(row)}>
          删除
        </button>
      </div>
    </div>
  );
}

export function MealPage() {
  const { state, saveRecord, deleteRecord } = useMeal();
  const today = todayKey();
  const todayRecord = state.records[today];
  const balance = computeMealBalance(state);
  const rows = buildMealRows(state);
  const newestFirst = [...rows].reverse();
  const missing = missingDates(state, today);
  const summary = mealMonthSummary(state, monthOf(today), today);

  const [todaySpent, setTodaySpent] = useState(todayRecord ? centsToYuan(todayRecord.spent) : '');
  const [todayNote, setTodayNote] = useState(todayRecord?.note ?? '');
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<MealRow | null>(null);
  const [editingSpent, setEditingSpent] = useState('');
  const [editingNote, setEditingNote] = useState('');
  const [editingError, setEditingError] = useState('');
  const [deleting, setDeleting] = useState<MealRow | null>(null);

  const groups = newestFirst.reduce<Record<string, MealRow[]>>((accumulator, row) => {
    const month = monthOf(row.date);
    (accumulator[month] ??= []).push(row);
    return accumulator;
  }, {});

  const submitToday = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(todaySpent);
    if (cents === null) {
      setFormError('请输入有效金额');
      return;
    }
    saveRecord(today, cents, todayNote, state.settings.dailyAllowance);
    setFormError('');
  };

  const openEdit = (row: MealRow) => {
    setEditing(row);
    setEditingSpent(centsToYuan(row.record.spent));
    setEditingNote(row.record.note ?? '');
    setEditingError('');
  };

  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const cents = parseYuanToCents(editingSpent);
    if (cents === null) {
      setEditingError('请输入有效金额');
      return;
    }
    saveRecord(editing.date, cents, editingNote, state.settings.dailyAllowance);
    setEditing(null);
  };

  return (
    <div className="page">
      <section className="balance-card balance-card--green">
        <span className="balance-card__label">当前可用余额</span>
        <strong className={`balance-card__amount${balance < 0 ? ' is-negative' : ''}`}>{formatYuan(balance)}</strong>
        <span className="balance-card__meta">
          已记录 {rows.length} 天 · 起始 {state.settings.startDate}
        </span>
        {balance < 0 && <span className="badge">已超支</span>}
      </section>

      <section className="card">
        <h2 className="card-title">
          今天 {formatDisplayDate(today)} · 餐补 {formatYuan(state.settings.dailyAllowance)}
        </h2>
        <form className="form" onSubmit={submitToday}>
          <label className="field">
            <span>今日实际花费</span>
            <MoneyInput value={todaySpent} onChange={setTodaySpent} ariaLabel="今日实际花费" />
          </label>
          <label className="field">
            <span>备注（可选）</span>
            <input
              type="text"
              value={todayNote}
              onChange={(event) => setTodayNote(event.target.value)}
              aria-label="今日备注"
            />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <button className="button button--primary" type="submit">
            {todayRecord ? '更新今日记录' : '保存'}
          </button>
        </form>
        {todayRecord && (
          <p className="muted">
            今日已记录，花费 {formatYuan(todayRecord.spent)}，结余{' '}
            {formatSignedYuan(todayRecord.allowance - todayRecord.spent)}
          </p>
        )}
      </section>

      {missing.length > 0 && (
        <Link className="banner banner--warning" to="/meal/backfill">
          ⚠ 还有 {missing.length} 天未记录，去补记 ›
        </Link>
      )}

      <section className="card summary-grid">
        <div>
          <span className="muted">本月结余</span>
          <strong className={summary.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(summary.net)}</strong>
        </div>
        <div>
          <span className="muted">本月餐补</span>
          <strong>{formatYuan(summary.allowanceTotal)}</strong>
        </div>
        <div>
          <span className="muted">本月餐费</span>
          <strong>{formatYuan(summary.spentTotal)}</strong>
        </div>
        <div>
          <span className="muted">当前累计</span>
          <strong>{formatYuan(summary.endBalance)}</strong>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>最近记录</h2>
          <span className="muted">最近 5 条</span>
        </div>
        {newestFirst.length === 0 ? (
          <EmptyState title="还没有记录" hint="记下今天的花费，开始攒结余。" />
        ) : (
          <div className="card list">
            {newestFirst.slice(0, 5).map((row) => (
              <RecordRow key={row.date} row={row} onEdit={openEdit} onDelete={setDeleting} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>历史明细</h2>
          <span className="muted">按月份</span>
        </div>
        {Object.entries(groups).map(([month, monthRows]) => (
          <div className="card" key={month}>
            <h3 className="card-title">{formatMonthLabel(month)}</h3>
            {monthRows.map((row) => (
              <RecordRow key={row.date} row={row} onEdit={openEdit} onDelete={setDeleting} />
            ))}
          </div>
        ))}
      </section>

      {editing && (
        <Sheet open title="修改记录" onClose={() => setEditing(null)}>
          <form className="form" onSubmit={submitEdit}>
            <label className="field">
              <span>{formatDisplayDate(editing.date)} 花费</span>
              <MoneyInput value={editingSpent} onChange={setEditingSpent} ariaLabel="修改金额" />
            </label>
            <label className="field">
              <span>备注（可选）</span>
              <input
                type="text"
                value={editingNote}
                onChange={(event) => setEditingNote(event.target.value)}
                aria-label="修改备注"
              />
            </label>
            {editingError && (
              <p className="form-error" role="alert">
                {editingError}
              </p>
            )}
            <button className="button button--primary" type="submit">
              保存修改
            </button>
          </form>
        </Sheet>
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="删除这条记录？"
          message={`删除 ${formatDisplayDate(deleting.date)} 的记录后，余额会重新计算。`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteRecord(deleting.date);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: 运行 MealPage 测试确认通过**

Run: `npx vitest run src/ui/pages/MealPage.test.tsx`
Expected: PASS（2 个测试）。

- [ ] **Step 7: 写失败测试 `src/ui/pages/BackfillPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../domain/dates';
import { MEAL_STORAGE_KEY } from '../../storage/mealStorage';
import { renderWithProviders } from '../../test/render';
import { BackfillPage } from './BackfillPage';

describe('BackfillPage', () => {
  it('records a missing date and removes it from the list', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const missingDate = addDays(today, -1);
    const meal = { settings: { dailyAllowance: 2000, startDate: missingDate }, records: {} };
    renderWithProviders(<BackfillPage />, { meal });

    await user.type(screen.getByLabelText(`${missingDate} 金额`), '10');
    await user.click(screen.getByRole('button', { name: `保存 ${missingDate}` }));

    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.records[missingDate].spent).toBe(1000);
    expect(screen.queryByLabelText(`${missingDate} 金额`)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 8: 运行测试确认失败**

Run: `npx vitest run src/ui/pages/BackfillPage.test.tsx`
Expected: FAIL，模块 `./BackfillPage` 不存在。

- [ ] **Step 9: 实现 `src/ui/pages/BackfillPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { missingDates } from '../../domain/meal';
import { parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { EmptyState } from '../components/EmptyState';
import { MoneyInput } from '../components/MoneyInput';

function BackfillRow({ date }: { date: string }) {
  const { state, saveRecord } = useMeal();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const cents = parseYuanToCents(amount);
    if (cents === null) {
      setError('请输入有效金额');
      return;
    }
    saveRecord(date, cents, note, state.settings.dailyAllowance);
  };

  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(date)}</span>
      </div>
      <div className="backfill-row">
        <MoneyInput value={amount} onChange={setAmount} ariaLabel={`${date} 金额`} />
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="备注"
          aria-label={`${date} 备注`}
        />
        <button type="button" className="button button--secondary" onClick={save} aria-label={`保存 ${date}`}>
          保存
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function BackfillPage() {
  const { state } = useMeal();
  const today = todayKey();
  const dates = missingDates(state, today);
  const groups = dates.reduce<Record<string, string[]>>((accumulator, date) => {
    const month = monthOf(date);
    (accumulator[month] ??= []).push(date);
    return accumulator;
  }, {});

  return (
    <div className="page">
      <div className="page-nav">
        <Link className="text-button" to="/">
          ‹ 返回餐补
        </Link>
      </div>
      <h1>补记</h1>
      {dates.length === 0 ? (
        <EmptyState title="没有需要补记的日期" hint="所有日子都记录好了。" />
      ) : (
        Object.entries(groups).map(([month, monthDates]) => (
          <section className="card" key={month}>
            <h2 className="card-title">{formatMonthLabel(month)}</h2>
            {monthDates.map((date) => (
              <BackfillRow key={date} date={date} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 10: 运行两个测试文件确认通过**

Run: `npx vitest run src/ui/pages/MealPage.test.tsx src/ui/pages/BackfillPage.test.tsx`
Expected: PASS（3 个测试）。

- [ ] **Step 11: 提交**

```bash
git add src/test/render.tsx src/ui/pages/Onboarding.tsx src/ui/pages/MealPage.tsx src/ui/pages/MealPage.test.tsx src/ui/pages/BackfillPage.tsx src/ui/pages/BackfillPage.test.tsx
git commit -m "feat: add onboarding, meal page and backfill page"
```

---

### Task 12: 规划账记账弹层、事项表单与首页

**Files:**
- Create: `src/ui/components/EntrySheet.tsx`
- Create: `src/ui/components/EventForm.tsx`
- Create: `src/ui/pages/PlanningPage.tsx`
- Test: `src/ui/pages/PlanningPage.test.tsx`

- [ ] **Step 1: 创建 `src/ui/components/EntrySheet.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayKey } from '../../domain/dates';
import { centsToYuan, parseYuanToCents } from '../../domain/money';
import type { PlanningEvent } from '../../domain/planning';
import type { EntryKind } from '../../state/PlanningStore';
import { MoneyInput } from './MoneyInput';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';

export interface EntryDraft {
  kind: EntryKind;
  eventId?: string;
  date: string;
  amount: number;
  note?: string;
}

interface EntrySheetProps {
  mode: 'create' | 'edit';
  initial?: { kind?: EntryKind; eventId?: string; date?: string; amount?: number; note?: string };
  events: PlanningEvent[];
  lockKind?: boolean;
  onClose: () => void;
  onSubmit: (draft: EntryDraft) => void;
}

const KIND_OPTIONS: Array<{ value: EntryKind; label: string }> = [
  { value: 'spend', label: '支出' },
  { value: 'replenish', label: '补回' },
  { value: 'inflow', label: '汇入' },
];

export function EntrySheet({ mode, initial, events, lockKind = false, onClose, onSubmit }: EntrySheetProps) {
  const today = todayKey();
  const [kind, setKind] = useState<EntryKind>(initial?.kind ?? 'spend');
  const [eventId, setEventId] = useState(initial?.eventId ?? events[0]?.id ?? '');
  const [date, setDate] = useState(initial?.date ?? today);
  const initialAmount = initial?.amount;
  const [amount, setAmount] = useState(initialAmount !== undefined ? centsToYuan(initialAmount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');

  const needsEvent = kind === 'spend' || kind === 'replenish';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(amount);
    if (cents === null || cents <= 0) {
      setError('请输入大于 0 的有效金额');
      return;
    }
    if (!date || date > today) {
      setError('日期不能晚于今天');
      return;
    }
    if (needsEvent && !eventId) {
      setError('请选择关联事项');
      return;
    }
    onSubmit({
      kind,
      eventId: needsEvent ? eventId : undefined,
      date,
      amount: cents,
      note: note.trim() || undefined,
    });
  };

  return (
    <Sheet open title={mode === 'create' ? '记一笔' : '修改流水'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!lockKind && <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} />}
        {needsEvent && (
          <label className="field">
            <span>关联事项</span>
            <select value={eventId} onChange={(event) => setEventId(event.target.value)} aria-label="关联事项">
              {events.length === 0 && <option value="">请先创建事项</option>}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>金额</span>
          <MoneyInput value={amount} onChange={setAmount} ariaLabel="金额" />
        </label>
        <label className="field">
          <span>日期</span>
          <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} aria-label="日期" />
        </label>
        <label className="field">
          <span>备注（可选）</span>
          <input type="text" value={note} onChange={(event) => setNote(event.target.value)} aria-label="备注" />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary" type="submit">
          保存
        </button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 2: 创建 `src/ui/components/EventForm.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { centsToYuan, parseYuanToCents } from '../../domain/money';
import type { ReplenishPlanItem } from '../../domain/planning';
import { MoneyInput } from './MoneyInput';

export interface EventDraft {
  name: string;
  plannedTotal?: number;
  note?: string;
  replenishPlan: ReplenishPlanItem[];
}

interface PlanRow {
  month: string;
  amount: string;
}

interface EventFormProps {
  initial?: EventDraft;
  submitLabel: string;
  onSubmit: (draft: EventDraft) => void;
}

function nextMonthKey(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function EventForm({ initial, submitLabel, onSubmit }: EventFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [plannedTotal, setPlannedTotal] = useState(
    initial?.plannedTotal !== undefined ? centsToYuan(initial.plannedTotal) : '',
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [planRows, setPlanRows] = useState<PlanRow[]>(
    initial?.replenishPlan.map((item) => ({ month: item.month, amount: centsToYuan(item.amount) })) ?? [],
  );
  const [error, setError] = useState('');

  const updateRow = (index: number, patch: Partial<PlanRow>) => {
    setPlanRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('请填写事项名称');
      return;
    }
    let planned: number | undefined;
    if (plannedTotal.trim()) {
      const cents = parseYuanToCents(plannedTotal);
      if (cents === null || cents <= 0) {
        setError('计划总花费必须是大于 0 的有效金额');
        return;
      }
      planned = cents;
    }
    const replenishPlan: ReplenishPlanItem[] = [];
    const usedMonths = new Set<string>();
    for (const row of planRows) {
      if (!row.month && !row.amount.trim()) continue;
      const cents = parseYuanToCents(row.amount);
      if (!row.month || cents === null || cents <= 0) {
        setError('补回计划需要填写月份和大于 0 的金额');
        return;
      }
      if (usedMonths.has(row.month)) {
        setError('补回计划里有重复的月份');
        return;
      }
      usedMonths.add(row.month);
      replenishPlan.push({ month: row.month, amount: cents });
    }
    onSubmit({
      name: trimmedName,
      plannedTotal: planned,
      note: note.trim() || undefined,
      replenishPlan,
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>事项名称</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：买电脑"
          aria-label="事项名称"
        />
      </label>
      <label className="field">
        <span>计划总花费（可选）</span>
        <MoneyInput value={plannedTotal} onChange={setPlannedTotal} ariaLabel="计划总花费" />
      </label>
      <label className="field">
        <span>备注（可选）</span>
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} aria-label="事项备注" />
      </label>
      <div className="field">
        <span>补回计划（可选）</span>
        {planRows.map((row, index) => (
          <div className="plan-row" key={index}>
            <input
              type="month"
              value={row.month}
              onChange={(event) => updateRow(index, { month: event.target.value })}
              aria-label={`补回月份 ${index + 1}`}
            />
            <MoneyInput
              value={row.amount}
              onChange={(value) => updateRow(index, { amount: value })}
              ariaLabel={`补回金额 ${index + 1}`}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="删除补回计划"
              onClick={() => setPlanRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() => setPlanRows((rows) => [...rows, { month: nextMonthKey(), amount: '' }])}
        >
          ＋ 添加补回月份
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--primary" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 写失败测试 `src/ui/pages/PlanningPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { PlanningPage } from './PlanningPage';

describe('PlanningPage', () => {
  it('creates an event and records a spend linked to it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '新建事项' }));
    await user.type(screen.getByLabelText('事项名称'), '买电脑');
    await user.click(screen.getByRole('button', { name: '创建事项' }));
    expect(await screen.findByText('买电脑')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '记一笔' }));
    await user.type(screen.getByLabelText('金额'), '3000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('待补 ¥3000.00')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npx vitest run src/ui/pages/PlanningPage.test.tsx`
Expected: FAIL，模块 `./PlanningPage` 不存在。

- [ ] **Step 5: 实现 `src/ui/pages/PlanningPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, monthOf, todayKey } from '../../domain/dates';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import { computePlanningBalance, eventProgress, planningMonthSummary } from '../../domain/planning';
import type { InflowEntry } from '../../domain/planning';
import { usePlanning } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { EntrySheet } from '../components/EntrySheet';
import type { EntryDraft } from '../components/EntrySheet';
import { EventForm } from '../components/EventForm';
import type { EventDraft } from '../components/EventForm';
import { ProgressBar } from '../components/ProgressBar';
import { Sheet } from '../components/Sheet';

export function PlanningPage() {
  const { state, addEvent, addEntry, updateEntry, deleteEntry } = usePlanning();
  const today = todayKey();
  const balance = computePlanningBalance(state);
  const summary = planningMonthSummary(state, monthOf(today), today);
  const events = [...state.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const inflows = [...state.inflows].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  );
  const [entryOpen, setEntryOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [editingInflow, setEditingInflow] = useState<InflowEntry | null>(null);
  const [deletingInflow, setDeletingInflow] = useState<InflowEntry | null>(null);

  const submitEntry = (draft: EntryDraft) => {
    addEntry(draft);
    setEntryOpen(false);
  };

  const submitEvent = (draft: EventDraft) => {
    addEvent(draft);
    setEventOpen(false);
  };

  return (
    <div className="page">
      <section className="balance-card balance-card--indigo">
        <span className="balance-card__label">规划账余额</span>
        <strong className={`balance-card__amount${balance < 0 ? ' is-negative' : ''}`}>{formatYuan(balance)}</strong>
        <span className="balance-card__meta">本月净变化 {formatSignedYuan(summary.net)}</span>
      </section>

      <section className="card summary-grid">
        <div>
          <span className="muted">本月支出</span>
          <strong>{formatYuan(summary.spends)}</strong>
        </div>
        <div>
          <span className="muted">本月补回</span>
          <strong className="positive">{formatYuan(summary.replenishes)}</strong>
        </div>
        <div>
          <span className="muted">本月汇入</span>
          <strong className="positive">{formatYuan(summary.inflows)}</strong>
        </div>
        <div>
          <span className="muted">月末余额</span>
          <strong>{formatYuan(summary.endBalance)}</strong>
        </div>
      </section>

      <div className="action-row">
        <button type="button" className="button button--primary" onClick={() => setEntryOpen(true)}>
          记一笔
        </button>
        <button type="button" className="button button--secondary" onClick={() => setEventOpen(true)}>
          新建事项
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>事项</h2>
          <span className="muted">{events.length} 个</span>
        </div>
        {events.length === 0 ? (
          <EmptyState title="还没有事项" hint="新建一个事项，记录花掉和补回的过程。" />
        ) : (
          events.map((event) => {
            const progress = eventProgress(state, event.id);
            const percent = progress.spent > 0 ? (progress.replenished / progress.spent) * 100 : 0;
            return (
              <Link to={`/planning/events/${event.id}`} className="card event-card" key={event.id}>
                <div className="event-card__head">
                  <strong>{event.name}</strong>
                  {progress.outstanding > 0 && <span className="badge">待补 {formatYuan(progress.outstanding)}</span>}
                  {progress.outstanding < 0 && (
                    <span className="badge badge--success">多补 {formatYuan(-progress.outstanding)}</span>
                  )}
                  {progress.outstanding === 0 && <span className="badge badge--success">已补齐</span>}
                </div>
                <ProgressBar value={percent} tone="indigo" />
                <div className="event-card__meta muted">
                  已花 {formatYuan(progress.spent)} · 已补 {formatYuan(progress.replenished)}
                </div>
              </Link>
            );
          })
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>最近汇入</h2>
          <span className="muted">{inflows.length} 笔</span>
        </div>
        {inflows.length === 0 ? (
          <EmptyState title="还没有汇入" hint="工资、红包等额外资金可以记在这里。" />
        ) : (
          <div className="card list">
            {inflows.map((entry) => (
              <div className="list-row" key={entry.id}>
                <div className="list-row__main">
                  <span className="list-row__title">{formatDisplayDate(entry.date)}</span>
                  {entry.note && <span className="list-row__note">{entry.note}</span>}
                </div>
                <div className="list-row__amounts">
                  <span className="positive">+{formatYuan(entry.amount)}</span>
                </div>
                <div className="list-row__actions">
                  <button type="button" className="text-button" onClick={() => setEditingInflow(entry)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="text-button text-button--danger"
                    onClick={() => setDeletingInflow(entry)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {entryOpen && (
        <EntrySheet
          mode="create"
          events={events}
          onClose={() => setEntryOpen(false)}
          onSubmit={submitEntry}
        />
      )}

      {eventOpen && (
        <Sheet open title="新建事项" onClose={() => setEventOpen(false)}>
          <EventForm submitLabel="创建事项" onSubmit={submitEvent} />
        </Sheet>
      )}

      {editingInflow && (
        <EntrySheet
          mode="edit"
          initial={{
            kind: 'inflow',
            date: editingInflow.date,
            amount: editingInflow.amount,
            note: editingInflow.note,
          }}
          events={events}
          lockKind
          onClose={() => setEditingInflow(null)}
          onSubmit={(draft) => {
            updateEntry('inflow', editingInflow.id, {
              date: draft.date,
              amount: draft.amount,
              note: draft.note,
            });
            setEditingInflow(null);
          }}
        />
      )}

      {deletingInflow && (
        <ConfirmDialog
          open
          title="删除这笔汇入？"
          message="删除后规划账余额会重新计算。"
          onCancel={() => setDeletingInflow(null)}
          onConfirm={() => {
            deleteEntry('inflow', deletingInflow.id);
            setDeletingInflow(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/ui/pages/PlanningPage.test.tsx`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/ui/components/EntrySheet.tsx src/ui/components/EventForm.tsx src/ui/pages/PlanningPage.tsx src/ui/pages/PlanningPage.test.tsx
git commit -m "feat: add planning page with event and entry forms"
```

---

### Task 13: 事项详情页

**Files:**
- Create: `src/ui/pages/EventDetailPage.tsx`
- Test: `src/ui/pages/EventDetailPage.test.tsx`

- [ ] **Step 1: 写失败测试 `src/ui/pages/EventDetailPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { EventDetailPage } from './EventDetailPage';

const planning: PlanningState = {
  events: [
    {
      id: 'e1',
      name: '买电脑',
      plannedTotal: 500000,
      replenishPlan: [{ month: '2026-12', amount: 300000 }],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
  spends: [
    { id: 's1', eventId: 'e1', date: '2026-11-02', amount: 500000, createdAt: '2026-11-02T00:00:00.000Z' },
  ],
  replenishes: [
    { id: 'r1', eventId: 'e1', date: '2026-11-05', amount: 200000, createdAt: '2026-11-05T00:00:00.000Z' },
  ],
  inflows: [],
};

describe('EventDetailPage', () => {
  it('shows progress, plan comparison and timeline', () => {
    renderWithProviders(
      <Routes>
        <Route path="/planning/events/:eventId" element={<EventDetailPage />} />
      </Routes>,
      { route: '/planning/events/e1', planning },
    );

    expect(screen.getByText('待补 ¥3000.00')).toBeInTheDocument();
    expect(screen.getByText('补回计划 vs 实际')).toBeInTheDocument();
    expect(screen.getByText('2026年12月')).toBeInTheDocument();
    expect(screen.getByText('当时待补 ¥5000.00')).toBeInTheDocument();
    expect(screen.getByText('当时待补 ¥3000.00')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/ui/pages/EventDetailPage.test.tsx`
Expected: FAIL，模块 `./EventDetailPage` 不存在。

- [ ] **Step 3: 实现 `src/ui/pages/EventDetailPage.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDisplayDate, formatMonthLabel } from '../../domain/dates';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import { eventProgress, eventTimeline, replenishPlanComparison } from '../../domain/planning';
import type { TimelineItem } from '../../domain/planning';
import { usePlanning } from '../../state/PlanningStore';
import type { EntryKind } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EntrySheet } from '../components/EntrySheet';
import type { EntryDraft } from '../components/EntrySheet';
import { EventForm } from '../components/EventForm';
import type { EventDraft } from '../components/EventForm';
import { EmptyState } from '../components/EmptyState';
import { Sheet } from '../components/Sheet';

interface EditingEntry {
  kind: EntryKind;
  id: string;
  eventId: string;
  date: string;
  amount: number;
  note?: string;
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { state, updateEvent, deleteEvent, addEntry, updateEntry, deleteEntry } = usePlanning();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<EntryKind>('spend');
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<EditingEntry | null>(null);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);

  const event = state.events.find((candidate) => candidate.id === eventId);

  if (!event || !eventId) {
    return (
      <div className="page">
        <EmptyState title="没有找到这个事项" />
        <Link className="button button--secondary" to="/planning">
          返回规划账
        </Link>
      </div>
    );
  }

  const progress = eventProgress(state, eventId);
  const timeline = eventTimeline(state, eventId);
  const comparison = replenishPlanComparison(state, eventId);

  const openAddEntry = (kind: EntryKind) => {
    setEntryKind(kind);
    setEditingEntry(null);
    setEntryOpen(true);
  };

  const openEditEntry = (item: TimelineItem) => {
    setEditingEntry({
      kind: item.kind,
      id: item.id,
      eventId,
      date: item.date,
      amount: item.amount,
      note: item.note,
    });
    setEntryOpen(true);
  };

  const submitEntry = (draft: EntryDraft) => {
    if (editingEntry) {
      updateEntry(editingEntry.kind, editingEntry.id, {
        date: draft.date,
        amount: draft.amount,
        note: draft.note,
        eventId: draft.eventId,
      });
      setEditingEntry(null);
    } else {
      addEntry({ ...draft, eventId });
    }
    setEntryOpen(false);
  };

  const closeEntry = () => {
    setEntryOpen(false);
    setEditingEntry(null);
  };

  const submitEventEdit = (draft: EventDraft) => {
    updateEvent(eventId, draft);
    setEditEventOpen(false);
  };

  return (
    <div className="page">
      <div className="page-nav">
        <Link className="text-button" to="/planning">
          ‹ 返回规划账
        </Link>
        <div>
          <button type="button" className="text-button" onClick={() => setEditEventOpen(true)}>
            编辑
          </button>
          <button type="button" className="text-button text-button--danger" onClick={() => setDeleteEventOpen(true)}>
            删除
          </button>
        </div>
      </div>

      <section className="balance-card balance-card--indigo">
        <span className="balance-card__label">{event.name}</span>
        <strong className="balance-card__amount">
          {progress.outstanding > 0
            ? `待补 ${formatYuan(progress.outstanding)}`
            : progress.outstanding < 0
              ? `多补 ${formatYuan(-progress.outstanding)}`
              : '已补齐'}
        </strong>
        {progress.overPlanned !== undefined && (
          <span className="badge badge--danger">超计划 {formatYuan(progress.overPlanned)}</span>
        )}
        <span className="balance-card__meta">
          已花 {formatYuan(progress.spent)} · 已补 {formatYuan(progress.replenished)}
          {event.plannedTotal !== undefined ? ` · 计划 ${formatYuan(event.plannedTotal)}` : ''}
        </span>
      </section>

      <section className="card">
        <h2 className="card-title">补回计划 vs 实际</h2>
        {comparison.length === 0 ? (
          <p className="muted">还没有补回计划或补回记录。</p>
        ) : (
          <div className="table">
            <div className="table__row table__head">
              <span>月份</span>
              <span>计划</span>
              <span>实际</span>
              <span>差额</span>
            </div>
            {comparison.map((row) => (
              <div className="table__row" key={row.month}>
                <span>{formatMonthLabel(row.month)}</span>
                <span>{formatYuan(row.planned)}</span>
                <span>{formatYuan(row.actual)}</span>
                <span className={row.diff >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(row.diff)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">来回补的过程</h2>
        {timeline.length === 0 ? (
          <p className="muted">还没有支出或补回记录。</p>
        ) : (
          <ul className="timeline">
            {timeline.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="timeline__item">
                <span className={`timeline__dot timeline__dot--${item.kind}`} />
                <div className="timeline__body">
                  <div className="timeline__head">
                    <strong className={item.kind === 'spend' ? 'negative' : 'positive'}>
                      {item.kind === 'spend' ? '支出' : '补回'} {formatYuan(item.amount)}
                    </strong>
                    <span className="muted">{formatDisplayDate(item.date)}</span>
                  </div>
                  {item.note && <p className="muted">{item.note}</p>}
                  <p className="muted">当时待补 {formatYuan(item.outstandingAfter)}</p>
                </div>
                <div className="timeline__actions">
                  <button type="button" className="text-button" onClick={() => openEditEntry(item)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="text-button text-button--danger"
                    onClick={() =>
                      setDeletingEntry({
                        kind: item.kind,
                        id: item.id,
                        eventId,
                        date: item.date,
                        amount: item.amount,
                        note: item.note,
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="action-row">
        <button type="button" className="button button--primary" onClick={() => openAddEntry('spend')}>
          记支出
        </button>
        <button type="button" className="button button--secondary" onClick={() => openAddEntry('replenish')}>
          记补回
        </button>
      </div>

      {entryOpen && (
        <EntrySheet
          mode={editingEntry ? 'edit' : 'create'}
          initial={editingEntry ?? { kind: entryKind, eventId }}
          events={state.events}
          lockKind
          onClose={closeEntry}
          onSubmit={submitEntry}
        />
      )}

      {deletingEntry && (
        <ConfirmDialog
          open
          title="删除这笔流水？"
          message="删除后规划账余额和事项进度会重新计算。"
          onCancel={() => setDeletingEntry(null)}
          onConfirm={() => {
            deleteEntry(deletingEntry.kind, deletingEntry.id);
            setDeletingEntry(null);
          }}
        />
      )}

      {editEventOpen && (
        <Sheet open title="编辑事项" onClose={() => setEditEventOpen(false)}>
          <EventForm
            initial={{
              name: event.name,
              plannedTotal: event.plannedTotal,
              note: event.note,
              replenishPlan: event.replenishPlan,
            }}
            submitLabel="保存修改"
            onSubmit={submitEventEdit}
          />
        </Sheet>
      )}

      {deleteEventOpen && (
        <ConfirmDialog
          open
          title="删除这个事项？"
          message="事项下的所有支出和补回记录会被一并删除，且无法恢复。"
          onCancel={() => setDeleteEventOpen(false)}
          onConfirm={() => {
            deleteEvent(eventId);
            navigate('/planning');
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/ui/pages/EventDetailPage.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/pages/EventDetailPage.tsx src/ui/pages/EventDetailPage.test.tsx
git commit -m "feat: add event detail page with progress and timeline"
```

---

### Task 14: 统计页

**Files:**
- Create: `src/ui/pages/StatsPage.tsx`
- Test: `src/ui/pages/StatsPage.test.tsx`

- [ ] **Step 1: 写失败测试 `src/ui/pages/StatsPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from '../../domain/planning';
import { todayKey } from '../../domain/dates';
import { renderWithProviders } from '../../test/render';
import { StatsPage } from './StatsPage';

describe('StatsPage', () => {
  it('switches between meal and planning statistics', async () => {
    const user = userEvent.setup();
    const meal = {
      settings: { dailyAllowance: 2000, startDate: todayKey() },
      records: {},
    };
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState() });

    expect(screen.getByText('每月结余')).toBeInTheDocument();
    expect(screen.getByText('餐补额度')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '规划账' }));
    expect(screen.getByText('每月净变化')).toBeInTheDocument();
    expect(screen.getByText('本月支出')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/ui/pages/StatsPage.test.tsx`
Expected: FAIL，模块 `./StatsPage` 不存在。

- [ ] **Step 3: 实现 `src/ui/pages/StatsPage.tsx`**

```tsx
import { useState } from 'react';
import { formatMonthLabel, todayKey } from '../../domain/dates';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import { mealMonthlySeries, planningMonthlySeries } from '../../domain/stats';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { BarChart } from '../components/BarChart';
import { SegmentedControl } from '../components/SegmentedControl';

type Ledger = 'meal' | 'planning';

export function StatsPage() {
  const { state: mealState } = useMeal();
  const { state: planningState } = usePlanning();
  const [ledger, setLedger] = useState<Ledger>('meal');
  const [count, setCount] = useState(6);
  const today = todayKey();
  const mealRows = mealMonthlySeries(mealState, today, count);
  const planningRows = planningMonthlySeries(planningState, today, count);
  const chartData =
    ledger === 'meal'
      ? mealRows.map((row) => ({ label: row.month, value: row.net }))
      : planningRows.map((row) => ({ label: row.month, value: row.net }));
  const displayMealRows = [...mealRows].reverse();
  const displayPlanningRows = [...planningRows].reverse();

  return (
    <div className="page">
      <h1>统计</h1>
      <SegmentedControl
        options={[
          { value: 'meal', label: '餐补' },
          { value: 'planning', label: '规划账' },
        ]}
        value={ledger}
        onChange={setLedger}
      />

      <section className="card">
        <h2 className="card-title">{ledger === 'meal' ? '每月结余' : '每月净变化'}</h2>
        <BarChart
          data={chartData}
          color={ledger === 'meal' ? 'var(--meal-primary)' : 'var(--planning-primary)'}
        />
      </section>

      <section className="card table-wrap">
        {ledger === 'meal' ? (
          <div className="table table--stats">
            <div className="table__row table__head">
              <span>月份</span>
              <span>天数</span>
              <span>餐补额度</span>
              <span>餐费</span>
              <span>结余</span>
              <span>累计</span>
            </div>
            {displayMealRows.map((row) => (
              <div className="table__row" key={row.month}>
                <span>{formatMonthLabel(row.month)}</span>
                <span>{row.daysRecorded}</span>
                <span>{formatYuan(row.allowanceTotal)}</span>
                <span>{formatYuan(row.spentTotal)}</span>
                <span className={row.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(row.net)}</span>
                <span>{formatYuan(row.endBalance)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="table table--stats">
            <div className="table__row table__head">
              <span>月份</span>
              <span>支出</span>
              <span>补回</span>
              <span>汇入</span>
              <span>净变化</span>
              <span>余额</span>
            </div>
            {displayPlanningRows.map((row) => (
              <div className="table__row" key={row.month}>
                <span>{formatMonthLabel(row.month)}</span>
                <span>{formatYuan(row.spends)}</span>
                <span>{formatYuan(row.replenishes)}</span>
                <span>{formatYuan(row.inflows)}</span>
                <span className={row.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(row.net)}</span>
                <span>{formatYuan(row.endBalance)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button type="button" className="button button--secondary" onClick={() => setCount((current) => current + 6)}>
        显示更早的月份
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/ui/pages/StatsPage.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/pages/StatsPage.tsx src/ui/pages/StatsPage.test.tsx
git commit -m "feat: add monthly statistics page"
```

### Task 15: 设置页

**Files:**
- Create: `src/ui/pages/SettingsPage.tsx`
- Test: `src/ui/pages/SettingsPage.test.tsx`

- [ ] **Step 1: 写失败测试 `src/ui/pages/SettingsPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { todayKey } from '../../domain/dates';
import { MEAL_STORAGE_KEY } from '../../storage/mealStorage';
import { renderWithProviders } from '../../test/render';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('saves a new daily allowance', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = { settings: { dailyAllowance: 2000, startDate: today }, records: {} };
    renderWithProviders(<SettingsPage />, { meal });

    const input = screen.getByLabelText('每日餐补金额');
    await user.clear(input);
    await user.type(input, '25');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) ?? '{}');
    expect(saved.settings.dailyAllowance).toBe(2500);
    expect(screen.getByText('设置已保存')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/ui/pages/SettingsPage.test.tsx`
Expected: FAIL，模块 `./SettingsPage` 不存在。

- [ ] **Step 3: 实现 `src/ui/pages/SettingsPage.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayKey } from '../../domain/dates';
import { centsToYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MoneyInput } from '../components/MoneyInput';

export function SettingsPage() {
  const { state, updateSettings, clearRecords } = useMeal();
  const { clearAll } = usePlanning();
  const [allowance, setAllowance] = useState(centsToYuan(state.settings.dailyAllowance));
  const [startDate, setStartDate] = useState(state.settings.startDate);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clearMealOpen, setClearMealOpen] = useState(false);
  const [clearPlanOpen, setClearPlanOpen] = useState(false);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(allowance);
    if (cents === null || cents <= 0) {
      setError('每日餐补必须是大于 0 的有效金额');
      return;
    }
    const result = updateSettings({ dailyAllowance: cents, startDate });
    if (result) {
      setError(result);
      setMessage('');
      return;
    }
    setError('');
    setMessage('设置已保存');
  };

  return (
    <div className="page">
      <h1>设置</h1>

      <section className="card">
        <h2 className="card-title">餐补设置</h2>
        <form className="form" onSubmit={save}>
          <label className="field">
            <span>每日餐补</span>
            <MoneyInput value={allowance} onChange={setAllowance} ariaLabel="每日餐补金额" />
          </label>
          <label className="field">
            <span>起始日期（只能提前）</span>
            <input
              type="date"
              value={startDate}
              max={todayKey()}
              onChange={(event) => setStartDate(event.target.value)}
              aria-label="起始日期"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && <p className="positive">{message}</p>}
          <button className="button button--primary" type="submit">
            保存设置
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">数据</h2>
        <p className="muted">数据只保存在本机浏览器中，清除浏览器数据会丢失记录。</p>
        <button type="button" className="button button--ghost" onClick={() => setClearMealOpen(true)}>
          清空餐补数据
        </button>
        <button type="button" className="button button--ghost" onClick={() => setClearPlanOpen(true)}>
          清空规划账数据
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">关于</h2>
        <p className="muted">小账本 v0.1.0 · PWA · 本地存储</p>
      </section>

      {clearMealOpen && (
        <ConfirmDialog
          open
          title="清空餐补数据？"
          message="将删除所有餐补记录，并把起始日期重置为今天；每日餐补金额保留。"
          confirmLabel="确认清空"
          onCancel={() => setClearMealOpen(false)}
          onConfirm={() => {
            clearRecords();
            setClearMealOpen(false);
            setMessage('餐补数据已清空');
          }}
        />
      )}

      {clearPlanOpen && (
        <ConfirmDialog
          open
          title="清空规划账数据？"
          message="将删除所有事项、支出、补回和汇入记录，且无法恢复。"
          confirmLabel="确认清空"
          onCancel={() => setClearPlanOpen(false)}
          onConfirm={() => {
            clearAll();
            setClearPlanOpen(false);
            setMessage('规划账数据已清空');
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/ui/pages/SettingsPage.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/pages/SettingsPage.tsx src/ui/pages/SettingsPage.test.tsx
git commit -m "feat: add settings page with data clearing"
```

---

### Task 16: 应用外壳、路由与底部导航

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: 写失败测试 `src/App.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { todayKey } from './domain/dates';
import { emptyPlanningState } from './domain/planning';
import { renderWithProviders } from './test/render';
import App from './App';

describe('App', () => {
  it('shows onboarding when the meal start date is empty', () => {
    renderWithProviders(<App />, {
      meal: { settings: { dailyAllowance: 2000, startDate: '' }, records: {} },
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('button', { name: '开始记账' })).toBeInTheDocument();
  });

  it('renders the bottom navigation after onboarding', () => {
    renderWithProviders(<App />, {
      meal: { settings: { dailyAllowance: 2000, startDate: todayKey() }, records: {} },
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('link', { name: '餐补' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '规划账' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '设置' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL，底部导航不存在（当前 `App.tsx` 仍是占位实现）。

- [ ] **Step 3: 用以下内容替换 `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { MealProvider } from './state/MealStore';
import { PlanningProvider } from './state/PlanningStore';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MealProvider>
      <PlanningProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </PlanningProvider>
    </MealProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: 用以下内容替换 `src/App.tsx`**

```tsx
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMeal } from './state/MealStore';
import { usePlanning } from './state/PlanningStore';
import { Onboarding } from './ui/pages/Onboarding';
import { MealPage } from './ui/pages/MealPage';
import { BackfillPage } from './ui/pages/BackfillPage';
import { PlanningPage } from './ui/pages/PlanningPage';
import { EventDetailPage } from './ui/pages/EventDetailPage';
import { StatsPage } from './ui/pages/StatsPage';
import { SettingsPage } from './ui/pages/SettingsPage';

const NAV_ITEMS: Array<{ to: string; label: string; icon: ReactNode }> = [
  {
    to: '/',
    label: '餐补',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12h16a8 8 0 0 1-16 0Z" />
        <path d="M8 8c0-2 1.5-3 3.5-3" />
      </svg>
    ),
  },
  {
    to: '/planning',
    label: '规划账',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 9h7M9 13h7M9 17h4" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: '统计',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </svg>
    ),
  },
];

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__inner">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function StorageBanner() {
  const meal = useMeal();
  const planning = usePlanning();
  const message = meal.storageError ?? planning.storageError;
  if (!message) return null;
  return (
    <div className="storage-banner" role="alert">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          meal.dismissError();
          planning.dismissError();
        }}
      >
        知道了
      </button>
    </div>
  );
}

export default function App() {
  const { state } = useMeal();
  if (!state.settings.startDate) return <Onboarding />;
  return (
    <div className="app-shell">
      <StorageBanner />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<MealPage />} />
          <Route path="/meal/backfill" element={<BackfillPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/planning/events/:eventId" element={<EventDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 5: 运行 App 测试确认通过**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS（2 个测试）。

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 7: 提交**

```bash
git add src/main.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: wire routes, bottom navigation and app shell"
```

---

### Task 17: PWA 配置与图标

**Files:**
- Create: `public/icon.svg`
- Create: `scripts/generate-icons.mjs`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-512.png`
- Modify: `vite.config.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: 创建 `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#10B981"/>
  <rect x="96" y="152" width="320" height="208" rx="44" fill="#FFFFFF"/>
  <rect x="96" y="208" width="320" height="44" fill="#A7F3D0"/>
  <circle cx="352" cy="304" r="30" fill="#10B981"/>
</svg>
```

- [ ] **Step 2: 创建 `scripts/generate-icons.mjs`**

```js
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const source = 'public/icon.svg';
await mkdir('public/icons', { recursive: true });
await sharp(source).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(source).resize(512, 512).png().toFile('public/icons/icon-512.png');

const padded = await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#10B981' },
})
  .composite([{ input: await sharp(source).resize(384, 384).png().toBuffer(), gravity: 'center' }])
  .png()
  .toBuffer();

await sharp(padded).toFile('public/icons/icon-maskable-512.png');
console.log('icons generated');
```

- [ ] **Step 3: 生成图标**

Run: `npm run icons`
Expected: 输出 `icons generated`，`public/icons/` 下生成 3 个 PNG。

- [ ] **Step 4: 用以下内容替换 `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '小账本',
        short_name: '小账本',
        description: '餐补结余与规划支出账本',
        theme_color: '#10B981',
        background_color: '#F7F8F6',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    passWithNoTests: true,
  },
});
```

- [ ] **Step 5: 更新 `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 6: 在 `src/main.tsx` 顶部注册 Service Worker**

在 import 区域加入：

```tsx
import { registerSW } from 'virtual:pwa-register';
```

在 `createRoot(...)` 之前加入：

```tsx
registerSW({ immediate: true });
```

完成后 `src/main.tsx` 的完整内容应为：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { MealProvider } from './state/MealStore';
import { PlanningProvider } from './state/PlanningStore';
import './ui/styles.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MealProvider>
      <PlanningProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </PlanningProvider>
    </MealProvider>
  </StrictMode>,
);
```

- [ ] **Step 7: 构建并确认 PWA 产物**

Run: `npm run build`
Expected: 构建成功。

Run: `ls dist`
Expected: 包含 `index.html`、`manifest.webmanifest`、`sw.js`、`icons/`、`icon.svg`。

- [ ] **Step 8: 本地预览验证离线**

Run: `npm run preview -- --host`
Expected: 输出本地和局域网访问地址；用浏览器打开，DevTools → Application → Service Workers 中可见已激活的 worker。

完成后按 Ctrl+C 停止预览。

- [ ] **Step 9: 提交**

```bash
git add public scripts vite.config.ts src/vite-env.d.ts src/main.tsx
git commit -m "feat: add PWA manifest, service worker and icons"
```

---

### Task 18: GitHub Pages 部署配置与 README

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

- [ ] **Step 1: 创建 `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test:run
      - run: npm run build
        env:
          VITE_BASE: /pocket-ledger/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 创建 `README.md`**

````markdown
# 小账本（pocket-ledger）

个人自用的移动端记账 PWA，包含两套独立账本：

- **餐补账**：每天 20 元餐补（可改），记录实际餐费，结余逐日累计。
- **规划账**：规划一笔支出，可多笔花、逐月补回，并记录额外汇入。
- **统计**：两套账的按月汇总与趋势图。
- 数据仅保存在本机浏览器（localStorage），无账号、无云同步。

## 开发

```bash
npm install
npm run dev          # 本地开发
npm run test         # 监听模式测试
npm run test:run     # 单次运行测试
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览构建产物
```

## 手机试用（同一 Wi-Fi）

```bash
npm run dev -- --host
```

手机浏览器打开终端输出的局域网地址即可。

## 部署到 GitHub Pages

1. 在 GitHub 创建仓库 `pocket-ledger`（公开或私有均可，Pages 需要公开或 Pro）。
2. 推送 `main` 分支：
   ```bash
   git remote add origin https://github.com/<你的GitHub用户名>/pocket-ledger.git
   git push -u origin main
   ```
3. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. 等待 Actions 完成后，访问 `https://<你的GitHub用户名>.github.io/pocket-ledger/`。

## 安装到手机主屏幕

Chrome 打开上述地址 → 右上角菜单 → **添加到主屏幕**。之后可离线使用。

## 数据说明

所有数据保存在本机浏览器的 localStorage 中，清除浏览器数据或卸载浏览器会丢失记录。
````

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: add GitHub Pages deployment workflow and README"
```

- [ ] **Step 4: 推送前与用户确认**

推送是外发操作，必须先征得用户确认 GitHub 用户名与仓库是否已创建。确认后执行：

```bash
git remote add origin https://github.com/<用户确认的用户名>/pocket-ledger.git
git push -u origin main
```

Expected: 推送成功，GitHub Actions 开始构建；在仓库 Actions 页面看到 `Deploy to GitHub Pages` 工作流成功。

---

### Task 19: 最终验证

**Files:**
- 无新增文件；修复验证中发现的问题。

- [ ] **Step 1: 运行全部测试**

Run: `npm run test:run`
Expected: 所有测试通过（0 failed）。

- [ ] **Step 2: 生产构建**

Run: `npm run build`
Expected: 无 TypeScript 错误，生成 `dist/`。

- [ ] **Step 3: 本地预览并逐项手动检查**

Run: `npm run preview -- --host`

检查清单：

- [ ] 首次打开显示引导页；设置每日餐补与起始日期后进入首页。
- [ ] 餐补首页：记录今日花费后余额、已记录天数、今日结余即时更新。
- [ ] 超支时余额变红并显示「已超支」。
- [ ] 存在未记录日期时出现提醒条，补记后提醒减少。
- [ ] 编辑、删除历史记录后余额与累计重新计算。
- [ ] 规划账：新建事项（含计划总额与补回计划）、记多笔支出、记补回、记汇入。
- [ ] 事项详情：待补金额、超计划提示、补回计划 vs 实际、时间线正确。
- [ ] 删除事项后其支出与补回被级联删除，余额重算。
- [ ] 统计页两套账切换正常，月度数字与图表显示正确。
- [ ] 设置页可修改餐补额、起始日期（不能晚于今天或最早记录），清空数据有二次确认。
- [ ] 深色模式下界面可读。
- [ ] 断网后刷新页面仍可使用（Service Worker 生效）。

- [ ] **Step 4: 手机实测**

在电脑与手机连接同一 Wi-Fi 的情况下，用手机 Chrome 打开预览地址，测试「添加到主屏幕」、断网打开、关闭重开数据仍在。

- [ ] **Step 5: 修复问题后提交**

若验证中发现任何问题，修复并重跑测试与构建，然后：

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

---

## 计划自检

- **规格覆盖**：第 3 节规则 → Task 4/5/12/13；界面第 4 节 → Task 10-16；数据模型第 6 节 → Task 4/5/7；错误处理第 7 节 → Task 8/12/13/15；测试第 8 节 → 各任务内测试 + Task 19；验收第 9 节 → Task 19 检查清单。
- **占位符**：除部署步骤需要用户确认 GitHub 用户名外，无 TBD/TODO；部署账号属于外部信息，执行时向用户确认。
- **类型一致性**：`EntryKind`、`EntryInput`、`EventInput` 在 Task 8 定义，Task 12/13 使用一致；`MealState`/`PlanningState` 字段命名在领域、存储、状态、页面中一致；金额统一为分。


