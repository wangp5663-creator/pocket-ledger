export const FONT_SCALES = [0.9, 1, 1.1, 1.25] as const;
export type FontScaleValue = (typeof FONT_SCALES)[number];

export const FONT_SCALE_LABELS: Record<FontScaleValue, string> = {
  0.9: '小',
  1: '标准',
  1.1: '大',
  1.25: '特大',
};

const STORAGE_KEY = 'pocket-ledger.ui.v1';

export function loadFontScale(): FontScaleValue {
  if (typeof localStorage === 'undefined') return 1;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1;
    const parsed = JSON.parse(raw) as { fontScale?: unknown } | null;
    const value = parsed?.fontScale;
    return FONT_SCALES.find((scale) => scale === value) ?? 1;
  } catch {
    return 1;
  }
}

export function saveFontScale(value: FontScaleValue): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontScale: value }));
  } catch {
    // 本地存储不可用时只影响持久化，不影响当前显示
  }
}

export function applyFontScale(value: FontScaleValue): void {
  document.documentElement.style.setProperty('--font-scale', String(value));
}
