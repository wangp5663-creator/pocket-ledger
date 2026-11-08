import { describe, expect, it, vi } from 'vitest';
import { loadJson, saveJson } from './jsonStorage';

describe('jsonStorage', () => {
  it('returns default when a key is missing', () => {
    expect(loadJson('missing', (value): value is string[] => Array.isArray(value), () => ['default'])).toEqual({
      value: ['default'],
    });
  });

  it('loads valid JSON', () => {
    localStorage.setItem('list', JSON.stringify(['a', 'b']));
    expect(loadJson('list', (value): value is string[] => Array.isArray(value), () => [])).toEqual({
      value: ['a', 'b'],
    });
  });

  it('resets invalid shapes with a warning', () => {
    localStorage.setItem('list', JSON.stringify({ nope: true }));
    expect(loadJson('list', (value): value is string[] => Array.isArray(value), () => [])).toEqual({
      value: [],
      error: '本机数据格式异常，已重置',
    });
  });

  it('resets broken JSON with a warning', () => {
    localStorage.setItem('list', '{broken');
    expect(loadJson('list', (value): value is string[] => Array.isArray(value), () => [])).toEqual({
      value: [],
      error: '无法读取本机数据',
    });
  });

  it('saves JSON and reports failures', () => {
    expect(saveJson('list', ['x'])).toBeNull();
    expect(localStorage.getItem('list')).toBe('["x"]');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveJson('list', ['y'])).toBe('无法保存数据，请检查本机存储空间或应用权限');
    setItemSpy.mockRestore();
  });
});
