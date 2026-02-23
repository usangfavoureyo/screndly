import { Checkbox } from './ui/checkbox';
import { haptics } from '../utils/haptics';

interface LetterboxControlProps {
  id: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  removeLetterbox: boolean;
  onToggle: (checked: boolean) => void;
  enableAutoframing?: boolean;
  onAutoframingToggle?: (checked: boolean) => void;
}

export function LetterboxControl({ 
  id, 
  aspectRatio, 
  removeLetterbox, 
  onToggle,
  enableAutoframing,
  onAutoframingToggle
}: LetterboxControlProps) {
  // Only show for vertical and square aspect ratios
  if (aspectRatio !== '9:16' && aspectRatio !== '1:1') {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Remove Letterbox Toggle */}
      <div className="flex items-start gap-3 p-3 bg-white dark:bg-[#000000] rounded-lg border border-gray-200 dark:border-[#333333]">
        <Checkbox
          id={id}
          checked={removeLetterbox}
          onCheckedChange={(checked) => {
            haptics.light();
            onToggle(checked as boolean);
          }}
        />
        <label
          htmlFor={id}
          className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">Remove Letterbox (Scale to Fill)</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Scales the 16:9 trailer up to fill the {aspectRatio} frame completely, eliminating black bars by cropping edges
          </p>
        </label>
      </div>

      {/* Autoframing Toggle - Only shows when letterbox removal is enabled */}
      {removeLetterbox && onAutoframingToggle !== undefined && (
        <div className="flex items-start gap-3 p-3 bg-white dark:bg-[#000000] rounded-lg border border-gray-200 dark:border-[#333333] ml-6">
          <Checkbox
            id={`${id}-autoframing`}
            checked={enableAutoframing}
            onCheckedChange={(checked) => {
              haptics.light();
              onAutoframingToggle(checked as boolean);
            }}
          />
          <label
            htmlFor={`${id}-autoframing`}
            className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">AI Autoframing (Beta)</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Intelligently centers faces and action when cropping. Uses AI to detect and track important subjects.
            </p>
          </label>
        </div>
      )}
    </div>
  );
}
