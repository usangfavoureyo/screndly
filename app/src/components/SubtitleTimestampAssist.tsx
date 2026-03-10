/**
 * Subtitle Timestamp Assistant
 * Uses .srt subtitle files as dialogue-anchored timecodes for scene cutting
 */

import { useState, useRef } from 'react';
import { Search, Clock, FileText, Copy, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { 
  parseSRT, 
  searchSubtitles, 
  SubtitleEntry, 
  validateSRT,
  secondsToFFmpegTime,
  formatDuration,
  generateExtractSubtitlesCommand
} from '../utils/subtitleParser';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { listVideoStudioFiles } from '../lib/api/backblaze';

interface SubtitleTimestampAssistProps {
  videoFileName?: string;
  onSelectTimestamp: (startTime: string, endTime: string, context: string) => void;
  onSubtitlesLoaded?: (entries: SubtitleEntry[]) => void; // For AI Assist integration
  mode?: 'ai' | 'manual'; // Current mode in parent
}

export function SubtitleTimestampAssist({ videoFileName, onSelectTimestamp, onSubtitlesLoaded, mode }: SubtitleTimestampAssistProps) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [filteredSubtitles, setFilteredSubtitles] = useState<SubtitleEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [isLoadingBackblaze, setIsLoadingBackblaze] = useState(false);
  const [showBackblazeFiles, setShowBackblazeFiles] = useState(false);
  const [backblazeSubtitles, setBackblazeSubtitles] = useState<Array<{ fileName: string; url: string; size: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      
      // Validate SRT format
      const validation = validateSRT(content);
      if (!validation.valid) {
        toast.error(`Invalid subtitle file: ${validation.error}`);
        return;
      }

      // Parse SRT content
      const parsed = parseSRT(content);
      
      if (parsed.length === 0) {
        toast.error('No subtitles found in file');
        return;
      }

      setSubtitles(parsed);
      setFilteredSubtitles(parsed);
      setIsExpanded(true);
      haptics.success();
      toast.success(`Loaded ${parsed.length} subtitle entries`);
      
      // Notify parent component (for AI Assist integration)
      onSubtitlesLoaded?.(parsed);
    } catch (error) {
      console.error('Error parsing subtitle file:', error);
      toast.error('Failed to parse subtitle file');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadBackblazeSubtitles = async () => {
    if (window.location.protocol === 'backblaze-disabled:') {
      toast.error('Backblaze Videos Bucket not configured', {
        description: 'Add credentials in Settings → API Keys → Videos Bucket'
      });
      return;
    }

    setIsLoadingBackblaze(true);
    haptics.light();

    try {
      const result = await listVideoStudioFiles('subtitles');

      if (result.success && result.files) {
        // Filter for subtitle files (.srt, .vtt, .sub)
        const subtitleFiles = result.files.filter(file =>
          file.fileName.match(/\.(srt|vtt|sub)$/i)
        ).map(file => ({
          fileName: file.fileName,
          url: file.url,
          size: file.contentLength
        }));

        setBackblazeSubtitles(subtitleFiles);
        setShowBackblazeFiles(true);

        if (subtitleFiles.length === 0) {
          toast.info('No subtitle files found', {
            description: 'Upload .srt files to your Backblaze bucket'
          });
        } else {
          haptics.success();
          toast.success(`Found ${subtitleFiles.length} subtitle file${subtitleFiles.length > 1 ? 's' : ''}`);
        }
      } else {
        throw new Error(result.error || 'Failed to load files');
      }
    } catch (error) {
      haptics.error();
      toast.error('Failed to load Backblaze files', {
        description: error instanceof Error ? error.message : 'Check your credentials'
      });
    } finally {
      setIsLoadingBackblaze(false);
    }
  };

  const loadBackblazeSubtitleFile = async (url: string, fileName: string) => {
    haptics.light();
    toast.loading('Loading subtitle file...', { id: 'load-subtitle' });

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch subtitle file');
      
      const content = await response.text();
      
      // Validate SRT format
      const validation = validateSRT(content);
      if (!validation.valid) {
        toast.error(`Invalid subtitle file: ${validation.error}`, { id: 'load-subtitle' });
        return;
      }

      // Parse SRT content
      const parsed = parseSRT(content);
      
      if (parsed.length === 0) {
        toast.error('No subtitles found in file', { id: 'load-subtitle' });
        return;
      }

      setSubtitles(parsed);
      setFilteredSubtitles(parsed);
      setIsExpanded(true);
      setShowBackblazeFiles(false);
      haptics.success();
      toast.success(`Loaded ${parsed.length} entries from ${fileName}`, { id: 'load-subtitle' });
      
      // Notify parent component (for AI Assist integration)
      onSubtitlesLoaded?.(parsed);
    } catch (error) {
      console.error('Error loading subtitle file:', error);
      toast.error('Failed to load subtitle file', { id: 'load-subtitle' });
      haptics.error();
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredSubtitles(subtitles);
      return;
    }

    const results = searchSubtitles(subtitles, query);
    setFilteredSubtitles(results);
  };

  const handleSelectTimestamp = (entry: SubtitleEntry) => {
    const startTime = secondsToFFmpegTime(entry.startSeconds);
    const endTime = secondsToFFmpegTime(entry.endSeconds);
    
    setSelectedEntry(entry.index);
    haptics.medium();
    onSelectTimestamp(startTime, endTime, entry.text);
    
    toast.success('Timestamp applied to scene', {
      description: `${startTime} → ${endTime}`
    });
  };

  const copyExtractCommand = () => {
    const command = generateExtractSubtitlesCommand(videoFileName || 'input.mp4');
    navigator.clipboard.writeText(command);
    setCopiedCommand(true);
    haptics.light();
    toast.success('FFmpeg command copied');
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const handleDownloadSample = () => {
    const sampleSRT = `1
00:00:10,500 --> 00:00:13,000
Welcome to the world premiere.

2
00:00:15,000 --> 00:00:18,500
This summer's biggest blockbuster.

3
00:00:20,000 --> 00:00:23,500
Prepare for the adventure of a lifetime.

4
00:00:25,000 --> 00:00:28,000
Coming soon to theaters everywhere.
`;
    
    const blob = new Blob([sampleSRT], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    haptics.light();
    toast.success('Sample SRT file downloaded');
  };

  const handleLocalFileClick = () => {
    haptics.light();
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => {
          haptics.light();
          setIsExpanded(!isExpanded);
        }}
        className="w-full px-4 py-3 flex items-center justify-between bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#111111] active:bg-white dark:active:bg-[#000000] focus:bg-white dark:focus:bg-[#000000] focus:outline-none transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900 dark:text-white">
            Subtitle Timestamp Assist
          </span>
          {subtitles.length > 0 && (
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] bg-gray-100 dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
              {subtitles.length} entries
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-[#333333] space-y-4 bg-white dark:bg-[#000000]">
          {/* Info Banner */}
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-lg p-3">
            <p className="text-xs text-black dark:text-white">
              <strong>Subtitle-Based Timestamps:</strong> <span className="text-gray-500 dark:text-gray-400">Upload a .srt file to use dialogue as your temporal index. 
              Click any subtitle to instantly apply its exact timestamps to your scene cut.</span>
            </p>
          </div>

          {/* Upload Section */}
          <div className="space-y-3">
            <Label className="text-gray-600 dark:text-[#9CA3AF] text-xs">
              Upload Subtitle File (.srt)
            </Label>
            
            <div className="grid grid-cols-2 gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt"
                onChange={handleFileUpload}
                className="hidden"
                id="subtitle-upload"
              />
              <Button
                onClick={handleLocalFileClick}
                variant="outline"
                className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
              >
                Local File
              </Button>
              
              <Button
                onClick={() => {
                  haptics.light();
                  loadBackblazeSubtitles();
                }}
                disabled={isLoadingBackblaze}
                variant="outline"
                className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
              >
                {isLoadingBackblaze ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-gray-300 border-t-[#ec1e24] rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Backblaze
                  </>
                )}
              </Button>
            </div>
            
            <Button
              onClick={handleDownloadSample}
              variant="outline"
              size="sm"
              className="w-full !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            >
              Download Sample .srt
            </Button>
          </div>

          {/* AI Assist Helper */}
          {mode === 'ai' && subtitles.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-purple-900 dark:text-purple-200">
                  <strong>AI Assist Mode:</strong> Subtitles loaded! The AI can now use dialogue context to find scenes more accurately. 
                  Try queries like "Find the fight scene" or "hallway confrontation scene".
                </div>
              </div>
            </div>
          )}

          {/* Extract Command */}
          {videoFileName && (
            <div className="space-y-2">
              <Label className="text-gray-600 dark:text-[#9CA3AF] text-xs">
                Extract Embedded Subtitles (FFmpeg)
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333333] rounded px-3 py-2 font-mono text-xs text-gray-900 dark:text-white overflow-x-auto">
                  {generateExtractSubtitlesCommand(videoFileName)}
                </div>
                <Button
                  onClick={copyExtractCommand}
                  variant="outline"
                  size="sm"
                  className="!bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
                >
                  {copiedCommand ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Search */}
          {subtitles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-gray-600 dark:text-[#9CA3AF] text-xs">
                Search Dialogue
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search for dialogue..."
                  className="pl-9 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      haptics.light();
                      handleSearch('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  Found {filteredSubtitles.length} of {subtitles.length} entries
                </p>
              )}
            </div>
          )}

          {/* Subtitle List */}
          {filteredSubtitles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-gray-600 dark:text-[#9CA3AF] text-xs">
                Click to Apply Timestamp
              </Label>
              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                {filteredSubtitles.map((entry) => (
                  <button
                    key={entry.index}
                    onClick={() => handleSelectTimestamp(entry)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedEntry === entry.index
                        ? 'bg-[#ec1e24]/10 border-[#ec1e24] dark:border-[#ec1e24]'
                        : 'bg-gray-50 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#333333] hover:border-[#ec1e24] dark:hover:border-[#ec1e24]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3 text-[#ec1e24]" />
                        <span className="text-gray-900 dark:text-white font-mono">
                          {entry.startTime}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-900 dark:text-white font-mono">
                          {entry.endTime}
                        </span>
                      </div>
                      <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        {formatDuration(entry.duration)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                      {entry.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {subtitles.length === 0 && (
            <div className="text-center py-8 text-[#6B7280] dark:text-[#9CA3AF]">
              <p className="text-sm mb-2">No subtitle file loaded</p>
              <p className="text-xs">
                Upload a .srt file or extract subtitles from your video
              </p>
            </div>
          )}
        </div>
      )}

      {/* Backblaze Subtitle Files Bottom Sheet */}
      <BottomSheet
        open={showBackblazeFiles}
        onOpenChange={(open) => {
          haptics.light();
          setShowBackblazeFiles(open);
        }}
        heightMode="auto"
      >
        <BottomSheetHeader>
          <BottomSheetTitle>Backblaze B2 Subtitle Files</BottomSheetTitle>
          <BottomSheetDescription>
            Select a subtitle file from your Backblaze Videos Bucket
          </BottomSheetDescription>
        </BottomSheetHeader>

        <BottomSheetBody>
          {backblazeSubtitles.length > 0 ? (
            <div className="space-y-2">
              {backblazeSubtitles.map((file, index) => (
                <button
                  key={index}
                  onClick={() => {
                    haptics.light();
                    loadBackblazeSubtitleFile(file.url, file.fileName);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-[#ec1e24] flex-shrink-0" />
                      <span className="text-sm text-gray-900 dark:text-white truncate">
                        {file.fileName}
                      </span>
                    </div>
                    <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] ml-2 flex-shrink-0">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#6B7280] dark:text-[#9CA3AF]">
              <p className="text-sm mb-2">No subtitle files found</p>
              <p className="text-xs">
                Upload .srt, .vtt, or .sub files to your Backblaze Videos Bucket
              </p>
            </div>
          )}
        </BottomSheetBody>

        <BottomSheetFooter>
          <Button
            onClick={() => {
              haptics.light();
              setShowBackblazeFiles(false);
            }}
            variant="outline"
            className="w-full !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white"
          >
            Cancel
          </Button>
        </BottomSheetFooter>
      </BottomSheet>
    </div>
  );
}
