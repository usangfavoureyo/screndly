import { useEffect, useState } from 'react';
import { BackIconButton } from './BackIconButton';

interface TermsPageProps {
  onNavigate: (page: string) => void;
  isAuthenticated?: boolean;
}

const EFFECTIVE_DATE = 'March 7, 2026';
const LAST_UPDATED = 'March 7, 2026';
const BUSINESS_NAME = 'Screen Render';
const BUSINESS_ADDRESS = 'Business address available upon verified request.';
const SUPPORT_EMAIL = 'support@screndly.com';

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
          <BackIconButton onClick={handleBack} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" />
          <div>
            <h1 className="text-2xl text-gray-900 dark:text-white">Terms of Service</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Effective Date: {EFFECTIVE_DATE}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last Updated: {LAST_UPDATED}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-6 text-gray-700 dark:text-[#D1D5DB]">
          <section className="space-y-3">
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Screndly
              website, application, and related services (collectively, the &quot;Services&quot;). By
              accessing or using the Services, you agree to be bound by these Terms.
            </p>
            <p>If you do not agree, do not use the Services.</p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">1. About Screndly</h2>
            <p className="mb-3">
              Screndly is a social media publishing, scheduling, automation, analytics, and
              content workflow service that enables users to manage authorized content operations
              across supported third-party platforms.
            </p>
            <p>
              Screndly is operated by {BUSINESS_NAME} (&quot;Screndly,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">2. Eligibility</h2>
            <p className="mb-3">You may use the Services only if:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>you can form a binding contract under applicable law;</li>
              <li>you are authorized to act on behalf of any business or organization whose account you connect or manage;</li>
              <li>your use of the Services complies with applicable law, these Terms, and the rules of any connected third-party platform.</li>
            </ul>
            <p className="mt-3">
              If you are using the Services for a company, brand, or other entity, you represent
              that you have authority to bind that entity to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">3. Account Registration and Security</h2>
            <p className="mb-3">To use certain features, you may need to create an account.</p>
            <p className="mb-3">You agree to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>provide accurate and complete information;</li>
              <li>keep your login credentials secure;</li>
              <li>promptly update your information if it changes;</li>
              <li>accept responsibility for all activity occurring under your account.</li>
            </ul>
            <p className="mt-3">
              You must notify us promptly at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#ec1e24] hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              if you believe your account has been accessed without authorization.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">4. Connected Third-Party Platforms</h2>
            <p className="mb-3">
              Screndly may allow you to connect accounts from third-party platforms, including
              TikTok, Pinterest, X, Meta platforms, and YouTube.
            </p>
            <p className="mb-3">By connecting a third-party account, you:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>authorize Screndly to access and use data and permissions made available by that platform according to your granted permissions;</li>
              <li>represent that you have the right to connect and manage that account;</li>
              <li>acknowledge that your use of third-party platforms remains subject to that platform&apos;s own terms, policies, and technical limitations.</li>
            </ul>
            <p className="mt-3 mb-2">We are not responsible for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>third-party platform outages, policy changes, API restrictions, suspensions, removals, or errors;</li>
              <li>the approval, rejection, limitation, or revocation of developer access by any platform;</li>
              <li>any action taken by a third-party platform against your account, content, or access rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">5. License to Use the Services</h2>
            <p className="mb-3">
              Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
              revocable license to access and use the Services for lawful internal business or
              personal workflow purposes in accordance with these Terms.
            </p>
            <p className="mb-3">You may not:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>copy, modify, distribute, sell, lease, sublicense, or exploit the Services except as expressly permitted;</li>
              <li>reverse engineer, decompile, disassemble, or attempt to derive source code except where prohibited by law from restricting such rights;</li>
              <li>interfere with or disrupt the integrity, security, or performance of the Services;</li>
              <li>bypass rate limits, authentication, or access controls;</li>
              <li>use the Services to scrape, harvest, or improperly collect data;</li>
              <li>use the Services in a way that violates any third-party platform rules or developer policies;</li>
              <li>use the Services for unlawful, deceptive, fraudulent, abusive, defamatory, infringing, or harmful conduct.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">6. User Content</h2>
            <p className="mb-3">
              &quot;User Content&quot; means any text, media, posts, captions, drafts, files, data, or
              other material that you upload, create, submit, schedule, publish, or otherwise
              make available through the Services.
            </p>
            <p className="mb-3">You retain ownership of your User Content.</p>
            <p className="mb-3">
              You grant us a limited, non-exclusive, worldwide, royalty-free license to host,
              store, process, reproduce, format, transmit, and display User Content solely as
              necessary to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>operate and provide the Services;</li>
              <li>perform user-authorized publishing and workflow actions;</li>
              <li>maintain service functionality, backups, security, diagnostics, and support;</li>
              <li>enforce these Terms and comply with legal obligations.</li>
            </ul>
            <p className="mt-3 mb-2">You represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>you own or have all rights necessary to use and authorize the use of your User Content;</li>
              <li>your User Content and use of the Services do not violate any law, intellectual property right, privacy right, publicity right, contract, or platform policy;</li>
              <li>your User Content is not misleading, unlawful, infringing, malicious, or otherwise prohibited.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">7. Platform Compliance</h2>
            <p className="mb-3">
              You are responsible for ensuring that your use of Screndly complies with the terms,
              community rules, API policies, automation rules, and publishing standards of all
              connected platforms.
            </p>
            <p className="mb-3">You may not use Screndly to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>post spam, misleading, manipulative, or unauthorized commercial content;</li>
              <li>impersonate any person or entity;</li>
              <li>violate copyright, trademark, privacy, or publicity rights;</li>
              <li>evade, bypass, or undermine platform restrictions;</li>
              <li>access, store, or process data beyond what is permitted by the connected platform;</li>
              <li>engage in abusive automation, credential misuse, or prohibited scraping.</li>
            </ul>
            <p className="mt-3">
              We may restrict or terminate access if we reasonably believe your use violates these
              Terms, a connected platform&apos;s rules, or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">8. Subscription, Fees, and Billing</h2>
            <p className="mb-3">Certain features may require payment. If paid plans are offered:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>pricing, billing intervals, and feature limits will be disclosed at the point of purchase;</li>
              <li>you authorize us or our payment processor to charge applicable fees;</li>
              <li>fees are non-refundable except where required by law or expressly stated otherwise;</li>
              <li>we may change pricing prospectively with reasonable notice.</li>
            </ul>
            <p className="mt-3">If payment is overdue, we may suspend or limit access to paid features.</p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">9. Service Availability and Changes</h2>
            <p>
              We may modify, suspend, or discontinue any part of the Services at any time, with or
              without notice, including features dependent on third-party APIs or platform access.
              We do not guarantee uninterrupted availability, continued compatibility with
              third-party platforms, or error-free operation.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">10. Beta Features</h2>
            <p>
              We may offer features labeled alpha, beta, preview, or similar. Those features are
              provided &quot;as is&quot; and may be unstable, incomplete, changed, or withdrawn at any
              time.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">11. Intellectual Property</h2>
            <p className="mb-3">
              The Services, including software, interface elements, branding, logos, designs,
              workflows, documentation, and related content, are owned by or licensed to Screndly
              and are protected by intellectual property and other applicable laws.
            </p>
            <p className="mb-3">
              Except for the limited license granted in these Terms, no rights are transferred to
              you.
            </p>
            <p>
              Third-party names, logos, and trademarks remain the property of their respective
              owners. Use of third-party platform integrations does not imply endorsement,
              partnership, or affiliation unless expressly stated.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">12. Feedback</h2>
            <p>
              If you provide suggestions, ideas, or feedback regarding the Services, you grant us
              a non-exclusive, worldwide, perpetual, irrevocable, royalty-free license to use,
              reproduce, modify, and incorporate that feedback without compensation or restriction.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">13. Privacy</h2>
            <p>
              Your use of the Services is also governed by our Privacy Policy:{' '}
              <a href="/privacy" className="text-[#ec1e24] hover:underline">
                /privacy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">14. Suspension and Termination</h2>
            <p className="mb-3">
              We may suspend, restrict, or terminate your access to the Services immediately if:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>you violate these Terms;</li>
              <li>your use creates legal, security, reputational, or operational risk;</li>
              <li>a connected platform restricts or revokes required access;</li>
              <li>we are required to do so by law or legal process.</li>
            </ul>
            <p className="mt-3">
              You may stop using the Services at any time and may request account deletion in
              accordance with our Privacy Policy.
            </p>
            <p className="mt-3">
              Termination does not affect rights or obligations that by nature should survive
              termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">15. Disclaimers</h2>
            <p className="mb-3 uppercase">
              The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis.
            </p>
            <p className="mb-3 uppercase">
              To the maximum extent permitted by law, Screndly disclaims all warranties, whether
              express, implied, statutory, or otherwise, including implied warranties of
              merchantability, fitness for a particular purpose, title, non-infringement,
              accuracy, and quiet enjoyment.
            </p>
            <p className="mb-3 uppercase">We do not warrant that:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 uppercase">
              <li>the Services will be uninterrupted, secure, or error-free;</li>
              <li>the Services will meet your requirements or expectations;</li>
              <li>any third-party platform integration will remain available;</li>
              <li>any content will be successfully published, delivered, or retained;</li>
              <li>any analytics or metrics will be complete, error-free, or continuously available.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">16. Limitation of Liability</h2>
            <p className="mb-3 uppercase">
              To the maximum extent permitted by law, Screndly and its owners, affiliates,
              licensors, service providers, and representatives will not be liable for any
              indirect, incidental, special, consequential, exemplary, or punitive damages, or
              for any loss of profits, revenue, goodwill, data, business opportunity, or business
              interruption, arising out of or relating to the Services or these Terms.
            </p>
            <p className="mb-3 uppercase">
              To the maximum extent permitted by law, the total liability of Screndly for all
              claims arising out of or relating to the Services or these Terms shall not exceed:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 uppercase">
              <li>the amount paid by you to Screndly for the Services during the twelve (12) months before the event giving rise to the claim, or</li>
              <li>if you have not paid any amounts, one hundred United States dollars (US $100), whichever is greater.</li>
            </ul>
            <p className="mt-3 uppercase">
              Some jurisdictions do not allow certain limitations, so some of the above may not
              apply to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">17. Indemnification</h2>
            <p className="mb-3">
              You agree to defend, indemnify, and hold harmless Screndly and its owners,
              affiliates, licensors, service providers, and representatives from and against any
              claims, liabilities, damages, judgments, losses, costs, and expenses, including
              reasonable legal fees, arising out of or relating to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>your use of the Services;</li>
              <li>your User Content;</li>
              <li>your violation of these Terms;</li>
              <li>your violation of any law or third-party right;</li>
              <li>your violation of any third-party platform rules, developer policies, or terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">18. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction where {BUSINESS_NAME} is
              established and operates, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">19. Dispute Resolution</h2>
            <p>
              Any dispute arising out of or relating to these Terms or the Services shall be
              resolved in the courts located in the jurisdiction where {BUSINESS_NAME} is
              established and operates, unless applicable law requires otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">20. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. If we do, we will revise the
              &quot;Last Updated&quot; date above. Continued use of the Services after the updated Terms
              become effective constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg text-gray-900 dark:text-white mb-3">21. Contact</h2>
            <p>
              <strong>Screndly</strong>
            </p>
            <p>{BUSINESS_NAME}</p>
            <p>{BUSINESS_ADDRESS}</p>
            <p>
              Email:{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#ec1e24] hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-gray-200 dark:border-[#374151] py-8 px-6 mt-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            <a href="/privacy" className="hover:text-[#ec1e24]">Privacy</a>
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
