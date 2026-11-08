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
