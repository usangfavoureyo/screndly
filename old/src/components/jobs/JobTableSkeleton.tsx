import { Skeleton } from '../ui/skeleton';

export function JobTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg"
        >
          <div className="flex items-center gap-4">
            {/* File info */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 bg-gray-200 dark:bg-[#1a1a1a]" />
              <Skeleton className="h-3 w-32 bg-gray-200 dark:bg-[#1a1a1a]" />
            </div>

            {/* Status */}
            <div className="w-24">
              <Skeleton className="h-6 w-20 bg-gray-200 dark:bg-[#1a1a1a]" />
            </div>

            {/* Stage */}
            <div className="w-32">
              <Skeleton className="h-4 w-24 bg-gray-200 dark:bg-[#1a1a1a]" />
            </div>

            {/* Progress */}
            <div className="w-32">
              <Skeleton className="h-2 w-full bg-gray-200 dark:bg-[#1a1a1a]" />
            </div>

            {/* Metadata */}
            <div className="w-40">
              <Skeleton className="h-4 w-32 bg-gray-200 dark:bg-[#1a1a1a]" />
            </div>

            {/* Actions */}
            <div className="w-8">
              <Skeleton className="h-8 w-8 bg-gray-200 dark:bg-[#1a1a1a]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
