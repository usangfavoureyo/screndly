import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { JobStage } from '../../store/useJobsStore';

interface PipelineProgressProps {
  stage: JobStage;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  compact?: boolean;
}

const stages = [
  { key: 'queued' as JobStage, label: 'In Queue' },
  { key: 'processing' as JobStage, label: 'Processing' },
  { key: 'generating_metadata' as JobStage, label: 'GPT Metadata' },
  { key: 'encoding' as JobStage, label: 'FFmpeg' },
  { key: 'waiting_schedule' as JobStage, label: 'Waiting' },
  { key: 'uploading' as JobStage, label: 'Uploading' },
  { key: 'published' as JobStage, label: 'Published' },
];

export function PipelineProgress({ stage, status, compact = false }: PipelineProgressProps) {
  const currentStageIndex = stages.findIndex(s => s.key === stage);
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-[#6B7280]">
          {stages[currentStageIndex]?.label || 'Unknown'}
        </span>
        {status === 'processing' && (
          <Loader2 className="w-3 h-3 text-[#ec1e24] animate-spin" />
        )}
        {status === 'completed' && (
          <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-500" />
        )}
        {status === 'failed' && (
          <Circle className="w-3 h-3 text-red-600 dark:text-red-500 fill-current" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage indicators */}
      <div className="flex items-center justify-between">
        {stages.map((stageItem, index) => {
          const isPast = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isFuture = index > currentStageIndex;

          return (
            <div key={stageItem.key} className="flex flex-col items-center gap-2 flex-1">
              {/* Icon */}
              <div className="relative">
                {isPast || (isCurrent && isCompleted) ? (
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500" />
                ) : isCurrent && isFailed ? (
                  <Circle className="w-6 h-6 text-red-600 dark:text-red-500 fill-current" />
                ) : isCurrent ? (
                  <Loader2 className="w-6 h-6 text-[#ec1e24] animate-spin" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-300 dark:text-[#333333]" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-xs text-center',
                  isPast || isCurrent
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-400 dark:text-[#666666]'
                )}
              >
                {stageItem.label}
              </span>

              {/* Connector line */}
              {index < stages.length - 1 && (
                <div
                  className={cn(
                    'absolute top-3 left-1/2 w-full h-0.5 -z-10',
                    isPast || (isCurrent && !isFuture)
                      ? 'bg-green-600 dark:bg-green-500'
                      : 'bg-gray-300 dark:bg-[#333333]'
                  )}
                  style={{
                    transform: 'translateX(50%)',
                    width: 'calc(100% - 24px)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-[#ec1e24]'
          )}
          style={{ width: `${((currentStageIndex + 1) / stages.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

interface PipelineStageListProps {
  stage: JobStage;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export function PipelineStageList({ stage, status }: PipelineStageListProps) {
  const currentStageIndex = stages.findIndex(s => s.key === stage);
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <div className="space-y-2">
      {stages.map((stageItem, index) => {
        const isPast = index < currentStageIndex;
        const isCurrent = index === currentStageIndex;

        return (
          <div
            key={stageItem.key}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              isCurrent
                ? 'border-[#ec1e24] bg-red-50 dark:bg-[#1a0000]'
                : isPast
                ? 'border-green-600 dark:border-green-500 bg-green-50 dark:bg-[#001a00]'
                : 'border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000]'
            )}
          >
            {isPast || (isCurrent && isCompleted) ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0" />
            ) : isCurrent && isFailed ? (
              <Circle className="w-5 h-5 text-red-600 dark:text-red-500 fill-current flex-shrink-0" />
            ) : isCurrent ? (
              <Loader2 className="w-5 h-5 text-[#ec1e24] animate-spin flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-gray-300 dark:text-[#333333] flex-shrink-0" />
            )}
            <span
              className={cn(
                'text-sm',
                isCurrent
                  ? 'text-gray-900 dark:text-white font-medium'
                  : isPast
                  ? 'text-gray-600 dark:text-[#9CA3AF]'
                  : 'text-gray-400 dark:text-[#666666]'
              )}
            >
              {stageItem.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
