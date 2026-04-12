import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api/config', () => ({
  getApiUrl: () => 'https://screndly-production.up.railway.app',
}));

import { buildComposeAssetStreamUrl } from '../../lib/create/composeStorage';

describe('composeStorage', () => {
  it('builds the compose asset stream URL against the configured API base', () => {
    const rawBackblazeUrl = 'https://f005.backblazeb2.com/file/screndly-bucket/compose/videos/trailer.mp4';

    expect(buildComposeAssetStreamUrl(rawBackblazeUrl)).toBe(
      `https://screndly-production.up.railway.app/api/create/asset-stream?url=${encodeURIComponent(rawBackblazeUrl)}`,
    );
  });

  it('returns authorized Backblaze preview URLs as-is', () => {
    const authorizedUrl = 'https://f005.backblazeb2.com/file/screndly-bucket/compose/videos/trailer.mp4?Authorization=token';

    expect(buildComposeAssetStreamUrl(authorizedUrl)).toBe(authorizedUrl);
  });
});
