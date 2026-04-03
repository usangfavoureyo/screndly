const TMDB_REASON_LABELS: Record<string, string> = {
  unscheduled_no_same_day_capacity: 'Could not schedule this post on the same day because the day is already full.',
  posting_window_closed: 'Could not schedule this post because today\'s posting window has already closed.',
  daily_cap_reached: 'Could not schedule this post because the daily posting limit has been reached.',
  conflict_with_reserved_urgent_slots: 'Could not schedule this post because reserved urgent slots are being protected.',
  skipped_due_to_daily_cap: 'Skipped because the daily posting limit was reached.',
  held_for_review_overflow: 'Held for review because the posting schedule is full.',
  rescheduled_with_caption_regen: 'Rescheduled because the original slot was unavailable and the caption timing was regenerated.',
  dropped_due_to_overflow_policy: 'Dropped because the posting schedule was full and the overflow policy skipped it.',
  reschedule_window_expired: 'Could not reschedule this post because the valid scheduling window has expired.',
  scheduled_same_day: 'Scheduled for the same day.',
};

export function formatTMDbReasonLabel(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const mapped = TMDB_REASON_LABELS[normalized];
  if (mapped) {
    return mapped;
  }

  return normalized
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase());
}
