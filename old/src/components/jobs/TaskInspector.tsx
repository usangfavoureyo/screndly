import { X, FileVideo, Calendar, Hash, AlertCircle, Image as ImageIcon, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useJobsStore } from '../../store/useJobsStore';
import { haptics } from '../../utils/haptics';
import { cn } from '../ui/utils';
import { MetadataConfidence } from './MetadataConfidence';
import { PipelineStageList } from './PipelineProgress';
import { OperatorShortcuts } from './OperatorShortcuts';
import { EmptyMetadata } from './EmptyStates';

interface TaskInspectorProps {
  jobId: string;
  onClose: () => void;
}

export function TaskInspector({ jobId, onClose }: TaskInspectorProps) {
  const { getJob } = useJobsStore();
  const job = getJob(jobId);

  if (!job) {
    return null;
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'processing':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end">
      <div 
        className="h-full w-full max-w-3xl bg-white dark:bg-[#000000] border-l border-gray-200 dark:border-[#333333] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#333333]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-gray-900 dark:text-white truncate">
                {job.fileName}
              </h2>
              <Badge variant="outline" className={getStatusBadgeColor(job.status)}>
                {job.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF] font-mono">
              Job ID: {job.id}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              haptics.light();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-[#666666] dark:hover:text-[#9CA3AF] ml-4"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6">
            {/* Operator Shortcuts */}
            <div>
              <h3 className="text-sm text-gray-500 dark:text-[#6B7280] mb-3">Quick Actions</h3>
              <OperatorShortcuts jobId={jobId} />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-[#111111]">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Source File */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Source File</h3>
                  <div className="p-4 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg bg-gray-200 dark:bg-[#1a1a1a] p-3">
                        <FileVideo className="w-8 h-8 text-gray-600 dark:text-[#9CA3AF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          {job.fileName}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-[#9CA3AF]">
                          {formatFileSize(job.fileSize)}
                        </p>
                        {job.sourceUrl && (
                          <a
                            href={job.sourceUrl}
                            className="text-xs text-[#ec1e24] hover:underline mt-2 inline-block"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Preview Placeholder */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Preview</h3>
                  <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                    <FileVideo className="w-16 h-16 text-gray-600" />
                  </div>
                </div>

                {/* Schedule Info */}
                {job.scheduledFor && (
                  <div className="space-y-3">
                    <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Schedule</h3>
                    <div className="p-4 bg-blue-50 dark:bg-[#001a1a] border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                            Scheduled for
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                            {formatDate(job.scheduledFor)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cost Estimate */}
                {job.costEstimate !== undefined && (
                  <div className="space-y-3">
                    <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Cost Estimate</h3>
                    <div className="p-4 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                          Backend: {job.backendUsed || 'N/A'}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ${job.costEstimate.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {job.error && (
                  <div className="space-y-3">
                    <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Error Details</h3>
                    <div className="p-4 bg-red-50 dark:bg-[#1a0000] border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">
                            {job.error.message}
                          </p>
                          {job.error.cause && (
                            <p className="text-xs text-red-700 dark:text-red-400 mt-2">
                              Cause: {job.error.cause}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Timestamps</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-gray-400 dark:text-[#666666]" />
                        <span className="text-xs text-gray-500 dark:text-[#6B7280]">Created</span>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {formatDate(job.createdAt)}
                      </p>
                    </div>
                    {job.completedAt && (
                      <div className="p-3 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-gray-400 dark:text-[#666666]" />
                          <span className="text-xs text-gray-500 dark:text-[#6B7280]">Completed</span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {formatDate(job.completedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="space-y-6 mt-6">
                {/* Title */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Title</h3>
                  <div className="p-4 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                    {job.metadata.title ? (
                      <p className="text-sm text-gray-900 dark:text-white">
                        {job.metadata.title}
                      </p>
                    ) : (
                      <EmptyMetadata field="title" />
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Description</h3>
                  <div className="p-4 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                    {job.metadata.description ? (
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                        {job.metadata.description}
                      </p>
                    ) : (
                      <EmptyMetadata field="description" />
                    )}
                  </div>
                </div>

                {/* Tags */}
                {job.metadata.tags && job.metadata.tags.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {job.metadata.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#333333]"
                        >
                          <Hash className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thumbnail */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Thumbnail</h3>
                  <div className="aspect-video bg-gray-100 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg flex items-center justify-center overflow-hidden">
                    {job.metadata.thumbnailUrl ? (
                      <img
                        src={job.metadata.thumbnailUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-12 h-12 text-gray-400 dark:text-[#666666] mx-auto mb-2" />
                        <EmptyMetadata field="thumbnail" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata Confidence */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Confidence Scores</h3>
                  <div className="p-4 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                    <MetadataConfidence
                      titleScore={job.metadata.titleScore}
                      thumbnailAvailable={job.metadata.thumbnailAvailable}
                      descriptionWordCount={job.metadata.descriptionWordCount}
                      seoScore={job.metadata.seoScore}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Pipeline Tab */}
              <TabsContent value="pipeline" className="space-y-6 mt-6">
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Current Stage</h3>
                  <PipelineStageList stage={job.stage} status={job.status} />
                </div>

                {/* Progress */}
                <div className="space-y-3">
                  <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Progress</h3>
                  <div className="p-4 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#333333] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Overall Progress</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {Math.round(job.progress)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
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
                  </div>
                </div>
              </TabsContent>

              {/* Events Tab */}
              <TabsContent value="events" className="space-y-6 mt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm text-gray-500 dark:text-[#6B7280]">Event Log</h3>
                    <span className="text-xs text-gray-400 dark:text-[#666666]">
                      {job.events.length} events
                    </span>
                  </div>
                  
                  {job.events.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-gray-400 dark:text-[#666666]">No events recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {job.events.map(event => (
                        <div
                          key={event.id}
                          className="p-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg"
                        >
                          <div className="flex items-start gap-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                event.severity === 'success' && 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
                                event.severity === 'error' && 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
                                event.severity === 'warning' && 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
                                event.severity === 'info' && 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                              )}
                            >
                              {event.severity}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white">
                                {event.message}
                              </p>
                              {event.details && (
                                <p className="text-xs text-gray-600 dark:text-[#9CA3AF] mt-1">
                                  {event.details}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 dark:text-[#666666] mt-1">
                                {formatDate(event.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
