import { useState, useRef, useEffect } from 'react';
import { UploadJob } from '../../store/useJobsStore';
import { JobRow } from './JobRow';
import { JobTableSkeleton } from './JobTableSkeleton';
import { ScrollArea } from '../ui/scroll-area';

interface JobTableProps {
  jobs: UploadJob[];
  loading?: boolean;
  onViewDetails: (jobId: string) => void;
  onShowError: (job: UploadJob) => void;
}

export function JobTable({ jobs, loading, onViewDetails, onShowError }: JobTableProps) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use virtual scrolling only when there are many jobs (>50)
  const useVirtualScrolling = jobs.length > 50;
  const itemHeight = 80; // Approximate height of each row in pixels

  useEffect(() => {
    if (!useVirtualScrolling || !scrollContainerRef.current) return;

    const handleScroll = () => {
      if (!scrollContainerRef.current) return;

      const scrollTop = scrollContainerRef.current.scrollTop;
      const containerHeight = scrollContainerRef.current.clientHeight;
      
      // Calculate which items should be visible
      const start = Math.floor(scrollTop / itemHeight);
      const end = Math.ceil((scrollTop + containerHeight) / itemHeight) + 10; // Buffer of 10 items
      
      setVisibleRange({ 
        start: Math.max(0, start - 5), // 5 items buffer before
        end: Math.min(jobs.length, end + 5) // 5 items buffer after
      });
    };

    const scrollContainer = scrollContainerRef.current;
    scrollContainer.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [useVirtualScrolling, jobs.length, itemHeight]);

  if (loading) {
    return <JobTableSkeleton />;
  }

  // For virtual scrolling with many items
  if (useVirtualScrolling) {
    const visibleJobs = jobs.slice(visibleRange.start, visibleRange.end);
    const totalHeight = jobs.length * itemHeight;
    const offsetY = visibleRange.start * itemHeight;

    return (
      <div 
        ref={scrollContainerRef}
        className="w-full overflow-auto"
        style={{ maxHeight: '600px' }}
      >
        <div className="min-w-full">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#333333] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                  File
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                  Metadata
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#000000] divide-y divide-gray-200 dark:divide-[#333333]">
              {/* Spacer before visible items */}
              {visibleRange.start > 0 && (
                <tr style={{ height: `${offsetY}px` }}>
                  <td colSpan={6}></td>
                </tr>
              )}
              
              {/* Visible items */}
              {visibleJobs.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  onViewDetails={onViewDetails}
                  onShowError={onShowError}
                />
              ))}
              
              {/* Spacer after visible items */}
              {visibleRange.end < jobs.length && (
                <tr style={{ height: `${totalHeight - (visibleRange.end * itemHeight)}px` }}>
                  <td colSpan={6}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Standard rendering for smaller lists
  return (
    <ScrollArea className="w-full">
      <div className="min-w-full">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#333333]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                File
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                Stage
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                Metadata
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#6B7280] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#000000] divide-y divide-gray-200 dark:divide-[#333333]">
            {jobs.map(job => (
              <JobRow
                key={job.id}
                job={job}
                onViewDetails={onViewDetails}
                onShowError={onShowError}
              />
            ))}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}