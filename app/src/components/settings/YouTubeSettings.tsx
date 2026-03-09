import { PlatformConnectionSettings } from './PlatformConnectionSettings';

interface YouTubeSettingsProps {
  onSave?: () => void;
}

export function YouTubeSettings({ onSave }: YouTubeSettingsProps) {
  return (
    <PlatformConnectionSettings
      title="YouTube"
      description="Manage the backend-saved YouTube channel connection used for uploads and scheduled publishing."
      note="YouTube OAuth is now handled through the backend flow so credentials are not stored in the browser. Connect the channel here, then use your normal upload workflows."
      platforms={[{ platform: 'YouTube', label: 'YouTube' }]}
      onSave={onSave}
    />
  );
}
