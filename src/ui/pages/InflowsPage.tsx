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
