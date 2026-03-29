import { ArrowLeft } from "lucide-react";
import { FadeIn, MarketingLayout } from "./MarketingLayout";

export function MarketingTermsPage() {
  return (
    <MarketingLayout>
      <section className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <a
              href="/"
              aria-label="Back to home"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--marketing-border)] text-[var(--marketing-text)] transition hover:border-[var(--marketing-text)]"
            >
              <ArrowLeft size={16} />
            </a>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-[#ec1e24]">Terms of Service</p>
            <h1 className="marketing-heading mt-5 text-3xl font-semibold text-[var(--marketing-text)] md:text-4xl">
              Screndly Terms of Service
            </h1>
            <p className="mt-4 text-sm text-[var(--marketing-muted)] md:text-base">
              These Terms of Service ("Terms") govern your access to and use of the Screndly website, application, and
              related services (collectively, the "Services"). By accessing or using the Services, you agree to be
              bound by these Terms.
            </p>
            <p className="mt-4 text-sm text-[var(--marketing-muted)] md:text-base">
              If you do not agree, do not use the Services.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[var(--marketing-bg)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 text-sm text-[var(--marketing-muted)] lg:px-10 lg:py-20">
          <FadeIn>
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">1. About Screndly</h2>
                <p className="mt-2">
                  Screndly is a social media publishing, scheduling, automation, analytics, and content workflow
                  service that enables users to manage authorized content operations across supported third-party
                  platforms.
                </p>
                <p className="mt-2">Screndly is operated by Screen Render ("Screndly," "we," "us," or "our").</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">2. Eligibility</h2>
                <p className="mt-2">You may use the Services only if:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>you can form a binding contract under applicable law;</li>
                  <li>you are authorized to act on behalf of any business or organization whose account you connect or manage;</li>
                  <li>your use of the Services complies with applicable law, these Terms, and the rules of any connected third-party platform.</li>
                </ul>
                <p className="mt-2">
                  If you are using the Services for a company, brand, or other entity, you represent that you have
                  authority to bind that entity to these Terms.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">3. Account Registration and Security</h2>
                <p className="mt-2">To use certain features, you may need to create an account.</p>
                <p className="mt-2">You agree to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>provide accurate and complete information;</li>
                  <li>keep your login credentials secure;</li>
                  <li>promptly update your information if it changes;</li>
                  <li>accept responsibility for all activity occurring under your account.</li>
                </ul>
                <p className="mt-2">
                  You must notify us promptly at{" "}
                  <a className="font-medium text-[var(--marketing-text)] underline" href="mailto:support@screndly.com">
                    support@screndly.com
                  </a>{" "}
                  if you believe your account has been accessed without authorization.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">4. Connected Third-Party Platforms</h2>
                <p className="mt-2">
                  Screndly may allow you to connect accounts from third-party platforms, including TikTok, Pinterest,
                  X, Meta platforms, and YouTube.
                </p>
                <p className="mt-2">By connecting a third-party account, you:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>authorize Screndly to access and use data and permissions made available by that platform according to your granted permissions;</li>
                  <li>represent that you have the right to connect and manage that account;</li>
                  <li>acknowledge that your use of third-party platforms remains subject to that platform's own terms, policies, and technical limitations.</li>
                </ul>
                <p className="mt-2">We are not responsible for:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>third-party platform outages, policy changes, API restrictions, suspensions, removals, or errors;</li>
                  <li>the approval, rejection, limitation, or revocation of developer access by any platform;</li>
                  <li>any action taken by a third-party platform against your account, content, or access rights.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">5. License to Use the Services</h2>
                <p className="mt-2">
                  Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to
                  access and use the Services for lawful internal business or personal workflow purposes in accordance
                  with these Terms.
                </p>
                <p className="mt-2">You may not:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>copy, modify, distribute, sell, lease, sublicense, or exploit the Services except as expressly permitted;</li>
                  <li>reverse engineer, decompile, disassemble, or attempt to derive source code except where prohibited by law from restricting such rights;</li>
                  <li>interfere with or disrupt the integrity, security, or performance of the Services;</li>
                  <li>bypass rate limits, authentication, or access controls;</li>
                  <li>use the Services to scrape, harvest, or improperly collect data;</li>
                  <li>use the Services in a way that violates any third-party platform rules or developer policies;</li>
                  <li>use the Services for unlawful, deceptive, fraudulent, abusive, defamatory, infringing, or harmful conduct.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">6. User Content</h2>
                <p className="mt-2">
                  "User Content" means any text, media, posts, captions, drafts, files, data, or other material that you
                  upload, create, submit, schedule, publish, or otherwise make available through the Services.
                </p>
                <p className="mt-2">You retain ownership of your User Content.</p>
                <p className="mt-2">
                  You grant us a limited, non-exclusive, worldwide, royalty-free license to host, store, process,
                  reproduce, format, transmit, and display User Content solely as necessary to:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>operate and provide the Services;</li>
                  <li>perform user-authorized publishing and workflow actions;</li>
                  <li>maintain service functionality, backups, security, diagnostics, and support;</li>
                  <li>enforce these Terms and comply with legal obligations.</li>
                </ul>
                <p className="mt-2">You represent and warrant that:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>you own or have all rights necessary to use and authorize the use of your User Content;</li>
                  <li>your User Content and use of the Services do not violate any law, intellectual property right, privacy right, publicity right, contract, or platform policy;</li>
                  <li>your User Content is not misleading, unlawful, infringing, malicious, or otherwise prohibited.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">7. Platform Compliance</h2>
                <p className="mt-2">
                  You are responsible for ensuring that your use of Screndly complies with the terms, community rules,
                  API policies, automation rules, and publishing standards of all connected platforms.
                </p>
                <p className="mt-2">You may not use Screndly to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>post spam, misleading, manipulative, or unauthorized commercial content;</li>
                  <li>impersonate any person or entity;</li>
                  <li>violate copyright, trademark, privacy, or publicity rights;</li>
                  <li>evade, bypass, or undermine platform restrictions;</li>
                  <li>access, store, or process data beyond what is permitted by the connected platform;</li>
                  <li>engage in abusive automation, credential misuse, or prohibited scraping.</li>
                </ul>
                <p className="mt-2">
                  We may restrict or terminate access if we reasonably believe your use violates these Terms, a
                  connected platform's rules, or applicable law.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">8. Subscription, Fees, and Billing</h2>
                <p className="mt-2">
                  Certain features may require payment. If paid plans are offered:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>pricing, billing intervals, and feature limits will be disclosed at the point of purchase;</li>
                  <li>you authorize us or our payment processor to charge applicable fees;</li>
                  <li>fees are non-refundable except where required by law or expressly stated otherwise;</li>
                  <li>we may change pricing prospectively with reasonable notice.</li>
                </ul>
                <p className="mt-2">If payment is overdue, we may suspend or limit access to paid features.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">9. Service Availability and Changes</h2>
                <p className="mt-2">
                  We may modify, suspend, or discontinue any part of the Services at any time, with or without notice,
                  including features dependent on third-party APIs or platform access. We do not guarantee uninterrupted
                  availability, continued compatibility with third-party platforms, or error-free operation.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">10. Beta Features</h2>
                <p className="mt-2">
                  We may offer features labeled alpha, beta, preview, or similar. Those features are provided "as is"
                  and may be unstable, incomplete, changed, or withdrawn at any time.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">11. Intellectual Property</h2>
                <p className="mt-2">
                  The Services, including software, interface elements, branding, logos, designs, workflows,
                  documentation, and related content, are owned by or licensed to Screndly and are protected by
                  intellectual property and other applicable laws.
                </p>
                <p className="mt-2">Except for the limited license granted in these Terms, no rights are transferred to you.</p>
                <p className="mt-2">
                  Third-party names, logos, and trademarks remain the property of their respective owners. Use of
                  third-party platform integrations does not imply endorsement, partnership, or affiliation unless
                  expressly stated.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">12. Feedback</h2>
                <p className="mt-2">
                  If you provide suggestions, ideas, or feedback regarding the Services, you grant us a non-exclusive,
                  worldwide, perpetual, irrevocable, royalty-free license to use, reproduce, modify, and incorporate
                  that feedback without compensation or restriction.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">13. Privacy</h2>
                <p className="mt-2">
                  Your use of the Services is also governed by our Privacy Policy: /privacy.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">14. Suspension and Termination</h2>
                <p className="mt-2">
                  We may suspend, restrict, or terminate your access to the Services immediately if:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>you violate these Terms;</li>
                  <li>your use creates legal, security, reputational, or operational risk;</li>
                  <li>a connected platform restricts or revokes required access;</li>
                  <li>we are required to do so by law or legal process.</li>
                </ul>
                <p className="mt-2">
                  You may stop using the Services at any time and may request account deletion in accordance with our
                  Privacy Policy.
                </p>
                <p className="mt-2">
                  Termination does not affect rights or obligations that by nature should survive termination.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">15. Disclaimers</h2>
                <p className="mt-2">
                  The Services are provided on an "as is" and "as available" basis.
                </p>
                <p className="mt-2">
                  To the maximum extent permitted by law, Screndly disclaims all warranties, whether express, implied,
                  statutory, or otherwise, including implied warranties of merchantability, fitness for a particular
                  purpose, title, non-infringement, accuracy, and quiet enjoyment.
                </p>
                <p className="mt-2">We do not warrant that:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>the Services will be uninterrupted, secure, or error-free;</li>
                  <li>the Services will meet your requirements or expectations;</li>
                  <li>any third-party platform integration will remain available;</li>
                  <li>any content will be successfully published, delivered, or retained;</li>
                  <li>any analytics or metrics will be complete, error-free, or continuously available.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">16. Limitation of Liability</h2>
                <p className="mt-2">
                  To the maximum extent permitted by law, Screndly and its owners, affiliates, licensors, service
                  providers, and representatives will not be liable for any indirect, incidental, special,
                  consequential, exemplary, or punitive damages, or for any loss of profits, revenue, goodwill, data,
                  business opportunity, or business interruption, arising out of or relating to the Services or these
                  Terms.
                </p>
                <p className="mt-2">
                  To the maximum extent permitted by law, the total liability of Screndly for all claims arising out of
                  or relating to the Services or these Terms shall not exceed:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>the amount paid by you to Screndly for the Services during the twelve (12) months before the event giving rise to the claim, or</li>
                  <li>if you have not paid any amounts, one hundred United States dollars (US $100), whichever is greater.</li>
                </ul>
                <p className="mt-2">Some jurisdictions do not allow certain limitations, so some of the above may not apply to you.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">17. Indemnification</h2>
                <p className="mt-2">
                  You agree to defend, indemnify, and hold harmless Screndly and its owners, affiliates, licensors,
                  service providers, and representatives from and against any claims, liabilities, damages, judgments,
                  losses, costs, and expenses, including reasonable legal fees, arising out of or relating to:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>your use of the Services;</li>
                  <li>your User Content;</li>
                  <li>your violation of these Terms;</li>
                  <li>your violation of any law or third-party right;</li>
                  <li>your violation of any third-party platform rules, developer policies, or terms.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">18. Governing Law</h2>
                <p className="mt-2">
                  These Terms are governed by the laws of the jurisdiction where Screen Render is established and
                  operates, without regard to conflict of law principles.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">19. Dispute Resolution</h2>
                <p className="mt-2">
                  Any dispute arising out of or relating to these Terms or the Services shall be resolved in the courts
                  located in the jurisdiction where Screen Render is established and operates, unless applicable law
                  requires otherwise.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">20. Changes to These Terms</h2>
                <p className="mt-2">
                  We may update these Terms from time to time. If we do, we will revise the "Last Updated" date above.
                  Continued use of the Services after the updated Terms become effective constitutes acceptance of the
                  revised Terms.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">21. Contact</h2>
                <p className="mt-2">
                  Screndly
                </p>
                <p className="mt-2">Screen Render</p>
                <p className="mt-2">Business address available upon verified request.</p>
                <p className="mt-2">
                  Email:{" "}
                  <a className="font-medium text-[var(--marketing-text)] underline" href="mailto:support@screndly.com">
                    support@screndly.com
                  </a>
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </MarketingLayout>
  );
}
