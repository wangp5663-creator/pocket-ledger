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
      setError('请输入大于 0 的金额');
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
    <Sheet open title={mode === 'create' ? '记一笔' : '修改记录'} onClose={onClose}>
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
        <button className="button button--planning" type="submit">
          保存
        </button>
      </form>
    </Sheet>
  );
}
