import { useState, useEffect } from 'react';
import { haptics } from '../utils/haptics';

interface CookiePageProps {
  onNavigate: (page: string) => void;
  isAuthenticated?: boolean;
}

export function CookiePage({ onNavigate, isAuthenticated = true }: CookiePageProps) {
  const SUPPORT_EMAIL = 'support@screndly.com';

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleBack = () => {
    haptics.light();
    if (!isAuthenticated) {
      window.location.href = '/';
    } else if (isDesktop) {
      onNavigate('dashboard');
    } else {
      onNavigate('settings');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="flex items-start gap-4 mb-8">
          <button
            onClick={handleBack}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2M9 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl text-gray-900 dark:text-white">Cookie Policy</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last Updated: January 6, 2026</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-6 text-gray-700 dark:text-[#D1D5DB]">

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">1. Overview</h2>
            <p>
              Screndly uses cookies and similar technologies strictly for internal operational purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">2. Types of Cookies Used</h2>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Session and authentication cookies</li>
              <li>Security-related cookies</li>
              <li>Functional cookies for system stability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">3. Purpose</h2>
            <p className="mb-3">Cookies are used to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Maintain authenticated sessions</li>
              <li>Secure platform integrations</li>
              <li>Ensure proper system operation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">4. No Advertising or Tracking</h2>
            <p className="mb-3">Screndly does not use:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Advertising cookies</li>
              <li>Behavioral tracking</li>
              <li>Third-party ad networks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">5. Management</h2>
            <p>
              Cookies can be cleared or disabled through browser settings. Disabling cookies may affect functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">6. Contact</h2>
            <p>
              For questions regarding this Cookie Policy:<br />
              <strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#ec1e24] hover:underline">{SUPPORT_EMAIL}</a>
            </p>
          </section>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-[#374151] py-8 px-6 mt-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            <a href="/privacy" className="hover:text-[#ec1e24]">Privacy</a>
            <span>•</span>
            <a href="/terms" className="hover:text-[#ec1e24]">Terms</a>
            <span>•</span>
            <a href="/disclaimer" className="hover:text-[#ec1e24]">Disclaimer</a>
            <span>•</span>
            <a href="/cookies" className="hover:text-[#ec1e24]">Cookie</a>
            <span>•</span>
            <a href="/contact" className="hover:text-[#ec1e24]">Contact</a>
            <span>•</span>
            <a href="/about" className="hover:text-[#ec1e24]">About</a>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            ©️ 2026, Screndly. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
