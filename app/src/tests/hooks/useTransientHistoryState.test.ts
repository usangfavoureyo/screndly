import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeHandledPopState,
  markNextPopStateAsHandled,
} from '../../hooks/useTransientHistoryState';

describe('useTransientHistoryState popstate suppression', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses every listener during the same handled popstate event', () => {
    vi.useFakeTimers();

    markNextPopStateAsHandled();

    expect(consumeHandledPopState()).toBe(true);
    expect(consumeHandledPopState()).toBe(true);
    expect(consumeHandledPopState()).toBe(true);

    vi.runAllTimers();

    expect(consumeHandledPopState()).toBe(false);
  });
});
