export type Cents = number;

export function parseYuanToCents(input: string): Cents | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [yuan, fraction = ''] = trimmed.split('.');
  return Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
}

export function centsToYuan(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const yuan = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sign}${yuan}.${fraction}`;
}

export function formatYuan(cents: Cents): string {
  return `¥${centsToYuan(cents)}`;
}

export function formatSignedYuan(cents: Cents): string {
  return `${cents >= 0 ? '+' : '-'}${formatYuan(Math.abs(cents))}`;
}
