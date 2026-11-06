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
        <button type="button" className="text-button" aria-label={`编辑 ${formatDisplayDate(row.date)}`} onClick={() => onEdit(row)}>
          编辑
        </button>
        <button type="button" className="text-button text-button--danger" aria-label={`删除 ${formatDisplayDate(row.date)}`} onClick={() => onDelete(row)}>
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
    if (editing.date === today) {
      setTodaySpent(centsToYuan(cents));
      setTodayNote(editingNote);
    }
    setEditing(null);
  };

  return (
    <div className="page">
      <section className="balance-card balance-card--green">
        <span className="balance-card__label">当前可用余额</span>
        <strong className={`balance-card__amount${balance < 0 ? ' is-negative' : ''}`}>{formatYuan(balance)}</strong>
        <span className="balance-card__meta">
          已记录 {rows.length} 天 · 起始 {formatDisplayDate(state.settings.startDate)}
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
            if (deleting.date === today) {
              setTodaySpent('');
              setTodayNote('');
            }
            deleteRecord(deleting.date);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
