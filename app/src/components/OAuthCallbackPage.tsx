import { useEffect, useRef, useState } from 'react';
import { getAuthHeaders, SESSION_ACTIVE_KEY, TOKEN_KEY } from '../lib/api/authToken';
import { getApiUrl } from '../lib/api/config';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { getOAuthRedirectUri } from '../utils/oauthRedirect';
import { PageLoader } from './PageLoader';

export function OAuthCallbackPage({ onNavigate }: { onNavigate: (page: string) => void }) {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const hasProcessedRef = useRef(false);
    const PLATFORM_STORAGE_KEY = 'screndly_oauth_platform';
    const STATE_STORAGE_KEY = 'screndly_oauth_state';
    const CODE_VERIFIER_STORAGE_KEY = 'screndly_oauth_code_verifier';
    const OAUTH_RETURN_TOKEN_KEY = 'screndly_oauth_return_token';
    const CALLBACK_LOCK_PREFIX = 'screndly_oauth_callback_lock_';
    const OAUTH_REFRESH_KEY = 'screndly_oauth_refresh_platform';
    const CALLBACK_TIMEOUT_MS = 60000;

    useEffect(() => {
        const getStoredPlatform = (): string | null => {
            return localStorage.getItem(PLATFORM_STORAGE_KEY) || sessionStorage.getItem(PLATFORM_STORAGE_KEY);
        };

        const getStoredState = (): string | null => {
            return localStorage.getItem(STATE_STORAGE_KEY) || sessionStorage.getItem(STATE_STORAGE_KEY);
        };

        const getStoredCodeVerifier = (): string | null => {
            return localStorage.getItem(CODE_VERIFIER_STORAGE_KEY) || sessionStorage.getItem(CODE_VERIFIER_STORAGE_KEY);
        };

        const clearStoredPlatform = () => {
            localStorage.removeItem(PLATFORM_STORAGE_KEY);
            sessionStorage.removeItem(PLATFORM_STORAGE_KEY);
            localStorage.removeItem(STATE_STORAGE_KEY);
            sessionStorage.removeItem(STATE_STORAGE_KEY);
            localStorage.removeItem(CODE_VERIFIER_STORAGE_KEY);
            sessionStorage.removeItem(CODE_VERIFIER_STORAGE_KEY);
            localStorage.removeItem(OAUTH_RETURN_TOKEN_KEY);
        };

        const restoreAuthSessionForMobileReturn = () => {
            if (sessionStorage.getItem(TOKEN_KEY)) {
                return;
            }

            const pendingToken = localStorage.getItem(OAUTH_RETURN_TOKEN_KEY);
            if (!pendingToken) {
                return;
            }

            sessionStorage.setItem(TOKEN_KEY, pendingToken);
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        };

        const decodeJwtPayload = (value: string): string | null => {
            const parts = value.split('.');
            if (parts.length !== 3) return null;

            const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padding = '='.repeat((4 - (normalized.length % 4)) % 4);

            try {
                return atob(`${normalized}${padding}`);
            } catch {
                return null;
            }
        };

        const decodePlatformFromState = (value: string | null): string | null => {
            if (!value) return null;
            if (['Instagram', 'Facebook', 'Threads', 'TikTok', 'X', 'YouTube', 'Pinterest'].includes(value)) {
                return value;
            }

            try {
                const payloadRaw = decodeJwtPayload(value);
                if (!payloadRaw) return null;

                const payload = JSON.parse(payloadRaw) as { platform?: string };

                return payload.platform || null;
            } catch {
                return null;
            }
        };

        const processCallback = async () => {
            if (hasProcessedRef.current) return;
            hasProcessedRef.current = true;

            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

            const providerError =
                urlParams.get('error') ||
                urlParams.get('error_code') ||
                hashParams.get('error') ||
                hashParams.get('error_code');
            const providerErrorDescription =
                urlParams.get('error_description') ||
                urlParams.get('error_message') ||
                hashParams.get('error_description') ||
                hashParams.get('error_message');
            if (providerError) {
                clearStoredPlatform();
                setStatus('error');
                setErrorMsg(providerErrorDescription || providerError);
                return;
            }

            const code = urlParams.get('code') || hashParams.get('code');
            const rawState = urlParams.get('state') || hashParams.get('state');
            const storedState = getStoredState();
            const effectiveState = rawState || storedState;
            restoreAuthSessionForMobileReturn();
            const platform = getStoredPlatform() || decodePlatformFromState(effectiveState) || decodePlatformFromState(rawState);
            const codeVerifier = getStoredCodeVerifier();

            if (!code || (!platform && !effectiveState)) {
                setStatus('error');
                setErrorMsg('Missing authorization code or platform identifier.');
                return;
            }

            const callbackLockKey = `${CALLBACK_LOCK_PREFIX}${code}`;
            if (sessionStorage.getItem(callbackLockKey) === '1') {
                setStatus('error');
                setErrorMsg('This authorization code has already been processed. Please start the connection again.');
                return;
            }
            sessionStorage.setItem(callbackLockKey, '1');

            // Remove one-time auth values from URL immediately to prevent accidental reuse.
            window.history.replaceState({}, '', '/platforms/callback');

            try {
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);
                const rawResponse = await fetch(`${getApiUrl()}/api/platforms/callback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders(),
                    },
                    cache: 'no-store',
                    signal: controller.signal,
                    body: JSON.stringify({
                        platform,
                        code,
                        state: effectiveState,
                        codeVerifier,
                        redirectUri: getOAuthRedirectUri(platform || undefined)
                    })
                });
                window.clearTimeout(timeoutId);

                const response = await rawResponse.json().catch(() => ({}));

                if (rawResponse.ok && response.success) {
                    if (platform) {
                        sessionStorage.setItem(OAUTH_REFRESH_KEY, platform);
                    }
                    clearStoredPlatform();
                    sessionStorage.removeItem(callbackLockKey);
                    setStatus('success');
                    // Auto redirect after a few seconds
                    setTimeout(() => onNavigate('platforms'), 2000);
                } else {
                    throw new Error(response?.error?.message || response?.message || 'Authentication failed');
                }
            } catch (err: any) {
                console.error('Callback error:', err);
                sessionStorage.removeItem(callbackLockKey);
                setStatus('error');
                const isTimeout = err?.name === 'AbortError';
                setErrorMsg(isTimeout ? 'Request timed out while contacting backend. Please retry.' : (err.message || 'An error occurred during authentication.'));
            }
        };

        processCallback();
    }, [onNavigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
            {status === 'loading' && (
                <PageLoader size="lg" className="h-auto py-8" label="Finalizing platform connection..." />
            )}

            {status === 'success' && (
                <>
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-xl font-semibold dark:text-white mb-2">Connection Successful!</h2>
                    <p className="text-gray-500 mb-6 text-center">Your account has been connected. You will be redirected shortly.</p>
                    <Button onClick={() => onNavigate('platforms')}>Return to Platforms</Button>
                </>
            )}

            {status === 'error' && (
                <>
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold dark:text-white mb-2">Connection Failed</h2>
                    <p className="text-red-500 mb-6 text-center max-w-md">{errorMsg}</p>
                    <Button onClick={() => onNavigate('platforms')} variant="outline" className="border-gray-200 dark:border-[#333] dark:text-white">Back to Platforms</Button>
                </>
            )}
        </div>
    );
}
