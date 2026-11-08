import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlanForm } from './PlanForm';

describe('PlanForm', () => {
  it('requires the event title', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PlanForm submitLabel="创建计划" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: '创建计划' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请填写事件内容');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits cents and trimmed content', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PlanForm submitLabel="创建计划" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('事件内容'), '  换电脑  ');
    await user.type(screen.getByLabelText('金额'), '5000');
    await user.click(screen.getByRole('button', { name: '创建计划' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: '换电脑', amount: 500000 }));
  });

  it('rejects a zero amount', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PlanForm submitLabel="创建计划" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('事件内容'), '换电脑');
    await user.type(screen.getByLabelText('金额'), '0');
    await user.click(screen.getByRole('button', { name: '创建计划' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入大于 0 的金额');
  });

  it('prefills initial values', () => {
    render(
      <PlanForm
        initial={{
          spendMonth: '2026-11',
          title: '旅行',
          amount: 200000,
          replenishMonth: '2026-12',
        }}
        submitLabel="保存修改"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('事件内容')).toHaveValue('旅行');
    expect(screen.getByLabelText('金额')).toHaveValue('2000.00');
  });
});
