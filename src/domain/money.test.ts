import { describe, expect, it } from 'vitest';
import {
  centsToYuan,
  formatCompactYuan,
  formatSignedYuan,
  formatYuan,
  formatYuanPlain,
  parseYuanToCents,
} from './money';

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

  it('formats compact values for charts', () => {
    expect(formatCompactYuan(0)).toBe('¥0');
    expect(formatCompactYuan(12345)).toBe('¥123');
    expect(formatCompactYuan(-12345)).toBe('-¥123');
    expect(formatCompactYuan(100000)).toBe('¥1k');
    expect(formatCompactYuan(123456)).toBe('¥1.2k');
    expect(formatCompactYuan(1000000)).toBe('¥10k');
  });

  it('formats plain yuan for highlighted copy', () => {
    expect(formatYuanPlain(0)).toBe('0元');
    expect(formatYuanPlain(400)).toBe('4元');
    expect(formatYuanPlain(450)).toBe('4.50元');
  });
});
