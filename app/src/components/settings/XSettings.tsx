import { PlatformConnectionSettings } from './PlatformConnectionSettings';

interface XSettingsProps {
  onSave?: () => void;
}

export function XSettings({ onSave }: XSettingsProps) {
  return (
    <PlatformConnectionSettings
      title="X (Twitter)"
      description="Manage the backend-saved X connection used for publishing and automation."
      note="The X settings screen now reflects the real backend connection state instead of using browser-held OAuth credentials."
      platforms={[{ platform: 'X', label: 'X' }]}
      onSave={onSave}
    />
  );
}
