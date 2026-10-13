const DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

export interface ParsedDateTimeValue {
  date: Date;
  hour: number;
  minute: number;
}

function createLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parseDateValue(value?: string | null): Date | null {
  const match = DATE_VALUE_PATTERN.exec(value?.trim() || "");
  if (!match) return null;
  return createLocalDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function formatDateValue(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDateLabel(date: Date): string {
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
}

export function todayDateValue(now = new Date()): string {
  return formatDateValue(now);
}

export function addDaysToDateValue(value: string, days: number): string | null {
  const date = parseDateValue(value);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return formatDateValue(date);
}

export function parseDateTimeValue(value?: string | null): ParsedDateTimeValue | null {
  const match = DATE_TIME_VALUE_PATTERN.exec(value?.trim() || "");
  if (!match) return null;

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour > 23 || minute > 59) return null;

  const date = createLocalDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return date ? { date, hour, minute } : null;
}

export function formatDateTimeValue(date: Date, hour: number, minute: number): string {
  return `${formatDateValue(date)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

