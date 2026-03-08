import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Menu, MoreVertical, Pin, PinOff, Plus, Search, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BackIconButton } from '../BackIconButton';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet';
import { PAD_TEMPLATES } from '../../config/create';
import { useSettings } from '../../contexts/SettingsContext';
import { generatePadReply } from '../../lib/create/generation';
import { usePadStore } from '../../store/usePadStore';
import type { PadAttachment, PadMessage, PadSession } from '../../types/pad';
import { haptics } from '../../utils/haptics';

interface PadWorkspacePageProps {
  onNavigate: (page: string, fromPage?: string) => void;
  previousPage?: string | null;
}

function createChatSession(templateId: string, systemPrompt: string): PadSession {
  const timestamp = new Date().toISOString();
  return {
    id: `pad-${Date.now()}`,
    templateId,
    title: 'New Chat',
    systemPrompt,
    pinned: false,
    messages: [],
    latestOutput: '',
    outputs: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildAttachment(file: File): PadAttachment {
  return {
    id: `attachment-${Date.now()}-${file.name}`,
    name: file.name,
    type: file.type,
    size: file.size,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  };
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function PadWorkspacePage({ onNavigate, previousPage }: PadWorkspacePageProps) {
  const {
    sessions,
    activeSessionId,
    getSessionById,
    setActiveSessionId,
    createSession,
    appendMessage,
    updateSystemPrompt,
    renameSession,
    togglePinned,
    deleteSession,
  } = usePadStore();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<PadAttachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const session = getSessionById(activeSessionId);
  const template = useMemo(
    () => PAD_TEMPLATES.find((entry) => entry.id === session?.templateId) ?? PAD_TEMPLATES[0],
    [session?.templateId],
  );

  const filteredSessions = useMemo(() => {
    const ordered = [...sessions].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    if (!searchQuery.trim()) return ordered;
    const query = searchQuery.toLowerCase();
    return ordered.filter((entry) =>
      [entry.title, entry.systemPrompt, ...entry.messages.map((message) => message.content)].join(' ').toLowerCase().includes(query),
    );
  }, [searchQuery, sessions]);
  const menuSession = useMemo(
    () => sessions.find((entry) => entry.id === menuSessionId) ?? null,
    [menuSessionId, sessions],
  );

  useEffect(() => {
    if (!session && sessions.length > 0) {
      setActiveSessionId(filteredSessions[0]?.id ?? sessions[0].id);
    }
  }, [filteredSessions, session, sessions, setActiveSessionId]);

  const handleNewChat = () => {
    const nextSession = createChatSession(
      template.id,
      settings.padChatSystemPrompt || `You are Screndly PAD. Stay focused on the ${template.name} workflow and respond like a creative writing copilot.`,
    );
    createSession(nextSession);
    setDraft('');
    setAttachments([]);
    haptics.medium();
    if (window.innerWidth < 1024) {
      setIsMobileDrawerOpen(false);
    }
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setAttachments((current) => [...current, ...files.map(buildAttachment)]);
    event.target.value = '';
  };

  const handleSend = async () => {
    if (!session) return;
    if (!draft.trim() && attachments.length === 0) {
      toast.error('Enter a message or attach an image');
      return;
    }

    const now = new Date().toISOString();
    const userMessage: PadMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: draft.trim() || 'Attached images',
      createdAt: now,
      attachments,
    };

    appendMessage(session.id, userMessage);
    setDraft('');
    setAttachments([]);
    setIsGenerating(true);
    haptics.medium();

    try {
      const reply = await generatePadReply({
        model: settings.padChatModel || 'gpt-5-mini',
        systemPrompt: session.systemPrompt,
        history: session.messages.map((message) => ({ role: message.role, content: message.content })),
        message: userMessage.content,
        attachmentNames: userMessage.attachments?.map((entry) => entry.name),
      });

      const assistantMessage: PadMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      appendMessage(session.id, assistantMessage);

      if (session.title === 'New Chat' && userMessage.content.trim()) {
        renameSession(session.id, userMessage.content.trim().slice(0, 42));
      }
      haptics.success();
    } catch (error) {
      haptics.error();
      toast.error(error instanceof Error ? error.message : 'Failed to generate PAD reply');
    } finally {
      setIsGenerating(false);
    }
  };

  const openSessionMenu = (targetSession: PadSession) => {
    setMenuSessionId(targetSession.id);
    setRenameValue(targetSession.title);
    haptics.light();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX;
    if (touchStartX < 28 && delta > 70) {
      setIsMobileDrawerOpen(true);
      haptics.light();
    }
    setTouchStartX(null);
  };

  const renderThreadList = (mobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-4 dark:border-[#333333]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => haptics.light()}
            placeholder="Search chats"
            className="pl-9 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
          />
        </div>
        <Button className="mt-3 w-full" onClick={handleNewChat}>
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {filteredSessions.map((entry) => (
          <div
            key={entry.id}
            onTouchStart={() => {
              if (!mobile) return;
              longPressTimer.current = window.setTimeout(() => openSessionMenu(entry), 450);
            }}
            onTouchEnd={() => {
              if (longPressTimer.current) {
                window.clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }}
            className={`rounded-2xl border p-3 transition-colors ${
              activeSessionId === entry.id
                ? 'border-[#ec1e24] bg-[#ec1e24]/10'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-[#333333] dark:bg-[#000000] dark:hover:bg-[#111111]'
            }`}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSessionId(entry.id);
                  haptics.light();
                  if (mobile) setIsMobileDrawerOpen(false);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm text-gray-900 dark:text-white">{entry.title}</p>
                  {entry.pinned ? <Pin className="h-3.5 w-3.5 text-[#ec1e24]" /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  {entry.messages.at(-1)?.content || entry.systemPrompt || 'No messages yet'}
                </p>
              </button>
              {!mobile ? (
                <button type="button" onClick={() => openSessionMenu(entry)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#111111]">
                  <MoreVertical className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!session) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-[#333333] dark:bg-[#000000]">
          <p className="mb-2 text-gray-900 dark:text-white">No PAD chat selected</p>
          <Button onClick={handleNewChat}>Start New Chat</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="mb-4 flex items-start gap-4">
        <BackIconButton onClick={() => onNavigate(previousPage || 'create')} className="mt-1 -ml-2 p-2 text-gray-900 hover:text-[#ec1e24] dark:text-white" />
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <button type="button" onClick={() => setIsMobileDrawerOpen(true)} className="rounded-lg border border-gray-200 p-2 text-gray-900 dark:border-[#333333] dark:text-white lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <div className="inline-flex rounded-lg bg-[#ec1e24]/10 px-3 py-1 text-sm text-[#ec1e24]">{template.name}</div>
          </div>
          <h1 className="mb-2 text-gray-900 dark:text-white">PAD Chat</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">{template.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#333333] dark:bg-[#000000] lg:block">
          {renderThreadList(false)}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#333333] dark:bg-[#000000]">
          <div className="border-b border-gray-200 p-5 dark:border-[#333333]">
            <Label className="text-gray-600 dark:text-[#9CA3AF]">Chat Context</Label>
            <Textarea
              value={session.systemPrompt}
              onChange={(event) => {
                updateSystemPrompt(session.id, event.target.value);
                haptics.selection();
              }}
              onFocus={() => haptics.light()}
              className="mt-2 min-h-[120px] border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
              placeholder="Set the context this chat should follow for future replies."
            />
          </div>

          <div className="space-y-4 p-5">
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              {session.messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-[#333333]">
                  <p className="text-gray-900 dark:text-white">No messages yet</p>
                  <p className="mt-2 text-sm text-[#6B7280] dark:text-[#9CA3AF]">Start typing below. This chat will follow the context box above.</p>
                </div>
              ) : (
                session.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-[#ec1e24] text-white' : 'bg-gray-100 text-gray-900 dark:bg-[#111111] dark:text-white'}`}>
                      {message.attachments?.length ? (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <div key={attachment.id} className="overflow-hidden rounded-xl border border-white/20 bg-black/10">
                              {attachment.previewUrl ? (
                                <img src={attachment.previewUrl} alt={attachment.name} className="h-20 w-20 object-cover" />
                              ) : (
                                <div className="flex h-20 w-20 items-center justify-center text-xs">{attachment.name}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      <p className={`mt-2 text-[11px] ${message.role === 'user' ? 'text-white/75' : 'text-[#6B7280] dark:text-[#9CA3AF]'}`}>{formatMessageTime(message.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 p-3 dark:border-[#333333]">
              {attachments.length ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-[#111111] dark:text-[#9CA3AF]">
                      <span className="truncate">{attachment.name}</span>
                      <button type="button" onClick={() => setAttachments((current) => current.filter((entry) => entry.id !== attachment.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <Textarea
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  haptics.selection();
                }}
                onFocus={() => haptics.light()}
                placeholder="Send a message to PAD"
                className="min-h-[120px] border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <Label htmlFor="pad-attachments" className="cursor-pointer">
                  <span className="sr-only">Upload images</span>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-900 dark:border-[#333333] dark:text-white">
                    <ImagePlus className="h-4 w-4" />
                  </div>
                </Label>
                <input id="pad-attachments" type="file" accept="image/*" multiple className="hidden" onChange={handleAttachmentChange} />
                <Button onClick={handleSend} disabled={isGenerating} className="ml-auto">
                  <Send className="h-4 w-4" />
                  {isGenerating ? 'Sending' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
        <SheetContent side="left" className="w-[85%] max-w-sm border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]">
          <SheetHeader>
            <SheetTitle className="text-gray-900 dark:text-white">Chats</SheetTitle>
            <SheetDescription className="text-[#6B7280] dark:text-[#9CA3AF]">Search, pin, and switch PAD chats.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">{renderThreadList(true)}</div>
        </SheetContent>
      </Sheet>

      <BottomSheet open={Boolean(menuSessionId)} onOpenChange={(open) => !open && setMenuSessionId(null)}>
        <BottomSheetHeader>
          <BottomSheetTitle>Chat Options</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-600 dark:text-[#9CA3AF]">Chat Name</Label>
              <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onFocus={() => haptics.light()} className="mt-2 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]" />
            </div>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => menuSessionId && togglePinned(menuSessionId)}>
                {menuSession?.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {menuSession?.pinned ? 'Unpin Chat' : 'Pin Chat'}
              </Button>
              <Button variant="outline" className="w-full justify-start text-[#EF4444]" onClick={() => {
                if (!menuSessionId) return;
                deleteSession(menuSessionId);
                setMenuSessionId(null);
                toast.success('Chat deleted');
              }}>
                <Trash2 className="h-4 w-4" />
                Delete Chat
              </Button>
            </div>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setMenuSessionId(null)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              if (menuSessionId && renameValue.trim()) {
                renameSession(menuSessionId, renameValue.trim());
              }
              setMenuSessionId(null);
            }}>Save</Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>
    </div>
  );
}
