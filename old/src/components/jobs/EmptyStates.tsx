import { Upload, AlertCircle, CheckCircle, FileX } from 'lucide-react';
import { Button } from '../ui/button';

interface EmptyStateProps {
  type: 'no-jobs' | 'no-failed' | 'no-completed' | 'no-results';
  onAction?: () => void;
}

export function EmptyState({ type, onAction }: EmptyStateProps) {
  const configs = {
    'no-jobs': {
      icon: Upload,
      title: 'No uploads yet',
      description: 'Upload your first video to get started with automated processing and metadata generation.',
      actionLabel: 'Upload Video',
      showAction: true,
    },
    'no-failed': {
      icon: CheckCircle,
      title: 'No failed jobs',
      description: 'All jobs are processing successfully. Great work!',
      actionLabel: null,
      showAction: false,
    },
    'no-completed': {
      icon: AlertCircle,
      title: 'No completed jobs',
      description: 'Completed jobs will appear here once processing is finished.',
      actionLabel: null,
      showAction: false,
    },
    'no-results': {
      icon: FileX,
      title: 'No matching jobs',
      description: 'Try adjusting your filters or search criteria.',
      actionLabel: 'Clear Filters',
      showAction: true,
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="rounded-full bg-gray-100 dark:bg-[#111111] p-6 mb-4">
        <Icon className="w-12 h-12 text-gray-400 dark:text-[#666666]" />
      </div>
      <h3 className="text-gray-900 dark:text-white mb-2 text-center">
        {config.title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center max-w-md mb-6">
        {config.description}
      </p>
      {config.showAction && onAction && config.actionLabel && (
        <Button
          onClick={onAction}
          className="bg-[#ec1e24] hover:bg-[#d01a1f] text-white"
        >
          {config.actionLabel}
        </Button>
      )}
    </div>
  );
}

interface EmptyMetadataProps {
  field: 'title' | 'description' | 'thumbnail';
}

export function EmptyMetadata({ field }: EmptyMetadataProps) {
  const labels = {
    title: 'No title generated',
    description: 'No description available',
    thumbnail: 'No thumbnail',
  };

  return (
    <span className="text-sm text-gray-400 dark:text-[#666666] italic">
      {labels[field]}
    </span>
  );
}
