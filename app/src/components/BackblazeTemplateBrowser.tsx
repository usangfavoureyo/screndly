import { useEffect, useState } from 'react';
import { Cloud, FileImage, Search, Loader2, CheckCircle, FolderOpen } from 'lucide-react';
import { toast } from "sonner";
import { haptics } from '../utils/haptics';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BackblazeBrowserFile, listDesignTemplates } from '../lib/api/backblaze';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';

interface BackblazeTemplateBrowserProps {
  open: boolean;
  onSelectTemplate: (file: BackblazeBrowserFile) => void;
  onClose: () => void;
}

export function BackblazeTemplateBrowser({ open, onSelectTemplate, onClose }: BackblazeTemplateBrowserProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<BackblazeBrowserFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<BackblazeBrowserFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<BackblazeBrowserFile | null>(null);

  useEffect(() => {
    if (open) {
      void loadFiles();
      setSearchQuery('');
      setSelectedFile(null);
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = files.filter(file =>
        file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFiles(filtered);
    } else {
      setFilteredFiles(files);
    }
  }, [searchQuery, files]);

  const loadFiles = async () => {
    setIsLoading(true);
    haptics.light();

    try {
      const result = await listDesignTemplates();

      if (result.success && result.files) {
        setFiles(result.files);
        setFilteredFiles(result.files);

        if (result.files.length === 0) {
          toast.info('No templates found', {
            description: 'Upload PSD templates to your Backblaze Design bucket first',
          });
        } else {
          haptics.success();
          toast.success(`Found ${result.files.length} template${result.files.length > 1 ? 's' : ''}`, {
            description: 'Select one to load into Design Studio',
          });
        }
      } else {
        throw new Error(result.error || 'Failed to load templates');
      }
    } catch (error) {
      haptics.error();
      toast.error('Failed to load Backblaze templates', {
        description: error instanceof Error ? error.message : 'Check your credentials',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = (file: BackblazeBrowserFile) => {
    setSelectedFile(file);
    haptics.light();
  };

  const handleConfirmSelection = () => {
    if (!selectedFile) {
      return;
    }

    haptics.success();
    onSelectTemplate(selectedFile);
    toast.success('Template loaded from Backblaze', {
      description: selectedFile.fileName,
    });
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${sizes[index]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileName = (fileName: string): string => {
    return fileName
      .replace(/^design-studio\/templates\//, '')
      .replace(/^templates\//, '')
      .replace(/\.psd$/i, '');
  };

  return (
    <BottomSheet open={open} onOpenChange={onClose} heightMode="full">
      <BottomSheetHeader>
        <div className="flex items-center gap-3">
          <Cloud className="w-7 h-7 text-[#ec1e24]" />
          <div>
            <BottomSheetTitle>Backblaze B2 Templates</BottomSheetTitle>
            <BottomSheetDescription>
              Select a PSD template from your cloud storage
            </BottomSheetDescription>
          </div>
        </div>
      </BottomSheetHeader>

      <BottomSheetBody className="flex flex-col gap-4 flex-1 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              haptics.light();
              setSearchQuery(e.target.value);
            }}
            onFocus={() => haptics.light()}
            placeholder="Search templates by filename..."
            className="pl-10 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] focus:border-[#292929] dark:focus:border-[#292929]"
            disabled={isLoading}
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-[#ec1e24] animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading templates from Backblaze...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                {searchQuery ? 'No templates match your search' : 'No templates found'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {!searchQuery && 'Upload PSD templates to your Backblaze Design bucket to see them here'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <button
                  key={file.fileId}
                  onClick={() => handleSelectFile(file)}
                  className={`
                    w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                    ${selectedFile?.fileId === file.fileId
                      ? 'border-[#ec1e24] bg-red-50 dark:bg-red-900/10'
                      : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                      ${selectedFile?.fileId === file.fileId
                        ? 'bg-[#ec1e24] text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }
                    `}>
                      {selectedFile?.fileId === file.fileId ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <FileImage className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white truncate mb-1">
                        {formatFileName(file.fileName)}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(file.contentLength)}</span>
                        <span>•</span>
                        <span>{formatDate(file.uploadTimestamp)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </BottomSheetBody>

      <BottomSheetFooter>
        <Button
          onClick={onClose}
          variant="outline"
          className="flex-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirmSelection}
          disabled={!selectedFile}
          className="flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50"
        >
          Load Template
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  );
}
