import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OAuthCallbackPage } from '../../components/OAuthCallbackPage';

vi.mock('../../lib/api/config', () => ({
  getApiUrl: () => 'https://api.screndly.test',
}));

vi.mock('../../utils/oauthRedirect', () => ({
  getOAuthRedirectUri: () => 'https://app.screndly.test/platforms/callback',
}));

describe('OAuthCallbackPage', () => {
  it('recovers callback params from persisted storage when the live URL is empty', async () => {
    window.history.replaceState({}, '', '/platforms/callback');

    localStorage.setItem('screndly_oauth_platform', 'Instagram');
    localStorage.setItem(
      'screndly_oauth_callback_result',
      JSON.stringify({
        search: '?code=test-code&state=test-state',
        hash: '',
        capturedAt: Date.now(),
      }),
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as any;

    const onNavigate = vi.fn();

    render(<OAuthCallbackPage onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [requestUrl, requestOptions] = vi.mocked(global.fetch).mock.calls[0];
    expect(requestUrl).toBe('https://api.screndly.test/api/platforms/callback');
    expect(requestOptions?.method).toBe('POST');
    expect(requestOptions?.body).toContain('"platform":"Instagram"');
    expect(requestOptions?.body).toContain('"code":"test-code"');
    expect(requestOptions?.body).toContain('"state":"test-state"');

    expect(localStorage.getItem('screndly_oauth_callback_result')).toBeNull();
    expect(sessionStorage.getItem('screndly_oauth_callback_result')).toBeNull();
  });
});
