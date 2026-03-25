import crypto from 'crypto';
import {
    addCalendarDays,
    addCalendarMonths,
    formatReleaseDate,
    getCalendarMonthTargetDate,
    getExactDayDifference,
    getLocalDateIso,
    getWeekdayName,
    isSameCalendarDay,
    parseReleaseDate,
} from '../lib/tmdb-date';

export type TMDbModuleType = 'today' | 'weekly' | 'monthly' | 'anniversary';
export type TMDbOverflowPolicy = 'DROP' | 'HOLD_FOR_REVIEW' | 'RESCHEDULE_WITH_REGEN';
export type TMDbHistoryStatus = 'fetched' | 'scheduled' | 'dispatched' | 'published' | 'skipped' | 'unscheduled';
export type TMDbPostStatus = 'queued' | 'scheduled' | 'dispatched' | 'published' | 'failed' | 'unscheduled' | 'skipped';
export type TMDbDecisionReason =
    | 'not_exact_today'
    | 'not_exact_weekly_target'
    | 'not_exact_monthly_target'
    | 'not_anniversary_today'
    | 'anniversary_milestone_not_allowed'
    | 'missing_release_date'
    | 'already_consumed_in_module_cycle'
    | 'scheduled_same_day'
    | 'unscheduled_no_same_day_capacity'
    | 'posting_window_closed'
    | 'daily_cap_reached'
    | 'conflict_with_reserved_urgent_slots'
    | 'skipped_due_to_daily_cap'
    | 'held_for_review_overflow'
    | 'rescheduled_with_caption_regen'
    | 'dropped_due_to_overflow_policy'
    | 'reschedule_window_expired';

export interface TMDbCandidate {
    provider: 'tmdb';
    moduleType: TMDbModuleType;
    mediaType: 'movie' | 'tv';
    tmdbId: number;
    title: string;
    releaseDate: Date;
    originalReleaseDate?: Date | null;
    anniversaryMilestone?: number | null;
    source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
    overview: string;
    originalLanguage: string;
    popularity: number;
    posterPath: string | null;
    backdropPath: string | null;
    cast: string[];
    genres: string[];
    platforms: string[];
}

export interface EligibilityResult {
    eligible: boolean;
    moduleType: TMDbModuleType;
    targetDate: Date;
    releaseDate: Date | null;
    reason?: TMDbDecisionReason;
    anniversaryMilestone?: number | null;
}

export interface CaptionContext {
    moduleType: TMDbModuleType;
    releaseDate: string;
    scheduledDate: string;
    scheduledDateTime: string;
    fetchDate: string;
    exactDayDelta: number;
    exactMonthDeltaIfRelevant: number | null;
    weekdayName: string;
    formattedReleaseDate: string;
    anniversaryMilestone: number | null;
    isReleaseToday: boolean;
    isOneWeekOut: boolean;
    isOneCalendarMonthOut: boolean;
    timingMode:
        | 'release_today'
        | 'exact_d_plus_7'
        | 'exact_calendar_month_plus_1'
        | 'anniversary_today'
        | 'fallback_exact_date'
        | 'fallback_day_count';
}

export interface SchedulerSettings {
    postingWindowStart: string;
    postingWindowEnd: string;
    minGapBetweenPostsMinutes: number;
    preferredGapBetweenSameModuleMinutes: number;
    maxPostsPerDayOverall: number;
    maxPostsPerModulePerDay: number;
    reserveUrgentSlots: number;
    weeklyOverflowPolicy: TMDbOverflowPolicy;
    monthlyOverflowPolicy: TMDbOverflowPolicy;
    weeklyRescheduleValidityDays: number;
    monthlyRescheduleValidityDays: number;
    interleaveModules: boolean;
}

export interface ScheduledCandidate {
    candidate: TMDbCandidate;
    status: TMDbPostStatus;
    reason: TMDbDecisionReason;
    scheduledAt: Date | null;
    overflowPolicy?: TMDbOverflowPolicy;
    overflowExpiresAt?: Date | null;
    captionContext?: CaptionContext;
    captionContextHash?: string;
}

export function getModuleSource(moduleType: TMDbModuleType): TMDbCandidate['source'] {
    return `tmdb_${moduleType}` as TMDbCandidate['source'];
}

export function getCanonicalKey(mediaType: TMDbCandidate['mediaType'], tmdbId: number): string {
    return `tmdb:${mediaType}:${tmdbId}`;
}

export function getCycleKey(candidate: Pick<TMDbCandidate, 'moduleType' | 'mediaType' | 'tmdbId' | 'releaseDate' | 'originalReleaseDate' | 'anniversaryMilestone'>, timezone: string): string {
    if (candidate.moduleType === 'anniversary') {
        const originalReleaseDate = candidate.originalReleaseDate || candidate.releaseDate;
        return `${candidate.mediaType}:${candidate.tmdbId}:anniversary:${getLocalDateIso(originalReleaseDate, timezone)}:y${candidate.anniversaryMilestone || 0}`;
    }

    return `${candidate.mediaType}:${candidate.tmdbId}:${candidate.moduleType}:${getLocalDateIso(candidate.releaseDate, timezone)}`;
}

export function evaluateCandidateEligibility(
    moduleType: TMDbModuleType,
    releaseDate: Date | null,
    now: Date,
    timezone: string,
    anniversaryMilestones: number[] = [],
): EligibilityResult {
    const localToday = now;
    const todayTarget = new Date(localToday.getTime());
    const weeklyTarget = addCalendarDays(localToday, 7, timezone);
    const monthlyTarget = getCalendarMonthTargetDate(localToday, 1, timezone);

    if (!releaseDate) {
        return {
            eligible: false,
            moduleType,
            targetDate: moduleType === 'today' ? todayTarget : moduleType === 'weekly' ? weeklyTarget : monthlyTarget,
            releaseDate: null,
            reason: 'missing_release_date',
        };
    }

    if (moduleType === 'today') {
        return {
            eligible: isSameCalendarDay(releaseDate, todayTarget, timezone),
            moduleType,
            targetDate: todayTarget,
            releaseDate,
            reason: isSameCalendarDay(releaseDate, todayTarget, timezone) ? undefined : 'not_exact_today',
        };
    }

    if (moduleType === 'weekly') {
        return {
            eligible: isSameCalendarDay(releaseDate, weeklyTarget, timezone),
            moduleType,
            targetDate: weeklyTarget,
            releaseDate,
            reason: isSameCalendarDay(releaseDate, weeklyTarget, timezone) ? undefined : 'not_exact_weekly_target',
        };
    }

    if (moduleType === 'monthly') {
        return {
            eligible: isSameCalendarDay(releaseDate, monthlyTarget, timezone),
            moduleType,
            targetDate: monthlyTarget,
            releaseDate,
            reason: isSameCalendarDay(releaseDate, monthlyTarget, timezone) ? undefined : 'not_exact_monthly_target',
        };
    }

    const todayParts = getLocalDateIso(localToday, timezone).slice(5);
    const releaseParts = getLocalDateIso(releaseDate, timezone).slice(5);
    const milestone = getLocalAnniversaryMilestone(releaseDate, localToday, timezone);

    if (todayParts !== releaseParts) {
        return {
            eligible: false,
            moduleType,
            targetDate: todayTarget,
            releaseDate,
            reason: 'not_anniversary_today',
            anniversaryMilestone: milestone,
        };
    }

    if (!milestone || !anniversaryMilestones.includes(milestone)) {
        return {
            eligible: false,
            moduleType,
            targetDate: todayTarget,
            releaseDate,
            reason: 'anniversary_milestone_not_allowed',
            anniversaryMilestone: milestone,
        };
    }

    return {
        eligible: true,
        moduleType,
        targetDate: todayTarget,
        releaseDate,
        anniversaryMilestone: milestone,
    };
}

export function getLocalAnniversaryMilestone(releaseDate: Date, now: Date, timezone: string): number {
    const releaseYear = Number(getLocalDateIso(releaseDate, timezone).slice(0, 4));
    const currentYear = Number(getLocalDateIso(now, timezone).slice(0, 4));
    return currentYear - releaseYear;
}

export function buildCaptionContext(
    candidate: TMDbCandidate,
    scheduledAt: Date,
    fetchDate: Date,
    timezone: string,
): CaptionContext {
    const exactDayDelta = getExactDayDifference(scheduledAt, candidate.releaseDate, timezone);
    const monthlyTarget = addCalendarMonths(scheduledAt, 1, timezone);
    const isOneCalendarMonthOut = isSameCalendarDay(monthlyTarget, candidate.releaseDate, timezone);
    const isReleaseToday = exactDayDelta === 0;
    const isOneWeekOut = exactDayDelta === 7;

    let timingMode: CaptionContext['timingMode'] = 'fallback_exact_date';
    if (candidate.moduleType === 'anniversary' && isReleaseToday) {
        timingMode = 'anniversary_today';
    } else if (isReleaseToday) {
        timingMode = 'release_today';
    } else if (isOneWeekOut) {
        timingMode = 'exact_d_plus_7';
    } else if (isOneCalendarMonthOut) {
        timingMode = 'exact_calendar_month_plus_1';
    } else if (exactDayDelta > 0) {
        timingMode = 'fallback_day_count';
    }

    return {
        moduleType: candidate.moduleType,
        releaseDate: candidate.releaseDate.toISOString(),
        scheduledDate: scheduledAt.toISOString(),
        scheduledDateTime: scheduledAt.toISOString(),
        fetchDate: fetchDate.toISOString(),
        exactDayDelta,
        exactMonthDeltaIfRelevant: isOneCalendarMonthOut ? 1 : null,
        weekdayName: getWeekdayName(candidate.releaseDate, timezone),
        formattedReleaseDate: formatReleaseDate(candidate.releaseDate, timezone),
        anniversaryMilestone: candidate.anniversaryMilestone || null,
        isReleaseToday,
        isOneWeekOut,
        isOneCalendarMonthOut,
        timingMode,
    };
}

export function hashCaptionContext(context: CaptionContext): string {
    return crypto.createHash('sha1').update(JSON.stringify(context)).digest('hex');
}

function scoreSimilarity(previous: ScheduledCandidate | null, next: TMDbCandidate): number {
    if (!previous) {
        return 0;
    }

    let penalty = 0;
    if (previous.candidate.moduleType === next.moduleType) penalty += 8;
    if (previous.candidate.mediaType === next.mediaType) penalty += 4;
    if (previous.candidate.genres[0] && previous.candidate.genres[0] === next.genres[0]) penalty += 2;
    return penalty;
}

function parseMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
    return (hours * 60) + minutes;
}

function setTimeOfDay(base: Date, timeValue: string) {
    const result = new Date(base.getTime());
    const [hours, minutes] = timeValue.split(':').map((part) => Number.parseInt(part, 10));
    result.setHours(hours, minutes, 0, 0);
    return result;
}

export function scheduleCandidates(
    candidates: TMDbCandidate[],
    existingScheduledTimes: Date[],
    now: Date,
    timezone: string,
    settings: SchedulerSettings,
): ScheduledCandidate[] {
    const urgent = candidates.filter((candidate) => candidate.moduleType === 'today' || candidate.moduleType === 'anniversary');
    const standard = candidates.filter((candidate) => candidate.moduleType === 'weekly' || candidate.moduleType === 'monthly');
    const results: ScheduledCandidate[] = [];
    const reserved = [...existingScheduledTimes].sort((left, right) => left.getTime() - right.getTime());
    const start = setTimeOfDay(now, settings.postingWindowStart);
    const end = setTimeOfDay(now, settings.postingWindowEnd);
    const currentStart = now > start ? now : start;

    const windowMinutes = Math.max(1, Math.floor((end.getTime() - currentStart.getTime()) / 60000));
    const availableSlots = Math.max(0, Math.min(
        settings.maxPostsPerDayOverall,
        Math.floor(windowMinutes / Math.max(1, settings.minGapBetweenPostsMinutes)) + 1,
    ));
    const remainingOverallCapacity = Math.max(0, availableSlots - reserved.length);
    const urgentCapacity = Math.max(0, remainingOverallCapacity);
    const standardCapacity = Math.max(0, remainingOverallCapacity - Math.min(settings.reserveUrgentSlots, urgent.length));

    let previous: ScheduledCandidate | null = null;
    let nextTime = new Date(currentStart.getTime());

    const place = (pool: TMDbCandidate[], capacity: number, urgentMode: boolean) => {
        let used = 0;
        while (pool.length > 0) {
            const sorted = [...pool].sort((left, right) => scoreSimilarity(previous, left) - scoreSimilarity(previous, right));
            const next = sorted[0];
            pool.splice(pool.findIndex((item) => item.tmdbId === next.tmdbId && item.mediaType === next.mediaType && item.moduleType === next.moduleType), 1);

            if (used >= capacity) {
                const overflowPolicy = next.moduleType === 'weekly' ? settings.weeklyOverflowPolicy : settings.monthlyOverflowPolicy;
                if (urgentMode) {
                    results.push({
                        candidate: next,
                        status: 'unscheduled',
                        reason: 'unscheduled_no_same_day_capacity',
                        scheduledAt: null,
                    });
                } else if (overflowPolicy === 'DROP') {
                    results.push({
                        candidate: next,
                        status: 'unscheduled',
                        reason: 'dropped_due_to_overflow_policy',
                        scheduledAt: null,
                        overflowPolicy,
                    });
                } else if (overflowPolicy === 'HOLD_FOR_REVIEW') {
                    results.push({
                        candidate: next,
                        status: 'queued',
                        reason: 'held_for_review_overflow',
                        scheduledAt: null,
                        overflowPolicy,
                    });
                } else {
                    const validityDays = next.moduleType === 'weekly'
                        ? settings.weeklyRescheduleValidityDays
                        : settings.monthlyRescheduleValidityDays;
                    const scheduledAt = addCalendarDays(now, 1, timezone);
                    const overflowExpiresAt = addCalendarDays(now, validityDays, timezone);
                    if (scheduledAt.getTime() > overflowExpiresAt.getTime()) {
                        results.push({
                            candidate: next,
                            status: 'unscheduled',
                            reason: 'reschedule_window_expired',
                            scheduledAt: null,
                            overflowPolicy,
                            overflowExpiresAt,
                        });
                    } else {
                        const captionContext = buildCaptionContext(next, scheduledAt, now, timezone);
                        results.push({
                            candidate: next,
                            status: 'scheduled',
                            reason: 'rescheduled_with_caption_regen',
                            scheduledAt,
                            overflowPolicy,
                            overflowExpiresAt,
                            captionContext,
                            captionContextHash: hashCaptionContext(captionContext),
                        });
                    }
                }
                continue;
            }

            if (nextTime.getTime() > end.getTime()) {
                results.push({
                    candidate: next,
                    status: urgentMode ? 'unscheduled' : 'unscheduled',
                    reason: urgentMode ? 'posting_window_closed' : 'unscheduled_no_same_day_capacity',
                    scheduledAt: null,
                });
                continue;
            }

            const captionContext = buildCaptionContext(next, nextTime, now, timezone);
            const scheduled: ScheduledCandidate = {
                candidate: next,
                status: 'scheduled',
                reason: 'scheduled_same_day',
                scheduledAt: new Date(nextTime.getTime()),
                captionContext,
                captionContextHash: hashCaptionContext(captionContext),
            };
            results.push(scheduled);
            previous = scheduled;
            reserved.push(new Date(nextTime.getTime()));
            used += 1;

            const dynamicGap = Math.max(
                settings.minGapBetweenPostsMinutes,
                Math.floor(windowMinutes / Math.max(1, candidates.length)),
            );
            const extraGap = previous?.candidate.moduleType === next.moduleType ? settings.preferredGapBetweenSameModuleMinutes : 0;
            nextTime = new Date(nextTime.getTime() + Math.max(dynamicGap, extraGap || dynamicGap) * 60000);
        }
    };

    place(urgent, urgentCapacity, true);
    place(standard, standardCapacity, false);

    return results;
}

export function getCandidateReleaseDate(candidate: { release_date?: string; first_air_date?: string }): Date | null {
    return parseReleaseDate(candidate.release_date || candidate.first_air_date || null);
}

export function mapModuleToTemporalTag(context: CaptionContext): 'releasing_today' | 'releasing_this_week' | 'releasing_this_month' | 'anniversary' | 'already_released' {
    switch (context.timingMode) {
        case 'release_today':
            return 'releasing_today';
        case 'exact_d_plus_7':
            return 'releasing_this_week';
        case 'exact_calendar_month_plus_1':
            return 'releasing_this_month';
        case 'anniversary_today':
            return 'anniversary';
        default:
            return context.exactDayDelta > 0 ? 'releasing_this_week' : 'already_released';
    }
}
