import { useState, useEffect } from 'react';
import { Trash2, Play, Pause, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useJobsStore, UploadJob } from '../../store/useJobsStore';
import { haptics } from '../../utils/haptics';
import { JobTable } from './JobTable';
import { TaskInspector } from './TaskInspector';
import { ErrorModal } from './ErrorModal';
import { SystemLogViewer } from './SystemLogViewer';
import { EmptyState } from './EmptyStates';

interface UploadManagerPageProps {
  onBack: () => void;
}

export function UploadManagerPage({ onBack }: UploadManagerPageProps) {
  const {
    jobs,
    isPolling,
    startPolling,
    stopPolling,
    clearCompletedJobs,
    clearFailedJobs,
    clearAllJobs,
    getActiveJobs,
    getFailedJobs,
    getJobsByStatus,
    retryJob,
    duplicateJob,
    refreshJobs,
  } = useJobsStore();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [errorModalJob, setErrorModalJob] = useState<UploadJob | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed' | 'failed' | 'logs'>('all');
  const [loading, setLoading] = useState(true);

  // Start polling on mount
  useEffect(() => {
    let active = true;
    startPolling();
    void (async () => {
      await refreshJobs();
      if (active) {
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      stopPolling();
    };
  }, [refreshJobs, startPolling, stopPolling]);

  const activeJobs = getActiveJobs();
  const failedJobs = getFailedJobs();
  const completedJobs = getJobsByStatus('completed');

  const getFilteredJobs = () => {
    switch (activeTab) {
      case 'active':
        return activeJobs;
      case 'completed':
        return completedJobs;
      case 'failed':
        return failedJobs;
      default:
        return jobs;
    }
  };

  const filteredJobs = getFilteredJobs();

  const handleClearJobs = () => {
    haptics.medium();
    
    if (activeTab === 'completed') {
      if (confirm(`Clear all ${completedJobs.length} completed jobs?`)) {
        clearCompletedJobs();
      }
    } else if (activeTab === 'failed') {
      if (confirm(`Clear all ${failedJobs.length} failed jobs?`)) {
        clearFailedJobs();
      }
    } else {
      if (confirm(`Clear all ${jobs.length} jobs? This cannot be undone.`)) {
        clearAllJobs();
      }
    }
  };

  const handleViewDetails = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  const handleShowError = (job: UploadJob) => {
    setErrorModalJob(job);
  };

  const handleRetryError = () => {
    if (errorModalJob) {
      retryJob(errorModalJob.id);
    }
  };

  const handleDuplicateError = () => {
    if (errorModalJob) {
      void duplicateJob(errorModalJob.id);
    }
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-start gap-4 mb-4">
          <button
            onClick={() => {
              haptics.light();
              onBack();
            }}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1 flex-shrink-0"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2M9 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl text-gray-900 dark:text-white">Upload Manager</h1>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF] mt-1">
              Manage video uploads and processing pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Polling Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              haptics.medium();
              isPolling ? stopPolling() : startPolling();
            }}
            className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
          >
            {isPolling ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>

          <Button
            onClick={() => {
              haptics.light();
              refreshJobs();
            }}
            variant="outline"
            size="sm"
            className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg">
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Total Jobs</p>
          <p className="text-2xl text-gray-900 dark:text-white mt-1">{jobs.length}</p>
        </div>

        <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg">
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Active</p>
          <p className="text-2xl text-gray-900 dark:text-white mt-1">{activeJobs.length}</p>
        </div>

        <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg">
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Completed</p>
          <p className="text-2xl text-gray-900 dark:text-white mt-1">{completedJobs.length}</p>
        </div>

        <div className="p-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg">
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Failed</p>
          <p className="text-2xl text-gray-900 dark:text-white mt-1">{failedJobs.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="bg-gray-100 dark:bg-[#111111] w-max sm:w-auto">
              <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#000000] text-xs sm:text-sm whitespace-nowrap">
                All ({jobs.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#000000] text-xs sm:text-sm whitespace-nowrap">
                Active ({activeJobs.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#000000] text-xs sm:text-sm whitespace-nowrap">
                Completed ({completedJobs.length})
              </TabsTrigger>
              <TabsTrigger value="failed" className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#000000] text-xs sm:text-sm whitespace-nowrap">
                Failed ({failedJobs.length})
              </TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#000000] text-xs sm:text-sm whitespace-nowrap">
                System Logs
              </TabsTrigger>
            </TabsList>
          </div>

          {activeTab !== 'logs' && filteredJobs.length > 0 && (
            <Button
              onClick={handleClearJobs}
              variant="outline"
              size="sm"
              className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111] flex-shrink-0"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear {activeTab === 'all' ? 'All' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </Button>
          )}
        </div>

        {/* All Jobs */}
        <TabsContent value="all" className="mt-6">
          {jobs.length === 0 ? (
            <EmptyState type="no-jobs" />
          ) : (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
              <JobTable
                jobs={filteredJobs}
                loading={loading}
                onViewDetails={handleViewDetails}
                onShowError={handleShowError}
              />
            </div>
          )}
        </TabsContent>

        {/* Active Jobs */}
        <TabsContent value="active" className="mt-6">
          {activeJobs.length === 0 ? (
            <EmptyState type="no-results" />
          ) : (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
              <JobTable
                jobs={filteredJobs}
                loading={loading}
                onViewDetails={handleViewDetails}
                onShowError={handleShowError}
              />
            </div>
          )}
        </TabsContent>

        {/* Completed Jobs */}
        <TabsContent value="completed" className="mt-6">
          {completedJobs.length === 0 ? (
            <EmptyState type="no-completed" />
          ) : (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
              <JobTable
                jobs={filteredJobs}
                loading={loading}
                onViewDetails={handleViewDetails}
                onShowError={handleShowError}
              />
            </div>
          )}
        </TabsContent>

        {/* Failed Jobs */}
        <TabsContent value="failed" className="mt-6">
          {failedJobs.length === 0 ? (
            <EmptyState type="no-failed" />
          ) : (
            <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
              <JobTable
                jobs={filteredJobs}
                loading={loading}
                onViewDetails={handleViewDetails}
                onShowError={handleShowError}
              />
            </div>
          )}
        </TabsContent>

        {/* System Logs */}
        <TabsContent value="logs" className="mt-6">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-6">
            <SystemLogViewer />
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Inspector */}
      {selectedJobId && (
        <TaskInspector
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}

      {/* Error Modal */}
      {errorModalJob && errorModalJob.error && (
        <ErrorModal
          isOpen={true}
          onClose={() => setErrorModalJob(null)}
          error={errorModalJob.error}
          jobId={errorModalJob.id}
          fileName={errorModalJob.fileName}
          onRetry={handleRetryError}
          onDuplicate={handleDuplicateError}
        />
      )}
    </div>
  );
}
