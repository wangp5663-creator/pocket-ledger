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
