import prisma from '../lib/prisma';

export const API_USAGE_SERVICE_ORDER = [
    'openai',
    'serper',
    'tmdb',
    'shotstack',
    'googleSearch',
    'googleVideo',
] as const;

export type ApiUsageService = typeof API_USAGE_SERVICE_ORDER[number];

export interface TrackApiUsageInput {
    service: ApiUsageService;
    endpoint?: string;
    tokens?: number;
    cost?: number;
    success?: boolean;
}

export interface ApiUsageSummaryRow {
    service: ApiUsageService | 'total';
    label: string;
    daily: number;
    weekly: number;
    monthly: number;
}

export interface ApiUsageCards {
    openai: number;
    serper: number;
    tmdb: number;
    shotstack: number;
    googleSearch: number;
    googleVideo: number;
    total: number;
}

export interface ApiUsageActivitySummary {
    cards: ApiUsageCards;
    summary: ApiUsageSummaryRow[];
}

const API_USAGE_LABELS: Record<ApiUsageService, string> = {
    openai: 'OpenAI API',
    serper: 'Serper API',
    tmdb: 'TMDb API',
    shotstack: 'Shotstack API',
    googleSearch: 'Google Search API',
    googleVideo: 'Google Video Intelligence API',
};

const DB_DEGRADED_LOG_COOLDOWN_MS = 5 * 60 * 1000;

let lastApiUsageWriteWarningAt = 0;
let lastApiUsageReadWarningAt = 0;

function daysAgo(days: number): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date;
}

function emptyCounts(): Record<ApiUsageService, number> {
    return API_USAGE_SERVICE_ORDER.reduce<Record<ApiUsageService, number>>((acc, service) => {
        acc[service] = 0;
        return acc;
    }, {} as Record<ApiUsageService, number>);
}

async function getCountsSince(since: Date): Promise<Record<ApiUsageService, number>> {
    const rows = await prisma.apiUsage.groupBy({
        by: ['service'],
        _count: { _all: true },
        where: {
            createdAt: { gte: since },
            service: { in: [...API_USAGE_SERVICE_ORDER] },
        },
    });

    return rows.reduce<Record<ApiUsageService, number>>((acc, row) => {
        acc[row.service as ApiUsageService] = row._count._all;
        return acc;
    }, emptyCounts());
}

function toCards(counts: Record<ApiUsageService, number>): ApiUsageCards {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return {
        ...counts,
        total,
    };
}

function isPrismaConnectivityError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const maybeError = error as { code?: string; message?: string };

    if (maybeError.code === 'P1001') {
        return true;
    }

    const message = typeof maybeError.message === 'string' ? maybeError.message.toLowerCase() : '';
    return (
        message.includes("can't reach database server") ||
        message.includes('cant reach database server') ||
        message.includes('database server') && message.includes('timed out') ||
        message.includes('connection refused') ||
        message.includes('connection terminated') ||
        message.includes('failed to connect')
    );
}

function shouldLogDbDegradedWarning(lastLoggedAt: number): boolean {
    return Date.now() - lastLoggedAt >= DB_DEGRADED_LOG_COOLDOWN_MS;
}

export async function trackApiUsage(input: TrackApiUsageInput): Promise<void> {
    try {
        await prisma.apiUsage.create({
            data: {
                service: input.service,
                endpoint: input.endpoint,
                tokens: input.tokens ?? 0,
                cost: input.cost ?? 0,
                success: input.success ?? true,
            },
        });
    } catch (error) {
        if (isPrismaConnectivityError(error)) {
            if (shouldLogDbDegradedWarning(lastApiUsageWriteWarningAt)) {
                lastApiUsageWriteWarningAt = Date.now();
                console.warn('[ApiUsage] Usage tracking temporarily unavailable because the database is unreachable. Continuing without recording usage until connectivity recovers.');
            }
            return;
        }

        console.error('[ApiUsage] Failed to record usage:', error);
    }
}

export async function getApiUsageActivitySummary(): Promise<ApiUsageActivitySummary> {
    let dailyCounts: Record<ApiUsageService, number>;
    let weeklyCounts: Record<ApiUsageService, number>;
    let monthlyCounts: Record<ApiUsageService, number>;

    try {
        [dailyCounts, weeklyCounts, monthlyCounts] = await Promise.all([
            getCountsSince(daysAgo(0)),
            getCountsSince(daysAgo(6)),
            getCountsSince(daysAgo(29)),
        ]);
    } catch (error) {
        if (isPrismaConnectivityError(error)) {
            if (shouldLogDbDegradedWarning(lastApiUsageReadWarningAt)) {
                lastApiUsageReadWarningAt = Date.now();
                console.warn('[ApiUsage] API usage summary unavailable because the database is unreachable. Returning empty usage stats until connectivity recovers.');
            }
        } else {
            console.error('[ApiUsage] Failed to load usage summary, returning empty stats:', error);
        }

        dailyCounts = emptyCounts();
        weeklyCounts = emptyCounts();
        monthlyCounts = emptyCounts();
    }

    const summary = API_USAGE_SERVICE_ORDER.map<ApiUsageSummaryRow>((service) => ({
        service,
        label: API_USAGE_LABELS[service],
        daily: dailyCounts[service],
        weekly: weeklyCounts[service],
        monthly: monthlyCounts[service],
    }));

    const totals = summary.reduce(
        (acc, row) => ({
            daily: acc.daily + row.daily,
            weekly: acc.weekly + row.weekly,
            monthly: acc.monthly + row.monthly,
        }),
        { daily: 0, weekly: 0, monthly: 0 }
    );

    summary.push({
        service: 'total',
        label: 'Total',
        daily: totals.daily,
        weekly: totals.weekly,
        monthly: totals.monthly,
    });

    return {
        cards: toCards(dailyCounts),
        summary,
    };
}
