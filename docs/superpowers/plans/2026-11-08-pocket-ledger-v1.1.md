# 小账本 v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付小账本 v1.1：餐补负值提醒与历史周期子页、补回账分区与汇入归档、独立用款计划（表格 + 时间轴）、统计指标切换，以及全站术语统一。

**Architecture:** 在现有 React + TypeScript + Capacitor 应用上增量开发。补回账的「待补回 / 已补回」和「本月汇入 / 汇入记录」全部由现有 `PlanningState` 派生，不改数据结构；用款计划使用独立的 `PlanState`、独立 localStorage key 和 `PlanProvider`，与补回账零耦合。新页面通过 React Router 子路由接入，底部导航不增加 tab。

**Tech Stack:** React 19、TypeScript、Vite 6、React Router 7、Capacitor 8、Vitest、Testing Library、jsdom。

**工作目录:** `C:/Users/20820/pocket-ledger`（Git Bash 路径 `~/pocket-ledger`）。所有命令默认在此目录执行，提交前先 `cd ~/pocket-ledger`。

**Spec:** `docs/superpowers/specs/2026-11-08-pocket-ledger-planning-design.md`

---

## 文件结构

新增：

| 文件 | 职责 |
|---|---|
| `src/domain/planItems.ts` | 计划条目类型、月度桶、范围汇总、排序、表单校验 |
| `src/storage/planItemsStorage.ts` | `planned-ledger.plan-items.v1` 的读写与校验 |
| `src/state/PlanStore.tsx` | 用款计划 React Context 与持久化 |
| `src/ui/components/EntryLink.tsx` | 带标题、说明、`›` 的入口卡 |
| `src/ui/components/PeriodCard.tsx` | 餐补周期卡片（从 MealPage 抽出） |
| `src/ui/components/InflowRow.tsx` | 汇入行（本月与历史共用） |
| `src/ui/components/PlanForm.tsx` | 用款计划新建/编辑表单 |
| `src/ui/pages/MealRecordsPage.tsx` | 历史周期子页 |
| `src/ui/pages/CompletedEventsPage.tsx` | 已补回子页 |
| `src/ui/pages/InflowsPage.tsx` | 汇入记录子页 |
| `src/ui/pages/PlansPage.tsx` | 用款计划子页 |

修改：`src/domain/dates.ts`、`src/domain/mealV2.ts`、`src/domain/planning.ts`、`src/storage/jsonStorage.ts`、`src/test/render.tsx`、`src/main.tsx`、`src/App.tsx`、`src/ui/styles.css`、`src/ui/pages/MealPage.tsx`、`PlanningPage.tsx`、`EventDetailPage.tsx`、`StatsPage.tsx`、`SettingsPage.tsx`、`Onboarding.tsx`、`BackfillPage.tsx`、`src/ui/components/EntrySheet.tsx`、`EventForm.tsx`，以及对应测试。

---

### Task 1: 日期缩写与负值提醒纯函数

**Files:**
- Modify: `src/domain/dates.ts`
- Modify: `src/domain/mealV2.ts`
- Test: `src/domain/dates.test.ts`
- Test: `src/domain/mealV2.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/domain/dates.test.ts` 的现有 import 中加入 `formatShortMonth`，并在 `describe('dates', ...)` 末尾追加：

```ts
  it('abbreviates months relative to the current year', () => {
    expect(formatShortMonth('2026-11', '2026-11-08')).toBe('11月');
    expect(formatShortMonth('2025-12', '2026-11-08')).toBe('2025年12月');
  });
```

在 `src/domain/mealV2.test.ts` 的 import 中加入 `formatMealDeficitHint`、`mealDeficitHint`、`type MealStatus`，并在文件末尾追加：

```ts
function deficitStatus(overrides: Partial<MealStatus> = {}): MealStatus {
  return {
    mode: 'normal',
    balance: 0,
    dailyAllowance: 2000,
    freeRemaining: 0,
    distanceToMinimum: 0,
    freeAllowance: 0,
    dailyNormal: 2000,
    dailyMinimum: 1500,
    startDate: '2026-11-01',
    endDate: '2026-11-08',
    hasRecordToday: false,
    ...overrides,
  };
}

describe('meal deficit hint', () => {
  it('does nothing for a non-negative balance', () => {
    expect(mealDeficitHint(deficitStatus({ balance: 0 }), '2026-11-02')).toEqual({ kind: 'none' });
    expect(formatMealDeficitHint({ kind: 'none' })).toBeNull();
  });

  it('includes today when today is not recorded', () => {
    const hint = mealDeficitHint(deficitStatus({ balance: -12000 }), '2026-11-02');
    expect(hint).toEqual({ kind: 'reduce', over: 12000, days: 7, perDayYuan: 18 });
    expect(formatMealDeficitHint(hint)).toBe('超支 ¥120.00，剩 7 天，每天额度至少需减少 ¥18.00');
  });

  it('starts from tomorrow when today is recorded', () => {
    const hint = mealDeficitHint(deficitStatus({ balance: -12000, hasRecordToday: true }), '2026-11-02');
    expect(hint).toEqual({ kind: 'reduce', over: 12000, days: 6, perDayYuan: 20 });
  });

  it('reports less than one yuan', () => {
    const hint = mealDeficitHint(deficitStatus({ balance: -50, endDate: '2026-11-04' }), '2026-11-02');
    expect(hint).toEqual({ kind: 'lessThanOne', over: 50, days: 3 });
    expect(formatMealDeficitHint(hint)).toBe('超支 ¥0.50，剩 3 天，每天额度平均需减少不足 1 元');
  });

  it('reports impossible when the daily reduction exceeds the allowance', () => {
    const hint = mealDeficitHint(deficitStatus({ balance: -25000, endDate: '2026-11-06' }), '2026-11-02');
    expect(hint).toEqual({ kind: 'impossible', over: 25000, remainingOver: 15000 });
    expect(formatMealDeficitHint(hint)).toBe('即使每天不花，本周期仍将超支 ¥150.00');
  });

  it('treats equality with the allowance as achievable', () => {
    const hint = mealDeficitHint(deficitStatus({ balance: -10000, endDate: '2026-11-06' }), '2026-11-02');
    expect(hint).toEqual({ kind: 'reduce', over: 10000, days: 5, perDayYuan: 20 });
  });

  it('reports the end of the cycle', () => {
    const hint = mealDeficitHint(
      deficitStatus({ balance: -100, endDate: '2026-11-02', hasRecordToday: true }),
      '2026-11-02',
    );
    expect(hint).toEqual({ kind: 'ended', over: 100 });
    expect(formatMealDeficitHint(hint)).toBe('本周期已结束，超支 ¥1.00 不会结转');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd ~/pocket-ledger
npx vitest run src/domain/dates.test.ts src/domain/mealV2.test.ts
```

预期：`formatShortMonth`、`mealDeficitHint`、`formatMealDeficitHint` 未导出，编译或导入失败。

- [ ] **Step 3: 实现日期缩写**

在 `src/domain/dates.ts` 的 `formatMonthLabel` 之后追加：

```ts
export function formatShortMonth(month: string, today: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return year === Number(today.slice(0, 4)) ? `${monthNumber}月` : `${year}年${monthNumber}月`;
}
```

- [ ] **Step 4: 实现提醒纯函数**

在 `src/domain/mealV2.ts` 顶部加入：

```ts
import { formatYuan } from './money';
```

在文件末尾追加：

```ts
export type MealDeficitHint =
  | { kind: 'none' }
  | { kind: 'ended'; over: number }
  | { kind: 'impossible'; over: number; remainingOver: number }
  | { kind: 'lessThanOne'; over: number; days: number }
  | { kind: 'reduce'; over: number; days: number; perDayYuan: number };

export function mealDeficitHint(status: MealStatus, today: string): MealDeficitHint {
  if (status.balance >= 0) return { kind: 'none' };
  const over = -status.balance;
  const start = status.hasRecordToday ? addDays(today, 1) : today;
  const days = status.endDate >= start ? listDates(start, status.endDate).length : 0;
  if (days === 0) return { kind: 'ended', over };
  const perDay = over / days;
  if (perDay > status.dailyAllowance) {
    return { kind: 'impossible', over, remainingOver: over - days * status.dailyAllowance };
  }
  if (perDay < 100) return { kind: 'lessThanOne', over, days };
  return { kind: 'reduce', over, days, perDayYuan: Math.ceil(perDay / 100) };
}

export function formatMealDeficitHint(hint: MealDeficitHint): string | null {
  switch (hint.kind) {
    case 'none':
      return null;
    case 'ended':
      return `本周期已结束，超支 ${formatYuan(hint.over)} 不会结转`;
    case 'impossible':
      return `即使每天不花，本周期仍将超支 ${formatYuan(hint.remainingOver)}`;
    case 'lessThanOne':
      return `超支 ${formatYuan(hint.over)}，剩 ${hint.days} 天，每天额度平均需减少不足 1 元`;
    case 'reduce':
      return `超支 ${formatYuan(hint.over)}，剩 ${hint.days} 天，每天额度至少需减少 ${formatYuan(hint.perDayYuan * 100)}`;
  }
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run src/domain/dates.test.ts src/domain/mealV2.test.ts
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/domain/dates.ts src/domain/dates.test.ts src/domain/mealV2.ts src/domain/mealV2.test.ts
git commit -m "feat: add deficit reminder helpers and short month labels"
```

---

### Task 2: 历史周期子页与餐补主页精简

**Files:**
- Create: `src/ui/components/EntryLink.tsx`
- Create: `src/ui/components/PeriodCard.tsx`
- Create: `src/ui/pages/MealRecordsPage.tsx`
- Modify: `src/ui/pages/MealPage.tsx`
- Modify: `src/ui/styles.css`
- Test: `src/ui/pages/MealPage.test.tsx`
- Test: `src/ui/pages/MealRecordsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

用下面的内容替换 `src/ui/pages/MealPage.test.tsx`：

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
  return upsertMealRecord(mealFixture({ settings }), todayKey(), spent, '', new Date().toISOString());
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

  it('replaces the sad message with a deficit reminder', () => {
    renderWithProviders(<MealPage />, { meal: makeState(3000) });
    expect(screen.queryByText('有点超支了…')).not.toBeInTheDocument();
    expect(screen.getByText(/超支 ¥10\.00|本周期已结束|即使每天不花/)).toBeInTheDocument();
  });

  it('shows the minimum phase copy after crossing the free limit', () => {
    renderWithProviders(<MealPage />, { meal: makeState(17000) });
    expect(screen.getByText(/保底 ¥\d+\.\d{2}\/天 · 无自由额度/)).toBeInTheDocument();
    expect(screen.getAllByText(/自由额度已用完|超支/).length).toBeGreaterThan(0);
  });

  it('uses configured daily rates in labels', () => {
    const customSettings = { monthlyBudget: 80000, monthlyMinimum: 45000, startDate: todayKey() };
    const state = upsertMealRecord(
      mealFixture({ settings: customSettings }),
      todayKey(),
      1000,
      '',
      new Date().toISOString(),
    );
    renderWithProviders(<MealPage />, { meal: state });
    expect(screen.getByText(/正常 ¥26\.67/)).toBeInTheDocument();
  });

  it('shows the threshold sheet after crossing on save', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealPage />, { meal: mealFixture() });
    await user.type(screen.getByLabelText('今日实际花费'), '170');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect((await screen.findAllByText('自由额度已用完')).length).toBeGreaterThan(0);
  });

  it('links to the history page', () => {
    renderWithProviders(<MealPage />, { meal: mealFixture({ settings }) });
    expect(screen.getByRole('link', { name: /历史周期/ })).toHaveAttribute('href', '/meal/records');
  });
});
```

创建 `src/ui/pages/MealRecordsPage.test.tsx`：

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { upsertMealRecord, type MealStateV2 } from '../../domain/mealV2';
import { mealFixture, renderWithProviders } from '../../test/render';
import { MealRecordsPage } from './MealRecordsPage';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: todayKey() };

function makeState(spent: number): MealStateV2 {
  return upsertMealRecord(mealFixture({ settings }), todayKey(), spent, '', new Date().toISOString());
}

describe('MealRecordsPage', () => {
  it('lists periods and returns to the meal page', () => {
    renderWithProviders(<MealRecordsPage />, { meal: makeState(1000), route: '/meal/records' });
    expect(screen.getByRole('heading', { name: '历史周期' })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(formatDisplayDate(todayKey()))).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '‹ 返回餐补' })).toHaveAttribute('href', '/');
  });

  it('edits a record from the history page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealRecordsPage />, { meal: makeState(1000), route: '/meal/records' });
    await user.click(screen.getByRole('button', { name: `编辑 ${formatDisplayDate(todayKey())}` }));
    const input = screen.getByLabelText('修改金额');
    await user.clear(input);
    await user.type(input, '20');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(await screen.findByText(/花费 ¥20\.00/)).toBeInTheDocument();
  });

  it('confirms before deleting a record', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MealRecordsPage />, { meal: makeState(1000), route: '/meal/records' });
    await user.click(screen.getByRole('button', { name: `删除 ${formatDisplayDate(todayKey())}` }));
    expect(screen.getByText('删除这条记录？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.queryByRole('button', { name: `删除 ${formatDisplayDate(todayKey())}` })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/MealPage.test.tsx src/ui/pages/MealRecordsPage.test.tsx
```

预期：`MealRecordsPage` 不存在、`EntryLink` 相关断言失败。

- [ ] **Step 3: 创建入口卡组件**

创建 `src/ui/components/EntryLink.tsx`：

```tsx
import { Link } from 'react-router-dom';

interface EntryLinkProps {
  to: string;
  title: string;
  detail?: string;
}

export function EntryLink({ to, title, detail }: EntryLinkProps) {
  return (
    <Link className="card entry-link" to={to}>
      <span className="entry-link__text">
        <strong>{title}</strong>
        {detail && <span className="muted">{detail}</span>}
      </span>
      <span className="entry-link__chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: 抽出周期卡片**

创建 `src/ui/components/PeriodCard.tsx`：

```tsx
import { formatDisplayDate } from '../../domain/dates';
import type { MealDay, MealPeriod } from '../../domain/mealV2';
import { formatSignedYuan, formatYuan } from '../../domain/money';

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
        {day.switchedToMinimum && <span className="badge badge--danger">自由额度已用完</span>}
      </div>
      <div className="list-row__amounts">
        <span>额度 {formatYuan(day.allowance)} · 花费 {formatYuan(day.spent)}</span>
        <span className={day.dailyBalance >= 0 ? 'positive' : 'negative'}>当日结余 {formatSignedYuan(day.dailyBalance)}</span>
        <span className="muted">累计结余 {formatYuan(day.balanceAfter)}</span>
      </div>
      <div className="list-row__actions">
        <button
          type="button"
          className="text-button"
          aria-label={`编辑 ${formatDisplayDate(day.date)}`}
          onClick={() => onEdit(day.date)}
        >
          编辑
        </button>
        <button
          type="button"
          className="text-button text-button--danger"
          aria-label={`删除 ${formatDisplayDate(day.date)}`}
          onClick={() => onDelete(day.date)}
        >
          删除
        </button>
      </div>
    </div>
  );
}

export function PeriodCard({
  period,
  onEdit,
  onDelete,
}: {
  period: MealPeriod;
  onEdit: (date: string) => void;
  onDelete: (date: string) => void;
}) {
  return (
    <div className="card">
      <div className="period-heading">
        <strong>
          {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}
        </strong>
        <div>
          {period.switchDate && (
            <span className="mode-badge mode-badge--minimum">保底 {formatYuan(period.restore.dailyMinimum)}</span>
          )}
          <span className="mode-badge">{formatYuan(period.restore.dailyNormal)}/天</span>
        </div>
      </div>
      <div className="period-meta">
        花费 {formatYuan(period.totalSpent)} · 期末余额 {formatYuan(period.endingBalance)} · 结转{' '}
        {period.carry > 0 ? formatYuan(period.carry) : '已清零'}
      </div>
      {period.days.length === 0 ? (
        <p className="muted">这个周期还没有记录。</p>
      ) : (
        [...period.days].reverse().map((day) => (
          <RecordRow key={day.date} day={day} onEdit={onEdit} onDelete={onDelete} />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 5: 创建历史周期子页**

创建 `src/ui/pages/MealRecordsPage.tsx`：

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { buildMealTimeline, currentMealStatus, removeMealRecord, upsertMealRecord } from '../../domain/mealV2';
import { centsToYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MoneyInput } from '../components/MoneyInput';
import { PeriodCard } from '../components/PeriodCard';
import { Sheet } from '../components/Sheet';

export function MealRecordsPage() {
  const { state, saveRecord, deleteRecord } = useMeal();
  const today = todayKey();
  const status = currentMealStatus(state, today);
  const periods = [...buildMealTimeline(state, today)].filter((period) => period.startDate <= today).reverse();

  const [editing, setEditing] = useState<{ date: string; spent: string; note: string; error: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('删除这条记录？');
  const [confirmMessage, setConfirmMessage] = useState('');

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
      setConfirmTitle('确认修改？');
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
    setConfirmTitle('删除这条记录？');
    setConfirmMessage(nextMode !== status.mode ? '删除会改变当前阶段，仍要删除吗？' : '删除后余额和阶段会重新计算。');
    setPendingAction(() => () => {
      deleteRecord(date);
    });
  };

  return (
    <div className="page">
      <Link className="text-button" to="/">
        ‹ 返回餐补
      </Link>
      <h1>历史周期</h1>
      {periods.length === 0 ? (
        <EmptyState title="还没有周期记录" />
      ) : (
        periods.map((period) => (
          <PeriodCard key={period.restore.id} period={period} onEdit={openEdit} onDelete={requestDelete} />
        ))
      )}

      {editing && (
        <Sheet open title="修改记录" onClose={() => setEditing(null)}>
          <form className="form" onSubmit={submitEdit}>
            <label className="field">
              <span>{formatDisplayDate(editing.date)} 花费</span>
              <MoneyInput
                value={editing.spent}
                onChange={(value) => setEditing({ ...editing, spent: value, error: '' })}
                ariaLabel="修改金额"
              />
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
            {editing.error && (
              <p className="form-error" role="alert">
                {editing.error}
              </p>
            )}
            <button className="button button--primary" type="submit">
              保存修改
            </button>
          </form>
        </Sheet>
      )}

      {pendingAction && (
        <ConfirmDialog
          open
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel="确认"
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            pendingAction();
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: 重写餐补主页**

用下面的内容替换 `src/ui/pages/MealPage.tsx`：

```tsx
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import {
  buildMealTimeline,
  currentMealStatus,
  formatMealDeficitHint,
  mealDeficitHint,
  missingMealDates,
} from '../../domain/mealV2';
import { centsToYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { BeanMascot } from '../components/BeanMascot';
import type { MascotState } from '../components/BeanMascot';
import { EntryLink } from '../components/EntryLink';
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--primary" type="submit">
        保存
      </button>
    </form>
  );
}

export function MealPage() {
  const { state, saveRecord } = useMeal();
  const today = todayKey();
  const status = currentMealStatus(state, today);
  const timeline = buildMealTimeline(state, today);
  const periods = [...timeline].filter((period) => period.startDate <= today).reverse();
  const missing = missingMealDates(state, today);
  const todayRecord = state.records[today];
  const recordedDays = timeline.reduce((total, period) => total + period.days.length, 0);
  const deficitMessage = formatMealDeficitHint(mealDeficitHint(status, today));

  const previousMode = useRef(status.mode);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  useEffect(() => {
    if (previousMode.current === 'normal' && status.mode === 'minimum') {
      setThresholdOpen(true);
    }
    previousMode.current = status.mode;
  }, [status.mode]);

  const mascotState: MascotState = status.mode === 'minimum' ? 'worried' : status.balance < 0 ? 'sad' : 'happy';
  const cardTone = status.mode === 'minimum' ? 'minimum' : status.balance < 0 ? 'sad' : 'happy';

  return (
    <div className="page">
      <section className={`balance-card balance-card--${cardTone}`}>
        <div className="balance-card__body">
          <div className="balance-card__text">
            <span className="balance-card__label">当前结余</span>
            <strong className={`balance-card__amount${status.balance < 0 ? ' is-negative' : ''}`}>
              {formatYuan(status.balance)}
            </strong>
            <span className="status-pill">
              {status.mode === 'minimum'
                ? `保底 ${formatYuan(status.dailyMinimum)}/天 · 无自由额度`
                : `正常 ${formatYuan(status.dailyNormal)}/天 · 距保底 ${formatYuan(status.distanceToMinimum)}`}
            </span>
            <div className="balance-card__meta">
              已记录 {recordedDays} 天 · {formatDisplayDate(status.startDate)} 起
            </div>
            <p className="balance-card__message">
              {deficitMessage ?? (status.mode === 'minimum' ? '自由额度已用完' : '真棒！今天也攒下啦')}
            </p>
          </div>
          <div className="balance-card__mascot">
            <BeanMascot state={mascotState} />
          </div>
        </div>
        {status.mode === 'normal' ? (
          <div className="free-quota">
            <div className="free-quota__label">
              <span>自由额度剩余</span>
              <span>
                {formatYuan(status.freeRemaining)} / {formatYuan(status.freeAllowance)}
              </span>
            </div>
            <div
              className="free-quota__track"
              role="progressbar"
              aria-label="自由额度剩余"
              aria-valuemin={0}
              aria-valuemax={status.freeAllowance}
              aria-valuenow={status.freeRemaining}
            >
              <div
                className="free-quota__fill"
                style={{
                  width: `${Math.min(100, Math.max(0, (status.freeRemaining / status.freeAllowance) * 100))}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <p className="balance-card__note">
            自由额度已用完，接下来每天按保底额度 {formatYuan(status.dailyMinimum)} 计算。
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">
          今天 {formatDisplayDate(today)} · 额度 {formatYuan(status.dailyAllowance)}
        </h2>
        <TodayForm
          key={todayRecord?.updatedAt ?? 'empty'}
          record={todayRecord}
          onSave={(spent, note) => saveRecord(today, spent, note)}
        />
        {todayRecord && <p className="muted">今日已记录，花费 {formatYuan(todayRecord.spent)}</p>}
      </section>

      {missing.length > 0 && (
        <Link className="banner banner--warning" to="/meal/backfill">
          ⚠ 还有 {missing.length} 天未记录，去补记 ›
        </Link>
      )}

      <section className="card summary-grid">
        <div>
          <span className="muted">本周期花费</span>
          <strong>{formatYuan(timeline[timeline.length - 1]?.totalSpent ?? 0)}</strong>
        </div>
        <div>
          <span className="muted">本周期总额度</span>
          <strong>{formatYuan(timeline[timeline.length - 1]?.totalAllowance ?? 0)}</strong>
        </div>
        <div>
          <span className="muted">当前阶段</span>
          <strong>
            {status.switchDate
              ? `保底阶段 ${formatYuan(status.dailyMinimum)}/天`
              : `正常阶段 ${formatYuan(status.dailyNormal)}/天`}
          </strong>
        </div>
        <div>
          <span className="muted">自由额度</span>
          <strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong>
        </div>
      </section>

      <EntryLink
        to="/meal/records"
        title="历史周期"
        detail={
          periods.length > 0
            ? `${periods.length} 个周期 · 最近 ${formatDisplayDate(periods[0].startDate)}–${formatDisplayDate(periods[0].endDate)}`
            : '还没有周期记录'
        }
      />

      <Sheet open={thresholdOpen} title="自由额度已用完" onClose={() => setThresholdOpen(false)}>
        <div className="threshold-message">
          <BeanMascot state="sad" className="mascot--sm" />
          <p>自由额度已用完，接下来每天按保底额度 {formatYuan(status.dailyMinimum)} 计算。</p>
          <button type="button" className="button button--primary" onClick={() => setThresholdOpen(false)}>
            知道了
          </button>
        </div>
      </Sheet>
    </div>
  );
}
```

注意：缺失记录提示保持原有的 `banner banner--warning`，不要改成入口卡，保留警示优先级。

- [ ] **Step 7: 加入入口卡样式**

在 `src/ui/styles.css` 末尾追加：

```css
.entry-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}

.entry-link__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.entry-link__chevron {
  color: var(--muted);
  font-size: calc(20px * var(--font-scale, 1));
  line-height: 1;
}
```

- [ ] **Step 8: 运行测试，确认通过**

```bash
npx vitest run src/ui/pages/MealPage.test.tsx src/ui/pages/MealRecordsPage.test.tsx
```

预期：全部 PASS。

- [ ] **Step 9: 提交**

```bash
git add src/ui/components/EntryLink.tsx src/ui/components/PeriodCard.tsx src/ui/pages/MealRecordsPage.tsx src/ui/pages/MealPage.tsx src/ui/pages/MealPage.test.tsx src/ui/pages/MealRecordsPage.test.tsx src/ui/styles.css
git commit -m "feat: move meal period history to a subpage and add deficit hints"
```

---

### Task 3: 补回账分区与汇入拆分纯函数

**Files:**
- Modify: `src/domain/planning.ts`
- Test: `src/domain/planning.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/domain/planning.test.ts` 的 import 中加入：

```ts
  completedEventGroups,
  firstSpendMonth,
  isEventCompleted,
  partitionEvents,
  partitionInflows,
```

在文件末尾追加：

```ts
describe('event partitions', () => {
  const orderState: PlanningState = {
    events: [
      { id: 'sep', name: '九月事项', replenishPlan: [], createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'nov', name: '十一月事项', replenishPlan: [], createdAt: '2026-11-01T00:00:00.000Z' },
      { id: 'idle', name: '未支出事项', replenishPlan: [], createdAt: '2026-10-01T00:00:00.000Z' },
    ],
    spends: [
      { id: 'sa', eventId: 'sep', date: '2026-09-05', amount: 100, createdAt },
      { id: 'sb', eventId: 'nov', date: '2026-11-05', amount: 100, createdAt },
    ],
    replenishes: [],
    inflows: [],
  };

  it('finds the first spend month', () => {
    expect(firstSpendMonth(state, 'e1')).toBe('2026-11');
    expect(firstSpendMonth(state, 'missing')).toBeUndefined();
  });

  it('completes only after spending and replenishing', () => {
    expect(isEventCompleted(state, 'e1')).toBe(false);
    expect(isEventCompleted(state, 'e2')).toBe(false);
  });

  it('sorts ongoing by spend month descending, then unspent last', () => {
    expect(partitionEvents(orderState).ongoing.map((event) => event.id)).toEqual(['nov', 'sep', 'idle']);
  });

  it('groups completed events by first spend month', () => {
    const completedState: PlanningState = {
      events: [
        { id: 'c1', name: '九月补完', replenishPlan: [], createdAt: '2026-09-01T00:00:00.000Z' },
        { id: 'c2', name: '十月多补', replenishPlan: [], createdAt: '2026-10-01T00:00:00.000Z' },
      ],
      spends: [
        { id: 'cs1', eventId: 'c1', date: '2026-09-03', amount: 100000, createdAt },
        { id: 'cs2', eventId: 'c2', date: '2026-10-03', amount: 50000, createdAt },
      ],
      replenishes: [
        { id: 'cr1', eventId: 'c1', date: '2026-11-05', amount: 100000, createdAt },
        { id: 'cr2', eventId: 'c2', date: '2026-11-06', amount: 60000, createdAt },
      ],
      inflows: [],
    };
    expect(isEventCompleted(completedState, 'c1')).toBe(true);
    expect(isEventCompleted(completedState, 'c2')).toBe(true);
    const groups = completedEventGroups(completedState);
    expect(groups.map((group) => group.month)).toEqual(['2026-10', '2026-09']);
    expect(groups[0]).toMatchObject({ spends: 50000, replenishes: 60000 });
    expect(groups[0].events.map((event) => event.id)).toEqual(['c2']);
  });
});

describe('inflow partitions', () => {
  it('keeps the current natural month separate from archived inflows', () => {
    const inflowState: PlanningState = {
      events: [],
      spends: [],
      replenishes: [],
      inflows: [
        { id: 'i1', date: '2026-11-02', amount: 100, createdAt },
        { id: 'i2', date: '2026-10-15', amount: 200, createdAt },
        { id: 'i3', date: '2026-12-01', amount: 300, createdAt },
      ],
    };
    const result = partitionInflows(inflowState, '2026-11-08');
    expect(result.currentMonth.map((entry) => entry.id)).toEqual(['i1']);
    expect(result.archived.map((entry) => entry.id)).toEqual(['i3', 'i2']);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/domain/planning.test.ts
```

预期：新增函数未导出。

- [ ] **Step 3: 实现派生函数**

在 `src/domain/planning.ts` 末尾追加：

```ts
export function firstSpendMonth(state: PlanningState, eventId: string): string | undefined {
  const spends = state.spends.filter((entry) => entry.eventId === eventId);
  if (spends.length === 0) return undefined;
  const earliest = spends.reduce((min, entry) => (entry.date < min ? entry.date : min), spends[0].date);
  return monthOf(earliest);
}

export function isEventCompleted(state: PlanningState, eventId: string): boolean {
  const progress = eventProgress(state, eventId);
  return progress.spent > 0 && progress.replenished >= progress.spent;
}

export interface EventPartition {
  ongoing: PlanningEvent[];
  completed: PlanningEvent[];
}

export function partitionEvents(state: PlanningState): EventPartition {
  const ongoing: PlanningEvent[] = [];
  const completed: PlanningEvent[] = [];

  for (const event of state.events) {
    if (isEventCompleted(state, event.id)) {
      completed.push(event);
    } else {
      ongoing.push(event);
    }
  }

  ongoing.sort((a, b) => {
    const monthA = firstSpendMonth(state, a.id);
    const monthB = firstSpendMonth(state, b.id);
    if (!monthA && !monthB) return b.createdAt.localeCompare(a.createdAt);
    if (!monthA) return 1;
    if (!monthB) return -1;
    return monthA === monthB ? b.createdAt.localeCompare(a.createdAt) : monthB.localeCompare(monthA);
  });

  return { ongoing, completed };
}

export interface CompletedEventGroup {
  month: string;
  events: PlanningEvent[];
  spends: number;
  replenishes: number;
}

function lastReplenishDate(state: PlanningState, eventId: string): string {
  const dates = state.replenishes
    .filter((entry) => entry.eventId === eventId)
    .map((entry) => entry.date)
    .sort();
  return dates[dates.length - 1] ?? '';
}

export function completedEventGroups(state: PlanningState): CompletedEventGroup[] {
  const { completed } = partitionEvents(state);
  const byMonth = new Map<string, PlanningEvent[]>();

  for (const event of completed) {
    const month = firstSpendMonth(state, event.id);
    if (!month) continue;
    const group = byMonth.get(month);
    if (group) group.push(event);
    else byMonth.set(month, [event]);
  }

  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, events]) => {
      const sorted = [...events].sort((a, b) => {
        const byDate = lastReplenishDate(state, b.id).localeCompare(lastReplenishDate(state, a.id));
        return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
      });
      return {
        month,
        events: sorted,
        spends: sorted.reduce((total, event) => total + eventProgress(state, event.id).spent, 0),
        replenishes: sorted.reduce((total, event) => total + eventProgress(state, event.id).replenished, 0),
      };
    });
}

export function partitionInflows(
  state: PlanningState,
  today: string,
): { currentMonth: InflowEntry[]; archived: InflowEntry[] } {
  const current = monthOf(today);
  const sortDesc = (entries: InflowEntry[]) =>
    [...entries].sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    );
  return {
    currentMonth: sortDesc(state.inflows.filter((entry) => monthOf(entry.date) === current)),
    archived: sortDesc(state.inflows.filter((entry) => monthOf(entry.date) !== current)),
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/domain/planning.test.ts
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/domain/planning.ts src/domain/planning.test.ts
git commit -m "feat: derive ongoing/completed events and monthly inflow splits"
```

### Task 4: 补回账主页分区与本月汇入

**Files:**
- Create: `src/ui/components/InflowRow.tsx`
- Modify: `src/ui/pages/PlanningPage.tsx`
- Test: `src/ui/pages/PlanningPage.test.tsx`

- [ ] **Step 1: 写失败测试**

用下面的内容替换 `src/ui/pages/PlanningPage.test.tsx`：

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatShortMonth, todayKey } from '../../domain/dates';
import { emptyPlanningState, type PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { PlanningPage } from './PlanningPage';

const createdAt = '2026-11-01T00:00:00.000Z';

function completedFixture(): PlanningState {
  return {
    events: [{ id: 'e1', name: '已补完', replenishPlan: [], createdAt }],
    spends: [{ id: 's1', eventId: 'e1', date: '2026-11-02', amount: 100000, createdAt }],
    replenishes: [{ id: 'r1', eventId: 'e1', date: '2026-11-03', amount: 100000, createdAt }],
    inflows: [],
  };
}

describe('PlanningPage', () => {
  it('creates an event and records a spend linked to it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '新建事项' }));
    await user.type(screen.getByLabelText('事项名称'), '买电脑');
    await user.click(screen.getByRole('button', { name: '创建事项' }));
    expect(await screen.findByText('买电脑')).toBeInTheDocument();
    expect(screen.getByText('未支出')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '记一笔' }));
    await user.type(screen.getByLabelText('金额'), '3000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('待补回 ¥3000.00')).toBeInTheDocument();
  });

  it('does not mark a new event as completed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '新建事项' }));
    await user.type(screen.getByLabelText('事项名称'), '新计划');
    await user.click(screen.getByRole('button', { name: '创建事项' }));

    expect(await screen.findByText('新计划')).toBeInTheDocument();
    expect(screen.queryByText('已补回')).not.toBeInTheDocument();
  });

  it('records and deletes a current-month inflow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });

    await user.click(screen.getByRole('button', { name: '记一笔' }));
    await user.click(screen.getByRole('tab', { name: '汇入' }));
    await user.type(screen.getByLabelText('金额'), '500');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect((await screen.findAllByText('+¥500.00')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByText('删除这笔汇入？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.queryByText('+¥500.00')).not.toBeInTheDocument();
  });

  it('moves completed events behind the 已补回 entry link', () => {
    renderWithProviders(<PlanningPage />, { planning: completedFixture() });
    const link = screen.getByRole('link', { name: /已补回/ });
    expect(link).toHaveAttribute('href', '/planning/completed');
    expect(link).toHaveTextContent('1 个');
    expect(screen.queryByText('已补完')).not.toBeInTheDocument();
  });

  it('shows the first spend month badge', () => {
    const planning: PlanningState = {
      events: [{ id: 'e2', name: '九月事项', replenishPlan: [], createdAt }],
      spends: [{ id: 's2', eventId: 'e2', date: '2026-09-03', amount: 100000, createdAt }],
      replenishes: [],
      inflows: [],
    };
    renderWithProviders(<PlanningPage />, { planning });
    expect(screen.getByText(formatShortMonth('2026-09', todayKey()))).toBeInTheDocument();
  });

  it('links to the plans page', () => {
    renderWithProviders(<PlanningPage />, { planning: emptyPlanningState() });
    expect(screen.getByRole('link', { name: /用款计划/ })).toHaveAttribute('href', '/planning/plans');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/PlanningPage.test.tsx
```

预期：`待补回`、入口卡、分区文案等断言失败。

- [ ] **Step 3: 创建汇入行组件**

创建 `src/ui/components/InflowRow.tsx`：

```tsx
import { formatDisplayDate } from '../../domain/dates';
import { formatYuan } from '../../domain/money';
import type { InflowEntry } from '../../domain/planning';

interface InflowRowProps {
  entry: InflowEntry;
  onEdit: () => void;
  onDelete: () => void;
}

export function InflowRow({ entry, onEdit, onDelete }: InflowRowProps) {
  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(entry.date)}</span>
        {entry.note && <span className="list-row__note">{entry.note}</span>}
      </div>
      <div className="list-row__amounts">
        <span className="positive">+{formatYuan(entry.amount)}</span>
      </div>
      <div className="list-row__actions">
        <button type="button" className="text-button" onClick={onEdit}>
          编辑
        </button>
        <button type="button" className="text-button text-button--danger" onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 重写补回账主页**

用下面的内容替换 `src/ui/pages/PlanningPage.tsx`：

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatShortMonth, monthOf, todayKey } from '../../domain/dates';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import {
  computePlanningBalance,
  eventProgress,
  firstSpendMonth,
  partitionEvents,
  partitionInflows,
  planningMonthSummary,
} from '../../domain/planning';
import type { InflowEntry } from '../../domain/planning';
import { usePlanning } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { EntryLink } from '../components/EntryLink';
import { EntrySheet } from '../components/EntrySheet';
import type { EntryDraft } from '../components/EntrySheet';
import { EventForm } from '../components/EventForm';
import type { EventDraft } from '../components/EventForm';
import { InflowRow } from '../components/InflowRow';
import { ProgressBar } from '../components/ProgressBar';
import { Sheet } from '../components/Sheet';

export function PlanningPage() {
  const { state, addEvent, addEntry, updateEntry, deleteEntry } = usePlanning();
  const today = todayKey();
  const balance = computePlanningBalance(state);
  const summary = planningMonthSummary(state, monthOf(today), today);
  const { ongoing, completed } = partitionEvents(state);
  const { currentMonth: currentInflows, archived } = partitionInflows(state, today);
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
        <span className="balance-card__label">补回账余额</span>
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
          <span className="muted">本月净变化</span>
          <strong className={summary.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(summary.net)}</strong>
        </div>
      </section>

      <div className="action-row">
        <button type="button" className="button button--planning" onClick={() => setEntryOpen(true)}>
          记一笔
        </button>
        <button type="button" className="button button--secondary" onClick={() => setEventOpen(true)}>
          新建事项
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>待补回</h2>
          <span className="muted">{ongoing.length} 个</span>
        </div>
        {ongoing.length === 0 ? (
          <EmptyState title="还没有待补回事项" hint="新建一个事项，记录支出和补回的过程。" />
        ) : (
          ongoing.map((event) => {
            const progress = eventProgress(state, event.id);
            const month = firstSpendMonth(state, event.id);
            const percent = progress.spent > 0 ? (progress.replenished / progress.spent) * 100 : 0;
            return (
              <Link to={`/planning/events/${event.id}`} className="card event-card" key={event.id}>
                <div className="event-card__head">
                  <strong>{event.name}</strong>
                  <span className="badge">{month ? formatShortMonth(month, today) : '未支出'}</span>
                  {progress.outstanding > 0 && <span className="badge">待补回 {formatYuan(progress.outstanding)}</span>}
                  {progress.outstanding < 0 && (
                    <span className="badge badge--success">多补回 {formatYuan(-progress.outstanding)}</span>
                  )}
                </div>
                <ProgressBar value={percent} tone="indigo" />
                <div className="event-card__meta muted">
                  已支出 {formatYuan(progress.spent)} · 已补回 {formatYuan(progress.replenished)}
                </div>
              </Link>
            );
          })
        )}
      </section>

      {completed.length > 0 && (
        <EntryLink to="/planning/completed" title="已补回" detail={`${completed.length} 个`} />
      )}

      <section className="section">
        <div className="section-head">
          <h2>本月汇入</h2>
          <span className="muted">{currentInflows.length} 笔</span>
        </div>
        {currentInflows.length === 0 ? (
          <EmptyState title="本月还没有汇入" hint="工资、红包等额外资金可以记在这里。" />
        ) : (
          <div className="card list">
            {currentInflows.map((entry) => (
              <InflowRow
                key={entry.id}
                entry={entry}
                onEdit={() => setEditingInflow(entry)}
                onDelete={() => setDeletingInflow(entry)}
              />
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <EntryLink to="/planning/inflows" title="汇入记录" detail={`${archived.length} 笔`} />
      )}

      <EntryLink to="/planning/plans" title="用款计划" detail="未来几个月的支出与回补安排" />

      {entryOpen && <EntrySheet mode="create" events={state.events} onClose={() => setEntryOpen(false)} onSubmit={submitEntry} />}

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
          events={state.events}
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
          message="删除后补回账余额会重新计算。"
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

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run src/ui/pages/PlanningPage.test.tsx
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/ui/components/InflowRow.tsx src/ui/pages/PlanningPage.tsx src/ui/pages/PlanningPage.test.tsx
git commit -m "feat: split the planning ledger into ongoing, completed and inflow sections"
```

---

### Task 5: 已补回子页

**Files:**
- Create: `src/ui/pages/CompletedEventsPage.tsx`
- Test: `src/ui/pages/CompletedEventsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/pages/CompletedEventsPage.test.tsx`：

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatMonthLabel } from '../../domain/dates';
import { emptyPlanningState, type PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { CompletedEventsPage } from './CompletedEventsPage';

const createdAt = '2026-11-01T00:00:00.000Z';

const completed: PlanningState = {
  events: [{ id: 'e1', name: '已补完', replenishPlan: [], createdAt }],
  spends: [{ id: 's1', eventId: 'e1', date: '2026-09-03', amount: 100000, createdAt }],
  replenishes: [{ id: 'r1', eventId: 'e1', date: '2026-11-05', amount: 100000, createdAt }],
  inflows: [],
};

describe('CompletedEventsPage', () => {
  it('groups completed events by first spend month', () => {
    renderWithProviders(<CompletedEventsPage />, { planning: completed, route: '/planning/completed' });
    expect(screen.getByRole('heading', { name: '已补回' })).toBeInTheDocument();
    expect(screen.getByText(formatMonthLabel('2026-09'))).toBeInTheDocument();
    expect(screen.getByText('已补完')).toBeInTheDocument();
    expect(screen.getAllByText('已补回').length).toBeGreaterThan(0);
    expect(screen.getByText(/支出 ¥1000\.00 · 补回 ¥1000\.00 · 1 个/)).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderWithProviders(<CompletedEventsPage />, {
      planning: emptyPlanningState(),
      route: '/planning/completed',
    });
    expect(screen.getByText('还没有已补回的事项')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/CompletedEventsPage.test.tsx
```

预期：页面文件不存在，导入失败。

- [ ] **Step 3: 实现页面**

创建 `src/ui/pages/CompletedEventsPage.tsx`：

```tsx
import { Link } from 'react-router-dom';
import { formatMonthLabel, formatShortMonth, todayKey } from '../../domain/dates';
import { formatYuan } from '../../domain/money';
import { completedEventGroups, eventProgress } from '../../domain/planning';
import { usePlanning } from '../../state/PlanningStore';
import { EmptyState } from '../components/EmptyState';
import { ProgressBar } from '../components/ProgressBar';

export function CompletedEventsPage() {
  const { state } = usePlanning();
  const today = todayKey();
  const groups = completedEventGroups(state);

  return (
    <div className="page">
      <Link className="text-button" to="/planning">
        ‹ 返回补回账
      </Link>
      <h1>已补回</h1>
      {groups.length === 0 ? (
        <EmptyState title="还没有已补回的事项" />
      ) : (
        groups.map((group) => (
          <section className="section" key={group.month}>
            <div className="section-head">
              <h2>{formatMonthLabel(group.month)}</h2>
              <span className="muted">
                支出 {formatYuan(group.spends)} · 补回 {formatYuan(group.replenishes)} · {group.events.length} 个
              </span>
            </div>
            {group.events.map((event) => {
              const progress = eventProgress(state, event.id);
              return (
                <Link to={`/planning/events/${event.id}`} className="card event-card" key={event.id}>
                  <div className="event-card__head">
                    <strong>{event.name}</strong>
                    <span className="badge badge--success">已补回</span>
                    <span className="badge">{formatShortMonth(group.month, today)}</span>
                  </div>
                  <ProgressBar value={100} tone="indigo" />
                  <div className="event-card__meta muted">
                    已支出 {formatYuan(progress.spent)} · 已补回 {formatYuan(progress.replenished)}
                  </div>
                </Link>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/ui/pages/CompletedEventsPage.test.tsx
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/pages/CompletedEventsPage.tsx src/ui/pages/CompletedEventsPage.test.tsx
git commit -m "feat: add the completed events page grouped by spend month"
```

---

### Task 6: 汇入记录子页

**Files:**
- Create: `src/ui/pages/InflowsPage.tsx`
- Test: `src/ui/pages/InflowsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/pages/InflowsPage.test.tsx`：

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addMonths, formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { emptyPlanningState, type PlanningState } from '../../domain/planning';
import { renderWithProviders } from '../../test/render';
import { InflowsPage } from './InflowsPage';

const createdAt = '2026-11-01T00:00:00.000Z';

function archivedFixture(): { state: PlanningState; month: string } {
  const month = addMonths(monthOf(todayKey()), -1);
  return {
    month,
    state: {
      ...emptyPlanningState(),
      inflows: [{ id: 'i1', date: `${month}-15`, amount: 50000, note: '上月红包', createdAt }],
    },
  };
}

describe('InflowsPage', () => {
  it('lists archived inflows by month', () => {
    const { state, month } = archivedFixture();
    renderWithProviders(<InflowsPage />, { planning: state, route: '/planning/inflows' });
    expect(screen.getByRole('heading', { name: '汇入记录' })).toBeInTheDocument();
    expect(screen.getByText(formatMonthLabel(month))).toBeInTheDocument();
    expect(screen.getByText('上月红包')).toBeInTheDocument();
    expect(screen.getByText('+¥500.00')).toBeInTheDocument();
  });

  it('edits an archived inflow', async () => {
    const user = userEvent.setup();
    const { state } = archivedFixture();
    renderWithProviders(<InflowsPage />, { planning: state, route: '/planning/inflows' });
    await user.click(screen.getByRole('button', { name: '编辑' }));
    const amount = screen.getByLabelText('金额');
    await user.clear(amount);
    await user.type(amount, '600');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('+¥600.00')).toBeInTheDocument();
  });

  it('deletes an archived inflow after confirmation', async () => {
    const user = userEvent.setup();
    const { state } = archivedFixture();
    renderWithProviders(<InflowsPage />, { planning: state, route: '/planning/inflows' });
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByText('删除这笔汇入？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(screen.getByText('还没有历史汇入')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderWithProviders(<InflowsPage />, { planning: emptyPlanningState(), route: '/planning/inflows' });
    expect(screen.getByText('还没有历史汇入')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/InflowsPage.test.tsx
```

预期：页面文件不存在，导入失败。

- [ ] **Step 3: 实现页面**

创建 `src/ui/pages/InflowsPage.tsx`：

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { partitionInflows } from '../../domain/planning';
import type { InflowEntry } from '../../domain/planning';
import { usePlanning } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { EntrySheet } from '../components/EntrySheet';
import type { EntryDraft } from '../components/EntrySheet';
import { InflowRow } from '../components/InflowRow';

export function InflowsPage() {
  const { state, updateEntry, deleteEntry } = usePlanning();
  const today = todayKey();
  const { archived } = partitionInflows(state, today);
  const [editing, setEditing] = useState<InflowEntry | null>(null);
  const [deleting, setDeleting] = useState<InflowEntry | null>(null);

  const groups = new Map<string, InflowEntry[]>();
  for (const entry of archived) {
    const month = monthOf(entry.date);
    const list = groups.get(month);
    if (list) list.push(entry);
    else groups.set(month, [entry]);
  }
  const months = [...groups.keys()].sort().reverse();

  return (
    <div className="page">
      <Link className="text-button" to="/planning">
        ‹ 返回补回账
      </Link>
      <h1>汇入记录</h1>
      {archived.length === 0 ? (
        <EmptyState title="还没有历史汇入" />
      ) : (
        months.map((month) => (
          <section className="section" key={month}>
            <div className="section-head">
              <h2>{formatMonthLabel(month)}</h2>
              <span className="muted">{groups.get(month)?.length ?? 0} 笔</span>
            </div>
            <div className="card list">
              {(groups.get(month) ?? []).map((entry) => (
                <InflowRow
                  key={entry.id}
                  entry={entry}
                  onEdit={() => setEditing(entry)}
                  onDelete={() => setDeleting(entry)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {editing && (
        <EntrySheet
          mode="edit"
          initial={{
            kind: 'inflow',
            date: editing.date,
            amount: editing.amount,
            note: editing.note,
          }}
          events={state.events}
          lockKind
          onClose={() => setEditing(null)}
          onSubmit={(draft: EntryDraft) => {
            updateEntry('inflow', editing.id, {
              date: draft.date,
              amount: draft.amount,
              note: draft.note,
            });
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="删除这笔汇入？"
          message="删除后补回账余额会重新计算。"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteEntry('inflow', deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/ui/pages/InflowsPage.test.tsx
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/pages/InflowsPage.tsx src/ui/pages/InflowsPage.test.tsx
git commit -m "feat: add the archived inflow page grouped by month"
```

### Task 7: 用款计划领域模型

**Files:**
- Create: `src/domain/planItems.ts`
- Test: `src/domain/planItems.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/domain/planItems.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  planMonthBuckets,
  sortPlanItems,
  summarizePlanRange,
  validatePlanItemDraft,
  type PlanItem,
} from './planItems';

const items: PlanItem[] = [
  {
    id: 'a',
    spendMonth: '2026-11',
    title: '换电脑',
    amount: 500000,
    replenishMonth: '2026-12',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'b',
    spendMonth: '2026-12',
    title: '旅行',
    amount: 200000,
    replenishMonth: '2027-01',
    createdAt: '2026-11-02T00:00:00.000Z',
  },
  {
    id: 'c',
    spendMonth: '2026-09',
    title: '旧账',
    amount: 100000,
    replenishMonth: '2026-11',
    createdAt: '2026-11-03T00:00:00.000Z',
  },
];

describe('plan month buckets', () => {
  it('aggregates spend, replenish, net and cumulative', () => {
    expect(planMonthBuckets(items, '2026-11', 3)).toEqual([
      { month: '2026-11', spend: 500000, replenish: 100000, net: -400000, cumulative: -400000 },
      { month: '2026-12', spend: 200000, replenish: 500000, net: 300000, cumulative: -100000 },
      { month: '2027-01', spend: 0, replenish: 200000, net: 200000, cumulative: 100000 },
    ]);
  });

  it('summarizes the selected range', () => {
    expect(summarizePlanRange(items, '2026-11', 3)).toEqual({
      spend: 700000,
      replenish: 800000,
      net: 100000,
      cumulative: 100000,
    });
  });
});

describe('plan sorting', () => {
  it('sorts by spend month then creation time', () => {
    expect(sortPlanItems(items, 'spendMonth').map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by creation time', () => {
    expect(sortPlanItems(items, 'createdAt').map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('plan draft validation', () => {
  it('requires a title, a positive amount and valid months', () => {
    expect(
      validatePlanItemDraft({ spendMonth: '2026-11', title: '', amount: 100, replenishMonth: '2026-12' }),
    ).toBe('请填写事件内容');
    expect(
      validatePlanItemDraft({ spendMonth: '2026-11', title: 'x', amount: 0, replenishMonth: '2026-12' }),
    ).toBe('请输入大于 0 的金额');
    expect(
      validatePlanItemDraft({ spendMonth: '2026-13', title: 'x', amount: 100, replenishMonth: '2026-12' }),
    ).toBe('请选择有效的月份');
    expect(
      validatePlanItemDraft({ spendMonth: '2026-11', title: 'x', amount: 100, replenishMonth: '2026-12' }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/domain/planItems.test.ts
```

预期：模块不存在，导入失败。

- [ ] **Step 3: 实现领域模型**

创建 `src/domain/planItems.ts`：

```ts
import { addMonths, isValidMonthKey } from './dates';

export interface PlanItem {
  id: string;
  spendMonth: string;
  title: string;
  amount: number;
  replenishMonth: string;
  createdAt: string;
}

export interface PlanState {
  items: PlanItem[];
}

export interface PlanItemDraft {
  spendMonth: string;
  title: string;
  amount: number;
  replenishMonth: string;
}

export function emptyPlanState(): PlanState {
  return { items: [] };
}

export function validatePlanItemDraft(draft: PlanItemDraft): string | null {
  if (!draft.title.trim()) return '请填写事件内容';
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) return '请输入大于 0 的金额';
  if (!isValidMonthKey(draft.spendMonth) || !isValidMonthKey(draft.replenishMonth)) {
    return '请选择有效的月份';
  }
  return null;
}

export interface PlanMonthBucket {
  month: string;
  spend: number;
  replenish: number;
  net: number;
  cumulative: number;
}

export function planMonthBuckets(items: PlanItem[], startMonth: string, length: number): PlanMonthBucket[] {
  const buckets: PlanMonthBucket[] = [];
  let cumulative = 0;
  for (let index = 0; index < length; index += 1) {
    const month = addMonths(startMonth, index);
    const spend = items
      .filter((item) => item.spendMonth === month)
      .reduce((total, item) => total + item.amount, 0);
    const replenish = items
      .filter((item) => item.replenishMonth === month)
      .reduce((total, item) => total + item.amount, 0);
    const net = replenish - spend;
    cumulative += net;
    buckets.push({ month, spend, replenish, net, cumulative });
  }
  return buckets;
}

export function summarizePlanRange(
  items: PlanItem[],
  startMonth: string,
  length: number,
): { spend: number; replenish: number; net: number; cumulative: number } {
  const buckets = planMonthBuckets(items, startMonth, length);
  const spend = buckets.reduce((total, bucket) => total + bucket.spend, 0);
  const replenish = buckets.reduce((total, bucket) => total + bucket.replenish, 0);
  return {
    spend,
    replenish,
    net: replenish - spend,
    cumulative: buckets[buckets.length - 1]?.cumulative ?? 0,
  };
}

export function sortPlanItems(items: PlanItem[], mode: 'spendMonth' | 'createdAt'): PlanItem[] {
  return [...items].sort((a, b) => {
    if (mode === 'spendMonth' && a.spendMonth !== b.spendMonth) {
      return a.spendMonth.localeCompare(b.spendMonth);
    }
    const byCreated = a.createdAt.localeCompare(b.createdAt);
    return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id);
  });
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/domain/planItems.test.ts
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/domain/planItems.ts src/domain/planItems.test.ts
git commit -m "feat: add plan item aggregation, sorting and validation"
```

---

### Task 8: 用款计划存储

**Files:**
- Create: `src/storage/planItemsStorage.ts`
- Test: `src/storage/planItemsStorage.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/storage/planItemsStorage.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { emptyPlanState } from '../domain/planItems';
import {
  PLAN_ITEMS_STORAGE_KEY,
  isPlanState,
  loadPlanState,
  savePlanState,
} from './planItemsStorage';

const state = {
  items: [
    {
      id: 'p1',
      spendMonth: '2026-11',
      title: '换电脑',
      amount: 500000,
      replenishMonth: '2026-12',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
};

describe('planItemsStorage', () => {
  it('round-trips plan state', () => {
    expect(savePlanState(state)).toBeNull();
    expect(loadPlanState()).toEqual({ value: state });
    expect(localStorage.getItem(PLAN_ITEMS_STORAGE_KEY)).toContain('换电脑');
  });

  it('rejects invalid shapes', () => {
    expect(isPlanState({ items: 'bad' })).toBe(false);
    expect(isPlanState({ items: [{ ...state.items[0], amount: 0 }] })).toBe(false);
    expect(isPlanState({ items: [{ ...state.items[0], spendMonth: '2026-13' }] })).toBe(false);
    expect(isPlanState({ items: [{ ...state.items[0], title: '  ' }] })).toBe(false);
  });

  it('falls back to defaults when storage is empty', () => {
    expect(loadPlanState()).toEqual({ value: emptyPlanState() });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/storage/planItemsStorage.test.ts
```

预期：模块不存在，导入失败。

- [ ] **Step 3: 实现存储**

创建 `src/storage/planItemsStorage.ts`：

```ts
import { isValidMonthKey } from '../domain/dates';
import { emptyPlanState } from '../domain/planItems';
import type { PlanState } from '../domain/planItems';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';

export const PLAN_ITEMS_STORAGE_KEY = 'planned-ledger.plan-items.v1';

export function isPlanState(value: unknown): value is PlanState {
  if (!isPlainObject(value) || !Array.isArray(value.items)) return false;
  return value.items.every(
    (item) =>
      isPlainObject(item) &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      item.title.trim().length > 0 &&
      typeof item.createdAt === 'string' &&
      typeof item.spendMonth === 'string' &&
      isValidMonthKey(item.spendMonth) &&
      typeof item.replenishMonth === 'string' &&
      isValidMonthKey(item.replenishMonth) &&
      typeof item.amount === 'number' &&
      Number.isInteger(item.amount) &&
      item.amount > 0,
  );
}

export function loadPlanState(): LoadResult<PlanState> {
  return loadJson(PLAN_ITEMS_STORAGE_KEY, isPlanState, emptyPlanState);
}

export function savePlanState(state: PlanState): string | null {
  return saveJson(PLAN_ITEMS_STORAGE_KEY, state);
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/storage/planItemsStorage.test.ts
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/storage/planItemsStorage.ts src/storage/planItemsStorage.test.ts
git commit -m "feat: persist plan items under a dedicated storage key"
```

---

### Task 9: PlanStore 与测试 Provider

**Files:**
- Create: `src/state/PlanStore.tsx`
- Modify: `src/test/render.tsx`
- Test: `src/state/PlanStore.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/state/PlanStore.test.tsx`：

```tsx
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { PLAN_ITEMS_STORAGE_KEY } from '../storage/planItemsStorage';
import { PlanProvider, usePlan } from './PlanStore';

describe('PlanStore', () => {
  it('adds, updates, deletes and clears plan items', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <PlanProvider>{children}</PlanProvider>;
    const { result } = renderHook(() => usePlan(), { wrapper });

    act(() => {
      result.current.addItem({
        spendMonth: '2026-11',
        title: '换电脑',
        amount: 500000,
        replenishMonth: '2026-12',
      });
    });
    expect(result.current.items).toHaveLength(1);

    const id = result.current.items[0].id;
    act(() => {
      result.current.updateItem(id, {
        spendMonth: '2026-11',
        title: '换新电脑',
        amount: 600000,
        replenishMonth: '2027-01',
      });
    });
    expect(result.current.items[0]).toMatchObject({ title: '换新电脑', amount: 600000 });

    const stored = JSON.parse(localStorage.getItem(PLAN_ITEMS_STORAGE_KEY) ?? '{}');
    expect(stored.items[0].title).toBe('换新电脑');

    act(() => {
      result.current.clearAll();
    });
    expect(result.current.items).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/state/PlanStore.test.tsx
```

预期：`PlanStore` 不存在，导入失败。

- [ ] **Step 3: 实现 Store**

创建 `src/state/PlanStore.tsx`：

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createId } from '../domain/id';
import { emptyPlanState } from '../domain/planItems';
import type { PlanItem, PlanItemDraft, PlanState } from '../domain/planItems';
import { loadPlanState, savePlanState } from '../storage/planItemsStorage';

interface PlanContextValue {
  items: PlanItem[];
  storageError: string | null;
  dismissError: () => void;
  addItem: (input: PlanItemDraft) => void;
  updateItem: (id: string, input: PlanItemDraft) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadPlanState());
  const [state, setState] = useState<PlanState>(initial.value);
  const [storageError, setStorageError] = useState<string | null>(initial.error ?? null);

  useEffect(() => {
    const error = savePlanState(state);
    if (error) setStorageError(error);
  }, [state]);

  const dismissError = useCallback(() => setStorageError(null), []);

  const addItem = useCallback((input: PlanItemDraft) => {
    const item: PlanItem = {
      id: createId(),
      spendMonth: input.spendMonth,
      title: input.title.trim(),
      amount: input.amount,
      replenishMonth: input.replenishMonth,
      createdAt: new Date().toISOString(),
    };
    setState((previous) => ({ ...previous, items: [...previous.items, item] }));
  }, []);

  const updateItem = useCallback((id: string, input: PlanItemDraft) => {
    setState((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === id
          ? {
              ...item,
              spendMonth: input.spendMonth,
              title: input.title.trim(),
              amount: input.amount,
              replenishMonth: input.replenishMonth,
            }
          : item,
      ),
    }));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setState((previous) => ({ ...previous, items: previous.items.filter((item) => item.id !== id) }));
  }, []);

  const clearAll = useCallback(() => setState(emptyPlanState()), []);

  const value = useMemo(
    () => ({ items: state.items, storageError, dismissError, addItem, updateItem, deleteItem, clearAll }),
    [state.items, storageError, dismissError, addItem, updateItem, deleteItem, clearAll],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const value = useContext(PlanContext);
  if (!value) throw new Error('usePlan must be used within PlanProvider');
  return value;
}
```

- [ ] **Step 4: 让测试 Provider 支持用款计划**

用下面的内容替换 `src/test/render.tsx`：

```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { todayKey } from '../domain/dates';
import { createRestoreEvent } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';
import type { PlanState } from '../domain/planItems';
import type { PlanningState } from '../domain/planning';
import { MealProvider } from '../state/MealStore';
import { PlanProvider } from '../state/PlanStore';
import { PlanningProvider } from '../state/PlanningStore';
import { MEAL_V2_STORAGE_KEY } from '../storage/mealV2Storage';
import { PLAN_ITEMS_STORAGE_KEY } from '../storage/planItemsStorage';
import { PLANNING_STORAGE_KEY } from '../storage/planningStorage';

interface RenderOptions {
  route?: string;
  meal?: MealStateV2;
  planning?: PlanningState;
  plan?: PlanState;
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
  if (options.plan) localStorage.setItem(PLAN_ITEMS_STORAGE_KEY, JSON.stringify(options.plan));
  return render(
    <MealProvider>
      <PlanningProvider>
        <PlanProvider>
          <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
        </PlanProvider>
      </PlanningProvider>
    </MealProvider>,
  );
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run src/state/PlanStore.test.tsx src/ui/pages/MealPage.test.tsx src/ui/pages/PlanningPage.test.tsx
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/state/PlanStore.tsx src/state/PlanStore.test.tsx src/test/render.tsx
git commit -m "feat: add the plan item store and test provider support"
```

### Task 10: 用款计划表单

**Files:**
- Create: `src/ui/components/PlanForm.tsx`
- Test: `src/ui/components/PlanForm.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/components/PlanForm.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlanForm } from './PlanForm';

describe('PlanForm', () => {
  it('requires the event title', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PlanForm submitLabel="创建计划" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: '创建计划' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请填写事件内容');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits cents and trimmed content', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PlanForm submitLabel="创建计划" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('事件内容'), '  换电脑  ');
    await user.type(screen.getByLabelText('金额'), '5000');
    await user.click(screen.getByRole('button', { name: '创建计划' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: '换电脑', amount: 500000 }));
  });

  it('rejects a zero amount', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PlanForm submitLabel="创建计划" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('事件内容'), '换电脑');
    await user.type(screen.getByLabelText('金额'), '0');
    await user.click(screen.getByRole('button', { name: '创建计划' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入大于 0 的金额');
  });

  it('prefills initial values', () => {
    render(
      <PlanForm
        initial={{
          spendMonth: '2026-11',
          title: '旅行',
          amount: 200000,
          replenishMonth: '2026-12',
        }}
        submitLabel="保存修改"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('事件内容')).toHaveValue('旅行');
    expect(screen.getByLabelText('金额')).toHaveValue('2000.00');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/components/PlanForm.test.tsx
```

预期：组件不存在，导入失败。

- [ ] **Step 3: 实现表单**

创建 `src/ui/components/PlanForm.tsx`：

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { addMonths, monthOf, todayKey } from '../../domain/dates';
import { centsToYuan, parseYuanToCents } from '../../domain/money';
import { validatePlanItemDraft } from '../../domain/planItems';
import type { PlanItemDraft } from '../../domain/planItems';
import { MoneyInput } from './MoneyInput';

interface PlanFormProps {
  initial?: PlanItemDraft;
  submitLabel: string;
  onSubmit: (draft: PlanItemDraft) => void;
}

export function PlanForm({ initial, submitLabel, onSubmit }: PlanFormProps) {
  const currentMonth = monthOf(todayKey());
  const [spendMonth, setSpendMonth] = useState(initial?.spendMonth ?? currentMonth);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial ? centsToYuan(initial.amount) : '');
  const [replenishMonth, setReplenishMonth] = useState(
    initial?.replenishMonth ?? addMonths(currentMonth, 1),
  );
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(amount);
    if (cents === null) {
      setError('请输入大于 0 的金额');
      return;
    }
    const draft: PlanItemDraft = {
      spendMonth,
      title: title.trim(),
      amount: cents,
      replenishMonth,
    };
    const message = validatePlanItemDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    setError('');
    onSubmit(draft);
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>支出月份</span>
        <input
          type="month"
          value={spendMonth}
          onChange={(event) => setSpendMonth(event.target.value)}
          aria-label="支出月份"
        />
      </label>
      <label className="field">
        <span>事件内容</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：换电脑"
          aria-label="事件内容"
        />
      </label>
      <label className="field">
        <span>金额</span>
        <MoneyInput value={amount} onChange={setAmount} ariaLabel="金额" />
      </label>
      <label className="field">
        <span>回补月份</span>
        <input
          type="month"
          value={replenishMonth}
          onChange={(event) => setReplenishMonth(event.target.value)}
          aria-label="回补月份"
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--planning" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/ui/components/PlanForm.test.tsx
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/components/PlanForm.tsx src/ui/components/PlanForm.test.tsx
git commit -m "feat: add the plan item form"
```

---

### Task 11: 用款计划页面

**Files:**
- Create: `src/ui/pages/PlansPage.tsx`
- Modify: `src/ui/styles.css`
- Test: `src/ui/pages/PlansPage.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/pages/PlansPage.test.tsx`：

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addMonths, monthOf, todayKey } from '../../domain/dates';
import { emptyPlanState, type PlanState } from '../../domain/planItems';
import { renderWithProviders } from '../../test/render';
import { PlansPage } from './PlansPage';

function fixture(): PlanState {
  const current = monthOf(todayKey());
  return {
    items: [
      {
        id: 'p1',
        spendMonth: current,
        title: '换电脑',
        amount: 500000,
        replenishMonth: addMonths(current, 1),
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ],
  };
}

describe('PlansPage', () => {
  it('shows the empty state and creates a plan', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlansPage />, { plan: emptyPlanState(), route: '/planning/plans' });
    expect(screen.getByText('还没有用款计划')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '＋ 新建' }));
    await user.type(screen.getByLabelText('事件内容'), '换电脑');
    await user.type(screen.getByLabelText('金额'), '5000');
    await user.click(screen.getByRole('button', { name: '创建计划' }));

    expect(await screen.findByText('换电脑')).toBeInTheDocument();
    expect(screen.getAllByText('¥5000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('近 3 个月')).toBeInTheDocument();
  });

  it('adjusts the timeline length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlansPage />, { plan: fixture(), route: '/planning/plans' });
    expect(screen.getByText('近 3 个月')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '增加一个月' }));
    expect(screen.getByText('近 4 个月')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '减少一个月' }));
    expect(screen.getByText('近 3 个月')).toBeInTheDocument();
  });

  it('edits and deletes a plan item', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlansPage />, { plan: fixture(), route: '/planning/plans' });

    await user.click(screen.getByText('换电脑'));
    const amount = screen.getByLabelText('金额');
    await user.clear(amount);
    await user.type(amount, '6000');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect((await screen.findAllByText('¥6000.00')).length).toBeGreaterThan(0);

    await user.click(screen.getByText('换电脑'));
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByText('删除这条计划？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(await screen.findByText('还没有用款计划')).toBeInTheDocument();
  });

  it('shows monthly totals and cumulative values', () => {
    renderWithProviders(<PlansPage />, { plan: fixture(), route: '/planning/plans' });
    expect(screen.getByText('计划支出')).toBeInTheDocument();
    expect(screen.getByText('计划回补')).toBeInTheDocument();
    expect(screen.getByText('累计')).toBeInTheDocument();
    expect(screen.getAllByText(/净额/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/PlansPage.test.tsx
```

预期：页面不存在，导入失败。

- [ ] **Step 3: 实现页面**

创建 `src/ui/pages/PlansPage.tsx`：

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatShortMonth, monthOf, todayKey } from '../../domain/dates';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import { planMonthBuckets, sortPlanItems, summarizePlanRange } from '../../domain/planItems';
import type { PlanItem, PlanItemDraft } from '../../domain/planItems';
import { usePlan } from '../../state/PlanStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PlanForm } from '../components/PlanForm';
import { SegmentedControl } from '../components/SegmentedControl';
import { Sheet } from '../components/Sheet';

type SortMode = 'spendMonth' | 'createdAt';

export function PlansPage() {
  const { items, addItem, updateItem, deleteItem } = usePlan();
  const today = todayKey();
  const currentMonth = monthOf(today);
  const [length, setLength] = useState(3);
  const [sortMode, setSortMode] = useState<SortMode>('spendMonth');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const [deleting, setDeleting] = useState<PlanItem | null>(null);

  const buckets = planMonthBuckets(items, currentMonth, length);
  const summary = summarizePlanRange(items, currentMonth, length);
  const sorted = sortPlanItems(items, sortMode);

  const create = (draft: PlanItemDraft) => {
    addItem(draft);
    setFormOpen(false);
  };

  const save = (draft: PlanItemDraft) => {
    if (!editing) return;
    updateItem(editing.id, draft);
    setEditing(null);
  };

  return (
    <div className="page">
      <Link className="text-button" to="/planning">
        ‹ 返回补回账
      </Link>
      <div className="section-head">
        <h1>用款计划</h1>
        {items.length > 0 && (
          <button type="button" className="button button--secondary" onClick={() => setFormOpen(true)}>
            ＋ 新建
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <>
          <EmptyState title="还没有用款计划" hint="把未来几个月的支出和回补排进来。" />
          <button type="button" className="button button--planning" onClick={() => setFormOpen(true)}>
            ＋ 新建
          </button>
        </>
      ) : (
        <>
          <section className="card summary-grid">
            <div>
              <span className="muted">计划支出</span>
              <strong>{formatYuan(summary.spend)}</strong>
            </div>
            <div>
              <span className="muted">计划回补</span>
              <strong>{formatYuan(summary.replenish)}</strong>
            </div>
            <div>
              <span className="muted">净额</span>
              <strong className={summary.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(summary.net)}</strong>
            </div>
            <div>
              <span className="muted">累计</span>
              <strong className={summary.cumulative >= 0 ? 'positive' : 'negative'}>
                {formatSignedYuan(summary.cumulative)}
              </strong>
            </div>
          </section>

          <div className="range-control">
            <button
              type="button"
              className="button button--ghost"
              aria-label="减少一个月"
              disabled={length <= 1}
              onClick={() => setLength((value) => Math.max(1, value - 1))}
            >
              −
            </button>
            <strong>近 {length} 个月</strong>
            <button
              type="button"
              className="button button--ghost"
              aria-label="增加一个月"
              disabled={length >= 24}
              onClick={() => setLength((value) => Math.min(24, value + 1))}
            >
              ＋
            </button>
          </div>

          <SegmentedControl
            options={[
              { value: 'spendMonth', label: '按支出月份' },
              { value: 'createdAt', label: '按写入顺序' },
            ]}
            value={sortMode}
            onChange={setSortMode}
          />

          <div className="card table-wrap">
            <div className="table table--plans">
              <div className="table__row table__head">
                <span>支出月份</span>
                <span>事件内容</span>
                <span>金额</span>
                <span>回补月份</span>
              </div>
              {sorted.map((item) => (
                <button
                  type="button"
                  className="table__row table__row--button"
                  key={item.id}
                  onClick={() => setEditing(item)}
                >
                  <span>{formatShortMonth(item.spendMonth, today)}</span>
                  <span className="table__ellipsis">{item.title}</span>
                  <span>{formatYuan(item.amount)}</span>
                  <span>{formatShortMonth(item.replenishMonth, today)}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="card">
            <h2 className="card-title">月度时间轴</h2>
            <div className="plan-timeline">
              {buckets.map((bucket) => (
                <div className="plan-timeline__month" key={bucket.month}>
                  <strong>{formatShortMonth(bucket.month, today)}</strong>
                  <span>支出 {formatYuan(bucket.spend)}</span>
                  <span>回补 {formatYuan(bucket.replenish)}</span>
                  <span className={bucket.net >= 0 ? 'positive' : 'negative'}>净额 {formatSignedYuan(bucket.net)}</span>
                  <span className={bucket.cumulative >= 0 ? 'positive' : 'negative'}>
                    累计 {formatSignedYuan(bucket.cumulative)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {formOpen && (
        <Sheet open title="新建计划" onClose={() => setFormOpen(false)}>
          <PlanForm submitLabel="创建计划" onSubmit={create} />
        </Sheet>
      )}

      {editing && (
        <Sheet open title="编辑计划" onClose={() => setEditing(null)}>
          <PlanForm
            initial={{
              spendMonth: editing.spendMonth,
              title: editing.title,
              amount: editing.amount,
              replenishMonth: editing.replenishMonth,
            }}
            submitLabel="保存修改"
            onSubmit={save}
          />
          <button
            type="button"
            className="text-button text-button--danger"
            onClick={() => {
              setDeleting(editing);
              setEditing(null);
            }}
          >
            删除
          </button>
        </Sheet>
      )}

      {deleting && (
        <ConfirmDialog
          open
          title="删除这条计划？"
          message="删除后时间轴和汇总会重新计算。"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteItem(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 加入计划表格与时间轴样式**

在 `src/ui/styles.css` 末尾追加：

```css
.table--plans .table__row {
  grid-template-columns: minmax(72px, 0.9fr) minmax(120px, 1.8fr) minmax(88px, 1fr) minmax(72px, 0.9fr);
}

.table__row--button {
  width: 100%;
  border-top: none;
  border-left: none;
  border-right: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.table__ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.range-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.plan-timeline {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.plan-timeline__month {
  min-width: 132px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-soft);
  font-size: calc(12px * var(--font-scale, 1));
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run src/ui/pages/PlansPage.test.tsx src/ui/components/PlanForm.test.tsx
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/ui/pages/PlansPage.tsx src/ui/pages/PlansPage.test.tsx src/ui/styles.css
git commit -m "feat: add the plan table, range controls and monthly timeline"
```

---

### Task 12: 路由、导航与存储错误横幅

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: 写失败测试**

用下面的内容替换 `src/App.test.tsx`：

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyPlanState } from './domain/planItems';
import { emptyPlanningState } from './domain/planning';
import { mealFixture, renderWithProviders } from './test/render';
import App from './App';

describe('App', () => {
  it('shows onboarding when the meal start date is empty', () => {
    renderWithProviders(<App />, {
      meal: mealFixture({ settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '' } }),
      planning: emptyPlanningState(),
      plan: emptyPlanState(),
    });
    expect(screen.getByRole('button', { name: '开始记账' })).toBeInTheDocument();
  });

  it('renders the bottom navigation after onboarding', () => {
    renderWithProviders(<App />, {
      meal: mealFixture(),
      planning: emptyPlanningState(),
      plan: emptyPlanState(),
    });
    expect(screen.getByRole('link', { name: '餐补' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '补回账' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '设置' })).toBeInTheDocument();
  });

  it('renders the selected route and marks its tab active', () => {
    renderWithProviders(<App />, {
      route: '/stats',
      meal: mealFixture(),
      planning: emptyPlanningState(),
      plan: emptyPlanState(),
    });
    expect(screen.getByRole('heading', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '统计' })).toHaveClass('is-active');
  });

  it('renders the plans route', () => {
    renderWithProviders(<App />, {
      route: '/planning/plans',
      meal: mealFixture(),
      planning: emptyPlanningState(),
      plan: emptyPlanState(),
    });
    expect(screen.getByRole('heading', { name: '用款计划' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/App.test.tsx
```

预期：导航仍显示「规划账」，`/planning/plans` 无匹配路由。

- [ ] **Step 3: 修改 App 路由与导航**

在 `src/App.tsx` 顶部加入：

```tsx
import { usePlan } from './state/PlanStore';
import { CompletedEventsPage } from './ui/pages/CompletedEventsPage';
import { InflowsPage } from './ui/pages/InflowsPage';
import { MealRecordsPage } from './ui/pages/MealRecordsPage';
import { PlansPage } from './ui/pages/PlansPage';
```

把底部导航第二项的 `label: '规划账'` 改为：

```tsx
    label: '补回账',
```

把 `StorageBanner` 改写为：

```tsx
function StorageBanner() {
  const meal = useMeal();
  const planning = usePlanning();
  const plan = usePlan();
  const message = meal.storageError ?? planning.storageError ?? plan.storageError;
  if (!message) return null;
  return (
    <div className="storage-banner" role="alert">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          meal.dismissError();
          planning.dismissError();
          plan.dismissError();
        }}
      >
        知道了
      </button>
    </div>
  );
}
```

在 `<Routes>` 中加入：

```tsx
          <Route path="/meal/records" element={<MealRecordsPage />} />
          <Route path="/planning/completed" element={<CompletedEventsPage />} />
          <Route path="/planning/inflows" element={<InflowsPage />} />
          <Route path="/planning/plans" element={<PlansPage />} />
```

- [ ] **Step 4: 挂载 PlanProvider**

在 `src/main.tsx` 中加入：

```tsx
import { PlanProvider } from './state/PlanStore';
```

并把渲染树改为：

```tsx
    <MealProvider>
      <PlanningProvider>
        <PlanProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </PlanProvider>
      </PlanningProvider>
    </MealProvider>
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run src/App.test.tsx
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "feat: wire the planning subroutes and rename the ledger tab"
```

### Task 13: 统计页规划账指标切换

**Files:**
- Modify: `src/ui/pages/StatsPage.tsx`
- Test: `src/ui/pages/StatsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

用下面的内容替换 `src/ui/pages/StatsPage.test.tsx`：

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { emptyPlanState } from '../../domain/planItems';
import { emptyPlanningState } from '../../domain/planning';
import { mealFixture, renderWithProviders } from '../../test/render';
import { StatsPage } from './StatsPage';

describe('StatsPage v2', () => {
  it('shows meal periods and switches to the ledger', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const meal = mealFixture({
      records: { [today]: { spent: 1500, updatedAt: '2026-11-01T00:00:00.000Z' } },
    });
    renderWithProviders(<StatsPage />, { meal, planning: emptyPlanningState(), plan: emptyPlanState() });

    expect(screen.getByText('每周期结余')).toBeInTheDocument();
    expect(screen.getByText('每日正常额度')).toBeInTheDocument();
    expect(screen.getByText(/–/)).toBeInTheDocument();
    expect(screen.getByText(/进行中/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '补回账' }));
    expect(screen.getByText('还没有数据')).toBeInTheDocument();
  });

  it('shows empty state without records', () => {
    renderWithProviders(<StatsPage />, {
      meal: mealFixture(),
      planning: emptyPlanningState(),
      plan: emptyPlanState(),
    });
    expect(screen.getByText('还没有数据')).toBeInTheDocument();
  });

  it('shows localized planning months', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const planning = {
      events: [],
      spends: [],
      replenishes: [],
      inflows: [{ id: 'i1', date: today, amount: 5000, createdAt: '2026-11-01T00:00:00.000Z' }],
    };
    renderWithProviders(<StatsPage />, { meal: mealFixture(), planning, plan: emptyPlanState() });
    await user.click(screen.getByRole('tab', { name: '补回账' }));
    expect(screen.getByText(formatMonthLabel(monthOf(today)))).toBeInTheDocument();
  });

  it('switches planning chart metrics', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const planning = {
      ...emptyPlanningState(),
      spends: [{ id: 's1', eventId: 'e1', date: today, amount: 3000, createdAt: '2026-11-01T00:00:00.000Z' }],
      replenishes: [
        { id: 'r1', eventId: 'e1', date: today, amount: 1000, createdAt: '2026-11-01T00:00:00.000Z' },
      ],
      inflows: [{ id: 'i1', date: today, amount: 500, createdAt: '2026-11-01T00:00:00.000Z' }],
    };
    renderWithProviders(<StatsPage />, { meal: mealFixture(), planning, plan: emptyPlanState() });
    await user.click(screen.getByRole('tab', { name: '补回账' }));
    expect(screen.getByText('每月净变化')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '支出' }));
    expect(screen.getByText('每月支出')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '补回' }));
    expect(screen.getByText('每月补回')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '汇入' }));
    expect(screen.getByText('每月汇入')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/StatsPage.test.tsx
```

预期：「补回账」「每周期结余」「每日正常额度」与指标切换断言失败。

- [ ] **Step 3: 重写统计页**

用下面的内容替换 `src/ui/pages/StatsPage.tsx`：

```tsx
import { useState } from 'react';
import { formatDisplayDate, formatMonthLabel, todayKey } from '../../domain/dates';
import { buildMealTimeline } from '../../domain/mealV2';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import type { PlanningMonthSummary } from '../../domain/planning';
import { planningMonthlySeries } from '../../domain/stats';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { BarChart } from '../components/BarChart';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';

type Ledger = 'meal' | 'planning';
type PlanningMetric = 'net' | 'spend' | 'replenish' | 'inflow';

const METRIC_OPTIONS: Array<{ value: PlanningMetric; label: string }> = [
  { value: 'net', label: '净变化' },
  { value: 'spend', label: '支出' },
  { value: 'replenish', label: '补回' },
  { value: 'inflow', label: '汇入' },
];

const METRIC_FIELD: Record<
  PlanningMetric,
  keyof Pick<PlanningMonthSummary, 'net' | 'spends' | 'replenishes' | 'inflows'>
> = {
  net: 'net',
  spend: 'spends',
  replenish: 'replenishes',
  inflow: 'inflows',
};

function shortDate(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8))}`;
}

export function StatsPage() {
  const { state: mealState } = useMeal();
  const { state: planningState } = usePlanning();
  const [ledger, setLedger] = useState<Ledger>('meal');
  const [count, setCount] = useState(6);
  const [planningMetric, setPlanningMetric] = useState<PlanningMetric>('net');
  const today = todayKey();
  const periods = buildMealTimeline(mealState, today).filter((period) => period.startDate <= today);
  const displayPeriods = [...periods].reverse();
  const planningRows = planningMonthlySeries(planningState, today, count);
  const planningDisplay = [...planningRows].reverse();
  const mealHasData = periods.some((period) => period.days.length > 0);
  const planningHasData =
    planningState.spends.length + planningState.replenishes.length + planningState.inflows.length > 0;
  const metric = METRIC_OPTIONS.find((option) => option.value === planningMetric)!;

  const chartData =
    ledger === 'meal'
      ? periods.map((period) => ({ label: shortDate(period.startDate), value: period.net }))
      : planningRows.map((row) => ({
          label: `${Number(row.month.slice(5))}月`,
          value: row[METRIC_FIELD[planningMetric]],
        }));

  const hasData = ledger === 'meal' ? mealHasData : planningHasData;

  return (
    <div className="page">
      <h1>统计</h1>
      <SegmentedControl
        options={[
          { value: 'meal', label: '餐补' },
          { value: 'planning', label: '补回账' },
        ]}
        value={ledger}
        onChange={setLedger}
      />

      {ledger === 'planning' && (
        <SegmentedControl options={METRIC_OPTIONS} value={planningMetric} onChange={setPlanningMetric} />
      )}

      {!hasData ? (
        <EmptyState title="还没有数据" hint="记录几笔后，这里会显示统计。" />
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">{ledger === 'meal' ? '每周期结余' : `每月${metric.label}`}</h2>
            <BarChart
              data={chartData}
              color={ledger === 'meal' ? 'var(--meal-primary)' : 'var(--planning-primary)'}
              ariaLabel={ledger === 'meal' ? '餐补周期结余趋势' : `补回账月度${metric.label}趋势`}
            />
          </section>

          <section className={ledger === 'meal' ? 'card' : 'card table-wrap'}>
            {ledger === 'meal' ? (
              <div className="period-stats">
                {displayPeriods.map((period) => (
                  <div className="period-stat" key={period.restore.id}>
                    <div className="period-stat__head">
                      <strong>
                        {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}
                      </strong>
                      {period.startDate <= today && period.endDate >= today && (
                        <span className="mode-badge">进行中</span>
                      )}
                    </div>
                    <div className="period-stat__grid">
                      <div>
                        <span className="muted">每日正常额度</span>
                        <strong>{formatYuan(period.restore.dailyNormal)}</strong>
                      </div>
                      <div>
                        <span className="muted">保底切换日</span>
                        <strong>{period.switchDate ? formatDisplayDate(period.switchDate) : '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">花费</span>
                        <strong>{formatYuan(period.totalSpent)}</strong>
                      </div>
                      <div>
                        <span className="muted">期末余额</span>
                        <strong className={period.endingBalance >= 0 ? 'positive' : 'negative'}>
                          {formatSignedYuan(period.endingBalance)}
                        </strong>
                      </div>
                      <div>
                        <span className="muted">结转</span>
                        <strong>{period.carry > 0 ? formatYuan(period.carry) : '已清零'}</strong>
                      </div>
                    </div>
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
                {planningDisplay.map((row) => (
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

          {ledger === 'planning' && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setCount((current) => current + 6)}
            >
              显示更早的月份
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/ui/pages/StatsPage.test.tsx
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/pages/StatsPage.tsx src/ui/pages/StatsPage.test.tsx
git commit -m "feat: switch planning chart metrics and align stats copy"
```

---

### Task 14: 设置页新增清空用款计划与文案对齐

**Files:**
- Modify: `src/ui/pages/SettingsPage.tsx`
- Test: `src/ui/pages/SettingsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/ui/pages/SettingsPage.test.tsx` 中：

1. 在文件顶部 import 中加入：

```tsx
import { PLAN_ITEMS_STORAGE_KEY } from '../../storage/planItemsStorage';
```

2. 把 `'立即恢复正常额度'` 改为 `'立即恢复周期'`，`'已恢复正常额度'` 改为 `'周期已恢复'`，`'正常 ¥26.67'` 改为 `'正常阶段 ¥26.67/天'`。

3. 在 `describe('SettingsPage v2', ...)` 末尾追加：

```tsx
  it('clears plan items separately from the ledger', async () => {
    const user = userEvent.setup();
    const plan = {
      items: [
        {
          id: 'p1',
          spendMonth: '2026-11',
          title: '换电脑',
          amount: 500000,
          replenishMonth: '2026-12',
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    };
    renderWithProviders(<SettingsPage />, { meal: mealFixture(), plan });
    await user.click(screen.getByRole('button', { name: '清空用款计划' }));
    await user.click(screen.getByRole('button', { name: '确认清空' }));
    expect(screen.getByText('用款计划已清空')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(PLAN_ITEMS_STORAGE_KEY) ?? '{}').items).toEqual([]);
  });
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/SettingsPage.test.tsx
```

预期：恢复按钮、阶段文案与清空用款计划按钮不存在。

- [ ] **Step 3: 修改设置页**

在 `src/ui/pages/SettingsPage.tsx` 中按下列内容修改。

顶部 import 加入：

```tsx
import { usePlan } from '../../state/PlanStore';
```

组件开头改为：

```tsx
  const { state, updateSettings, restoreNow, customizePeriod, clearRecords } = useMeal();
  const { clearAll: clearLedger } = usePlanning();
  const { clearAll: clearPlanItems } = usePlan();
```

状态区加入：

```tsx
  const [clearItemsOpen, setClearItemsOpen] = useState(false);
```

`manualRestore` 的成功提示改为：

```tsx
    setMessage('周期已恢复');
```

设置摘要段落改为：

```tsx
          <p className="muted">
            整月自由额度 {formatYuan(rates.freeAllowance)} · 正常 {formatYuan(rates.dailyNormal)}/天 · 保底{' '}
            {formatYuan(rates.dailyMinimum)}/天
          </p>
          <p className="muted">周期默认从每月起始日到下个月起始日前一天；修改后下次恢复生效。</p>
          <p className="muted">开始日期 {state.settings.startDate ? formatDisplayDate(state.settings.startDate) : '未设置'}</p>
```

「当前周期」卡片改为：

```tsx
        <div className="summary-grid">
          <div><span className="muted">开始日期</span><strong>{formatDisplayDate(status.startDate)}</strong></div>
          <div><span className="muted">结束日期</span><strong>{formatDisplayDate(status.endDate)}</strong></div>
          <div><span className="muted">每日正常额度</span><strong>{formatYuan(status.dailyNormal)}/天</strong></div>
          <div>
            <span className="muted">当前阶段</span>
            <strong>
              {status.switchDate
                ? `保底阶段 ${formatYuan(status.dailyMinimum)}/天`
                : `正常阶段 ${formatYuan(status.dailyNormal)}/天`}
            </strong>
          </div>
          <div><span className="muted">自由额度</span><strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong></div>
        </div>
```

恢复按钮改为：

```tsx
          {alreadyRestoredToday ? '今天已经恢复过' : '立即恢复周期'}
```

说明文字改为：

```tsx
        <p className="muted">
          日历可调整历史、当前和未来周期，也可以选到开始日期之前（开始日期会随之前移）；缺记的日子可到「补记」补上。恢复后负结余清零、正结余结转到新周期；手动恢复每天最多一次。
        </p>
```

数据卡片改为：

```tsx
      <section className="card">
        <h2 className="card-title">数据</h2>
        <p className="muted">数据只保存在本机，清除应用数据会丢失记录。</p>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearMealOpen(true)}>
          清空餐补数据
        </button>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearPlanOpen(true)}>
          清空补回账数据
        </button>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearItemsOpen(true)}>
          清空用款计划
        </button>
      </section>
```

关于行改为：

```tsx
        <p className="muted">小账本 v{__APP_VERSION__}</p>
```

恢复确认框改为：

```tsx
          title="立即恢复周期？"
          message="负结余将清零、正结余将结转到新周期；手动恢复每天最多一次。"
```

补回账清空确认框改为：

```tsx
          title="清空补回账数据？"
          message="将删除所有事项、支出、补回和汇入记录，且无法恢复。"
          onConfirm={() => {
            clearLedger();
            setClearPlanOpen(false);
            setError('');
            setMessage('补回账数据已清空');
          }}
```

在文件末尾、最后一个 `</div>` 之前加入用款计划确认框：

```tsx
      {clearItemsOpen && (
        <ConfirmDialog
          open
          title="清空用款计划？"
          message="将删除所有用款计划条目，且无法恢复。"
          confirmLabel="确认清空"
          onCancel={() => setClearItemsOpen(false)}
          onConfirm={() => {
            clearPlanItems();
            setClearItemsOpen(false);
            setError('');
            setMessage('用款计划已清空');
          }}
        />
      )}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/ui/pages/SettingsPage.test.tsx
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/pages/SettingsPage.tsx src/ui/pages/SettingsPage.test.tsx
git commit -m "feat: clear plan items from settings and align copy"
```

---

### Task 15: 全站文案统一

**Files:**
- Modify: `src/ui/pages/EventDetailPage.tsx`
- Modify: `src/ui/components/EntrySheet.tsx`
- Modify: `src/ui/components/EventForm.tsx`
- Modify: `src/ui/pages/Onboarding.tsx`
- Modify: `src/ui/pages/BackfillPage.tsx`
- Modify: `src/domain/mealV2.ts`
- Modify: `src/storage/jsonStorage.ts`
- Test: `src/ui/pages/EventDetailPage.test.tsx`
- Test: `src/domain/mealV2.test.ts`
- Test: `src/storage/jsonStorage.test.ts`

- [ ] **Step 1: 更新测试断言**

在 `src/ui/pages/EventDetailPage.test.tsx` 中替换：

- `'待补 ¥3000.00'` → `'待补回 ¥3000.00'`
- 两个 `'当时待补 ...'` → `'当时待补回 ...'`
- 测试名 `'shows 暂无支出 ...'` → `'shows 未支出 ...'`
- `'暂无支出'` → `'未支出'`
- `screen.queryByText('已补齐')` → `screen.queryByText('已补回')`

在 `src/domain/mealV2.test.ts` 中把：

```ts
expect(validateMealSettings({ ...settings, startDate: '' })).toBe('请选择起始日期');
```

改为：

```ts
expect(validateMealSettings({ ...settings, startDate: '' })).toBe('请选择开始日期');
```

在 `src/storage/jsonStorage.test.ts` 中替换：

- `'本地数据格式异常，已重置'` → `'本机数据格式异常，已重置'`
- `'无法读取本地数据'` → `'无法读取本机数据'`
- `'无法保存数据，请检查浏览器存储权限'` → `'无法保存数据，请检查本机存储空间或应用权限'`

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/ui/pages/EventDetailPage.test.tsx src/domain/mealV2.test.ts src/storage/jsonStorage.test.ts
```

预期：新文案断言失败。

- [ ] **Step 3: 应用文案替换**

按顺序执行以下替换（可用编辑器批量替换，注意只改用户可见字符串）：

`src/ui/components/EntrySheet.tsx`：

```diff
-      setError('请输入大于 0 的有效金额');
+      setError('请输入大于 0 的金额');
-    <Sheet open title={mode === 'create' ? '记一笔' : '修改流水'} onClose={onClose}>
+    <Sheet open title={mode === 'create' ? '记一笔' : '修改记录'} onClose={onClose}>
```

`src/ui/components/EventForm.tsx`：

```diff
-        setError('计划总花费必须是大于 0 的有效金额');
+        setError('请输入大于 0 的计划总支出');
-        <span>计划总花费（可选）</span>
-        <MoneyInput value={plannedTotal} onChange={setPlannedTotal} ariaLabel="计划总花费" />
+        <span>计划总支出（可选）</span>
+        <MoneyInput value={plannedTotal} onChange={setPlannedTotal} ariaLabel="计划总支出" />
```

`src/ui/pages/Onboarding.tsx`：

```diff
-      setError('请选择不晚于今天的起始日期');
+      setError('请选择不晚于今天的开始日期');
-          <span>起始日期</span>
+          <span>开始日期</span>
-            aria-label="起始日期"
+            aria-label="开始日期"
-            自由额度 {formatYuan(rates.freeAllowance)} · 日均正常 {formatYuan(rates.dailyNormal)} / 日均保底 {formatYuan(rates.dailyMinimum)}
+            自由额度 {formatYuan(rates.freeAllowance)} · 正常 {formatYuan(rates.dailyNormal)}/天 · 保底 {formatYuan(rates.dailyMinimum)}/天
-      <p className="onboarding__hint muted">数据只保存在这台手机上。</p>
+      <p className="onboarding__hint muted">数据只保存在本机。</p>
```

`src/domain/mealV2.ts`：

```diff
-  if (!settings.startDate) return '请选择起始日期';
+  if (!settings.startDate) return '请选择开始日期';
```

`src/storage/jsonStorage.ts`：

```diff
-    if (!validate(parsed)) return { value: createDefault(), error: '本地数据格式异常，已重置' };
+    if (!validate(parsed)) return { value: createDefault(), error: '本机数据格式异常，已重置' };
-    return { value: createDefault(), error: '无法读取本地数据' };
+    return { value: createDefault(), error: '无法读取本机数据' };
-    return '无法保存数据，请检查浏览器存储权限';
+    return '无法保存数据，请检查本机存储空间或应用权限';
```

`src/ui/pages/EventDetailPage.tsx`：

```diff
-          返回规划账
+          返回补回账
-          ‹ 返回规划账
+          ‹ 返回补回账
-            ? '暂无支出'
+            ? '未支出'
-              ? `待补 ${formatYuan(progress.outstanding)}`
+              ? `待补回 ${formatYuan(progress.outstanding)}`
-                ? `多补 ${formatYuan(-progress.outstanding)}`
+                ? `多补回 ${formatYuan(-progress.outstanding)}`
-                : '已补齐'}
+                : '已补回'}
-          已花 {formatYuan(progress.spent)} · 已补 {formatYuan(progress.replenished)}
+          已支出 {formatYuan(progress.spent)} · 已补回 {formatYuan(progress.replenished)}
-        <h2 className="card-title">来回补的过程</h2>
+        <h2 className="card-title">支出与补回记录</h2>
-                  <p className="muted">当时待补 {formatYuan(item.outstandingAfter)}</p>
+                  <p className="muted">当时待补回 {formatYuan(item.outstandingAfter)}</p>
-          记支出
+          记录支出
-          记补回
+          记录补回
-          title="删除这笔流水？"
+          title={deletingEntry.kind === 'spend' ? '删除这笔支出？' : '删除这笔补回？'}
-          message="删除后规划账余额和事项进度会重新计算。"
+          message="删除后补回账余额和事项进度会重新计算。"
```

删除确认框由 `deletingEntry` 条件渲染，`deletingEntry.kind` 在此处已被 TypeScript 收窄，可直接使用。

- [ ] **Step 4: 全局扫描旧文案**

```bash
cd ~/pocket-ledger
grep -rn "规划账\|最近汇入\|已补齐\|暂无支出\|当前可用余额\|起始日期\|修改流水\|计划总花费\|每期结余\|数据版本\|浏览器存储权限" src --include='*.ts' --include='*.tsx' || true
```

预期：无输出。若有残留，按 spec 第 11.10 节对照表修正。

- [ ] **Step 5: 运行受影响测试**

```bash
npx vitest run src/ui/pages/EventDetailPage.test.tsx src/domain/mealV2.test.ts src/storage/jsonStorage.test.ts
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "refactor: unify user-facing terminology and error copy"
```

---

### Task 16: 全量验证与发布 v1.1.0

**Files:**
- Modify: `package.json`
- Modify: `android/app/build.gradle`

- [ ] **Step 1: 全量测试**

```bash
cd ~/pocket-ledger
npm run test:run
```

预期：所有测试文件通过，0 失败。

- [ ] **Step 2: 版本号**

```bash
npm version 1.1.0 --no-git-tag-version
```

预期：`package.json` 与 `package-lock.json` 的 version 都变为 `1.1.0`，且不创建 git tag。

把 `android/app/build.gradle` 的：

```gradle
        versionCode 4
        versionName "1.0.3"
```

改为：

```gradle
        versionCode 5
        versionName "1.1.0"
```

- [ ] **Step 3: 构建网页产物**

```bash
npm run build
```

预期：`tsc -b` 无错误，`vite build` 成功，输出 `dist/` 并生成 service worker。

- [ ] **Step 4: 同步 Capacitor 并打签名 APK**

```bash
npx cap sync android
cd android
./gradlew assembleRelease
```

预期：`BUILD SUCCESSFUL`。签名依赖现有的 `android/keystore.properties` 与 keystore；如果文件缺失或密码错误，停止并请用户确认，不要生成未签名包。

- [ ] **Step 5: 复制 APK**

```bash
cd ~/pocket-ledger
cp android/app/build/outputs/apk/release/app-release.apk "$HOME/Desktop/小账本-v1.1.0.apk"
ls -lh "$HOME/Desktop/小账本-v1.1.0.apk"
```

预期：文件存在且大于 1 MB。

- [ ] **Step 6: 提交版本与发布**

```bash
git add package.json package-lock.json android/app/build.gradle
git commit -m "chore: release v1.1.0"
git push origin main
```

预期：推送成功，GitHub Actions `deploy.yml` 触发 Pages 部署。

- [ ] **Step 7: 验证部署**

```bash
gh run list --workflow=deploy.yml --limit 1
```

预期：最新一次运行状态为 `completed success`。若失败，查看 `gh run view <id> --log-failed` 并修复后重新运行 Task 16。

- [ ] **Step 8: 手工验证清单**

在浏览器打开线上地址或在手机上安装 APK，确认：

- 底部导航显示 `餐补 / 补回账 / 统计 / 设置`
- 餐补主页有「历史周期」入口，点入能看到周期卡片并编辑/删除
- 余额为负时显示「超支 … 天 … 减少」文案；保底时显示「自由额度已用完」
- 补回账主页分区为「待补回 / 本月汇入」，有「已补回 / 汇入记录 / 用款计划」入口
- 已补回按首笔支出月份分组
- 用款计划可新建/编辑/删除，表格四列，时间轴可 ± 调整长度
- 统计页规划账可切换「净变化 / 支出 / 补回 / 汇入」
- 设置页可分别清空餐补、补回账、用款计划

<!-- PLAN-END -->
