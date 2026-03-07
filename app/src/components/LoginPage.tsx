import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { login } from '../lib/auth';
import logoLoginDark from '../assets/logo-login-dark.png';
import logoLoginLight from '../assets/logo-login-light.png';

interface LoginPageProps {
  onLogin: () => void;
  onNavigate?: (page: string) => void;
}

export function LoginPage({ onLogin, onNavigate }: LoginPageProps) {
  // Remove email field - we only need password for single-user auth
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      haptics.error();
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    haptics.light();

    // Call the secure login API
    const result = await login(password, rememberMe);

    setLoading(false);

    if (result.success) {
      haptics.success();
      toast.success('Welcome to Screndly!');
      onLogin(); // Call parent's onLogin callback
    } else {
      haptics.error();

      // Handle different error types
      if (result.error?.includes('Too many')) {
        toast.error(result.error, { duration: 5000 });
      } else if (result.remainingAttempts !== undefined) {
        setRemainingAttempts(result.remainingAttempts);

        if (result.remainingAttempts === 0) {
          toast.error('Account locked for 15 minutes due to too many failed attempts', {
            duration: 5000,
          });
        } else {
          toast.error(`Invalid password (${result.remainingAttempts} attempts remaining)`);
        }
      } else {
        toast.error(result.error || 'Login failed');
      }

      setPassword(''); // Clear password on error
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex-1 flex items-center justify-center">
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-8 w-full">
          {/* Logo Area */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center">
              <img src={logoLoginLight} alt="Screndly Logo" className="h-24 w-auto dark:hidden mb-4 object-contain" />
              <img src={logoLoginDark} alt="Screndly Logo" className="h-24 w-auto hidden dark:block mb-4 object-contain" />
            </div>
          </div>

          {/* Rate Limit Warning */}
          {remainingAttempts !== null && remainingAttempts <= 2 && remainingAttempts > 0 && (
            <div className="mb-6 flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-900 dark:text-orange-200">
                <strong>Warning:</strong> {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before 15-minute lockout.
              </div>
            </div>
          )}

          {/* Password Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 relative">
              <Label htmlFor="password" className="text-gray-900 dark:text-white">Password</Label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onFocus={() => haptics.light()}
                  onChange={(e) => {
                    haptics.light();
                    setPassword(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleSubmit(e);
                    }
                  }}
                  required
                  disabled={loading}
                  className="flex h-9 w-full rounded-lg border px-3 py-1 text-base outline-none pr-10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  ref={passwordInputRef}
                />
                {/* CSS for password input — class-based rules take absolute priority over media queries */}
                <style>{`
                  /* Base light mode styles (default) */
                  input#password#password {
                    background-color: #ffffff !important;
                    border-color: #e5e7eb !important;
                    color: #111827 !important;
                    -webkit-appearance: none !important;
                    appearance: none !important;
                  }
                  /* Hide browser's native password reveal button (Edge + Chrome) */
                  input#password::-ms-reveal,
                  input#password::-ms-clear {
                    display: none !important;
                  }
                  input#password::-webkit-credentials-auto-fill-button,
                  input#password::-webkit-textfield-decoration-container {
                    visibility: hidden !important;
                    pointer-events: none !important;
                  }
                  input#password#password::placeholder {
                    color: #6B7280 !important;
                    opacity: 1 !important;
                  }
                  button.eye-btn {
                    color: #111827 !important;
                  }

                  /* Dark mode — activated by .dark class on html (set by ThemeProvider) */
                  html.dark input#password#password {
                    background-color: #000000 !important;
                    border-color: #333333 !important;
                    color: #ffffff !important;
                  }
                  html.dark input#password#password::placeholder {
                    color: #ffffff !important;
                    opacity: 1 !important;
                  }
                  html.dark button.eye-btn {
                    color: #ffffff !important;
                  }

                  /* Autofill overrides — dark mode */
                  html.dark input#password:-webkit-autofill,
                  html.dark input#password:-webkit-autofill:hover,
                  html.dark input#password:-webkit-autofill:focus,
                  html.dark input#password:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #000000 inset !important;
                    -webkit-text-fill-color: #ffffff !important;
                    border-color: #333333 !important;
                  }

                  /* Autofill overrides — light mode */
                  html:not(.dark) input#password:-webkit-autofill,
                  html:not(.dark) input#password:-webkit-autofill:hover,
                  html:not(.dark) input#password:-webkit-autofill:focus,
                  html:not(.dark) input#password:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
                    -webkit-text-fill-color: #111827 !important;
                    border-color: #e5e7eb !important;
                  }
                `}</style>
                <button
                  type="button"
                  className="eye-btn absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
                  onClick={() => {
                    haptics.light();
                    setShowPassword(!showPassword);
                  }}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="remember"
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                aria-labelledby="remember-label"
                disabled={loading}
                onClick={() => {
                  haptics.light();
                  setRememberMe((current) => !current);
                }}
                className={`flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec1e24]/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                  rememberMe
                    ? 'border-[#ec1e24] bg-[#ec1e24] text-white'
                    : 'border-gray-300 bg-white text-transparent dark:border-[#333333] dark:bg-[#000000]'
                }`}
              >
                <Check className={`h-3.5 w-3.5 stroke-[3] ${rememberMe ? 'opacity-100' : 'opacity-0'}`} />
              </button>
              <Label
                id="remember-label"
                htmlFor="remember"
                className="text-gray-600 dark:text-[#9CA3AF] cursor-pointer"
              >
                Keep me signed in
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full rounded-lg"
              onClick={() => haptics.light()}
              disabled={loading || !password.trim()}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Forgot your password? Contact your administrator.
            </p>
          </div>

          {/* Static Pages Links - Direct links to public routes */}
          <div className="mt-8 text-center text-[0.625rem] text-[#9CA3AF]">
            <p>
              Screndly's{' '}
              <a
                href="/terms"
                className="text-gray-900 dark:text-white hover:underline"
                onClick={() => haptics.light()}
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a
                href="/privacy"
                className="text-gray-900 dark:text-white hover:underline"
                onClick={() => haptics.light()}
              >
                Privacy Policy
              </a>
              , and{' '}
              <a
                href="/disclaimer"
                className="text-gray-900 dark:text-white hover:underline"
                onClick={() => haptics.light()}
              >
                Disclaimer
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Screen Render Attribution */}
      <div className="py-6 text-center">
        <p className="text-[#9CA3AF] tracking-widest uppercase text-xs">
          Screen Render
        </p>
      </div>
    </div>
  );
}
