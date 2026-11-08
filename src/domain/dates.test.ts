import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysInMonth,
  formatCompactMonth,
  formatDateKey,
  formatShortMonth,
  isValidDateKey,
  isValidMonthKey,
  lastNMonths,
  listDates,
  monthEndKey,
  monthOf,
  parseDateKey,
  todayKey,
} from './dates';

describe('dates', () => {
  it('formats and parses local dates', () => {
    expect(formatDateKey(new Date(2026, 10, 6))).toBe('2026-11-06');
    expect(parseDateKey('2026-11-06').getDate()).toBe(6);
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(monthEndKey('2028-02')).toBe('2028-02-29');
  });

  it('counts the actual days in a month', () => {
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
    expect(daysInMonth('2028-02')).toBe(29);
  });

  it('lists inclusive dates and month keys', () => {
    expect(listDates('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(listDates('2026-11-01', 'abc')).toEqual([]);
    expect(listDates('2026-11-03', '2026-11-01')).toEqual([]);
    expect(monthOf('2026-11-06')).toBe('2026-11');
  });

  it('lists the last n months', () => {
    expect(lastNMonths('2026-02-15', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('validates date and month keys', () => {
    expect(isValidDateKey('2026-11-06')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidMonthKey('2026-12')).toBe(true);
    expect(isValidMonthKey('2026-13')).toBe(false);
  });

  it('todayKey uses the provided date', () => {
    expect(todayKey(new Date(2026, 0, 2))).toBe('2026-01-02');
  });

  it('abbreviates months relative to the current year', () => {
    expect(formatShortMonth('2026-11', '2026-11-08')).toBe('11月');
    expect(formatShortMonth('2025-12', '2026-11-08')).toBe('2025年12月');
  });

  it('abbreviates cross-year months for narrow tables', () => {
    expect(formatCompactMonth('2026-11', '2026-11-08')).toBe('11月');
    expect(formatCompactMonth('2027-01', '2026-11-08')).toBe('27年1月');
  });
});
