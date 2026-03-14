import { BackIconButton } from '../BackIconButton';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AI_MODELS } from '../../lib/ai/models';
import { haptics } from '../../utils/haptics';

interface PadSettingsProps {
  settings: any;
  updateSetting: (key: string, value: any) => void;
  onBack: () => void;
}

export function PadSettings({ settings, updateSetting, onBack }: PadSettingsProps) {
  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-full overflow-y-auto bg-white dark:bg-[#000000] lg:w-[600px]">
      <div className="sticky top-0 border-b border-gray-200 bg-white p-4 dark:border-[#333333] dark:bg-[#000000]">
        <div className="flex items-start gap-4">
          <BackIconButton onClick={() => { haptics.light(); onBack(); }} className="mt-1 -ml-2 p-2 text-gray-900 hover:text-[#ec1e24] dark:text-white" />
          <div>
            <h2 className="text-gray-900 dark:text-white">Post Settings</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Choose the default post chat model and the starting system prompt for new chats.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#333333] dark:bg-[#000000]">
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Post Chat Model</Label>
          <Select value={settings.padChatModel || ''} onValueChange={(value) => updateSetting('padChatModel', value)}>
            <SelectTrigger className="mt-2 border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#333333] dark:bg-[#000000]">
          <Label className="text-gray-600 dark:text-[#9CA3AF]">Default Chat Context</Label>
          <Textarea
            value={settings.padChatSystemPrompt || ''}
            onChange={(event) => updateSetting('padChatSystemPrompt', event.target.value)}
            className="mt-2 min-h-[220px] border-gray-200 bg-white dark:border-[#333333] dark:bg-[#000000]"
            placeholder="Set the default post instructions that new chats start with."
          />
        </div>
      </div>
    </div>
  );
}
