import { AlertCircle, CheckCircle, MoreVertical, Trash2, Eye, RefreshCw, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { haptics } from '../../utils/haptics';
import { UploadJob, useJobsStore } from '../../store/useJobsStore';
import { cn } from '../ui/utils';
import { MetadataConfidence } from './MetadataConfidence';
import { PipelineProgress } from './PipelineProgress';
import { useUndo } from '../UndoContext';

interface JobRowProps {
  job: UploadJob;
  onViewDetails: (jobId: string) => void;
  onShowError: (job: UploadJob) => void;
}

export function JobRow({ job, onViewDetails, onShowError }: JobRowProps) {
  const { deleteJob, retryJob, duplicateJob, restoreJob } = useJobsStore();
  const { showUndo } = useUndo();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800">
            Pending
          </Badge>
        );
    }
  };

  const handleDelete = () => {
    haptics.medium();
    
    // Store the job data before deletion
    const deletedJob = { ...job };
    
    // Temporarily remove from state
    deleteJob(job.id);
    
    // Show undo toast
    showUndo({
      id: job.id,
      itemName: job.fileName || 'Job',
      onUndo: () => {
        // Restore the job
        restoreJob(deletedJob);
      }
    });
  };

  const handleRetry = () => {
    haptics.medium();
    retryJob(job.id);
  };

  const handleDuplicate = () => {
    haptics.medium();
    duplicateJob(job.id);
  };

  const handleViewDetails = () => {
    haptics.light();
    onViewDetails(job.id);
  };

  return (
    <tr 
      className={cn(
        'border-b border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors cursor-pointer',
        job.status === 'failed' && 'bg-red-50/50 dark:bg-red-900/5'
      )}
      onClick={handleViewDetails}
    >
      {/* File Name */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {job.fileName}
            </p>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-0.5">
              {formatFileSize(job.fileSize)} • {formatDate(job.createdAt)}
            </p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <div className="flex flex-col gap-2">
          {getStatusBadge(job.status)}
          {job.status === 'failed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                haptics.light();
                onShowError(job);
              }}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 justify-start p-0 h-auto"
            >
              View error
            </Button>
          )}
        </div>
      </td>

      {/* Pipeline Stage */}
      <td className="px-4 py-4">
        <PipelineProgress stage={job.stage} status={job.status} compact />
      </td>

      {/* Progress */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                job.status === 'failed' ? 'bg-red-500' :
                job.status === 'completed' ? 'bg-green-500' :
                'bg-[#ec1e24]'
              )}
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 dark:text-[#9CA3AF] w-10 text-right">
            {Math.round(job.progress)}%
          </span>
        </div>
      </td>

      {/* Metadata Confidence */}
      <td className="px-4 py-4">
        <MetadataConfidence
          titleScore={job.metadata.titleScore}
          thumbnailAvailable={job.metadata.thumbnailAvailable}
          descriptionWordCount={job.metadata.descriptionWordCount}
          seoScore={job.metadata.seoScore}
          compact
        />
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600 dark:text-[#666666] dark:hover:text-[#9CA3AF]"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails();
              }}
              className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            
            {job.status === 'failed' && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry();
                  }}
                  className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowError(job);
                  }}
                  className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  View Error
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate();
              }}
              className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-[#333333]" />
            
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
