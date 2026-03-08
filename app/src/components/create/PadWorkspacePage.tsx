import { useMemo, useState } from 'react';
import { RefreshCw, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { BackIconButton } from '../BackIconButton';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { PAD_TEMPLATES } from '../../config/create';
import { usePadStore } from '../../store/usePadStore';
import { generatePadOutput } from '../../lib/create/generation';

interface PadWorkspacePageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
}

export function PadWorkspacePage({ onNavigate, previousPage }: PadWorkspacePageProps) {
  const { activeSessionId, getSessionById, saveSession } = usePadStore();
  const session = getSessionById(activeSessionId);
  const template = useMemo(
    () => PAD_TEMPLATES.find((entry) => entry.id === session?.templateId) ?? PAD_TEMPLATES[0],
    [session?.templateId],
  );

  const [title, setTitle] = useState(session?.title || template.name);
  const [brief, setBrief] = useState(session?.brief || '');
  const [context, setContext] = useState(session?.context || '');
  const [output, setOutput] = useState(session?.latestOutput || '');
  const [isGenerating, setIsGenerating] = useState(false);

  const persistSession = (nextOutput: string) => {
    if (!session) return;
    const timestamp = new Date().toISOString();
    saveSession({
      ...session,
      title,
      brief,
      context,
      latestOutput: nextOutput,
      outputs: nextOutput && nextOutput !== session.latestOutput
        ? [{ id: `output-${Date.now()}`, content: nextOutput, createdAt: timestamp }, ...session.outputs]
        : session.outputs,
      drafts: nextOutput
        ? [{ id: `draft-${Date.now()}`, content: nextOutput, createdAt: timestamp }, ...session.drafts].slice(0, 5)
        : session.drafts,
      updatedAt: timestamp,
    });
  };

  const handleGenerate = async () => {
    if (!brief.trim()) {
      toast.error('Add a brief before generating');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generatePadOutput({
        templateName: template.name,
        brief,
        context,
      });
      setOutput(generated);
      persistSession(generated);
      toast.success('PAD output generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate PAD output');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = () => {
    persistSession(output);
    toast.success('PAD draft saved');
  };

  if (!session) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-8 text-center">
          <p className="text-gray-900 dark:text-white mb-2">No PAD session selected</p>
          <Button onClick={() => onNavigate('create', previousPage || 'create')}>Back to PAD</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-4 mb-4">
          <BackIconButton onClick={() => onNavigate(previousPage || 'create')} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" />
          <div className="flex-1">
            <div className="mb-2 inline-flex rounded-lg bg-[#ec1e24]/10 px-3 py-1 text-sm text-[#ec1e24]">
              {template.name}
            </div>
            <h1 className="text-gray-900 dark:text-white mb-2">PAD Workspace</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">{template.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Session Title</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
              </div>
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Brief</Label>
                <Textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder={template.promptHint} className="mt-1 min-h-[180px] bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
              </div>
              <div>
                <Label className="text-gray-600 dark:text-[#9CA3AF]">Context</Label>
                <Textarea value={context} onChange={(event) => setContext(event.target.value)} placeholder="Add references, constraints, platforms, or notes for this writing session." className="mt-1 min-h-[140px] bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-gray-900 dark:text-white mb-1">Generated Output</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Write, regenerate, and refine output without leaving the workspace.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
                <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </Button>
              </div>
            </div>
            <Textarea value={output} onChange={(event) => setOutput(event.target.value)} placeholder="Generated PAD output will appear here." className="min-h-[260px] bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]" />
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={handleSaveDraft}>
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
            <h3 className="text-gray-900 dark:text-white mb-4">Recent Outputs</h3>
            {session.outputs.length === 0 ? (
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">No generated outputs yet. Run the workspace once to capture a saved version.</p>
            ) : (
              <div className="space-y-3">
                {session.outputs.slice(0, 5).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setOutput(entry.content)}
                    className="w-full rounded-xl border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 dark:border-[#333333] dark:hover:bg-[#111111]"
                  >
                    <p className="text-sm text-gray-900 dark:text-white line-clamp-3">{entry.content}</p>
                    <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">{new Date(entry.createdAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
