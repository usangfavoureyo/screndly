import { Image as ImageIcon } from 'lucide-react';
import { type TMDbFeedImageStyle } from '../../lib/tmdb/feedImageSelection';
import { getTMDbImagePreferenceLabel } from '../../lib/tmdb/tmdbSettingsService';

interface ImageStyleSelectorProps {
  selectedStyle: TMDbFeedImageStyle;
  disabledStyles?: Partial<Record<TMDbFeedImageStyle, boolean>>;
  onSelect: (style: TMDbFeedImageStyle) => void;
}

const STYLE_OPTIONS: TMDbFeedImageStyle[] = [
  'poster',
  'backdrop',
  'backdrop_logo',
  'poster_backdrop',
];

export function ImageStyleSelector({
  selectedStyle,
  disabledStyles,
  onSelect,
}: ImageStyleSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {STYLE_OPTIONS.map((style) => {
        const disabled = Boolean(disabledStyles?.[style]);
        const isSelected = selectedStyle === style;

        return (
          <button
            key={style}
            type="button"
            onClick={() => !disabled && onSelect(style)}
            disabled={disabled}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              isSelected
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-[#333333] dark:bg-black dark:hover:bg-[#111111]'
            } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            <ImageIcon className="mb-3 h-5 w-5 text-gray-600 dark:text-[#9CA3AF]" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {getTMDbImagePreferenceLabel(style)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
