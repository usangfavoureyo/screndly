/**
 * Transfer Manager Component
 * 
 * Shows active and pending uploads/downloads
 * Allows users to resume, pause, or cancel transfers
 */

import { useState, useEffect } from 'react';
import { Upload, Download, X, Pause, RefreshCw } from 'lucide-react';
import { getPendingTransfers, cancelTransfer } from '../utils/resumableTransfer';
import { Progress } from './ui/progress';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";

interface TransferManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TransferManager({ isOpen, onClose }: TransferManagerProps) {
  const [transfers, setTransfers] = useState(getPendingTransfers());
  const [activeManagers, setActiveManagers] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (isOpen) {
      // Refresh transfers list
      setTransfers(getPendingTransfers());
      
      // Set up interval to refresh
      const interval = setInterval(() => {
        setTransfers(getPendingTransfers());
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleCancel = (id: string) => {
    haptics.medium();
    
    // Get the manager if active
    const manager = activeManagers.get(id);
    if (manager) {
      manager.cancel();
      activeManagers.delete(id);
      setActiveManagers(new Map(activeManagers));
    } else {
      cancelTransfer(id);
    }
    
    setTransfers(getPendingTransfers());
    toast.success('Transfer cancelled');
  };

  const handlePause = (id: string) => {
    haptics.light();
    const manager = activeManagers.get(id);
    if (manager) {
      manager.pause();
      toast.success('Transfer paused');
    }
    setTransfers(getPendingTransfers());
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'in-progress': return 'text-[#ec1e24]';
      case 'paused': return 'text-yellow-600 dark:text-yellow-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'in-progress': return 'Uploading';
      case 'paused': return 'Paused';
      case 'pending': return 'Pending';
      case 'completed': return 'Complete';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center">
      <div className="bg-white dark:bg-[#000000] w-full lg:w-[600px] lg:max-h-[80vh] lg:rounded-xl border-t lg:border border-gray-200 dark:border-[#333333] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-[#ec1e24]" />
            <h2 className="text-gray-900 dark:text-white">Transfers</h2>
            {transfers.length > 0 && (
              <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {transfers.length} active
              </span>
            )}
          </div>
          <button
            onClick={() => {
              haptics.light();
              onClose();
            }}
            className="text-gray-900 dark:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfers List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transfers.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 text-gray-300 dark:text-[#444444] mx-auto mb-3" />
              <p className="text-gray-600 dark:text-[#9CA3AF]">No active transfers</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                Uploads and downloads will appear here
              </p>
            </div>
          ) : (
            transfers.map((transfer) => {
              const progress = (transfer.bytesTransferred / transfer.fileSize) * 100;
              const isUpload = transfer.type === 'upload';
              
              return (
                <div
                  key={transfer.id}
                  className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4"
                >
                  {/* Transfer Info */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${isUpload ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                      {isUpload ? (
                        <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Download className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {transfer.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${getStatusColor(transfer.status)}`}>
                          {getStatusText(transfer.status)}
                        </span>
                        {transfer.section && (
                          <>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] capitalize">
                              {transfer.section}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {transfer.status === 'in-progress' && (
                        <button
                          onClick={() => handlePause(transfer.id)}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] rounded"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleCancel(transfer.id)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <Progress value={progress} className="h-1.5 mb-2" />

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    <span>
                      {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.fileSize)}
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>

                  {/* Chunks Info */}
                  {transfer.status === 'in-progress' && (
                    <div className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {transfer.chunks.filter(c => c.status === 'completed').length} / {transfer.totalChunks} chunks
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        {transfers.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#000000]">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] text-center">
              Transfers will auto-resume if interrupted
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
