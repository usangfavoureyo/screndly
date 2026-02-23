import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";
import { login } from '../lib/auth';
import screndlyLoginLogoDark from 'figma:asset/4befd8c03a67f3889be83b77f34eb6ea0d3f36d2.png';
import screndlyLoginLogoLight from 'figma:asset/651cd3122e66a0a82c96100f90fea6f2cdcb8b1c.png';

interface LoginPageProps {
  onLogin: () => void;
  onNavigate?: (page: string) => void;
}

export function LoginPage({ onLogin, onNavigate }: LoginPageProps) {
  // Remove email field - we only need password for single-user auth
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if dark mode is active
    const checkDarkMode = () => {
      const darkMode = document.documentElement.classList.contains('dark');
      setIsDark(darkMode);

      // Directly set the background color on the input element
      if (passwordInputRef.current) {
        passwordInputRef.current.style.setProperty('background-color', darkMode ? '#000000' : '#ffffff', 'important');
        passwordInputRef.current.style.setProperty('color', darkMode ? '#ffffff' : '#000000', 'important');
      }
    };

    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

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
              <img src={screndlyLoginLogoLight} alt="Screndly Logo" className="h-32 w-auto dark:hidden" />
              <img src={screndlyLoginLogoDark} alt="Screndly Logo" className="h-32 w-auto hidden dark:block" />
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
                <Input
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
                  className="rounded-lg !bg-white dark:!bg-[#000000] border-gray-300 dark:border-[#333333] !text-gray-900 dark:!text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:placeholder:opacity-0 autofill:!bg-white dark:autofill:!bg-[#000000] autofill:!text-gray-900 dark:autofill:!text-white pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                  style={{
                    // @ts-ignore - Force override autofill styling for dark mode
                    WebkitBoxShadow: 'var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 0 0 1000px var(--color-input-background) inset',
                    WebkitTextFillColor: 'inherit',
                  }}
                  ref={passwordInputRef}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
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
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => {
                  haptics.light();
                  setRememberMe(checked as boolean);
                }}
                disabled={loading}
              />
              <Label htmlFor="remember" className="text-gray-600 dark:text-[#9CA3AF] cursor-pointer">
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