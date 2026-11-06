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
              aria-label={`删除补回计划 ${index + 1}`}
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
      <button className="button button--planning" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
