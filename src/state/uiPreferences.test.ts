import { beforeEach, describe, expect, it } from 'vitest';
import { applyFontScale, loadFontScale, saveFontScale } from './uiPreferences';

describe('ui preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--font-scale');
  });

  it('defaults to the standard font scale', () => {
    expect(loadFontScale()).toBe(1);
  });

  it('persists a valid font scale', () => {
    saveFontScale(1.25);
    expect(loadFontScale()).toBe(1.25);
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem('pocket-ledger.ui.v1', JSON.stringify({ fontScale: 5 }));
    expect(loadFontScale()).toBe(1);
    localStorage.setItem('pocket-ledger.ui.v1', 'not json');
    expect(loadFontScale()).toBe(1);
  });

  it('applies the CSS variable', () => {
    applyFontScale(1.1);
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.1');
  });
});
