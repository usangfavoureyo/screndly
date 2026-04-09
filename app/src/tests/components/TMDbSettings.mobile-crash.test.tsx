import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { TMDbSettings } from '../../components/settings/TMDbSettings';

vi.mock('../../utils/haptics', () => ({
  haptics: {
    light: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../../lib/api/settings', () => ({
  fetchSettings: vi.fn().mockResolvedValue({ success: false }),
  saveSettings: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      timezone: 'Africa/Lagos',
      tmdbCaptionModel: 'gpt-5.4-mini',
      todayPrompt: 'prompt',
      weeklyPrompt: 'prompt',
      monthlyPrompt: 'prompt',
      anniversaryPrompt: 'prompt',
      tmdbActivityRetention: 24,
      tmdbLogLevel: 'standard',
    },
    updateSetting: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../components/ui/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('../../components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button type="button" onClick={() => onCheckedChange(!checked)}>
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

vi.mock('../../components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (value: number[]) => void }) => (
    <button type="button" onClick={() => onValueChange(value)}>
      Slider
    </button>
  ),
}));

vi.mock('../../components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? 'value'}</span>,
}));

vi.mock('../../components/ui/pinterest-board-select', () => ({
  PinterestBoardSelect: ({ value }: { value: string }) => <div>{value}</div>,
}));

describe('TMDbSettings mobile persisted state hardening', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders safely with malformed persisted TMDb settings', async () => {
    localStorage.setItem('screndly_tmdb_settings', JSON.stringify({
      preferredImageTypes: null,
      anniversaryYears: null,
      customAnniversaryYears: null,
      movieGenres: null,
      tvGenres: null,
      selectedGenres: null,
      todayPlatforms: null,
      weeklyPlatforms: null,
      monthlyPlatforms: null,
      anniversaryPlatforms: null,
      languageFilter: null,
      tmdbSchedulingMode: null,
      weeklyOverflowPolicy: null,
      monthlyOverflowPolicy: null,
      tmdbLogLevel: null,
      tmdbRegion: null,
      todayPrompt: null,
      weeklyPrompt: null,
      monthlyPrompt: null,
      anniversaryPrompt: null,
      todayPinterestTitlePrompt: null,
      todayPinterestDescriptionPrompt: null,
      weeklyPinterestTitlePrompt: null,
      weeklyPinterestDescriptionPrompt: null,
      monthlyPinterestTitlePrompt: null,
      monthlyPinterestDescriptionPrompt: null,
      anniversaryPinterestTitlePrompt: null,
      anniversaryPinterestDescriptionPrompt: null,
      tmdbDailyRefreshTime: null,
      postingWindowStart: null,
      postingWindowEnd: null,
    }));

    expect(() => render(<TMDbSettings />)).not.toThrow();

    await waitFor(() => {
      expect(screen.getByText('Caption Generation')).toBeInTheDocument();
    });
  });
});
