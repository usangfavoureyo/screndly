import { PlatformConnectionSettings } from './PlatformConnectionSettings';

interface MetaSettingsProps {
  onSave?: () => void;
}

export function MetaSettings({ onSave }: MetaSettingsProps) {
  return (
    <PlatformConnectionSettings
      title="Meta (Facebook, Instagram, Threads)"
      description="Manage your backend-saved Meta platform connections for Facebook Pages, Instagram Business accounts, and Threads."
      note="Instagram, Facebook, and Threads now use the shared backend OAuth flow. Connect each platform you want to publish to and manage token health from the saved backend status."
      platforms={[
        { platform: 'Instagram', label: 'Instagram' },
        { platform: 'Facebook', label: 'Facebook' },
        { platform: 'Threads', label: 'Threads' },
      ]}
      onSave={onSave}
    />
  );
}
