import { useState, useEffect } from 'react';
import { haptics } from '../utils/haptics';

interface PrivacyPageProps {
  onNavigate: (page: string) => void;
  isAuthenticated?: boolean;
}

export function PrivacyPage({ onNavigate, isAuthenticated = true }: PrivacyPageProps) {
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
            <h1 className="text-2xl text-gray-900 dark:text-white">Privacy Policy</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last Updated: January 6, 2026</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-6 text-gray-700 dark:text-[#D1D5DB]">

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">1. Introduction</h2>
            <p>
              Screndly is a private, internal automation and content management application operated by <strong>Screen Render</strong> ("we," "us," "our"). Screndly is not a public consumer service and is not offered to the general public. It is used exclusively by Screen Render for managing, automating, publishing, and analyzing content across third-party social media platforms.
            </p>
            <p className="mt-3">
              This Privacy Policy explains how data is collected, used, stored, and protected when Screndly interacts with third-party platforms and internal systems.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">2. Scope of This Policy</h2>
            <p>
              This policy applies solely to Screndly and its integrations. There are no external end users, public accounts, or customer registrations. All access is restricted to Screen Render or its authorized operator.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">3. Information Collected</h2>
            <p className="mb-3">Screndly collects and processes the following categories of information strictly for operational purposes:</p>

            <h3 className="text-gray-900 dark:text-white mt-4 mb-2">a. Authentication and Authorization Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>OAuth access tokens and refresh tokens</li>
              <li>Platform-issued account IDs, page IDs, channel IDs, and usernames</li>
            </ul>

            <h3 className="text-gray-900 dark:text-white mt-4 mb-2">b. Content Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Post captions, text, hashtags</li>
              <li>Media references (images, videos, thumbnails)</li>
              <li>Scheduling metadata and publishing status</li>
            </ul>

            <h3 className="text-gray-900 dark:text-white mt-4 mb-2">c. Analytics and Performance Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Engagement metrics (views, likes, comments, shares, impressions)</li>
              <li>Posting history and performance logs</li>
            </ul>

            <h3 className="text-gray-900 dark:text-white mt-4 mb-2">d. Technical and Log Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Timestamps, request logs, error logs</li>
              <li>IP addresses and system identifiers</li>
              <li>Cookies or local storage identifiers used for authentication and security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">4. Purpose of Data Collection</h2>
            <p className="mb-3">Data is collected and processed exclusively for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Automating content publishing and scheduling</li>
              <li>Managing authenticated connections with third-party APIs</li>
              <li>Retrieving analytics and performance insights</li>
              <li>Monitoring system integrity and debugging</li>
              <li>Ensuring compliance with third-party platform requirements</li>
            </ul>
            <p className="mt-3">
              Screndly does not use data for advertising, profiling, or marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">5. Cookies and Local Storage</h2>
            <p className="mb-3">Screndly uses limited cookies and local storage mechanisms to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Maintain authenticated sessions</li>
              <li>Secure platform integrations</li>
              <li>Prevent unauthorized access</li>
            </ul>
            <p className="mt-3">
              Screndly does not use advertising cookies or cross-site tracking technologies.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">6. Data Sharing and Disclosure</h2>
            <p className="mb-3">Screndly does not sell, rent, or trade data.</p>
            <p className="mb-3">Data is disclosed only in the following cases:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Transmission to third-party platform APIs (e.g., Meta, Google, TikTok, X, Pinterest) as required to perform requested actions</li>
              <li>Compliance with legal obligations if required by law</li>
            </ul>
            <p className="mt-3">
              No data is shared with advertisers, data brokers, or analytics resellers.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">7. Data Retention</h2>
            <p className="mb-3">Data is retained only for as long as necessary to fulfill operational purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>OAuth tokens are retained while integrations remain active</li>
              <li>Logs and analytics data are retained for system monitoring and compliance</li>
              <li>Data is deleted or rendered inaccessible upon revocation of platform access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">8. Data Security</h2>
            <p className="mb-3">Screndly implements appropriate technical and organizational safeguards, including:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Encrypted storage of sensitive credentials</li>
              <li>Restricted access controls (single-operator access)</li>
              <li>Secure API communication protocols</li>
              <li>Environment-based separation of secrets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">9. Data Control and Rights</h2>
            <p>
              As Screndly is a private internal system, data control is exercised directly by Screen Render. Platform access can be revoked, and stored data can be deleted at any time by the operator.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">10. Third-Party Platforms</h2>
            <p>
              Screndly relies on third-party platforms and APIs. Data handling by those platforms is governed by their respective privacy policies and terms. Screndly is not responsible for third-party practices.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">11. Changes to This Policy</h2>
            <p>
              This Privacy Policy may be updated periodically to reflect operational or regulatory changes. Updates will be published on this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">12. Contact</h2>
            <p>
              For questions regarding this Privacy Policy:<br />
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