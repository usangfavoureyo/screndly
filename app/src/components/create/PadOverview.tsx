import { Clock3, FilePenLine, Sparkles, Wand2 } from 'lucide-react';
import { PAD_TEMPLATES } from '../../config/create';
import { usePadStore } from '../../store/usePadStore';
import type { PadSession } from '../../types/pad';
import { haptics } from '../../utils/haptics';
import { useSettings } from '../../contexts/SettingsContext';

interface PadOverviewProps {
  onNavigate: (page: string, fromPage?: string) => void;
}

function createSession(templateId: string, title: string, systemPrompt: string): PadSession {
  const timestamp = new Date().toISOString();
  return {
    id: `pad-${Date.now()}`,
    templateId,
    title,
    systemPrompt,
    pinned: false,
    messages: [],
    latestOutput: '',
    outputs: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function PadOverview({ onNavigate }: PadOverviewProps) {
  const { sessions, createSession: createPadSession, setActiveSessionId } = usePadStore();
  const { settings } = useSettings();

  const stats = {
    sessions: sessions.length,
    templates: PAD_TEMPLATES.length,
    drafts: sessions.filter((session) => session.messages.length > 0).length,
    outputs: sessions.reduce((sum, session) => sum + session.outputs.length, 0),
  };

  const handleOpenTemplate = (templateId: string, title: string) => {
    const session = createSession(
      templateId,
      title,
      settings.padChatSystemPrompt
        ? `${settings.padChatSystemPrompt}\n\nTemplate focus: ${title}.`
        : `You are Screndly PAD. Stay focused on the ${title} workflow and respond like a creative writing copilot.`,
    );
    createPadSession(session);
    setActiveSessionId(session.id);
    onNavigate('pad-workspace', 'create');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Sessions</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.sessions}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Templates</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.templates}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Draft Saves</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.drafts}</p>
        </div>
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-5">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-1">Generated Outputs</p>
          <p className="text-gray-900 dark:text-white text-2xl">{stats.outputs}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Quick Start</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Choose a PAD template to open a focused writing workspace.</p>
          </div>
          <div className="rounded-xl bg-[#ec1e24]/10 p-3 text-[#ec1e24]">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PAD_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                haptics.medium();
                handleOpenTemplate(template.id, template.name);
              }}
              className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-[#ec1e24]/60 hover:bg-gray-50 dark:border-[#333333] dark:bg-[#000000] dark:hover:bg-[#111111]"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#ec1e24]/10 text-[#ec1e24]">
                <Wand2 className="h-5 w-5" />
              </div>
              <h4 className="text-gray-900 dark:text-white mb-1">{template.name}</h4>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{template.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-gray-900 dark:text-white mb-1">Recent Sessions</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Resume saved writing sessions and refine generated drafts.</p>
          </div>
          <FilePenLine className="h-5 w-5 text-[#ec1e24]" />
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-[#333333]">
            <Clock3 className="h-10 w-10 text-gray-400 dark:text-[#9CA3AF] mx-auto mb-3" />
            <p className="text-gray-900 dark:text-white mb-2">No PAD sessions yet</p>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Start with a template above to create your first writing workspace.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.slice(0, 5).map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  haptics.light();
                  setActiveSessionId(session.id);
                  onNavigate('pad-workspace', 'create');
                }}
                className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 dark:border-[#333333] dark:bg-[#000000] dark:hover:bg-[#111111]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-gray-900 dark:text-white mb-1 truncate">{session.title}</h4>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] line-clamp-2">
                      {session.messages.at(-1)?.content || session.latestOutput || 'No content saved yet.'}
                    </p>
                  </div>
                  <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
