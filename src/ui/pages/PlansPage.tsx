import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCompactMonth, formatShortMonth, monthOf, todayKey } from '../../domain/dates';
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
                  aria-label={`${formatShortMonth(item.spendMonth, today)} ${item.title} ${formatYuan(item.amount)} 回补 ${formatShortMonth(item.replenishMonth, today)}`}
                  onClick={() => setEditing(item)}
                >
                  <span>{formatCompactMonth(item.spendMonth, today)}</span>
                  <span className="table__ellipsis">{item.title}</span>
                  <span>{formatYuan(item.amount)}</span>
                  <span>{formatCompactMonth(item.replenishMonth, today)}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="card">
            <h2 className="card-title">月度时间轴</h2>
            <p className="muted plan-timeline__hint">横向为月份；每列左侧是事件，右侧是对应金额。</p>
            <div className="plan-timeline">
              {buckets.map((bucket) => {
                const monthSpends = items.filter((item) => item.spendMonth === bucket.month);
                const monthReplenishes = items.filter((item) => item.replenishMonth === bucket.month);
                return (
                  <div className="plan-timeline__month" key={bucket.month}>
                    <strong className="plan-timeline__month-title">
                      {formatShortMonth(bucket.month, today)}
                    </strong>
                    <div className="plan-timeline__events">
                      {monthSpends.map((item) => (
                        <div className="plan-timeline__row" key={`spend-${item.id}`}>
                          <span className="plan-timeline__event">
                            <span className="plan-timeline__dot plan-timeline__dot--spend" aria-hidden="true" />
                            {item.title}
                          </span>
                          <span className="plan-timeline__amount negative">支出 {formatYuan(item.amount)}</span>
                        </div>
                      ))}
                      {monthReplenishes.map((item) => (
                        <div className="plan-timeline__row" key={`replenish-${item.id}`}>
                          <span className="plan-timeline__event">
                            <span
                              className="plan-timeline__dot plan-timeline__dot--replenish"
                              aria-hidden="true"
                            />
                            {item.title}
                          </span>
                          <span className="plan-timeline__amount positive">回补 {formatYuan(item.amount)}</span>
                        </div>
                      ))}
                      {monthSpends.length === 0 && monthReplenishes.length === 0 && (
                        <span className="plan-timeline__empty">本月无安排</span>
                      )}
                    </div>
                    <div className="plan-timeline__footer">
                      <span>净额 {formatSignedYuan(bucket.net)}</span>
                      <span>累计 {formatSignedYuan(bucket.cumulative)}</span>
                    </div>
                  </div>
                );
              })}
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
