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
  const [confirmLabel, setConfirmLabel] = useState('确认删除');

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
      setConfirmLabel('确认');
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
    setConfirmLabel('确认删除');
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
          confirmLabel={confirmLabel}
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
