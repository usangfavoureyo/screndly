type DateInput = Date | string | number;

interface ZonedParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

function toDate(value: DateInput): Date {
    return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function getFormatter(timezone: string, includeTime = false) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(includeTime ? {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        } : {}),
    });
}

function getParts(value: DateInput, timezone: string, includeTime = true): ZonedParts {
    const parts = getFormatter(timezone, includeTime).formatToParts(toDate(value));
    const lookup = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

    return {
        year: lookup('year'),
        month: lookup('month'),
        day: lookup('day'),
        hour: includeTime ? lookup('hour') : 0,
        minute: includeTime ? lookup('minute') : 0,
        second: includeTime ? lookup('second') : 0,
    };
}

function compareParts(a: Pick<ZonedParts, 'year' | 'month' | 'day'>, b: Pick<ZonedParts, 'year' | 'month' | 'day'>) {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
}

function isoDateFromParts(parts: Pick<ZonedParts, 'year' | 'month' | 'day'>): string {
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function localDateToUtcDate(year: number, month: number, day: number, timezone: string): Date {
    const approxUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const actual = getParts(approxUtc, timezone, false);
    const deltaDays = compareParts({ year, month, day }, actual);
    const adjusted = new Date(approxUtc.getTime() + deltaDays * 24 * 60 * 60 * 1000);
    return new Date(Date.UTC(
        adjusted.getUTCFullYear(),
        adjusted.getUTCMonth(),
        adjusted.getUTCDate(),
        12,
        0,
        0,
    ));
}

function localDateTimeToUtcDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timezone: string
): Date {
    let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    for (let index = 0; index < 3; index += 1) {
        const actual = getParts(candidate, timezone, true);
        const deltaDays = compareParts({ year, month, day }, actual);
        const deltaMinutes = ((hour - actual.hour) * 60) + (minute - actual.minute);
        const deltaSeconds = second - actual.second;
        const adjustmentMs = (deltaDays * 24 * 60 * 60 * 1000)
            + (deltaMinutes * 60 * 1000)
            + (deltaSeconds * 1000);

        if (adjustmentMs === 0) {
            return candidate;
        }

        candidate = new Date(candidate.getTime() + adjustmentMs);
    }

    return candidate;
}

export function isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function getLocalDateParts(value: DateInput, timezone: string) {
    const parts = getParts(value, timezone, false);
    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
    };
}

export function getLocalDateIso(value: DateInput, timezone: string): string {
    return isoDateFromParts(getLocalDateParts(value, timezone));
}

export function isSameCalendarDay(dateA: DateInput, dateB: DateInput, timezone: string): boolean {
    return getLocalDateIso(dateA, timezone) === getLocalDateIso(dateB, timezone);
}

export function addCalendarDays(value: DateInput, days: number, timezone: string): Date {
    const parts = getLocalDateParts(value, timezone);
    const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
    const adjusted = getLocalDateParts(utc, timezone);
    return localDateToUtcDate(adjusted.year, adjusted.month, adjusted.day, timezone);
}

export function addCalendarMonths(value: DateInput, months: number, timezone: string): Date {
    const parts = getLocalDateParts(value, timezone);
    const zeroBasedMonth = parts.month - 1 + months;
    const year = parts.year + Math.floor(zeroBasedMonth / 12);
    const monthIndex = ((zeroBasedMonth % 12) + 12) % 12;
    const month = monthIndex + 1;
    const day = Math.min(parts.day, daysInMonth(year, month));
    return localDateToUtcDate(year, month, day, timezone);
}

export function getExactDayDifference(fromDate: DateInput, toDate: DateInput, timezone: string): number {
    const from = getLocalDateParts(fromDate, timezone);
    const to = getLocalDateParts(toDate, timezone);
    const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
    const toUtc = Date.UTC(to.year, to.month - 1, to.day);
    return Math.round((toUtc - fromUtc) / (24 * 60 * 60 * 1000));
}

export function getCalendarMonthTargetDate(today: DateInput, monthsToAdd: number, timezone: string): Date {
    return addCalendarMonths(today, monthsToAdd, timezone);
}

export function formatReleaseDate(value: DateInput, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(toDate(value));
}

export function getWeekdayName(value: DateInput, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
    }).format(toDate(value));
}

export function startOfLocalDay(value: DateInput, timezone: string): Date {
    const parts = getLocalDateParts(value, timezone);
    return localDateTimeToUtcDate(parts.year, parts.month, parts.day, 0, 0, 0, timezone);
}

export function endOfLocalDay(value: DateInput, timezone: string): Date {
    const parts = getLocalDateParts(value, timezone);
    return localDateTimeToUtcDate(parts.year, parts.month, parts.day, 23, 59, 59, timezone);
}

export function getLocalNow(timezone: string, now: Date = new Date()): Date {
    return localDateToUtcDate(
        getLocalDateParts(now, timezone).year,
        getLocalDateParts(now, timezone).month,
        getLocalDateParts(now, timezone).day,
        timezone,
    );
}

export function parseReleaseDate(value: string | undefined | null): Date | null {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
