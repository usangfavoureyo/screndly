import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addCalendarDays,
    addCalendarMonths,
    getCalendarMonthTargetDate,
    getExactDayDifference,
    isLeapYear,
} from '../lib/tmdb-date';
import {
    buildCaptionContext,
    evaluateCandidateEligibility,
    getCanonicalKey,
    getCycleKey,
    getModuleSource,
    scheduleCandidates,
    type SchedulerSettings,
    type TMDbCandidate,
} from '../services/tmdb-feed.domain';

const timezone = 'Africa/Lagos';

function createCandidate(overrides: Partial<TMDbCandidate> = {}): TMDbCandidate {
    return {
        provider: 'tmdb',
        moduleType: 'today',
        mediaType: 'movie',
        tmdbId: 101,
        title: 'Sample Title',
        releaseDate: new Date('2026-03-25T00:00:00.000Z'),
        originalReleaseDate: null,
        anniversaryMilestone: null,
        source: 'tmdb_today',
        overview: 'Overview',
        originalLanguage: 'en',
        popularity: 10,
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        cast: ['Actor One', 'Actor Two'],
        genres: ['Drama'],
        platforms: ['x'],
        ...overrides,
    };
}

function createSchedulerSettings(overrides: Partial<SchedulerSettings> = {}): SchedulerSettings {
    return {
        schedulingMode: 'adaptive',
        postingWindowStart: '09:00',
        postingWindowEnd: '21:00',
        minGapBetweenPostsMinutes: 60,
        preferredGapBetweenSameModuleMinutes: 120,
        maxPostsPerDayOverall: 4,
        maxPostsPerModulePerDay: 4,
        reserveUrgentSlots: 1,
        weeklyOverflowPolicy: 'RESCHEDULE_WITH_REGEN',
        monthlyOverflowPolicy: 'RESCHEDULE_WITH_REGEN',
        weeklyRescheduleValidityDays: 2,
        monthlyRescheduleValidityDays: 7,
        interleaveModules: true,
        ...overrides,
    };
}

test('today eligibility requires an exact same-day release', () => {
    const now = new Date('2026-03-25T07:00:00.000Z');
    const exact = evaluateCandidateEligibility('today', new Date('2026-03-25T00:00:00.000Z'), now, timezone);
    const missed = evaluateCandidateEligibility('today', new Date('2026-03-26T00:00:00.000Z'), now, timezone);

    assert.equal(exact.eligible, true);
    assert.equal(missed.eligible, false);
    assert.equal(missed.reason, 'not_exact_today');
});

test('weekly eligibility requires exact D+7, not within the next seven days', () => {
    const now = new Date('2026-03-25T07:00:00.000Z');
    const exact = evaluateCandidateEligibility('weekly', new Date('2026-04-01T00:00:00.000Z'), now, timezone);
    const early = evaluateCandidateEligibility('weekly', new Date('2026-03-31T00:00:00.000Z'), now, timezone);

    assert.equal(exact.eligible, true);
    assert.equal(early.eligible, false);
    assert.equal(early.reason, 'not_exact_weekly_target');
});

test('monthly eligibility uses true calendar month arithmetic', () => {
    const now = new Date('2026-01-31T07:00:00.000Z');
    const exact = evaluateCandidateEligibility('monthly', new Date('2026-02-28T00:00:00.000Z'), now, timezone);
    const wrong = evaluateCandidateEligibility('monthly', new Date('2026-03-02T00:00:00.000Z'), now, timezone);

    assert.equal(exact.eligible, true);
    assert.equal(wrong.eligible, false);
    assert.equal(wrong.reason, 'not_exact_monthly_target');
});

test('anniversary eligibility requires exact month/day and allowed milestone', () => {
    const now = new Date('2026-03-25T07:00:00.000Z');
    const exact = evaluateCandidateEligibility('anniversary', new Date('2006-03-25T00:00:00.000Z'), now, timezone, [20, 25]);
    const wrongDay = evaluateCandidateEligibility('anniversary', new Date('2006-03-24T00:00:00.000Z'), now, timezone, [20, 25]);
    const wrongMilestone = evaluateCandidateEligibility('anniversary', new Date('2021-03-25T00:00:00.000Z'), now, timezone, [20, 25]);

    assert.equal(exact.eligible, true);
    assert.equal(exact.anniversaryMilestone, 20);
    assert.equal(wrongDay.reason, 'not_anniversary_today');
    assert.equal(wrongMilestone.reason, 'anniversary_milestone_not_allowed');
});

test('calendar month helpers handle end-of-month safely', () => {
    assert.equal(addCalendarMonths(new Date('2026-01-31T07:00:00.000Z'), 1, timezone).toISOString().slice(0, 10), '2026-02-28');
    assert.equal(addCalendarMonths(new Date('2024-01-31T07:00:00.000Z'), 1, timezone).toISOString().slice(0, 10), '2024-02-29');
    assert.equal(addCalendarMonths(new Date('2026-03-31T07:00:00.000Z'), 1, timezone).toISOString().slice(0, 10), '2026-04-30');
    assert.equal(getCalendarMonthTargetDate(new Date('2026-08-31T07:00:00.000Z'), 1, timezone).toISOString().slice(0, 10), '2026-09-30');
});

test('day difference and leap year helpers stay deterministic', () => {
    assert.equal(getExactDayDifference(new Date('2026-03-25T09:00:00.000Z'), new Date('2026-04-01T00:00:00.000Z'), timezone), 7);
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2025), false);
});

test('cycle keys are module-aware and anniversary keys include milestone context', () => {
    const todayCandidate = createCandidate();
    const weeklyCandidate = createCandidate({
        moduleType: 'weekly',
        source: getModuleSource('weekly'),
        releaseDate: new Date('2026-04-01T00:00:00.000Z'),
    });
    const anniversaryCandidate = createCandidate({
        moduleType: 'anniversary',
        source: getModuleSource('anniversary'),
        releaseDate: new Date('2026-03-25T00:00:00.000Z'),
        originalReleaseDate: new Date('2006-03-25T00:00:00.000Z'),
        anniversaryMilestone: 20,
    });

    assert.equal(getCanonicalKey('movie', 101), 'tmdb:movie:101');
    assert.notEqual(getCycleKey(todayCandidate, timezone), getCycleKey(weeklyCandidate, timezone));
    assert.equal(
        getCycleKey(anniversaryCandidate, timezone),
        'movie:101:anniversary:2006-03-25:y20',
    );
});

test('caption context uses actual scheduled time for today, weekly, monthly, fallback, and anniversary wording modes', () => {
    const fetchDate = new Date('2026-03-25T07:00:00.000Z');

    const todayContext = buildCaptionContext(
        createCandidate({ moduleType: 'today', source: getModuleSource('today'), releaseDate: new Date('2026-03-25T00:00:00.000Z') }),
        new Date('2026-03-25T09:00:00.000Z'),
        fetchDate,
        timezone,
    );
    const weeklyContext = buildCaptionContext(
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), releaseDate: new Date('2026-04-01T00:00:00.000Z') }),
        new Date('2026-03-25T09:00:00.000Z'),
        fetchDate,
        timezone,
    );
    const monthlyContext = buildCaptionContext(
        createCandidate({ moduleType: 'monthly', source: getModuleSource('monthly'), releaseDate: new Date('2026-04-25T00:00:00.000Z') }),
        new Date('2026-03-25T09:00:00.000Z'),
        fetchDate,
        timezone,
    );
    const fallbackContext = buildCaptionContext(
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), releaseDate: new Date('2026-04-01T00:00:00.000Z') }),
        new Date('2026-03-27T09:00:00.000Z'),
        fetchDate,
        timezone,
    );
    const anniversaryContext = buildCaptionContext(
        createCandidate({
            moduleType: 'anniversary',
            source: getModuleSource('anniversary'),
            releaseDate: new Date('2026-03-25T00:00:00.000Z'),
            originalReleaseDate: new Date('2006-03-25T00:00:00.000Z'),
            anniversaryMilestone: 20,
        }),
        new Date('2026-03-25T10:00:00.000Z'),
        fetchDate,
        timezone,
    );

    assert.equal(todayContext.timingMode, 'release_today');
    assert.equal(weeklyContext.timingMode, 'exact_d_plus_7');
    assert.equal(monthlyContext.timingMode, 'exact_calendar_month_plus_1');
    assert.equal(fallbackContext.timingMode, 'fallback_day_count');
    assert.equal(anniversaryContext.timingMode, 'anniversary_today');
});

test('scheduler prioritizes urgent items and never silently carries them into tomorrow', () => {
    const now = new Date('2026-03-25T18:30:00.000Z');
    const settings = createSchedulerSettings({
        postingWindowStart: '19:00',
        postingWindowEnd: '20:00',
        maxPostsPerDayOverall: 1,
        reserveUrgentSlots: 1,
    });

    const results = scheduleCandidates([
        createCandidate({ moduleType: 'today', source: getModuleSource('today'), tmdbId: 1 }),
        createCandidate({ moduleType: 'anniversary', source: getModuleSource('anniversary'), tmdbId: 2, originalReleaseDate: new Date('2006-03-25T00:00:00.000Z'), anniversaryMilestone: 20 }),
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), tmdbId: 3, releaseDate: new Date('2026-04-01T00:00:00.000Z') }),
    ], [], now, timezone, settings);

    assert.equal(results[0]?.candidate.moduleType, 'today');
    assert.equal(results[0]?.status, 'scheduled');
    assert.equal(results[1]?.candidate.moduleType, 'anniversary');
    assert.equal(results[1]?.status, 'unscheduled');
    assert.equal(results[1]?.reason, 'unscheduled_no_same_day_capacity');
    assert.equal(results[2]?.candidate.moduleType, 'weekly');
    assert.equal(results[2]?.status, 'scheduled');
    assert.equal(results[2]?.reason, 'rescheduled_with_caption_regen');
});

test('weekly overflow DROP and monthly HOLD_FOR_REVIEW stay explicit', () => {
    const now = new Date('2026-03-25T20:30:00.000Z');
    const baseSettings = createSchedulerSettings({
        postingWindowStart: '09:00',
        postingWindowEnd: '20:00',
        maxPostsPerDayOverall: 0,
        reserveUrgentSlots: 0,
    });

    const weeklyDrop = scheduleCandidates([
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), releaseDate: addCalendarDays(now, 7, timezone), tmdbId: 11 }),
    ], [], now, timezone, {
        ...baseSettings,
        weeklyOverflowPolicy: 'DROP',
    });

    const monthlyHold = scheduleCandidates([
        createCandidate({ moduleType: 'monthly', source: getModuleSource('monthly'), releaseDate: addCalendarMonths(now, 1, timezone), tmdbId: 12 }),
    ], [], now, timezone, {
        ...baseSettings,
        monthlyOverflowPolicy: 'HOLD_FOR_REVIEW',
    });

    assert.equal(weeklyDrop[0]?.status, 'unscheduled');
    assert.equal(weeklyDrop[0]?.reason, 'dropped_due_to_overflow_policy');
    assert.equal(monthlyHold[0]?.status, 'queued');
    assert.equal(monthlyHold[0]?.reason, 'held_for_review_overflow');
});

test('reschedule-with-regen computes caption context from the final scheduled date', () => {
    const now = new Date('2026-03-25T20:30:00.000Z');
    const results = scheduleCandidates([
        createCandidate({
            moduleType: 'weekly',
            source: getModuleSource('weekly'),
            tmdbId: 21,
            releaseDate: new Date('2026-04-01T00:00:00.000Z'),
        }),
    ], [], now, timezone, createSchedulerSettings({
        postingWindowStart: '09:00',
        postingWindowEnd: '20:00',
        maxPostsPerDayOverall: 0,
        reserveUrgentSlots: 0,
        weeklyOverflowPolicy: 'RESCHEDULE_WITH_REGEN',
    }));

    assert.equal(results[0]?.status, 'scheduled');
    assert.equal(results[0]?.reason, 'rescheduled_with_caption_regen');
    assert.ok(results[0]?.captionContextHash);
    assert.equal(results[0]?.captionContext?.timingMode, 'fallback_day_count');
    assert.equal(results[0]?.captionContext?.exactDayDelta, 6);
});

test('adaptive scheduling spreads candidates across the window and respects the 1 hour floor', () => {
    const now = new Date('2026-04-04T06:00:00.000Z');
    const settings = createSchedulerSettings({
        schedulingMode: 'adaptive',
        postingWindowStart: '08:00',
        postingWindowEnd: '21:00',
        maxPostsPerDayOverall: 20,
        reserveUrgentSlots: 0,
    });

    const results = scheduleCandidates([
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), tmdbId: 1, releaseDate: new Date('2026-04-11T00:00:00.000Z') }),
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), tmdbId: 2, releaseDate: new Date('2026-04-11T00:00:00.000Z') }),
        createCandidate({ moduleType: 'monthly', source: getModuleSource('monthly'), tmdbId: 3, releaseDate: new Date('2026-05-04T00:00:00.000Z') }),
    ], [], now, timezone, settings).filter((item) => item.status === 'scheduled');

    assert.equal(results.length, 3);
    const firstGapMinutes = ((results[1]?.scheduledAt?.getTime() || 0) - (results[0]?.scheduledAt?.getTime() || 0)) / 60000;
    const secondGapMinutes = ((results[2]?.scheduledAt?.getTime() || 0) - (results[1]?.scheduledAt?.getTime() || 0)) / 60000;
    assert.equal(firstGapMinutes, 390);
    assert.equal(secondGapMinutes, 390);
});

test('adaptive scheduling overflows candidates that cannot fit within the 1 hour floor', () => {
    const now = new Date('2026-04-04T06:00:00.000Z');
    const settings = createSchedulerSettings({
        schedulingMode: 'adaptive',
        postingWindowStart: '08:00',
        postingWindowEnd: '12:00',
        maxPostsPerDayOverall: 10,
        reserveUrgentSlots: 0,
    });

    const candidates = Array.from({ length: 6 }, (_, index) => createCandidate({
        moduleType: 'weekly',
        source: getModuleSource('weekly'),
        tmdbId: 100 + index,
        releaseDate: new Date('2026-04-11T00:00:00.000Z'),
    }));

    const results = scheduleCandidates(candidates, [], now, timezone, settings);
    const scheduled = results.filter((item) => item.status === 'scheduled');
    const overflow = results.filter((item) => item.status !== 'scheduled');

    assert.equal(scheduled.length, 5);
    assert.equal(overflow.length, 1);
});

test('fixed scheduling uses the selected interval from the window start', () => {
    const now = new Date('2026-04-04T06:00:00.000Z');
    const settings = createSchedulerSettings({
        schedulingMode: 'fixed',
        postingWindowStart: '08:00',
        postingWindowEnd: '12:00',
        minGapBetweenPostsMinutes: 120,
        maxPostsPerDayOverall: 10,
        reserveUrgentSlots: 0,
    });

    const results = scheduleCandidates([
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), tmdbId: 201, releaseDate: new Date('2026-04-11T00:00:00.000Z') }),
        createCandidate({ moduleType: 'monthly', source: getModuleSource('monthly'), tmdbId: 202, releaseDate: new Date('2026-05-04T00:00:00.000Z') }),
        createCandidate({ moduleType: 'weekly', source: getModuleSource('weekly'), tmdbId: 203, releaseDate: new Date('2026-04-11T00:00:00.000Z') }),
    ], [], now, timezone, settings).filter((item) => item.status === 'scheduled');

    assert.equal(results.length, 3);
    const firstGapMinutes = ((results[1]?.scheduledAt?.getTime() || 0) - (results[0]?.scheduledAt?.getTime() || 0)) / 60000;
    const secondGapMinutes = ((results[2]?.scheduledAt?.getTime() || 0) - (results[1]?.scheduledAt?.getTime() || 0)) / 60000;
    assert.equal(firstGapMinutes, 120);
    assert.equal(secondGapMinutes, 120);
});
