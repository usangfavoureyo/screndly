import { useState, useEffect } from 'react';
import { haptics } from '../utils/haptics';

interface TermsPageProps {
  onNavigate: (page: string) => void;
  isAuthenticated?: boolean;
}

export function TermsPage({ onNavigate, isAuthenticated = true }: TermsPageProps) {
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
            <h1 className="text-2xl text-gray-900 dark:text-white">Terms of Service</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last Updated: January 6, 2026</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-6 text-gray-700 dark:text-[#D1D5DB]">

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">1. Nature of the Service</h2>
            <p>
              Screndly is a private, internal automation and content management platform operated by Screen Render. It is not a public SaaS product and is not offered to external users.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">2. Eligibility and Access</h2>
            <p>
              Access to Screndly is limited exclusively to Screen Render or its authorized operator. No public accounts, consumer access, or third-party usage is permitted.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">3. Acceptable Use</h2>
            <p className="mb-3">
              Screndly may only be used for lawful purposes and in compliance with all applicable third-party platform policies, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
              <li>Meta Platform Policies</li>
              <li>Google / YouTube API Services Terms</li>
              <li>TikTok Developer Terms</li>
              <li>X Developer Platform Policies</li>
              <li>Pinterest Developer Guidelines</li>
            </ul>
            <p className="mb-3">Screndly must not be used to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Circumvent platform safeguards</li>
              <li>Engage in spam, manipulation, or prohibited automation</li>
              <li>Violate community or content guidelines</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">4. Third-Party Dependency</h2>
            <p>
              Screndly functionality depends on third-party APIs and services. Access, features, or integrations may be modified, restricted, or revoked at any time by those platforms.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">5. No Warranties</h2>
            <p>
              Screndly is provided "as is" for internal operational use. No guarantees are made regarding availability, performance, reach, engagement, or monetization outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">6. Limitation of Liability</h2>
            <p className="mb-3">Screen Render shall not be liable for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Account suspension or API access revocation</li>
              <li>Content performance or distribution outcomes</li>
              <li>Service interruptions caused by third-party platforms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">7. Termination</h2>
            <p>
              Use of Screndly may be discontinued at any time. Upon termination, platform access tokens may be revoked and stored data deleted.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">8. Governing Law</h2>
            <p>
              These Terms are governed by applicable laws where Screen Render operates, without regard to conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">9. Contact</h2>
            <p>
              For questions regarding these Terms of Service:<br />
              <strong>Email:</strong> <a href="mailto:screenrender@gmail.com" className="text-[#ec1e24] hover:underline">screenrender@gmail.com</a>
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