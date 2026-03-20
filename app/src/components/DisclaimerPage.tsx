import { useState, useEffect } from 'react';
import { haptics } from '../utils/haptics';

interface DisclaimerPageProps {
  onNavigate?: (page: string) => void;
  isAuthenticated?: boolean;
}

export function DisclaimerPage({ onNavigate, isAuthenticated = true }: DisclaimerPageProps) {
  const LEGAL_EMAIL = 'legal@screndly.com';

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
    if (!isAuthenticated || !onNavigate) {
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
            <h1 className="text-2xl text-gray-900 dark:text-white">Disclaimer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last Updated: January 6, 2026</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-6 text-gray-700 dark:text-[#D1D5DB]">

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">Internal Automation Tool</h2>
            <p>
              Screndly is an internal automation tool operated by Screen Render. It is not affiliated with, endorsed by, or representative of Meta, Google, YouTube, TikTok, X, or Pinterest.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">No Guarantees</h2>
            <p>
              Screndly does not guarantee content reach, engagement, monetization, or platform approval. All content published through Screndly remains the sole responsibility of Screen Render.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">Third-Party Platform Supremacy</h2>
            <p>
              Third-party platform rules, policies, and enforcement actions supersede Screndly functionality at all times. Screndly operates within the constraints and guidelines set by each connected platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">No Liability</h2>
            <p className="mb-3">Screen Render and Screndly shall not be held liable for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Account suspensions or bans on third-party platforms</li>
              <li>Content removal or demonetization</li>
              <li>API access revocation or rate limiting</li>
              <li>Changes to platform policies affecting functionality</li>
              <li>Any financial losses resulting from platform actions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">Platform Trademarks</h2>
            <p>
              Meta, Facebook, Instagram, Threads, Google, YouTube, TikTok, X (formerly Twitter), and Pinterest are trademarks of their respective owners. Screndly is not endorsed by or affiliated with any of these companies.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">Use at Own Risk</h2>
            <p>
              Users of Screndly acknowledge that automated content publishing carries inherent risks including but not limited to platform policy violations, algorithm changes, and service disruptions. Use of this tool is at the operator's own risk and discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">Contact</h2>
            <p>
              For questions regarding this Disclaimer:<br />
              <strong>Email:</strong> <a href={`mailto:${LEGAL_EMAIL}`} className="text-[#ec1e24] hover:underline">{LEGAL_EMAIL}</a>
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
