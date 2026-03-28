import { BackIconButton } from './BackIconButton';

interface DataDeletionPageProps {
  onNavigate: (page: string) => void;
  isAuthenticated?: boolean;
}

const LAST_UPDATED = 'March 7, 2026';
const PRIVACY_EMAIL = 'support@screndly.com';

export function DataDeletionPage({
  onNavigate,
  isAuthenticated = true,
}: DataDeletionPageProps) {
  const handleBack = () => {
    if (!isAuthenticated) {
      window.location.href = '/';
    } else {
      onNavigate('settings');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="flex items-start gap-4 mb-8">
          <BackIconButton onClick={handleBack} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" />
          <div>
            <h1 className="text-2xl text-gray-900 dark:text-white">Data Deletion Instructions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last Updated: {LAST_UPDATED}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-6 text-gray-700 dark:text-[#D1D5DB]">
          <section className="space-y-3">
            <p>
              If you have used Screndly through a Meta-connected account and want your data
              deleted, send an email to{' '}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-[#ec1e24] hover:underline">
                {PRIVACY_EMAIL}
              </a>{' '}
              with:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>your full name</li>
              <li>your email address</li>
              <li>your connected Meta account identifier, if available</li>
              <li>the subject line: Meta Data Deletion Request</li>
            </ul>
          </section>

          <section className="space-y-3">
            <p>
              We will review and process valid requests within a commercially reasonable period,
              subject to legal and security retention obligations.
            </p>
            <p>
              You may also delete your Screndly account directly from the account settings page if
              that feature is available.
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-gray-200 dark:border-[#374151] py-8 px-6 mt-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            <a href="/privacy-policy" className="hover:text-[#ec1e24]">Privacy</a>
            <span>|</span>
            <a href="/terms" className="hover:text-[#ec1e24]">Terms</a>
            <span>|</span>
            <a href="/data-deletion" className="hover:text-[#ec1e24]">Data Deletion</a>
            <span>|</span>
            <a href="/contact" className="hover:text-[#ec1e24]">Contact</a>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            © 2026, Screndly by Screen Render. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
