export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(now: Date = new Date()): string {
  return formatDateKey(now);
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

export function listDates(start: string, end: string): string[] {
  if (!isValidDateKey(start) || !isValidDateKey(end) || start > end) return [];
  const dates: string[] = [];
  let current = start;
  while (current <= end) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function monthEndKey(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return formatDateKey(new Date(year, monthNumber, 0));
}

export function daysInMonth(month: string): number {
  return Number(monthEndKey(month).slice(8));
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function lastNMonths(today: string, count: number): string[] {
  const current = monthOf(today);
  const months: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    months.push(addMonths(current, -index));
  }
  return months;
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatDateKey(parseDateKey(value)) === value;
}

export function isValidMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = value.slice(5);
  return month >= '01' && month <= '12';
}

export function formatDisplayDate(key: string): string {
  const [, month, day] = key.split('-').map(Number);
  return `${month}月${day}日`;
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

export function formatShortMonth(month: string, today: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return year === Number(today.slice(0, 4)) ? `${monthNumber}月` : `${year}年${monthNumber}月`;
}

export function formatCompactMonth(month: string, today: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return year === Number(today.slice(0, 4)) ? `${monthNumber}月` : `${String(year).slice(2)}年${monthNumber}月`;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatFullDisplayDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return `${year}年${month}月${day}日 ${WEEKDAYS[new Date(year, month - 1, day).getDay()]}`;
}

export function formatPeriodRange(start: string, end: string): string {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const endText = startYear === endYear ? formatDisplayDate(end) : `${endYear}年${formatDisplayDate(end)}`;
  return `${startYear}年${formatDisplayDate(start)} – ${endText}`;
}

export function formatPeriodShort(start: string, end: string): string {
  const startMonth = monthOf(start);
  const endMonth = monthOf(end);
  if (startMonth === endMonth) return `${Number(start.slice(5, 7))}月`;
  return `${Number(start.slice(5, 7))}/${Number(start.slice(8))}–${Number(end.slice(5, 7))}/${Number(end.slice(8))}`;
}
