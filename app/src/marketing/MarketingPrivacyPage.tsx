import { ArrowLeft } from "lucide-react";
import { FadeIn, MarketingLayout } from "./MarketingLayout";

export function MarketingPrivacyPage() {
  return (
    <MarketingLayout>
      <section className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--marketing-border)] px-4 py-2 text-sm font-medium text-[var(--marketing-text)] transition hover:border-[var(--marketing-text)]"
            >
              <ArrowLeft size={16} />
              Back to Home
            </a>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ec1e24]">Privacy Policy</p>
            <h1 className="marketing-heading mt-5 text-3xl font-semibold text-[var(--marketing-text)] md:text-4xl">
              Screndly Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-[var(--marketing-muted)] md:text-base">
              Screndly ("Screndly," "we," "us," or "our") provides a social media publishing, scheduling, automation,
              analytics, and content workflow platform for creators, brands, and business users. This Privacy Policy
              explains how we collect, use, store, disclose, and delete information when you access or use our website,
              application, and related services (collectively, the "Services").
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[var(--marketing-muted-strong)]">
              Effective Date: March 7, 2026 · Last Updated: March 7, 2026
            </p>
            <p className="mt-4 text-sm text-[var(--marketing-muted)] md:text-base">
              By using the Services, you agree to this Privacy Policy.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[var(--marketing-bg)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 text-sm text-[var(--marketing-muted)] lg:px-10 lg:py-20">
          <FadeIn>
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">1. Who We Are</h2>
                <p className="mt-2">Screndly is operated by Screen Render, located at Business address available upon verified request.</p>
                <p className="mt-2">Contact email: support@screndly.com</p>
                <p className="mt-2">Website: https://screndly.vercel.app</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">2. Scope</h2>
                <p className="mt-2">This Privacy Policy applies to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>our website and web application;</li>
                  <li>user accounts created for Screndly;</li>
                  <li>integrations with third-party platforms, including TikTok, Pinterest, X, Meta platforms, and YouTube; and</li>
                  <li>communications with us relating to the Services.</li>
                </ul>
                <p className="mt-2">
                  This Privacy Policy does not apply to third-party platforms, websites, or services that you connect to
                  Screndly. Those services have their own terms and privacy policies.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">3. Information We Collect</h2>
                <p className="mt-2">We collect the following categories of information depending on how you use the Services.</p>
                <p className="mt-3 font-medium text-[var(--marketing-text)]">A. Information You Provide Directly</p>
                <p className="mt-2">We may collect:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>your name;</li>
                  <li>email address;</li>
                  <li>username or account identifier;</li>
                  <li>password or authentication-related account details managed by our authentication providers;</li>
                  <li>billing or subscription information, if applicable;</li>
                  <li>support messages, feedback, and other communications you send to us;</li>
                  <li>media, captions, drafts, post content, and scheduling inputs you upload or create within Screndly.</li>
                </ul>
                <p className="mt-3 font-medium text-[var(--marketing-text)]">B. Information Collected Automatically</p>
                <p className="mt-2">When you use the Services, we may automatically collect:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>IP address;</li>
                  <li>browser type and version;</li>
                  <li>device type and operating system;</li>
                  <li>referring URLs;</li>
                  <li>app activity, usage logs, and feature interactions;</li>
                  <li>crash reports, diagnostics, and performance data;</li>
                  <li>cookie or similar technology data.</li>
                </ul>
                <p className="mt-3 font-medium text-[var(--marketing-text)]">C. Information from Connected Third-Party Accounts</p>
                <p className="mt-2">
                  If you connect a third-party social media or content platform account to Screndly, we may receive
                  information made available by that platform according to the permissions you authorize. Depending on
                  the platform and approved scopes, this may include:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>account or channel ID;</li>
                  <li>username, display name, profile image, and public profile metadata;</li>
                  <li>business or creator account information;</li>
                  <li>social post, pin, video, or media metadata;</li>
                  <li>publishing permissions and access tokens;</li>
                  <li>analytics, engagement, and performance metrics;</li>
                  <li>page, board, channel, or account-level settings or identifiers.</li>
                </ul>
                <p className="mt-2">
                  We only access data that is permitted by the platform, authorized by you, and necessary to provide the
                  Services.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">4. How We Use Information</h2>
                <p className="mt-2">We use information to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>create and manage user accounts;</li>
                  <li>authenticate users and maintain session security;</li>
                  <li>connect and manage authorized third-party platform accounts;</li>
                  <li>create, schedule, publish, and manage posts, pins, videos, captions, and related content workflows;</li>
                  <li>provide analytics, reporting, and operational insights related to connected accounts and authorized content;</li>
                  <li>store drafts, templates, and workflow settings;</li>
                  <li>respond to customer support requests and service inquiries;</li>
                  <li>send service notices, transactional emails, security alerts, and account-related communications;</li>
                  <li>improve, monitor, debug, secure, and maintain the Services;</li>
                  <li>detect fraud, misuse, abuse, unauthorized access, and violations of our Terms;</li>
                  <li>comply with legal obligations and enforce our contractual rights.</li>
                </ul>
                <p className="mt-2">We do not sell personal information.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">5. Platform Data and Connected Account Data</h2>
                <p className="mt-2">
                  When you connect a TikTok, Pinterest, X, Meta, or YouTube account to Screndly, you authorize us to
                  access and process certain account data solely for the purposes disclosed in this Privacy Policy and
                  within the functionality of the Services.
                </p>
                <p className="mt-2">We use connected platform data only to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>enable account connection and authentication;</li>
                  <li>retrieve account information necessary for setup and account display;</li>
                  <li>support publishing, scheduling, and media workflow features;</li>
                  <li>display or process analytics and performance data where authorized;</li>
                  <li>maintain logs and records needed for security, troubleshooting, and service integrity;</li>
                  <li>comply with applicable platform rules, developer policies, and legal obligations.</li>
                </ul>
                <p className="mt-2">We do not use connected platform data for undisclosed secondary purposes.</p>
                <p className="mt-2">
                  We do not request or store your social platform password. Authentication is handled through the
                  platform's authorization flow where applicable.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">6. YouTube and Google User Data</h2>
                <p className="mt-2">
                  If you connect YouTube or another Google-authorized service to Screndly, we will only use Google user
                  data in accordance with the permissions granted by you, the functionality you request, and applicable
                  Google and YouTube API policies.
                </p>
                <p className="mt-2">If Screndly accesses Google user data, we will:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>clearly identify what data is being requested and why;</li>
                  <li>use that data only for the disclosed and user-authorized purposes;</li>
                  <li>not use Google user data for purposes that are inconsistent with this Privacy Policy or applicable Google API policies;</li>
                  <li>delete Google user data when it is no longer needed for the disclosed purpose, when you disconnect your account, or when deletion is otherwise required.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">7. Legal Bases for Processing</h2>
                <p className="mt-2">Where applicable under data protection law, we process personal data under one or more of the following legal bases:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>performance of a contract;</li>
                  <li>your consent;</li>
                  <li>compliance with legal obligations;</li>
                  <li>our legitimate interests in operating, securing, improving, and administering the Services, provided those interests are not overridden by your rights.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">8. Cookies and Similar Technologies</h2>
                <p className="mt-2">We may use cookies, local storage, and similar technologies to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>keep you signed in;</li>
                  <li>remember user settings and preferences;</li>
                  <li>analyze traffic and performance;</li>
                  <li>improve functionality and reliability;</li>
                  <li>support security and fraud prevention.</li>
                </ul>
                <p className="mt-2">
                  You may adjust browser settings to refuse some cookies, but parts of the Services may not function
                  properly as a result.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">9. How We Share Information</h2>
                <p className="mt-2">We may share information:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>with service providers and infrastructure vendors that help us operate the Services, such as hosting, storage, authentication, analytics, customer support, and email service providers;</li>
                  <li>with connected third-party platforms when required to perform a user-authorized action, such as publishing or retrieving account information;</li>
                  <li>with professional advisers, auditors, insurers, and legal counsel where reasonably necessary;</li>
                  <li>with law enforcement, regulators, courts, or other authorities when required by law or legal process;</li>
                  <li>in connection with a merger, acquisition, restructuring, financing, sale of assets, or similar transaction;</li>
                  <li>with your direction or consent.</li>
                </ul>
                <p className="mt-2">We do not sell your personal information to third parties.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">10. Data Retention</h2>
                <p className="mt-2">
                  We retain personal data only for as long as reasonably necessary to:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>provide the Services;</li>
                  <li>maintain account functionality;</li>
                  <li>preserve legitimate business and security records;</li>
                  <li>comply with legal, regulatory, tax, accounting, and enforcement obligations;</li>
                  <li>resolve disputes and enforce our agreements.</li>
                </ul>
                <p className="mt-2">
                  Retention periods may vary depending on the type of data, platform requirements, security needs, and
                  legal obligations.
                </p>
                <p className="mt-2">
                  Where required by applicable platform policy or law, we will delete or de-identify data within a
                  reasonable period after it is no longer needed, after authorization expires, or after a valid
                  deletion request is received.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">11. Account Disconnection and Data Deletion</h2>
                <p className="mt-2">
                  You may disconnect a third-party platform account from Screndly through the Service settings where
                  available.
                </p>
                <p className="mt-2">
                  You may request deletion of your Screndly account and associated personal data by contacting:
                  support@screndly.com.
                </p>
                <p className="mt-2">Upon a valid deletion request, we will take reasonable steps to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>delete or de-identify personal data associated with your account, subject to legal retention obligations;</li>
                  <li>revoke or remove stored access to connected platform accounts where applicable;</li>
                  <li>delete data that we are required to delete under applicable platform policies.</li>
                </ul>
                <p className="mt-2">
                  Some information may be retained where necessary for:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>fraud prevention and security;</li>
                  <li>legal compliance;</li>
                  <li>dispute resolution;</li>
                  <li>tax, accounting, or audit obligations;</li>
                  <li>backup and disaster recovery systems for a limited period.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">12. Meta Platform Data Deletion Instructions</h2>
                <p className="mt-2">
                  If you connected a Meta account and want your data deleted from Screndly, you may request deletion by:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>emailing support@screndly.com with the subject line: Meta Data Deletion Request, or</li>
                  <li>using the in-app account deletion process if available.</li>
                </ul>
                <p className="mt-2">
                  Your request should include enough information for us to identify your account. We will process
                  deletion requests within a commercially reasonable period, subject to applicable law and legitimate
                  retention requirements.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">13. Data Security</h2>
                <p className="mt-2">
                  We use reasonable administrative, technical, and organizational safeguards designed to protect
                  personal data against unauthorized access, disclosure, alteration, or destruction. These measures may
                  include:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>access controls;</li>
                  <li>encrypted transmission where appropriate;</li>
                  <li>secure authentication mechanisms;</li>
                  <li>logging and monitoring;</li>
                  <li>principle-of-least-privilege operational controls.</li>
                </ul>
                <p className="mt-2">
                  No method of transmission or storage is completely secure, and we cannot guarantee absolute security.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">14. International Data Transfers</h2>
                <p className="mt-2">
                  Your information may be processed and stored in countries other than your own, including where our
                  hosting or service providers operate. Where required, we take reasonable steps to provide appropriate
                  safeguards for international data transfers.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">15. Your Rights</h2>
                <p className="mt-2">Depending on your jurisdiction, you may have the right to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>access personal data we hold about you;</li>
                  <li>correct inaccurate data;</li>
                  <li>request deletion of your data;</li>
                  <li>object to or restrict certain processing;</li>
                  <li>withdraw consent where processing is based on consent;</li>
                  <li>request portability of your data;</li>
                  <li>lodge a complaint with a data protection authority.</li>
                </ul>
                <p className="mt-2">To exercise these rights, contact support@screndly.com.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">16. Children's Privacy</h2>
                <p className="mt-2">
                  The Services are not directed to children under the age required by applicable law to validly use the
                  Services without parental authorization. We do not knowingly collect personal data from children in
                  violation of applicable law.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">17. Third-Party Links and Services</h2>
                <p className="mt-2">
                  The Services may contain links to third-party websites, products, or platforms. We are not
                  responsible for the privacy practices, content, or security of those third parties.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">18. Changes to This Privacy Policy</h2>
                <p className="mt-2">
                  We may update this Privacy Policy from time to time. When we do, we will revise the "Last Updated"
                  date above. If changes are material, we may provide additional notice where appropriate.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">19. Contact Us</h2>
                <p className="mt-2">Screndly</p>
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
