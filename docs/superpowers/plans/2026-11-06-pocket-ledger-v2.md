# 小账本 v2 实现计划：餐补阶段、恢复周期与圆团子视觉

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有小账本的餐补账升级为「月度预算 / 保底 / 自由额度 + 20/15 阶段 + 恢复周期统计」，并引入已定稿的圆团子 + 小盆栽视觉。

**Architecture:** 新增纯函数领域模块 `mealV2.ts`，由记录与恢复事件实时推导周期、阶段、余额和统计；存储升级为 `meal-allowance.v2` 并自动迁移 v1；`MealStore` 改为 v2 actions；UI 页面重写餐补相关页面，规划账保持不变；圆团子用内联 SVG 组件实现。

**Tech Stack:** React 19、TypeScript、Vite 6、Vitest 5、Testing Library、PWA。

**规格文档:** `docs/superpowers/specs/2026-11-06-pocket-ledger-v2-design.md`

---

## 文件结构变化

```
src/
├─ domain/
│  ├─ mealV2.ts                 # 新增：v2 类型、费率、时间线、恢复、迁移辅助
│  ├─ mealV2.test.ts            # 新增
│  ├─ meal.ts / meal.test.ts    # 保留 v1，用于旧数据迁移与旧测试
│  └─ ...
├─ storage/
│  ├─ mealV2Storage.ts          # 新增：v2 校验/读写 + v1 自动迁移
│  ├─ mealV2Storage.test.ts     # 新增
│  ├─ mealMigration.ts          # 新增：v1 → v2 纯函数
│  ├─ mealMigration.test.ts     # 新增
│  └─ mealStorage.ts            # 保留 v1 读取
├─ state/
│  └─ MealStore.tsx             # 改：v2 状态与 actions
├─ ui/
│  ├─ components/
│  │  └─ BeanMascot.tsx         # 新增：圆团子 + 盆栽 + 三状态
│  ├─ pages/
│  │  ├─ Onboarding.tsx         # 改：月度预算/保底
│  │  ├─ MealPage.tsx           # 改：状态卡/阈值提示/周期历史
│  │  ├─ BackfillPage.tsx       # 改：v2 余额与阶段确认
│  │  ├─ SettingsPage.tsx       # 改：预算/保底/手动恢复
│  │  └─ StatsPage.tsx          # 改：餐补按周期统计
│  └─ styles.css                # 改：莫兰迪配色、状态卡、进度条、周期表
└─ test/render.tsx              # 改：seed v2 数据
```

---

### Task 1: v2 类型、费率与记录辅助

**Files:**
- Create: `src/domain/mealV2.ts`
- Test: `src/domain/mealV2.test.ts`

- [ ] **Step 1: 写失败测试 `src/domain/mealV2.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  createRestoreEvent,
  defaultMealStateV2,
  deriveRates,
  missingMealDates,
  removeMealRecord,
  upsertMealRecord,
  validateMealSettings,
  type MealStateV2,
} from './mealV2';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '2026-11-01' };

describe('rates and defaults', () => {
  it('derives daily rates and free allowance', () => {
    expect(deriveRates(settings)).toEqual({
      dailyNormal: 2000,
      dailyMinimum: 1500,
      freeAllowance: 15000,
    });
  });

  it('defaults to 600 / 450 / empty start date', () => {
    expect(defaultMealStateV2()).toEqual({
      settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '' },
      records: {},
      restores: [],
    });
  });

  it('validates settings', () => {
    expect(validateMealSettings(settings)).toBeNull();
    expect(validateMealSettings({ ...settings, monthlyBudget: 30000 })).toBe('月度保底必须小于月度预算');
    expect(validateMealSettings({ ...settings, monthlyMinimum: -1 })).toBe('月度保底不能为负数');
    expect(validateMealSettings({ ...settings, startDate: '' })).toBe('请选择起始日期');
  });
});

describe('restore event snapshot', () => {
  it('snapshots rates and clamps opening balance', () => {
    const event = createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z', -50);
    expect(event).toMatchObject({
      date: '2026-11-01',
      openingBalance: 0,
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      freeAllowance: 15000,
      dailyNormal: 2000,
      dailyMinimum: 1500,
    });
    expect(event.id).toBeTruthy();
  });
});

describe('missing dates', () => {
  it('lists unrecorded dates from start date to yesterday', () => {
    const state: MealStateV2 = {
      settings,
      records: { '2026-11-02': { spent: 2000, updatedAt: '2026-11-02T00:00:00.000Z' } },
      restores: [],
    };
    expect(missingMealDates(state, '2026-11-05')).toEqual(['2026-11-01', '2026-11-03', '2026-11-04']);
  });
});

describe('record helpers', () => {
  const base: MealStateV2 = { settings, records: {}, restores: [] };

  it('adds and updates records without storing allowance', () => {
    const next = upsertMealRecord(base, '2026-11-02', 1500, '午饭', '2026-11-02T12:00:00.000Z');
    expect(next.records['2026-11-02']).toEqual({
      spent: 1500,
      note: '午饭',
      updatedAt: '2026-11-02T12:00:00.000Z',
    });
  });

  it('removes records immutably', () => {
    const withRecord = upsertMealRecord(base, '2026-11-02', 1500, '', '2026-11-02T12:00:00.000Z');
    const next = removeMealRecord(withRecord, '2026-11-02');
    expect(next.records).toEqual({});
    expect(withRecord.records['2026-11-02']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/mealV2.test.ts`
Expected: FAIL，模块 `./mealV2` 不存在。

- [ ] **Step 3: 实现 `src/domain/mealV2.ts`（本任务部分）**

```ts
import { addDays, listDates } from './dates';
import { createId } from './id';

export type MealMode = 'normal' | 'minimum';

export interface MealSettingsV2 {
  monthlyBudget: number;
  monthlyMinimum: number;
  startDate: string;
}

export interface MealRecordV2 {
  spent: number;
  note?: string;
  updatedAt: string;
}

export interface RestoreEvent {
  id: string;
  date: string;
  at: string;
  openingBalance: number;
  monthlyBudget: number;
  monthlyMinimum: number;
  freeAllowance: number;
  dailyNormal: number;
  dailyMinimum: number;
  note?: string;
}

export interface MealStateV2 {
  settings: MealSettingsV2;
  records: Record<string, MealRecordV2>;
  restores: RestoreEvent[];
}

export interface DerivedRates {
  dailyNormal: number;
  dailyMinimum: number;
  freeAllowance: number;
}

export function defaultMealStateV2(): MealStateV2 {
  return {
    settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '' },
    records: {},
    restores: [],
  };
}

export function deriveRates(settings: MealSettingsV2): DerivedRates {
  return {
    dailyNormal: Math.round(settings.monthlyBudget / 30),
    dailyMinimum: Math.round(settings.monthlyMinimum / 30),
    freeAllowance: settings.monthlyBudget - settings.monthlyMinimum,
  };
}

export function validateMealSettings(settings: MealSettingsV2): string | null {
  if (!Number.isInteger(settings.monthlyBudget) || settings.monthlyBudget <= 0) {
    return '月度预算必须是大于 0 的金额';
  }
  if (!Number.isInteger(settings.monthlyMinimum) || settings.monthlyMinimum < 0) {
    return '月度保底不能为负数';
  }
  if (settings.monthlyMinimum >= settings.monthlyBudget) {
    return '月度保底必须小于月度预算';
  }
  if (!settings.startDate) return '请选择起始日期';
  return null;
}

export function createRestoreEvent(
  settings: MealSettingsV2,
  date: string,
  at: string,
  openingBalance = 0,
): RestoreEvent {
  const rates = deriveRates(settings);
  return {
    id: createId(),
    date,
    at,
    openingBalance: Math.max(0, openingBalance),
    monthlyBudget: settings.monthlyBudget,
    monthlyMinimum: settings.monthlyMinimum,
    freeAllowance: rates.freeAllowance,
    dailyNormal: rates.dailyNormal,
    dailyMinimum: rates.dailyMinimum,
  };
}

export function missingMealDates(state: MealStateV2, today: string): string[] {
  const { startDate } = state.settings;
  if (!startDate) return [];
  const lastMissing = addDays(today, -1);
  if (startDate > lastMissing) return [];
  return listDates(startDate, lastMissing).filter((date) => !state.records[date]);
}

export function upsertMealRecord(
  state: MealStateV2,
  date: string,
  spent: number,
  note: string,
  updatedAt: string,
): MealStateV2 {
  return {
    ...state,
    records: {
      ...state.records,
      [date]: { spent, note: note.trim() || undefined, updatedAt },
    },
  };
}

export function removeMealRecord(state: MealStateV2, date: string): MealStateV2 {
  const records = { ...state.records };
  delete records[date];
  return { ...state, records };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/mealV2.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/domain/mealV2.ts src/domain/mealV2.test.ts
git commit -m "feat: add meal v2 types and settings helpers"
```

---

### Task 2: v2 时间线、阶段与当前状态

**Files:**
- Modify: `src/domain/mealV2.ts`
- Modify: `src/domain/mealV2.test.ts`

- [ ] **Step 1: 追加失败测试到 `src/domain/mealV2.test.ts`**

```ts
import { buildMealTimeline, currentMealStatus } from './mealV2';

const baseState: MealStateV2 = {
  settings,
  records: {},
  restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
};

function withRecords(records: MealStateV2['records']): MealStateV2 {
  return { ...baseState, records };
}

describe('meal timeline', () => {
  it('keeps 20 yuan per day and accumulates balance before threshold', () => {
    const state = withRecords({
      '2026-11-01': { spent: 2500, updatedAt: '2026-11-01T00:00:00.000Z' },
      '2026-11-02': { spent: 1500, updatedAt: '2026-11-02T00:00:00.000Z' },
    });
    const periods = buildMealTimeline(state, '2026-11-10');
    expect(periods).toHaveLength(1);
    expect(periods[0].openingBalance).toBe(0);
    expect(periods[0].days.map((day) => day.allowance)).toEqual([2000, 2000]);
    expect(periods[0].endingBalance).toBe(0);
    expect(periods[0].switchDate).toBeUndefined();
  });

  it('switches after the triggering day and rebases by plus free allowance', () => {
    const state = withRecords({
      '2026-11-01': { spent: 17000, updatedAt: '2026-11-01T00:00:00.000Z' },
      '2026-11-02': { spent: 2000, updatedAt: '2026-11-02T00:00:00.000Z' },
    });
    const periods = buildMealTimeline(state, '2026-11-10');
    const days = periods[0].days;
    expect(days[0].allowance).toBe(2000);
    expect(days[0].switchedToMinimum).toBe(true);
    expect(days[0].balanceAfter).toBe(0); // -15000 + 15000
    expect(periods[0].switchDate).toBe('2026-11-01');
    expect(days[1].allowance).toBe(1500);
    expect(days[1].balanceAfter).toBe(-500);
  });

  it('carries positive balance into the next period and clears negative', () => {
    const state: MealStateV2 = {
      settings,
      records: {
        '2026-11-02': { spent: 1000, updatedAt: '2026-11-02T00:00:00.000Z' },
        '2026-12-02': { spent: 3500, updatedAt: '2026-12-02T00:00:00.000Z' },
      },
      restores: [
        createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z'),
        createRestoreEvent(settings, '2026-12-01', '2026-12-01T00:00:00.000Z'),
      ],
    };
    const periods = buildMealTimeline(state, '2026-12-10');
    expect(periods[0].endingBalance).toBe(1000);
    expect(periods[1].openingBalance).toBe(1000);
    expect(periods[1].endingBalance).toBe(-500);
  });

  it('reports current status and free quota remaining', () => {
    const state = withRecords({
      '2026-11-01': { spent: 17000, updatedAt: '2026-11-01T00:00:00.000Z' },
      '2026-11-02': { spent: 1000, updatedAt: '2026-11-02T00:00:00.000Z' },
    });
    const status = currentMealStatus(state, '2026-11-10');
    expect(status.mode).toBe('minimum');
    expect(status.balance).toBe(500);
    expect(status.freeRemaining).toBe(0);
    expect(status.distanceToMinimum).toBe(0);
    expect(status.dailyAllowance).toBe(1500);
    expect(status.hasRecordToday).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/mealV2.test.ts`
Expected: FAIL，`buildMealTimeline` / `currentMealStatus` 未定义。

- [ ] **Step 3: 在 `src/domain/mealV2.ts` 追加实现**

```ts
export interface MealDay {
  date: string;
  spent: number;
  note?: string;
  allowance: number;
  dailyBalance: number;
  balanceAfter: number;
  switchedToMinimum: boolean;
}

export interface MealPeriod {
  restore: RestoreEvent;
  startDate: string;
  endDate: string;
  openingBalance: number;
  endingBalance: number;
  carry: number;
  net: number;
  switchDate?: string;
  days: MealDay[];
  totalSpent: number;
  totalAllowance: number;
}

export interface MealStatus {
  mode: MealMode;
  balance: number;
  dailyAllowance: number;
  freeRemaining: number;
  distanceToMinimum: number;
  freeAllowance: number;
  dailyNormal: number;
  dailyMinimum: number;
  startDate: string;
  endDate: string;
  switchDate?: string;
  hasRecordToday: boolean;
  todayRecord?: MealRecordV2;
}

export function buildMealTimeline(state: MealStateV2, today: string): MealPeriod[] {
  const restores = [...state.restores].sort((a, b) => a.date.localeCompare(b.date));
  if (restores.length === 0) return [];

  const periods: MealPeriod[] = [];
  let previousEnd = 0;

  for (let index = 0; index < restores.length; index += 1) {
    const restore = restores[index];
    const next = restores[index + 1];
    const startDate = restore.date;
    const endDate = next ? addDays(next.date, -1) : today;
    if (!endDate || endDate < startDate) continue;

    let balance = index === 0 ? 0 : previousEnd;
    const openingBalance = balance;
    let mode: MealMode = 'normal';
    let switchDate: string | undefined;
    const days: MealDay[] = [];
    let totalSpent = 0;
    let totalAllowance = 0;

    const dates = Object.keys(state.records)
      .filter((date) => date >= startDate && date <= endDate)
      .sort();

    for (const date of dates) {
      const record = state.records[date];
      const allowance = mode === 'normal' ? restore.dailyNormal : restore.dailyMinimum;
      const dailyBalance = allowance - record.spent;
      balance += dailyBalance;
      totalSpent += record.spent;
      totalAllowance += allowance;

      let switchedToMinimum = false;
      if (mode === 'normal' && balance <= -restore.freeAllowance) {
        switchedToMinimum = true;
        mode = 'minimum';
        switchDate = date;
        balance += restore.freeAllowance;
      }

      days.push({
        date,
        spent: record.spent,
        note: record.note,
        allowance,
        dailyBalance,
        balanceAfter: balance,
        switchedToMinimum,
      });
    }

    const endingBalance = balance;
    periods.push({
      restore,
      startDate,
      endDate,
      openingBalance,
      endingBalance,
      carry: Math.max(0, endingBalance),
      net: endingBalance - openingBalance,
      switchDate,
      days,
      totalSpent,
      totalAllowance,
    });
    previousEnd = Math.max(0, endingBalance);
  }

  return periods;
}

export function currentMealStatus(state: MealStateV2, today: string): MealStatus {
  const periods = buildMealTimeline(state, today);
  const period = periods[periods.length - 1];
  if (!period) {
    const rates = deriveRates(state.settings);
    return {
      mode: 'normal',
      balance: 0,
      dailyAllowance: rates.dailyNormal,
      freeRemaining: rates.freeAllowance,
      distanceToMinimum: rates.freeAllowance,
      freeAllowance: rates.freeAllowance,
      dailyNormal: rates.dailyNormal,
      dailyMinimum: rates.dailyMinimum,
      startDate: state.settings.startDate,
      endDate: today,
      hasRecordToday: Boolean(state.records[today]),
      todayRecord: state.records[today],
    };
  }

  const mode: MealMode = period.switchDate ? 'minimum' : 'normal';
  const balance = period.endingBalance;
  return {
    mode,
    balance,
    dailyAllowance: mode === 'normal' ? period.restore.dailyNormal : period.restore.dailyMinimum,
    freeRemaining: mode === 'normal'
      ? Math.max(0, period.restore.freeAllowance - Math.max(0, -balance))
      : 0,
    distanceToMinimum: mode === 'normal' ? period.restore.freeAllowance + balance : 0,
    freeAllowance: period.restore.freeAllowance,
    dailyNormal: period.restore.dailyNormal,
    dailyMinimum: period.restore.dailyMinimum,
    startDate: period.startDate,
    endDate: period.endDate,
    switchDate: period.switchDate,
    hasRecordToday: Boolean(state.records[today]),
    todayRecord: state.records[today],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/mealV2.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/domain/mealV2.ts src/domain/mealV2.test.ts
git commit -m "feat: add meal v2 timeline and phase status"
```

---

### Task 3: v2 恢复事件补齐与手动恢复

**Files:**
- Modify: `src/domain/mealV2.ts`
- Modify: `src/domain/mealV2.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import { normalizeMealState, restoreMealNow } from './mealV2';

describe('restore normalization', () => {
  it('creates the first restore and fills missed month starts', () => {
    const state: MealStateV2 = { settings, records: {}, restores: [] };
    const next = normalizeMealState(state, '2027-02-10');
    expect(next.restores.map((event) => event.date)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
  });

  it('does not add duplicate auto restores', () => {
    const state: MealStateV2 = {
      settings,
      records: {},
      restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
    };
    const next = normalizeMealState(state, '2026-11-20');
    expect(next.restores).toHaveLength(1);
  });
});

describe('manual restore', () => {
  it('adds a restore for today and rejects a second one', () => {
    const state: MealStateV2 = {
      settings,
      records: {},
      restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
    };
    const first = restoreMealNow(state, '2026-11-10');
    expect(first.error).toBeUndefined();
    expect(first.state.restores.some((event) => event.date === '2026-11-10')).toBe(true);
    const second = restoreMealNow(first.state, '2026-11-10');
    expect(second.error).toBe('今天已经恢复过');
    expect(second.state.restores.filter((event) => event.date === '2026-11-10')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/mealV2.test.ts`
Expected: FAIL。

- [ ] **Step 3: 在 `src/domain/mealV2.ts` 追加实现**

```ts
import { addMonths, monthOf } from './dates';

export function normalizeMealState(state: MealStateV2, today: string): MealStateV2 {
  if (!state.settings.startDate) return state;

  let restores = [...state.restores].sort((a, b) => a.date.localeCompare(b.date));
  if (restores.length === 0) {
    restores = [
      createRestoreEvent(state.settings, state.settings.startDate, `${state.settings.startDate}T00:00:00`),
    ];
  } else if (restores[0].date > state.settings.startDate) {
    restores.unshift(
      createRestoreEvent(state.settings, state.settings.startDate, `${state.settings.startDate}T00:00:00`),
    );
  }

  const lastDate = restores[restores.length - 1].date;
  let cursor = `${addMonths(monthOf(lastDate), 1)}-01`;
  while (cursor <= today) {
    if (!restores.some((event) => event.date === cursor)) {
      restores.push(createRestoreEvent(state.settings, cursor, `${cursor}T00:00:00`));
    }
    cursor = `${addMonths(monthOf(cursor), 1)}-01`;
  }

  restores.sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  restores = restores.filter((event) => {
    if (seen.has(event.date)) return false;
    seen.add(event.date);
    return true;
  });

  return { ...state, restores };
}

export interface RestoreResult {
  state: MealStateV2;
  error?: string;
}

export function restoreMealNow(state: MealStateV2, today: string): RestoreResult {
  const normalized = normalizeMealState(state, today);
  if (normalized.restores.some((event) => event.date === today)) {
    return { state: normalized, error: '今天已经恢复过' };
  }
  const event = createRestoreEvent(normalized.settings, today, new Date().toISOString());
  const restores = [...normalized.restores, event].sort((a, b) => a.date.localeCompare(b.date));
  return { state: { ...normalized, restores } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/mealV2.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/domain/mealV2.ts src/domain/mealV2.test.ts
git commit -m "feat: add meal v2 restore normalization and manual restore"
```

### Task 4: v1 → v2 数据迁移

**Files:**
- Create: `src/storage/mealMigration.ts`
- Test: `src/storage/mealMigration.test.ts`

- [ ] **Step 1: 写失败测试 `src/storage/mealMigration.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { migrateMealV1ToV2 } from './mealMigration';
import type { MealState } from '../domain/meal';

const v1: MealState = {
  settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
  records: {
    '2026-11-02': {
      spent: 1500,
      note: '午饭',
      allowance: 2000,
      updatedAt: '2026-11-02T00:00:00.000Z',
    },
  },
};

describe('migrateMealV1ToV2', () => {
  it('maps daily allowance to monthly budget and minimum', () => {
    const state = migrateMealV1ToV2(v1);
    expect(state.settings).toEqual({
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      startDate: '2026-11-01',
    });
    expect(state.records['2026-11-02']).toEqual({
      spent: 1500,
      note: '午饭',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
    expect(state.records['2026-11-02']).not.toHaveProperty('allowance');
  });

  it('creates the first restore event', () => {
    const state = migrateMealV1ToV2(v1);
    expect(state.restores).toHaveLength(1);
    expect(state.restores[0]).toMatchObject({
      date: '2026-11-01',
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      freeAllowance: 15000,
      dailyNormal: 2000,
      dailyMinimum: 1500,
    });
  });

  it('keeps onboarding state without a start date', () => {
    const state = migrateMealV1ToV2({
      settings: { dailyAllowance: 2000, startDate: '' },
      records: {},
    });
    expect(state.settings.startDate).toBe('');
    expect(state.restores).toEqual([]);
  });

  it('keeps a positive free allowance for small old allowances', () => {
    const state = migrateMealV1ToV2({
      settings: { dailyAllowance: 1000, startDate: '2026-11-01' },
      records: {},
    });
    expect(state.settings.monthlyBudget).toBe(30000);
    expect(state.settings.monthlyMinimum).toBe(28500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/storage/mealMigration.test.ts`
Expected: FAIL，模块 `./mealMigration` 不存在。

- [ ] **Step 3: 实现 `src/storage/mealMigration.ts`**

```ts
import type { MealState } from '../domain/meal';
import { createRestoreEvent } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';

export function migrateMealV1ToV2(v1: MealState): MealStateV2 {
  const monthlyBudget = v1.settings.dailyAllowance * 30;
  const monthlyMinimum = monthlyBudget > 45000 ? 45000 : Math.max(0, monthlyBudget - 1500);
  const settings = {
    monthlyBudget,
    monthlyMinimum,
    startDate: v1.settings.startDate,
  };

  const records: MealStateV2['records'] = Object.fromEntries(
    Object.entries(v1.records).map(([date, record]) => [
      date,
      {
        spent: record.spent,
        note: record.note,
        updatedAt: record.updatedAt,
      },
    ]),
  );

  const restores = settings.startDate
    ? [createRestoreEvent(settings, settings.startDate, `${settings.startDate}T00:00:00`)]
    : [];

  return { settings, records, restores };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/storage/mealMigration.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/storage/mealMigration.ts src/storage/mealMigration.test.ts
git commit -m "feat: migrate meal v1 data to v2"
```

---

### Task 5: v2 存储与自动迁移

**Files:**
- Create: `src/storage/mealV2Storage.ts`
- Test: `src/storage/mealV2Storage.test.ts`

- [ ] **Step 1: 写失败测试 `src/storage/mealV2Storage.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { MEAL_V2_STORAGE_KEY, isMealStateV2, loadMealStateV2, saveMealStateV2 } from './mealV2Storage';
import { createRestoreEvent, type MealStateV2 } from '../domain/mealV2';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '2026-11-01' };
const state: MealStateV2 = {
  settings,
  records: {
    '2026-11-02': { spent: 1500, updatedAt: '2026-11-02T00:00:00.000Z' },
  },
  restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
};

describe('mealV2Storage', () => {
  it('round-trips v2 state', () => {
    expect(saveMealStateV2(state)).toBeNull();
    expect(loadMealStateV2()).toEqual({ value: state });
    expect(localStorage.getItem(MEAL_V2_STORAGE_KEY)).toContain('2026-11-02');
  });

  it('rejects invalid v2 shapes', () => {
    expect(isMealStateV2({ settings })).toBe(false);
    expect(isMealStateV2({ ...state, restores: [{ date: '2026-11-01' }] })).toBe(false);
  });

  it('migrates v1 data automatically', () => {
    localStorage.setItem(
      'meal-allowance.v1',
      JSON.stringify({
        settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
        records: {
          '2026-11-02': { spent: 1500, allowance: 2000, updatedAt: '2026-11-02T00:00:00.000Z' },
        },
      }),
    );
    const result = loadMealStateV2();
    expect(result.migrated).toBe(true);
    expect(result.value.settings.monthlyBudget).toBe(60000);
    expect(result.value.restores).toHaveLength(1);
    expect(localStorage.getItem(MEAL_V2_STORAGE_KEY)).toContain('60000');
  });

  it('falls back to defaults when both stores are empty', () => {
    expect(loadMealStateV2().value.settings).toEqual({
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      startDate: '',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/storage/mealV2Storage.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现 `src/storage/mealV2Storage.ts`**

```ts
import { defaultMealStateV2 } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';
import { loadMealState } from './mealStorage';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';
import { migrateMealV1ToV2 } from './mealMigration';

export const MEAL_V2_STORAGE_KEY = 'meal-allowance.v2';

function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRestoreEvent(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.at === 'string' &&
    isCents(value.openingBalance) &&
    isCents(value.monthlyBudget) &&
    isCents(value.monthlyMinimum) &&
    isCents(value.freeAllowance) &&
    isCents(value.dailyNormal) &&
    isCents(value.dailyMinimum) &&
    (value.note === undefined || typeof value.note === 'string')
  );
}

export function isMealStateV2(value: unknown): value is MealStateV2 {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.settings)) return false;
  const { monthlyBudget, monthlyMinimum, startDate } = value.settings;
  if (!isCents(monthlyBudget) || !isCents(monthlyMinimum) || typeof startDate !== 'string') return false;
  if (monthlyBudget <= monthlyMinimum) return false;
  if (!isPlainObject(value.records)) return false;
  const recordsOk = Object.values(value.records).every(
    (record) =>
      isPlainObject(record) &&
      isCents(record.spent) &&
      typeof record.updatedAt === 'string' &&
      (record.note === undefined || typeof record.note === 'string'),
  );
  return recordsOk && Array.isArray(value.restores) && value.restores.every(isRestoreEvent);
}

export interface MealLoadResult extends LoadResult<MealStateV2> {
  migrated?: boolean;
}

export function loadMealStateV2(): MealLoadResult {
  const v2 = loadJson(MEAL_V2_STORAGE_KEY, isMealStateV2, defaultMealStateV2);
  if (!v2.error && localStorage.getItem(MEAL_V2_STORAGE_KEY)) return v2;

  const v1 = loadMealState();
  if (v1.error === undefined && localStorage.getItem('meal-allowance.v1')) {
    const migrated = migrateMealV1ToV2(v1.value);
    saveJson(MEAL_V2_STORAGE_KEY, migrated);
    return { value: migrated, migrated: true };
  }

  return v2;
}

export function saveMealStateV2(state: MealStateV2): string | null {
  return saveJson(MEAL_V2_STORAGE_KEY, state);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/storage/mealV2Storage.test.ts`
Expected: PASS。若 `isMealState` 导入未使用，删除该导入后再运行。

- [ ] **Step 5: Commit**

```bash
git add src/storage/mealV2Storage.ts src/storage/mealV2Storage.test.ts
git commit -m "feat: add meal v2 storage with automatic migration"
```

---

### Task 6: MealStore 改为 v2

**Files:**
- Modify: `src/state/MealStore.tsx`
- Test: 页面测试覆盖（Task 8-12）

- [ ] **Step 1: 用以下完整内容替换 `src/state/MealStore.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import {
  createRestoreEvent,
  normalizeMealState,
  removeMealRecord,
  restoreMealNow,
  upsertMealRecord,
  validateMealSettings,
} from '../domain/mealV2';
import type { MealSettingsV2, MealStateV2 } from '../domain/mealV2';
import { loadMealStateV2, saveMealStateV2 } from '../storage/mealV2Storage';

interface MealContextValue {
  state: MealStateV2;
  storageError: string | null;
  dismissError: () => void;
  updateSettings: (settings: MealSettingsV2) => string | null;
  saveRecord: (date: string, spent: number, note: string) => void;
  deleteRecord: (date: string) => void;
  restoreNow: () => string | null;
  clearRecords: () => void;
}

const MealContext = createContext<MealContextValue | null>(null);

export function MealProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadMealStateV2());
  const [state, setState] = useState<MealStateV2>(initial.value);
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    setState((previous) => normalizeMealState(previous, todayKey()));
  }, []);

  useEffect(() => {
    const error = saveMealStateV2(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const mutate = useCallback((updater: (previous: MealStateV2) => MealStateV2) => {
    setState((previous) => updater(normalizeMealState(previous, todayKey())));
  }, []);

  const updateSettings = useCallback((settings: MealSettingsV2): string | null => {
    const message = validateMealSettings(settings);
    if (message) return message;
    setState((previous) => {
      const normalized = normalizeMealState(previous, todayKey());
      const restores =
        normalized.restores.length > 0
          ? normalized.restores
          : [createRestoreEvent(settings, settings.startDate, new Date().toISOString())];
      return { ...normalized, settings, restores };
    });
    return null;
  }, []);

  const saveRecord = useCallback(
    (date: string, spent: number, note: string) => {
      mutate((previous) => upsertMealRecord(previous, date, spent, note, new Date().toISOString()));
    },
    [mutate],
  );

  const deleteRecord = useCallback(
    (date: string) => {
      mutate((previous) => removeMealRecord(previous, date));
    },
    [mutate],
  );

  const restoreNow = useCallback((): string | null => {
    const result = restoreMealNow(state, todayKey());
    if (result.error) return result.error;
    setState(result.state);
    return null;
  }, [state]);

  const clearRecords = useCallback(() => {
    setState((previous) => {
      const settings = { ...previous.settings, startDate: todayKey() };
      return {
        settings,
        records: {},
        restores: [createRestoreEvent(settings, settings.startDate, new Date().toISOString())],
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      storageError,
      dismissError,
      updateSettings,
      saveRecord,
      deleteRecord,
      restoreNow,
      clearRecords,
    }),
    [state, storageError, dismissError, updateSettings, saveRecord, deleteRecord, restoreNow, clearRecords],
  );

  return <MealContext.Provider value={value}>{children}</MealContext.Provider>;
}

export function useMeal(): MealContextValue {
  const value = useContext(MealContext);
  if (!value) throw new Error('useMeal must be used within MealProvider');
  return value;
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc -b`
Expected: 仅页面/测试因旧 API 报错；Store 本身无类型错误。完成 Task 8-12 后全绿。

- [ ] **Step 3: Commit**

```bash
git add src/state/MealStore.tsx
git commit -m "feat: upgrade meal store to v2 phases"
```

---

### Task 7: 圆团子组件与莫兰迪样式

**Files:**
- Create: `src/ui/components/BeanMascot.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: 创建 `src/ui/components/BeanMascot.tsx`**

```tsx
export type MascotState = 'happy' | 'sad' | 'worried';

const LABELS: Record<MascotState, string> = {
  happy: '豆豆很开心',
  sad: '豆豆超支了',
  worried: '豆豆进入保底阶段',
};

const POT_LEAVES = {
  happy: (
    <>
      <path d="M60 70 q-2 -20 -16 -28" stroke="#5F6B5A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M49 48 q-16 -8 -22 4 q14 10 22 -4Z" fill="#9DB08A" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M61 56 q14 -12 24 -2 q-12 12 -24 2Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M56 35 q-10 -12 -22 -6 q6 14 22 6Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M66 44 q12 -12 22 -4 q-8 12 -22 4Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M46 62 q-16 -4 -20 8 q12 8 20 -8Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
    </>
  ),
  sad: <path d="M60 70 q-2 -12 -10 -18" stroke="#8A6654" strokeWidth="3" fill="none" strokeLinecap="round" />,
  worried: (
    <>
      <path d="M60 70 q-2 -20 -16 -28" stroke="#5F6B5A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M49 48 q-16 -8 -22 4 q14 10 22 -4Z" fill="#9DB08A" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M56 35 q-10 -12 -22 -6 q6 14 22 6Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
    </>
  ),
};

interface BeanMascotProps {
  state: MascotState;
  className?: string;
}

export function BeanMascot({ state, className = '' }: BeanMascotProps) {
  return (
    <svg
      className={`mascot ${className}`}
      viewBox="0 0 260 240"
      role="img"
      aria-label={LABELS[state]}
    >
      <circle cx="120" cy="110" r="58" fill="#F7F3EA" stroke="#D8CFC3" strokeWidth="3" />

      {state === 'happy' && (
        <>
          <circle cx="102" cy="105" r="6" fill="#4B4742" />
          <circle cx="138" cy="105" r="6" fill="#4B4742" />
          <path d="M112 130 Q120 136 128 130" stroke="#4B4742" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="84" cy="120" r="7" fill="#E2B6B0" opacity=".6" />
          <circle cx="156" cy="120" r="7" fill="#E2B6B0" opacity=".6" />
          <path d="M46 88 l3-7 3 7-3-2z" fill="#F0D9A8" />
          <circle cx="196" cy="84" r="2.5" fill="#F0D9A8" />
        </>
      )}

      {state === 'sad' && (
        <>
          <rect x="84" y="90" width="24" height="6" rx="3" fill="#5F6B5A" transform="rotate(-18 96 93)" />
          <rect x="132" y="90" width="24" height="6" rx="3" fill="#5F6B5A" transform="rotate(18 144 93)" />
          <path d="M90 106 Q100 98 110 106 Q100 102 90 106Z" fill="#4B4742" />
          <path d="M130 106 Q140 98 150 106 Q140 102 130 106Z" fill="#4B4742" />
          <path d="M96 108 q-3 18 1 30 q5 2 5 -30Z" fill="#A9C6D6" opacity=".92" />
          <path d="M144 108 q3 18 -1 30 q-5 2 -5 -30Z" fill="#A9C6D6" opacity=".92" />
          <ellipse cx="98" cy="140" rx="4" ry="6" fill="#A9C6D6" />
          <ellipse cx="142" cy="140" rx="4" ry="6" fill="#A9C6D6" />
          <ellipse cx="120" cy="136" rx="9" ry="7" fill="#4B3A2E" />
          <ellipse cx="120" cy="139" rx="5" ry="3" fill="#C98A8A" />
        </>
      )}

      {state === 'worried' && (
        <>
          <path
            d="M90 96 L108 106 L90 116"
            stroke="#3F4A3C"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M150 96 L132 106 L150 116"
            stroke="#3F4A3C"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="120" cy="136" rx="6" ry="7" fill="#4B3A2E" />
          <ellipse cx="120" cy="139" rx="3" ry="3" fill="#C98A8A" />
          <path d="M156 94 C162 104 160 112 154 114 C148 112 148 102 156 94Z" fill="#A9C6D6" stroke="#7FA6BA" strokeWidth="2" />
        </>
      )}

      <g transform="translate(12, 120) scale(0.55)">
        <path
          d="M36 112 L28 72 L92 72 L84 112 Q60 118 36 112Z"
          fill="#C08B72"
          stroke="#8A6654"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <ellipse cx="60" cy="72" rx="32" ry="8" fill="#8A6654" />
        <ellipse cx="60" cy="70" rx="25" ry="5" fill="#6B4B36" />
        {POT_LEAVES[state]}
      </g>

      {state === 'sad' && (
        <>
          <path d="M30 206 q-10 6 -8 14 q10 2 8 -14Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
          <path d="M44 212 q10 6 8 14 q-10 2 -8 -14Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
          <path d="M18 214 q-6 8 -2 14 q8 0 2 -14Z" fill="#9DB08A" stroke="#5F6B5A" strokeWidth="2" />
        </>
      )}
      {state === 'worried' && (
        <path d="M30 210 q-8 8 -2 14 q8 -2 2 -14Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
      )}
    </svg>
  );
}
```

- [ ] **Step 2: 更新 `src/ui/styles.css` 的颜色变量**

将浅色 `:root` 中以下变量替换为莫兰迪值（其余变量保留）：

```css
  --bg: #f3efe8;
  --surface: #fbf8f3;
  --surface-soft: #ede7dd;
  --text: #4b4742;
  --muted: #7a746b;
  --border: #ddd5c8;
  --meal-primary: #a8b5a2;
  --meal-primary-dark: #7e8d78;
  --planning-primary: #a7b6c2;
  --planning-primary-dark: #7f93a3;
  --danger: #b77a6e;
  --button-primary-bg: #5f6b5a;
  --button-primary-text: #ffffff;
  --button-planning-bg: #6f8798;
  --button-planning-text: #ffffff;
  --button-danger-bg: #9b5b50;
  --button-danger-text: #ffffff;
  --badge-danger-bg: #f0d7cf;
  --badge-danger-text: #8f3e35;
  --badge-success-bg: #dce4d8;
  --badge-success-text: #5f6b5a;
  --success: #7e8d78;
  --warning-bg: #f4ebdd;
  --warning-text: #8a6a3d;
```

深色 `@media` 中替换为：

```css
    --bg: #1f1d1a;
    --surface: #2a2723;
    --surface-soft: #332f2a;
    --text: #ece6dc;
    --muted: #b4aa9d;
    --border: #443e37;
    --meal-primary: #a8b5a2;
    --meal-primary-dark: #7e8d78;
    --planning-primary: #a7b6c2;
    --planning-primary-dark: #7f93a3;
    --danger: #d79a8e;
    --button-primary-bg: #a8b5a2;
    --button-primary-text: #1f1d1a;
    --button-planning-bg: #a7b6c2;
    --button-planning-text: #1f1d1a;
    --button-danger-bg: #d79a8e;
    --button-danger-text: #1f1d1a;
    --badge-danger-bg: #4a2f2a;
    --badge-danger-text: #f0b8aa;
    --badge-success-bg: #2f3a2d;
    --badge-success-text: #c4d0be;
    --success: #a8b5a2;
    --warning-bg: #3b3226;
    --warning-text: #e0c08a;
```

- [ ] **Step 3: 在 `styles.css` 末尾追加**

```css
.balance-card {
  position: relative;
  overflow: hidden;
}

.balance-card--indigo {
  background: linear-gradient(135deg, #bcc9d3, #a7b6c2);
  box-shadow: 0 16px 32px rgba(127, 147, 163, 0.2);
  color: #3e444b;
}

.balance-card--happy {
  background: linear-gradient(135deg, #c4cfbe, #a8b5a2);
  box-shadow: 0 16px 32px rgba(126, 141, 120, 0.22);
  color: #3f443c;
}

.balance-card--sad {
  background: linear-gradient(135deg, #e3c9c1, #d8b3a8);
  box-shadow: 0 16px 32px rgba(183, 122, 110, 0.18);
  color: #4a3b36;
}

.balance-card--minimum {
  background: linear-gradient(135deg, #ddd2bf, #c9b8a0);
  box-shadow: 0 16px 32px rgba(160, 137, 104, 0.2);
  color: #4a4236;
}

.balance-card--sad .balance-card__amount {
  color: #8f3e35;
}

.balance-card--minimum .balance-card__amount {
  color: #7c5a2e;
}

.status-pill {
  display: inline-flex;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-weight: 600;
}

.free-quota {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 58%;
  margin-top: 18px;
}

.free-quota__label {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  opacity: 0.85;
}

.free-quota__track {
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  overflow: hidden;
}

.free-quota__fill {
  height: 100%;
  border-radius: 999px;
  background: #5f6b5a;
}

.mascot {
  width: 128px;
  height: auto;
  display: block;
  flex-shrink: 0;
}

.mascot--sm {
  width: 92px;
}

.mascot--lg {
  width: 170px;
}

.period-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.period-meta {
  color: var(--muted);
  font-size: 12px;
}

.mode-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--surface-soft);
  color: var(--muted);
}

.mode-badge--minimum {
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
}

.threshold-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 组件与样式编译通过（页面仍是旧 API 时可能报错；完成 Task 8-12 后全绿）。

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/BeanMascot.tsx src/ui/styles.css
git commit -m "feat: add morandi mascot and phase styles"
```

### Task 8: 引导页 v2

**Files:**
- Modify: `src/ui/pages/Onboarding.tsx`

- [ ] **Step 1: 用以下内容替换 `src/ui/pages/Onboarding.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayKey } from '../../domain/dates';
import { deriveRates } from '../../domain/mealV2';
import { formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { MoneyInput } from '../components/MoneyInput';

export function Onboarding() {
  const { updateSettings } = useMeal();
  const [budget, setBudget] = useState('600');
  const [minimum, setMinimum] = useState('450');
  const [startDate, setStartDate] = useState(todayKey());
  const [error, setError] = useState('');

  const budgetCents = parseYuanToCents(budget);
  const minimumCents = parseYuanToCents(minimum);
  const valid = budgetCents !== null && minimumCents !== null && budgetCents > minimumCents;
  const rates = valid
    ? deriveRates({ monthlyBudget: budgetCents, monthlyMinimum: minimumCents, startDate })
    : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (budgetCents === null || minimumCents === null) {
      setError('请输入有效金额');
      return;
    }
    const message = updateSettings({
      monthlyBudget: budgetCents,
      monthlyMinimum: minimumCents,
      startDate,
    });
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
        <p className="muted">先设置月度预算、保底和起始日期。</p>
      </div>
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>月度餐补预算</span>
          <MoneyInput value={budget} onChange={setBudget} ariaLabel="月度餐补预算" />
        </label>
        <label className="field">
          <span>月度保底</span>
          <MoneyInput value={minimum} onChange={setMinimum} ariaLabel="月度保底" />
        </label>
        {rates && (
          <p className="muted">
            自由额度 {formatYuan(rates.freeAllowance)} · 日均 {formatYuan(rates.dailyNormal)} / {formatYuan(rates.dailyMinimum)}
          </p>
        )}
        <label className="field">
          <span>起始日期</span>
          <input type="date" value={startDate} max={todayKey()} onChange={(event) => setStartDate(event.target.value)} aria-label="起始日期" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--primary" type="submit">开始记账</button>
      </form>
      <p className="onboarding__hint muted">数据只保存在这台手机上。</p>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: Onboarding 编译通过；其他旧页面可能仍未更新。

- [ ] **Step 3: Commit**

```bash
git add src/ui/pages/Onboarding.tsx
git commit -m "feat: update onboarding for monthly budget and minimum"
```

---

### Task 9: 餐补首页 v2

**Files:**
- Modify: `src/ui/pages/MealPage.tsx`
- Modify: `src/ui/pages/MealPage.test.tsx`

- [ ] **Step 1: 用以下内容替换 `src/ui/pages/MealPage.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import {
  buildMealTimeline,
  currentMealStatus,
  missingMealDates,
  removeMealRecord,
  upsertMealRecord,
} from '../../domain/mealV2';
import type { MealDay } from '../../domain/mealV2';
import { centsToYuan, formatSignedYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { BeanMascot } from '../components/BeanMascot';
import type { MascotState } from '../components/BeanMascot';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MoneyInput } from '../components/MoneyInput';
import { Sheet } from '../components/Sheet';

function TodayForm({
  record,
  onSave,
}: {
  record?: { spent: number; note?: string };
  onSave: (spent: number, note: string) => void;
}) {
  const [spent, setSpent] = useState(record ? centsToYuan(record.spent) : '');
  const [note, setNote] = useState(record?.note ?? '');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(spent);
    if (cents === null) {
      setError('请输入有效金额');
      return;
    }
    setError('');
    onSave(cents, note);
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>今日实际花费</span>
        <MoneyInput value={spent} onChange={setSpent} ariaLabel="今日实际花费" />
      </label>
      <label className="field">
        <span>备注（可选）</span>
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} aria-label="今日备注" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button--primary" type="submit">{record ? '更新今日记录' : '保存'}</button>
    </form>
  );
}

function RecordRow({
  day,
  onEdit,
  onDelete,
}: {
  day: MealDay;
  onEdit: (date: string) => void;
  onDelete: (date: string) => void;
}) {
  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(day.date)}</span>
        {day.note && <span className="list-row__note">{day.note}</span>}
        {day.switchedToMinimum && <span className="badge badge--danger">自由额度用完</span>}
      </div>
      <div className="list-row__amounts">
        <span>额度 {formatYuan(day.allowance)} · 花 {formatYuan(day.spent)}</span>
        <span className={day.dailyBalance >= 0 ? 'positive' : 'negative'}>当日 {formatSignedYuan(day.dailyBalance)}</span>
        <span className="muted">累计 {formatYuan(day.balanceAfter)}</span>
      </div>
      <div className="list-row__actions">
        <button type="button" className="text-button" aria-label={`编辑 ${formatDisplayDate(day.date)}`} onClick={() => onEdit(day.date)}>
          编辑
        </button>
        <button type="button" className="text-button text-button--danger" aria-label={`删除 ${formatDisplayDate(day.date)}`} onClick={() => onDelete(day.date)}>
          删除
        </button>
      </div>
    </div>
  );
}

export function MealPage() {
  const { state, saveRecord, deleteRecord } = useMeal();
  const today = todayKey();
  const status = currentMealStatus(state, today);
  const timeline = buildMealTimeline(state, today);
  const periods = [...timeline].reverse();
  const missing = missingMealDates(state, today);
  const todayRecord = state.records[today];
  const recordedDays = timeline.reduce((total, period) => total + period.days.length, 0);

  const previousMode = useRef(status.mode);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [editing, setEditing] = useState<{ date: string; spent: string; note: string; error: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    if (previousMode.current === 'normal' && status.mode === 'minimum') {
      setThresholdOpen(true);
    }
    previousMode.current = status.mode;
  }, [status.mode]);

  const mascotState: MascotState = status.mode === 'minimum' ? 'worried' : status.balance < 0 ? 'sad' : 'happy';
  const cardTone = status.mode === 'minimum' ? 'minimum' : status.balance < 0 ? 'sad' : 'happy';

  const openEdit = (date: string) => {
    const record = state.records[date];
    if (!record) return;
    setEditing({ date, spent: centsToYuan(record.spent), note: record.note ?? '', error: '' });
  };

  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const cents = parseYuanToCents(editing.spent);
    if (cents === null) {
      setEditing({ ...editing, error: '请输入有效金额' });
      return;
    }
    const nextState = upsertMealRecord(state, editing.date, cents, editing.note, new Date().toISOString());
    const action = () => saveRecord(editing.date, cents, editing.note);
    if (currentMealStatus(nextState, today).mode !== status.mode) {
      setConfirmMessage('这次修改会改变当前阶段，确认继续吗？');
      setPendingAction(() => action);
    } else {
      action();
    }
    setEditing(null);
  };

  const requestDelete = (date: string) => {
    const nextState = removeMealRecord(state, date);
    const nextMode = currentMealStatus(nextState, today).mode;
    setConfirmMessage(nextMode !== status.mode ? '删除会改变当前阶段，仍要删除吗？' : '删除后余额与阶段会重新计算。');
    setPendingAction(() => () => deleteRecord(date));
  };

  return (
    <div className="page">
      <section className={`balance-card balance-card--${cardTone}`}>
        <div style={{ maxWidth: '62%', position: 'relative', zIndex: 1 }}>
          <span className="balance-card__label">当前可用余额</span>
          <strong className={`balance-card__amount${status.balance < 0 ? ' is-negative' : ''}`}>{formatYuan(status.balance)}</strong>
          <span className="status-pill">
            {status.mode === 'minimum'
              ? `保底 ${formatYuan(status.dailyMinimum)}/天 · 无自由额度`
              : `${formatYuan(status.dailyNormal)}/天 · 距保底 ${formatYuan(status.distanceToMinimum)}`}
          </span>
          <div className="balance-card__meta">
            已记录 {recordedDays} 天 · 本周期 {formatDisplayDate(status.startDate)} 起
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600 }}>
            {status.mode === 'minimum'
              ? '没有多余的钱可以随意消费'
              : status.balance < 0
                ? '有点超支了…'
                : '真棒！今天也攒下啦'}
          </p>
        </div>
        <div style={{ position: 'absolute', right: 12, bottom: 0 }}>
          <BeanMascot state={mascotState} />
        </div>
        {status.mode === 'normal' ? (
          <div className="free-quota">
            <div className="free-quota__label">
              <span>自由额度剩余</span>
              <span>{formatYuan(status.freeRemaining)} / {formatYuan(status.freeAllowance)}</span>
            </div>
            <div className="free-quota__track">
              <div
                className="free-quota__fill"
                style={{ width: `${Math.min(100, Math.max(0, (status.freeRemaining / status.freeAllowance) * 100))}%` }}
              />
            </div>
          </div>
        ) : (
          <p style={{ margin: '18px 0 0', fontSize: 12, opacity: 0.85 }}>
            自由额度已用完，接下来每天按 {formatYuan(status.dailyMinimum)} 计算。
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">今天 {formatDisplayDate(today)} · 额度 {formatYuan(status.dailyAllowance)}</h2>
        <TodayForm key={todayRecord?.updatedAt ?? 'empty'} record={todayRecord} onSave={(spent, note) => saveRecord(today, spent, note)} />
        {todayRecord && <p className="muted">今日已记录，花费 {formatYuan(todayRecord.spent)}</p>}
      </section>

      {missing.length > 0 && (
        <Link className="banner banner--warning" to="/meal/backfill">
          ⚠ 还有 {missing.length} 天未记录，去补记 ›
        </Link>
      )}

      <section className="card summary-grid">
        <div><span className="muted">本周期花费</span><strong>{formatYuan(timeline[timeline.length - 1]?.totalSpent ?? 0)}</strong></div>
        <div><span className="muted">本周期额度</span><strong>{formatYuan(timeline[timeline.length - 1]?.totalAllowance ?? 0)}</strong></div>
        <div><span className="muted">当前阶段</span><strong>{status.switchDate ? '保底 15 元' : '正常 20 元'}</strong></div>
        <div><span className="muted">自由额度</span><strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong></div>
      </section>

      <section className="section">
        <div className="section-head"><h2>周期记录</h2><span className="muted">按恢复周期</span></div>
        {periods.length === 0 ? (
          <EmptyState title="还没有记录" hint="记下今天的花费，开始攒结余。" />
        ) : (
          periods.map((period) => (
            <div className="card" key={period.restore.id}>
              <div className="period-heading">
                <strong>{formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}</strong>
                <div>
                  {period.switchDate && <span className="mode-badge mode-badge--minimum">15 元阶段</span>}
                  <span className="mode-badge">{formatYuan(period.restore.dailyNormal)}/天</span>
                </div>
              </div>
              <div className="period-meta">
                花 {formatYuan(period.totalSpent)} · 结束余额 {formatYuan(period.endingBalance)} · 结转 {period.carry > 0 ? formatYuan(period.carry) : '已清零'}
              </div>
              {period.days.length === 0 ? (
                <p className="muted">这个周期还没有记录。</p>
              ) : (
                [...period.days].reverse().map((day) => (
                  <RecordRow key={day.date} day={day} onEdit={openEdit} onDelete={requestDelete} />
                ))
              )}
            </div>
          ))
        )}
      </section>

      {editing && (
        <Sheet open title="修改记录" onClose={() => setEditing(null)}>
          <form className="form" onSubmit={submitEdit}>
            <label className="field">
              <span>{formatDisplayDate(editing.date)} 花费</span>
              <MoneyInput value={editing.spent} onChange={(value) => setEditing({ ...editing, spent: value, error: '' })} ariaLabel="修改金额" />
            </label>
            <label className="field">
              <span>备注（可选）</span>
              <input
                type="text"
                value={editing.note}
                onChange={(event) => setEditing({ ...editing, note: event.target.value, error: '' })}
                aria-label="修改备注"
              />
            </label>
            {editing.error && <p className="form-error" role="alert">{editing.error}</p>}
            <button className="button button--primary" type="submit">保存修改</button>
          </form>
        </Sheet>
      )}

      {pendingAction && (
        <ConfirmDialog
          open
          title="确认操作"
          message={confirmMessage}
          confirmLabel="确认"
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            pendingAction();
            setPendingAction(null);
          }}
        />
      )}

      <Sheet open={thresholdOpen} title="自由额度用完了" onClose={() => setThresholdOpen(false)}>
        <div className="threshold-message">
          <BeanMascot state="sad" className="mascot--sm" />
          <p>
            没有多余的钱可以随意消费了。接下来每天按{' '}
            {formatYuan(timeline[timeline.length - 1]?.restore.dailyMinimum ?? 1500)} 计算。
          </p>
          <button type="button" className="button button--primary" onClick={() => setThresholdOpen(false)}>
            知道了
          </button>
        </div>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 2: 重写 `src/ui/pages/MealPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { todayKey } from '../../domain/dates';
import { upsertMealRecord, type MealStateV2 } from '../../domain/mealV2';
import { mealFixture, renderWithProviders } from '../../test/render';
import { MealPage } from './MealPage';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: todayKey() };

function makeState(spent: number): MealStateV2 {
  const state = mealFixture({ settings });
  return upsertMealRecord(state, todayKey(), spent, '', new Date().toISOString());
}

describe('MealPage v2', () => {
  it('saves today spending and shows happy state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealFixture({ settings }) });
    await user.type(screen.getByLabelText('今日实际花费'), '15');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText(/已记录 1 天/)).toBeInTheDocument();
    expect(screen.getByText('真棒！今天也攒下啦')).toBeInTheDocument();
  });

  it('shows unhappy state when balance is negative', () => {
    renderWithProviders(<MealPage />, { meal: makeState(3000) });
    expect(screen.getByText('有点超支了…')).toBeInTheDocument();
  });

  it('shows conservative state after crossing the free limit', () => {
    renderWithProviders(<MealPage />, { meal: makeState(17000) });
    expect(screen.getByText(/保底 ¥15.00/)).toBeInTheDocument();
    expect(screen.getByText(/没有多余的钱可以随意消费/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/ui/pages/MealPage.test.tsx`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/MealPage.tsx src/ui/pages/MealPage.test.tsx
git commit -m "feat: rebuild meal page with phases and mascot"
```

---

### Task 10: 补记页 v2

**Files:**
- Modify: `src/ui/pages/BackfillPage.tsx`
- Modify: `src/ui/pages/BackfillPage.test.tsx`

- [ ] **Step 1: 用以下内容替换 `src/ui/pages/BackfillPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { currentMealStatus, missingMealDates, upsertMealRecord } from '../../domain/mealV2';
import { parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MoneyInput } from '../components/MoneyInput';

function BackfillRow({ date, onSave }: { date: string; onSave: (date: string, spent: number, note: string) => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const cents = parseYuanToCents(amount);
    if (cents === null) {
      setError('请输入有效金额');
      return;
    }
    onSave(date, cents, note);
  };

  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(date)}</span>
      </div>
      <div className="backfill-row">
        <MoneyInput value={amount} onChange={setAmount} ariaLabel={`${date} 金额`} />
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} placeholder="备注" aria-label={`${date} 备注`} />
        <button type="button" className="button button--secondary" onClick={save} aria-label={`保存 ${date}`}>
          保存
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

export function BackfillPage() {
  const { state, saveRecord } = useMeal();
  const today = todayKey();
  const dates = [...missingMealDates(state, today)].reverse();
  const [pending, setPending] = useState<{ message: string; action: () => void } | null>(null);
  const groups = dates.reduce<Record<string, string[]>>((accumulator, date) => {
    const month = monthOf(date);
    (accumulator[month] ??= []).push(date);
    return accumulator;
  }, {});

  const saveWithGuard = (date: string, spent: number, note: string) => {
    const nextState = upsertMealRecord(state, date, spent, note, new Date().toISOString());
    const action = () => saveRecord(date, spent, note);
    if (currentMealStatus(nextState, today).mode !== currentMealStatus(state, today).mode) {
      setPending({ message: '补记会改变当前阶段，确认继续吗？', action });
    } else {
      action();
    }
  };

  return (
    <div className="page">
      <div className="page-nav">
        <Link className="text-button" to="/">‹ 返回餐补</Link>
      </div>
      <h1>补记</h1>
      {dates.length === 0 ? (
        <EmptyState title="没有需要补记的日期" hint="所有日子都记录好了。" />
      ) : (
        Object.entries(groups).map(([month, monthDates]) => (
          <section className="card" key={month}>
            <h2 className="card-title">{formatMonthLabel(month)}</h2>
            {monthDates.map((date) => (
              <BackfillRow key={date} date={date} onSave={saveWithGuard} />
            ))}
          </section>
        ))
      )}
      {pending && (
        <ConfirmDialog
          open
          title="确认补记"
          message={pending.message}
          confirmLabel="确认"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            pending.action();
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 重写 `src/ui/pages/BackfillPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../domain/dates';
import { MEAL_V2_STORAGE_KEY } from '../../storage/mealV2Storage';
import { mealFixture, renderWithProviders } from '../../test/render';
import { BackfillPage } from './BackfillPage';

describe('BackfillPage v2', () => {
  it('records a missing date', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const missingDate = addDays(today, -1);
    const meal = mealFixture({
      settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: missingDate },
    });
    renderWithProviders(<BackfillPage />, { meal });

    await user.type(screen.getByLabelText(`${missingDate} 金额`), '10');
    await user.click(screen.getByRole('button', { name: `保存 ${missingDate}` }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.records[missingDate].spent).toBe(1000);
    expect(screen.queryByLabelText(`${missingDate} 金额`)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/ui/pages/BackfillPage.test.tsx`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/BackfillPage.tsx src/ui/pages/BackfillPage.test.tsx
git commit -m "feat: update backfill page for meal v2"
```

### Task 11: 设置页 v2

**Files:**
- Modify: `src/ui/pages/SettingsPage.tsx`
- Modify: `src/ui/pages/SettingsPage.test.tsx`

- [ ] **Step 1: 用以下内容替换 `src/ui/pages/SettingsPage.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { currentMealStatus, deriveRates } from '../../domain/mealV2';
import { centsToYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MoneyInput } from '../components/MoneyInput';

export function SettingsPage() {
  const { state, updateSettings, restoreNow, clearRecords } = useMeal();
  const { clearAll } = usePlanning();
  const today = todayKey();
  const status = currentMealStatus(state, today);
  const rates = deriveRates(state.settings);

  const [budget, setBudget] = useState(centsToYuan(state.settings.monthlyBudget));
  const [minimum, setMinimum] = useState(centsToYuan(state.settings.monthlyMinimum));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clearMealOpen, setClearMealOpen] = useState(false);
  const [clearPlanOpen, setClearPlanOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const alreadyRestoredToday = state.restores.some((restore) => restore.date === today);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const budgetCents = parseYuanToCents(budget);
    const minimumCents = parseYuanToCents(minimum);
    if (budgetCents === null || minimumCents === null) {
      setError('请输入有效金额');
      setMessage('');
      return;
    }
    const result = updateSettings({
      monthlyBudget: budgetCents,
      monthlyMinimum: minimumCents,
      startDate: state.settings.startDate,
    });
    if (result) {
      setError(result);
      setMessage('');
      return;
    }
    setError('');
    setMessage('设置已保存，下次恢复时生效');
  };

  const manualRestore = () => {
    const result = restoreNow();
    if (result) {
      setError(result);
      setMessage('');
      return;
    }
    setError('');
    setMessage('已恢复 20 元额度');
  };

  return (
    <div className="page">
      <h1>设置</h1>

      <section className="card">
        <h2 className="card-title">餐补设置</h2>
        <form className="form" onSubmit={save}>
          <label className="field">
            <span>月度餐补预算</span>
            <MoneyInput value={budget} onChange={setBudget} ariaLabel="月度餐补预算" />
          </label>
          <label className="field">
            <span>月度保底</span>
            <MoneyInput value={minimum} onChange={setMinimum} ariaLabel="月度保底" />
          </label>
          <p className="muted">
            自由额度 {formatYuan(rates.freeAllowance)} · 日均 {formatYuan(rates.dailyNormal)} / {formatYuan(rates.dailyMinimum)}
          </p>
          <p className="muted">起始日期 {state.settings.startDate ? formatDisplayDate(state.settings.startDate) : '未设置'}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="positive">{message}</p>}
          <button className="button button--primary" type="submit">保存设置</button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">当前周期</h2>
        <div className="summary-grid">
          <div><span className="muted">开始日期</span><strong>{formatDisplayDate(status.startDate)}</strong></div>
          <div><span className="muted">开始额度</span><strong>{formatYuan(status.dailyNormal)}/天</strong></div>
          <div><span className="muted">当前阶段</span><strong>{status.switchDate ? '保底 15 元' : '正常 20 元'}</strong></div>
          <div><span className="muted">自由额度</span><strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong></div>
        </div>
        <button
          type="button"
          className="button button--secondary"
          disabled={alreadyRestoredToday}
          onClick={() => setRestoreOpen(true)}
        >
          {alreadyRestoredToday ? '今天已经恢复过' : '立即恢复 20 元额度'}
        </button>
        <p className="muted">恢复后：负数清零、正数带入；手动恢复每天最多一次。</p>
      </section>

      <section className="card">
        <h2 className="card-title">数据</h2>
        <p className="muted">数据只保存在本机浏览器中，清除浏览器数据会丢失记录。</p>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearMealOpen(true)}>
          清空餐补数据
        </button>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearPlanOpen(true)}>
          清空规划账数据
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">关于</h2>
        <p className="muted">小账本 v0.2.0 · PWA · 数据版本 v2</p>
      </section>

      {restoreOpen && (
        <ConfirmDialog
          open
          title="立即恢复 20 元额度？"
          message="负数将清零、正数将带入新周期；手动恢复每天最多一次。"
          confirmLabel="确认恢复"
          onCancel={() => setRestoreOpen(false)}
          onConfirm={() => {
            setRestoreOpen(false);
            manualRestore();
          }}
        />
      )}

      {clearMealOpen && (
        <ConfirmDialog
          open
          title="清空餐补数据？"
          message="将删除所有餐补记录与周期，并把起始日期重置为今天；预算和保底保留。"
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

- [ ] **Step 2: 重写 `src/ui/pages/SettingsPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../domain/dates';
import { MEAL_V2_STORAGE_KEY } from '../../storage/mealV2Storage';
import { mealFixture, renderWithProviders } from '../../test/render';
import { SettingsPage } from './SettingsPage';

describe('SettingsPage v2', () => {
  it('saves monthly budget and minimum', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, { meal: mealFixture() });
    const budget = screen.getByLabelText('月度餐补预算');
    const minimum = screen.getByLabelText('月度保底');
    await user.clear(budget);
    await user.type(budget, '750');
    await user.clear(minimum);
    await user.type(minimum, '450');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.settings.monthlyBudget).toBe(75000);
    expect(saved.settings.monthlyMinimum).toBe(45000);
    expect(screen.getByText('设置已保存，下次恢复时生效')).toBeInTheDocument();
  });

  it('manually restores and adds today restore', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = mealFixture({
      settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: addDays(today, -5) },
    });
    renderWithProviders(<SettingsPage />, { meal });
    await user.click(screen.getByRole('button', { name: '立即恢复 20 元额度' }));
    await user.click(screen.getByRole('button', { name: '确认恢复' }));

    const saved = JSON.parse(localStorage.getItem(MEAL_V2_STORAGE_KEY) ?? '{}');
    expect(saved.restores.some((restore: { date: string }) => restore.date === today)).toBe(true);
    expect(screen.getByText('已恢复 20 元额度')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/ui/pages/SettingsPage.test.tsx`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/SettingsPage.tsx src/ui/pages/SettingsPage.test.tsx
git commit -m "feat: update settings page for meal v2"
```

---

### Task 12: 统计页 v2

**Files:**
- Modify: `src/ui/pages/StatsPage.tsx`
- Modify: `src/ui/pages/StatsPage.test.tsx`

- [ ] **Step 1: 用以下内容替换 `src/ui/pages/StatsPage.tsx`**

```tsx
import { useState } from 'react';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { buildMealTimeline } from '../../domain/mealV2';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import { planningMonthlySeries } from '../../domain/stats';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { BarChart } from '../components/BarChart';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';

type Ledger = 'meal' | 'planning';

function shortDate(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8))}`;
}

export function StatsPage() {
  const { state: mealState } = useMeal();
  const { state: planningState } = usePlanning();
  const [ledger, setLedger] = useState<Ledger>('meal');
  const [count, setCount] = useState(6);
  const today = todayKey();
  const periods = buildMealTimeline(mealState, today);
  const displayPeriods = [...periods].reverse();
  const planningRows = planningMonthlySeries(planningState, today, count);
  const planningDisplay = [...planningRows].reverse();
  const mealHasData = periods.some((period) => period.days.length > 0);
  const planningHasData =
    planningState.spends.length + planningState.replenishes.length + planningState.inflows.length > 0;

  const chartData =
    ledger === 'meal'
      ? periods.map((period) => ({ label: shortDate(period.startDate), value: period.net }))
      : planningRows.map((row) => ({ label: row.month, value: row.net }));

  const hasData = ledger === 'meal' ? mealHasData : planningHasData;

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

      {!hasData ? (
        <EmptyState title="还没有数据" hint="记录几笔后，这里会显示统计。" />
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">{ledger === 'meal' ? '每期结余' : '每月净变化'}</h2>
            <BarChart data={chartData} color={ledger === 'meal' ? 'var(--meal-primary)' : 'var(--planning-primary)'} />
          </section>

          <section className="card table-wrap">
            {ledger === 'meal' ? (
              <div className="table table--stats">
                <div className="table__row table__head">
                  <span>周期</span><span>开始额度</span><span>15切换</span><span>花费</span><span>结束</span><span>结转</span>
                </div>
                {displayPeriods.map((period) => (
                  <div className="table__row" key={period.restore.id}>
                    <span>{formatDisplayDate(period.startDate)}–{formatDisplayDate(period.endDate)}</span>
                    <span>{formatYuan(period.restore.dailyNormal)}</span>
                    <span>{period.switchDate ? formatDisplayDate(period.switchDate) : '—'}</span>
                    <span>{formatYuan(period.totalSpent)}</span>
                    <span className={period.endingBalance >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(period.endingBalance)}</span>
                    <span>{period.carry > 0 ? formatYuan(period.carry) : '已清零'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table table--stats">
                <div className="table__row table__head">
                  <span>月份</span><span>支出</span><span>补回</span><span>汇入</span><span>净变化</span><span>余额</span>
                </div>
                {planningDisplay.map((row) => (
                  <div className="table__row" key={row.month}>
                    <span>{row.month}</span>
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

          {ledger === 'planning' && (
            <button type="button" className="button button--secondary" onClick={() => setCount((current) => current + 6)}>
              显示更早的月份
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 重写 `src/ui/pages/StatsPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from '../../domain/planning';
import { todayKey } from '../../domain/dates';
import { mealFixture, renderWithProviders } from '../../test/render';
import { StatsPage } from './StatsPage';

describe('StatsPage v2', () => {
  it('shows meal periods and switches to planning', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = mealFixture({
      records: { [today]: { spent: 1500, updatedAt: '2026-11-01T00:00:00.000Z' } },
    });
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState() });

    expect(screen.getByText('每期结余')).toBeInTheDocument();
    expect(screen.getByText('开始额度')).toBeInTheDocument();
    expect(screen.getByText(/–/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '规划账' }));
    expect(screen.getByText('还没有数据')).toBeInTheDocument();
  });

  it('shows empty state without records', () => {
    renderWithProviders(<StatsPage />, { meal: mealFixture(), planning: emptyPlanningState() });
    expect(screen.getByText('还没有数据')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/ui/pages/StatsPage.test.tsx`
Expected: PASS。第一条测试中规划账为空，切换到规划账后显示空状态；`getByRole('heading')` 对 EmptyState 的 `<p>` 不成立，改为 `getByText('还没有数据')`。执行时若失败按此修正。

- [ ] **Step 4: Commit**

```bash
git add src/ui/pages/StatsPage.tsx src/ui/pages/StatsPage.test.tsx
git commit -m "feat: switch meal stats to restore periods"
```

---

### Task 13: 测试工具、App 测试与版本号

**Files:**
- Modify: `src/test/render.tsx`
- Modify: `src/App.test.tsx`
- Modify: `package.json`

- [ ] **Step 1: 用以下内容替换 `src/test/render.tsx`**

```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import { createRestoreEvent } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';
import type { PlanningState } from '../domain/planning';
import { MealProvider } from '../state/MealStore';
import { PlanningProvider } from '../state/PlanningStore';
import { MEAL_V2_STORAGE_KEY } from '../storage/mealV2Storage';
import { PLANNING_STORAGE_KEY } from '../storage/planningStorage';

interface RenderOptions {
  route?: string;
  meal?: MealStateV2;
  planning?: PlanningState;
}

export function mealFixture(overrides: Partial<MealStateV2> = {}): MealStateV2 {
  const settings = overrides.settings ?? {
    monthlyBudget: 60000,
    monthlyMinimum: 45000,
    startDate: todayKey(),
  };
  const fallbackRestores = settings.startDate
    ? [createRestoreEvent(settings, settings.startDate, `${settings.startDate}T00:00:00`)]
    : [];
  return {
    settings,
    records: overrides.records ?? {},
    restores: overrides.restores ?? fallbackRestores,
  };
}

export function renderWithProviders(ui: ReactNode, options: RenderOptions = {}) {
  localStorage.clear();
  if (options.meal) localStorage.setItem(MEAL_V2_STORAGE_KEY, JSON.stringify(options.meal));
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

- [ ] **Step 2: 重写 `src/App.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyPlanningState } from './domain/planning';
import { mealFixture, renderWithProviders } from './test/render';
import App from './App';

describe('App', () => {
  it('shows onboarding when the meal start date is empty', () => {
    renderWithProviders(<App />, {
      meal: mealFixture({ settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '' } }),
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('button', { name: '开始记账' })).toBeInTheDocument();
  });

  it('renders the bottom navigation after onboarding', () => {
    renderWithProviders(<App />, {
      meal: mealFixture(),
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('link', { name: '餐补' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '规划账' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '设置' })).toBeInTheDocument();
  });

  it('renders the selected route and marks its tab active', () => {
    renderWithProviders(<App />, {
      route: '/stats',
      meal: mealFixture(),
      planning: emptyPlanningState(),
    });
    expect(screen.getByRole('heading', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '统计' })).toHaveClass('is-active');
  });
});
```

- [ ] **Step 3: 更新 `package.json` 版本**

将 `"version": "0.1.0"` 改为 `"version": "0.2.0"`。

Run: `npm install --package-lock-only`
Expected: `package-lock.json` 的 version 同步更新，不安装新依赖。

- [ ] **Step 4: 运行全量测试并修复旧测试引用**

Run: `npm run test:run`
Expected: 旧测试若仍引用 v1 `MealState`、`MEAL_STORAGE_KEY`、`dailyAllowance`，按错误提示更新为 v2/`mealFixture`/`MEAL_V2_STORAGE_KEY`。不要删除规划账测试。

- [ ] **Step 5: 构建**

Run: `npm run build`
Expected: 通过。

- [ ] **Step 6: Commit**

```bash
git add src/test/render.tsx src/App.test.tsx package.json package-lock.json
git commit -m "test: update fixtures and app tests for meal v2"
```

---

### Task 14: 最终验证

**Files:** 无新增；修复验证问题。

- [ ] **Step 1: 全量测试与构建**

Run: `npm run test:run`
Expected: 全部通过。

Run: `npm run build`
Expected: 通过，PWA 产物生成。

- [ ] **Step 2: 本地预览与视觉检查**

Run: `npm run preview -- --host`
在浏览器检查：引导页、餐补页三种状态、阈值弹窗、补记、设置手动恢复、统计周期表；对照 `.superpowers/brainstorm/3940-1793948660/content/blob-leaves.html` 的圆团子/盆栽状态。

- [ ] **Step 3: 迁移检查**

在 DevTools 中写入 v1 数据（`meal-allowance.v1`），清掉 v2，刷新；确认自动迁移、余额与周期正常。

- [ ] **Step 4: PWA 离线**

确认 Service Worker 接管后停止预览服务，刷新仍可打开。

- [ ] **Step 5: 提交修复**

```bash
git add -A
git commit -m "chore: finalize meal v2 iteration"
```

- [ ] **Step 6: 不推送部署**

实现完成后先让用户验收；部署需用户再次确认。

---

## 计划自检

- **规格覆盖**：设置/费率 → Task 1；阶段/阈值/余额 → Task 2；恢复/周期 → Task 3；迁移 → Task 4/5；状态层 → Task 6；视觉 → Task 7；页面 → Task 8-12；测试与版本 → Task 13；验收 → Task 14。
- **占位符**：无 TBD/TODO；部署步骤明确等待用户确认。
- **类型一致性**：`MealStateV2`、`RestoreEvent`、`MealPeriod`、`MealStatus` 在 Task 1/2 定义，后续任务一致使用；`saveRecord(date, spent, note)` 不再传 allowance；`restoreNow()` 返回错误字符串；`mealFixture` 被所有 UI 测试复用。
- **已知取舍**：自动补建恢复使用当前设置快照；日均按 30 天固定折算；v2 不再编辑起始日期；这些均与 spec 一致。



