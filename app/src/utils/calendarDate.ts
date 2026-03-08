const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

export function isDateOnlyString(value?: string | null): value is string {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value);
}

export function parseCalendarDate(value?: string | null): Date | null {
  if (!value) return null;

  if (isDateOnlyString(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isValidDate(date) ? date : null;
  }

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

export function formatCalendarDate(
  value?: string | null,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
) {
  const date = parseCalendarDate(value);
  if (!date) {
    return value || 'Unknown';
  }

  return date.toLocaleDateString(locale, options);
}

export function formatDateTime(
  value?: string | null,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
) {
  const date = parseCalendarDate(value);
  if (!date) {
    return value || 'Unknown';
  }

  if (isDateOnlyString(value)) {
    return date.toLocaleDateString(locale, options);
  }

  return date.toLocaleString(locale, options);
}

export function getDaysUntilCalendarDate(value: string, referenceDate = new Date()) {
  const target = parseCalendarDate(value);
  if (!target) {
    return 0;
  }

  const referenceStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  return Math.max(0, Math.ceil((targetStart.getTime() - referenceStart.getTime()) / MS_PER_DAY));
}
