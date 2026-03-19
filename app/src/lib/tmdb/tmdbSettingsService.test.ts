import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveSettings } from '../api/settings';
import { getAnniversaryYears, getSettingsForBackend } from './tmdbSettingsService';

describe('TMDb settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: {}, meta: {} }),
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges custom anniversary years into the effective TMDb year list', () => {
    localStorage.setItem(
      'screndly_tmdb_settings',
      JSON.stringify({
        anniversaryYears: ['1', '5', '10'],
        customAnniversaryYears: ['30', '50'],
      })
    );

    expect(getAnniversaryYears()).toEqual([1, 5, 10, 30, 50]);
    expect(getSettingsForBackend().customAnniversaryYears).toEqual(['30', '50']);
  });

  it('sends custom anniversary years to the backend payload', async () => {
    await saveSettings({
      anniversaryYears: ['1', '5', '10', '30'],
      customAnniversaryYears: ['30'],
    } as any);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      anniversaryYears: ['1', '5', '10', '30'],
      customAnniversaryYears: ['30'],
    });
  });
});
