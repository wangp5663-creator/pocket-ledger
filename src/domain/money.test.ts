import { describe, expect, it } from 'vitest';
import { centsToYuan, formatSignedYuan, formatYuan, parseYuanToCents } from './money';

describe('parseYuanToCents', () => {
  it('parses whole and decimal yuan', () => {
    expect(parseYuanToCents('20')).toBe(2000);
    expect(parseYuanToCents('12.3')).toBe(1230);
    expect(parseYuanToCents('0.05')).toBe(5);
    expect(parseYuanToCents('0')).toBe(0);
  });

  it('rejects invalid input', () => {
    expect(parseYuanToCents('')).toBeNull();
    expect(parseYuanToCents('abc')).toBeNull();
    expect(parseYuanToCents('-1')).toBeNull();
    expect(parseYuanToCents('1.234')).toBeNull();
    expect(parseYuanToCents('.5')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats cents as yuan strings', () => {
    expect(centsToYuan(2000)).toBe('20.00');
    expect(centsToYuan(-5)).toBe('-0.05');
    expect(formatYuan(1230)).toBe('¥12.30');
    expect(formatYuan(-500)).toBe('-¥5.00');
    expect(formatYuan(0)).toBe('¥0.00');
    expect(formatSignedYuan(500)).toBe('+¥5.00');
    expect(formatSignedYuan(-500)).toBe('-¥5.00');
  });
});
