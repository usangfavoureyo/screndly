import { CheckCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface DetectedTitle {
  title: string;
  releaseDate?: string;
  timestamp: string;
  confidence: number;
  context: string;
}

interface AutoAssignTitlesDialogProps {
  detectedTitles: DetectedTitle[];
  videoCount: number;
  onAutoAssign: () => void;
  onDismiss: () => void;
}

export function AutoAssignTitlesDialog({
  detectedTitles,
  videoCount,
  onAutoAssign,
  onDismiss
}: AutoAssignTitlesDialogProps) {
  const canAutoAssign = videoCount === detectedTitles.length;

  return (
    <div className="px-5 py-4 bg-white dark:bg-[#000000] border-2 border-gray-200 dark:border-[#333333] rounded-xl">
      <div className="flex items-start gap-4">
        <CheckCircle className="flex-shrink-0 w-6 h-6 text-[#ec1e24]" />
        <div className="flex-1">
          <h3 className="text-gray-900 dark:text-white mb-2">
            Voiceover Analysis Complete
          </h3>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mb-3">
            We detected <strong>{detectedTitles.length} {detectedTitles.length === 1 ? 'movie' : 'movies'}</strong> in your voiceover. 
            {canAutoAssign 
              ? " We can automatically assign them to your uploaded videos!"
              : ` You have ${videoCount} videos uploaded.`}
          </p>
          <div className="space-y-2 mb-4">
            {detectedTitles.map((title, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-[#9CA3AF]">#{index + 1}</span>
                <span className="text-gray-900 dark:text-white">{title.title}</span>
                <span className="text-xs text-[#ec1e24]">
                  @ {title.timestamp}
                </span>
                {title.releaseDate && (
                  <span className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                    • {title.releaseDate}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                haptics.light();
                onAutoAssign();
              }}
              disabled={!canAutoAssign}
              className="px-6 py-3 bg-[#ec1e24] hover:bg-[#c71a1f] disabled:bg-[#ec1e24] disabled:cursor-not-allowed text-white disabled:text-white rounded-lg transition-all duration-200 flex items-center gap-2 justify-center"
            >
              <Sparkles className="w-5 h-5 text-white" />
              <span className="text-white">Auto-Assign Titles</span>
            </button>
            <button
              onClick={() => {
                haptics.light();
                onDismiss();
              }}
              className="px-4 py-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-all duration-200"
            >
              I'll Do It Manually
            </button>
          </div>
          {!canAutoAssign && (
            <div className="flex items-center gap-2 mt-2">
              <AlertTriangle className="w-4 h-4 text-[#ec1e24] flex-shrink-0" />
              <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                Video count mismatch: Upload {detectedTitles.length} videos to enable auto-assignment
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
