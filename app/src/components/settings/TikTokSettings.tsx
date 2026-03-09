import { PlatformConnectionSettings } from './PlatformConnectionSettings';

interface TikTokSettingsProps {
  onSave?: () => void;
}

export function TikTokSettings({ onSave }: TikTokSettingsProps) {
  return (
    <PlatformConnectionSettings
      title="TikTok"
      description="Manage the backend-saved TikTok connection used for posting and account automation."
      note="TikTok OAuth and token state are now sourced from the backend connection records instead of browser-side token storage."
      platforms={[{ platform: 'TikTok', label: 'TikTok' }]}
      onSave={onSave}
    />
  );
}
