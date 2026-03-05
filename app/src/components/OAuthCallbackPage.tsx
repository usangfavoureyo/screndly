import { useEffect, useRef, useState } from 'react';
import { getAuthHeaders } from '../lib/api/authToken';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export function OAuthCallbackPage({ onNavigate }: { onNavigate: (page: string) => void }) {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const hasProcessedRef = useRef(false);

    useEffect(() => {
        const processCallback = async () => {
            if (hasProcessedRef.current) return;
            hasProcessedRef.current = true;

            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

            const providerError = urlParams.get('error') || hashParams.get('error');
            const providerErrorDescription = urlParams.get('error_description') || hashParams.get('error_description');
            if (providerError) {
                setStatus('error');
                setErrorMsg(providerErrorDescription || providerError);
                return;
            }

            const code = urlParams.get('code') || hashParams.get('code');
            const platform = urlParams.get('state') || hashParams.get('state') || localStorage.getItem('screndly_oauth_platform');

            if (!code || !platform) {
                setStatus('error');
                setErrorMsg('Missing authorization code or platform identifier.');
                return;
            }

            // Remove one-time auth values from URL immediately to prevent accidental reuse.
            window.history.replaceState({}, '', '/platforms/callback');

            try {
                const rawResponse = await fetch('https://screndly-production.up.railway.app/api/platforms/callback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders(),
                    },
                    body: JSON.stringify({
                        platform,
                        code,
                        redirectUri: `${window.location.origin}/platforms/callback`
                    })
                });

                const response = await rawResponse.json();

                if (rawResponse.ok && response.success) {
                    localStorage.removeItem('screndly_oauth_platform');
                    setStatus('success');
                    // Auto redirect after a few seconds
                    setTimeout(() => onNavigate('platforms'), 2000);
                } else {
                    throw new Error(response?.error?.message || response?.message || 'Authentication failed');
                }
            } catch (err: any) {
                console.error('Callback error:', err);
                setStatus('error');
                setErrorMsg(err.message || 'An error occurred during authentication.');
            }
        };

        processCallback();
    }, [onNavigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
            {status === 'loading' && (
                <>
                    <Loader2 className="w-12 h-12 text-[#ec1e24] animate-spin mb-4" />
                    <h2 className="text-xl font-semibold dark:text-white mb-2">Connecting to Platform...</h2>
                    <p className="text-gray-500 text-center">Please wait while we establish the connection securely.</p>
                </>
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
