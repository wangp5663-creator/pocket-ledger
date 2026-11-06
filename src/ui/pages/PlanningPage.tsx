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
          <span className="muted">本月净变化</span>
          <strong className={summary.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(summary.net)}</strong>
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
                  {progress.outstanding === 0 && progress.spent > 0 && (
                    <span className="badge badge--success">已补齐</span>
                  )}
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
