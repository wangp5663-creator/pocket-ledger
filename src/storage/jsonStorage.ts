export interface LoadResult<T> {
  value: T;
  error?: string;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadJson<T>(
  key: string,
  validate: (value: unknown) => value is T,
  createDefault: () => T,
): LoadResult<T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { value: createDefault() };
    const parsed: unknown = JSON.parse(raw);
    if (!validate(parsed)) return { value: createDefault(), error: '本地数据格式异常，已重置' };
    return { value: parsed };
  } catch {
    return { value: createDefault(), error: '无法读取本地数据' };
  }
}

export function saveJson<T>(key: string, value: T): string | null {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch {
    return '无法保存数据，请检查浏览器存储权限';
  }
}
