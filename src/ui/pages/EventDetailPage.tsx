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
