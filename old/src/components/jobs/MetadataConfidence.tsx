import { CheckCircle, AlertCircle, XCircle, ImageIcon, FileText } from 'lucide-react';
import { cn } from '../ui/utils';

interface MetadataConfidenceProps {
  titleScore?: number;
  thumbnailAvailable: boolean;
  descriptionWordCount?: number;
  seoScore?: number;
  compact?: boolean;
}

export function MetadataConfidence({
  titleScore,
  thumbnailAvailable,
  descriptionWordCount,
  seoScore,
  compact = false,
}: MetadataConfidenceProps) {
  const getTitleScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400 dark:text-[#666666]';
    if (score >= 80) return 'text-green-600 dark:text-green-500';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-500';
    return 'text-red-600 dark:text-red-500';
  };

  const getSeoScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400 dark:text-[#666666]';
    if (score >= 80) return 'text-green-600 dark:text-green-500';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-500';
    return 'text-red-600 dark:text-red-500';
  };

  const getDescriptionStatus = (wordCount?: number) => {
    if (!wordCount) return { icon: XCircle, color: 'text-gray-400 dark:text-[#666666]', label: 'None' };
    if (wordCount >= 100) return { icon: CheckCircle, color: 'text-green-600 dark:text-green-500', label: `${wordCount} words` };
    if (wordCount >= 50) return { icon: AlertCircle, color: 'text-yellow-600 dark:text-yellow-500', label: `${wordCount} words` };
    return { icon: XCircle, color: 'text-red-600 dark:text-red-500', label: `${wordCount} words` };
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Title Score */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-[#6B7280]">Title:</span>
          <span className={cn('text-xs font-medium', getTitleScoreColor(titleScore))}>
            {titleScore ? `${titleScore}%` : 'N/A'}
          </span>
        </div>

        {/* Thumbnail */}
        <div className="flex items-center gap-1">
          <ImageIcon className={cn(
            'w-3 h-3',
            thumbnailAvailable ? 'text-green-600 dark:text-green-500' : 'text-gray-400 dark:text-[#666666]'
          )} />
        </div>

        {/* SEO Score */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-[#6B7280]">SEO:</span>
          <span className={cn('text-xs font-medium', getSeoScoreColor(seoScore))}>
            {seoScore ? `${seoScore}%` : 'N/A'}
          </span>
        </div>
      </div>
    );
  }

  const descStatus = getDescriptionStatus(descriptionWordCount);
  const DescIcon = descStatus.icon;

  return (
    <div className="space-y-3">
      {/* Title Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400 dark:text-[#666666]" />
          <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Title Quality</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                titleScore && titleScore >= 80 ? 'bg-green-500' :
                titleScore && titleScore >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              )}
              style={{ width: `${titleScore || 0}%` }}
            />
          </div>
          <span className={cn('text-sm font-medium w-10 text-right', getTitleScoreColor(titleScore))}>
            {titleScore ? `${titleScore}%` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-400 dark:text-[#666666]" />
          <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Thumbnail</span>
        </div>
        <div className="flex items-center gap-2">
          {thumbnailAvailable ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-500 font-medium">Available</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-gray-400 dark:text-[#666666]" />
              <span className="text-sm text-gray-400 dark:text-[#666666]">Missing</span>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400 dark:text-[#666666]" />
          <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Description</span>
        </div>
        <div className="flex items-center gap-2">
          <DescIcon className={cn('w-4 h-4', descStatus.color)} />
          <span className={cn('text-sm font-medium', descStatus.color)}>
            {descStatus.label}
          </span>
        </div>
      </div>

      {/* SEO Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-gray-400 dark:text-[#666666]" />
          <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">SEO Score</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                seoScore && seoScore >= 80 ? 'bg-green-500' :
                seoScore && seoScore >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              )}
              style={{ width: `${seoScore || 0}%` }}
            />
          </div>
          <span className={cn('text-sm font-medium w-10 text-right', getSeoScoreColor(seoScore))}>
            {seoScore ? `${seoScore}%` : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
