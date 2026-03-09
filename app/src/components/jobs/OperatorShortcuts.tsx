import { useState } from 'react';
import { Copy, FileText, Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from '../ui/bottom-sheet';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { haptics } from '../../utils/haptics';
import { useJobsStore } from '../../store/useJobsStore';

interface DuplicateAndSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceJobId: string;
}

function DuplicateAndSwapModal({ isOpen, onClose, sourceJobId }: DuplicateAndSwapModalProps) {
  const { getJob, duplicateJob, updateJob } = useJobsStore();
  const [newFileName, setNewFileName] = useState('');

  const handleDuplicateAndSwap = async () => {
    haptics.medium();
    
    if (!newFileName.trim()) {
      alert('Please enter a file name');
      return;
    }

    // Duplicate the job
    const newJobId = await duplicateJob(sourceJobId);
    if (!newJobId) {
      return;
    }
    
    // Update with new file name
    updateJob(newJobId, {
      fileName: newFileName,
    });

    onClose();
    setNewFileName('');
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={onClose}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">
          Duplicate Job & Swap File
        </BottomSheetTitle>
        <BottomSheetDescription className="text-gray-600 dark:text-[#9CA3AF]">
          Create a copy of this job with the same metadata but a different file.
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        <div className="space-y-2">
          <Label className="text-gray-900 dark:text-white">New File Name</Label>
          <Input
            placeholder="Enter new file name..."
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
          />
        </div>
      </BottomSheetBody>
      
      <BottomSheetFooter>
        <div className="flex items-center gap-3 w-full">
          <Button
            onClick={() => {
              void handleDuplicateAndSwap();
            }}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d01a1f] text-white"
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicate & Swap
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
          >
            Cancel
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  );
}

interface ApplyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetJobId: string;
}

function ApplyTemplateModal({ isOpen, onClose, targetJobId }: ApplyTemplateModalProps) {
  const { updateJob, jobs } = useJobsStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Get completed jobs as potential templates
  const templates = jobs.filter(j => j.status === 'completed' && j.metadata.title);

  const handleApplyTemplate = () => {
    haptics.medium();
    
    if (!selectedTemplateId) {
      alert('Please select a template');
      return;
    }

    const template = jobs.find(j => j.id === selectedTemplateId);
    if (!template) return;

    // Apply template metadata
    updateJob(targetJobId, {
      metadata: {
        ...template.metadata,
        thumbnailAvailable: false, // Reset thumbnail
      },
    });

    onClose();
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={onClose}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">
          Apply Metadata Template
        </BottomSheetTitle>
        <BottomSheetDescription className="text-gray-600 dark:text-[#9CA3AF]">
          Apply metadata from a previous successful job.
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF] text-center py-4">
            No completed jobs available as templates.
          </p>
        ) : (
          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-white">Select Template</Label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white"
            >
              <option value="">Choose a template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.fileName} - {template.metadata.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </BottomSheetBody>
      
      <BottomSheetFooter>
        <div className="flex items-center gap-3 w-full">
          <Button
            onClick={handleApplyTemplate}
            disabled={!selectedTemplateId}
            className="flex-1 bg-[#ec1e24] hover:bg-[#d01a1f] text-white disabled:opacity-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Apply Template
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
          >
            Cancel
          </Button>
        </div>
      </BottomSheetFooter>
    </BottomSheet>
  );
}

interface GenerateTitlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

function GenerateTitlesModal({ isOpen, onClose, jobId }: GenerateTitlesModalProps) {
  const { getJob, updateJob } = useJobsStore();
  const [titles, setTitles] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  const job = getJob(jobId);

  const handleGenerateTitles = async () => {
    haptics.medium();
    setGenerating(true);

    // Simulate GPT generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    const generatedTitles = [
      `${job?.fileName || 'Video'} - Official Trailer`,
      `${job?.fileName || 'Video'} - Behind the Scenes`,
      `${job?.fileName || 'Video'} - Exclusive Footage`,
      `Watch: ${job?.fileName || 'Video'} Latest Updates`,
      `${job?.fileName || 'Video'} - First Look`,
    ];

    setTitles(generatedTitles);
    setGenerating(false);
  };

  const handleSelectTitle = () => {
    haptics.medium();
    
    if (!selectedTitle) {
      alert('Please select a title');
      return;
    }

    updateJob(jobId, {
      metadata: {
        ...job?.metadata,
        title: selectedTitle,
        titleScore: 85 + Math.floor(Math.random() * 15), // Random score 85-99
        thumbnailAvailable: job?.metadata.thumbnailAvailable || false,
      },
    });

    onClose();
    setTitles([]);
    setSelectedTitle(null);
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={onClose}>
      <BottomSheetHeader>
        <BottomSheetTitle className="text-gray-900 dark:text-white">
          Generate Title Variants
        </BottomSheetTitle>
        <BottomSheetDescription className="text-gray-600 dark:text-[#9CA3AF]">
          Generate 5 optimized title options and select the best one.
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        {titles.length === 0 ? (
          <Button
            onClick={handleGenerateTitles}
            disabled={generating}
            className="w-full bg-[#ec1e24] hover:bg-[#d01a1f] text-white"
          >
            <Wand2 className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate 5 Titles'}
          </Button>
        ) : (
          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-white">Select a Title</Label>
            {titles.map((title, index) => (
              <button
                key={index}
                onClick={() => {
                  haptics.light();
                  setSelectedTitle(title);
                }}
                className={`w-full p-3 text-left rounded-lg border transition-colors ${
                  selectedTitle === title
                    ? 'border-[#ec1e24] bg-red-50 dark:bg-[#1a0000]'
                    : 'border-gray-200 dark:border-[#333333] bg-white dark:bg-[#000000] hover:border-gray-300 dark:hover:border-[#444444]'
                }`}
              >
                <p className="text-sm text-gray-900 dark:text-white">{title}</p>
              </button>
            ))}
          </div>
        )}
      </BottomSheetBody>
      
      {titles.length > 0 && (
        <BottomSheetFooter>
          <div className="flex items-center gap-3 w-full">
            <Button
              onClick={handleSelectTitle}
              disabled={!selectedTitle}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d01a1f] text-white disabled:opacity-50"
            >
              Apply Selected Title
            </Button>
            <Button
              onClick={() => {
                setTitles([]);
                setSelectedTitle(null);
                onClose();
              }}
              variant="outline"
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
            >
              Cancel
            </Button>
          </div>
        </BottomSheetFooter>
      )}
    </BottomSheet>
  );
}

interface OperatorShortcutsProps {
  jobId: string;
}

export function OperatorShortcuts({ jobId }: OperatorShortcutsProps) {
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTitlesModal, setShowTitlesModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={() => {
            haptics.light();
            setShowDuplicateModal(true);
          }}
          variant="outline"
          size="sm"
          className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
        >
          <Copy className="w-4 h-4 mr-2" />
          Duplicate & Swap
        </Button>

        <Button
          onClick={() => {
            haptics.light();
            setShowTemplateModal(true);
          }}
          variant="outline"
          size="sm"
          className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
        >
          <FileText className="w-4 h-4 mr-2" />
          Apply Template
        </Button>

        <Button
          onClick={() => {
            haptics.light();
            setShowTitlesModal(true);
          }}
          variant="outline"
          size="sm"
          className="border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Generate Titles
        </Button>
      </div>

      {/* Modals */}
      <DuplicateAndSwapModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        sourceJobId={jobId}
      />

      <ApplyTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        targetJobId={jobId}
      />

      <GenerateTitlesModal
        isOpen={showTitlesModal}
        onClose={() => setShowTitlesModal(false)}
        jobId={jobId}
      />
    </>
  );
}
