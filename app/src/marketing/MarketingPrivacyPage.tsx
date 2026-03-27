import { FadeIn, MarketingLayout } from "./MarketingLayout";

export function MarketingPrivacyPage() {
  return (
    <MarketingLayout>
      <section className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ec1e24]">Privacy Policy</p>
            <h1 className="marketing-heading mt-5 text-3xl font-semibold text-[var(--marketing-text)] md:text-4xl">
              Screndly Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-[var(--marketing-muted)] md:text-base">
              Screndly is a private publishing workspace. This policy explains how data is accessed and used when
              connecting social platforms.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[var(--marketing-bg)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 text-sm text-[var(--marketing-muted)] lg:px-10 lg:py-20">
          <FadeIn>
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">Authorized access only</h2>
                <p className="mt-2">
                  Screndly only connects to Pinterest and TikTok after explicit user authorization. Access is scoped to
                  create, schedule, and publish posts.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">Private workspace</h2>
                <p className="mt-2">
                  The Screndly dashboard is private. Content created within the dashboard is not publicly accessible
                  unless the user publishes it through an authorized platform.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">Data handling</h2>
                <p className="mt-2">
                  We store only the data required to operate publishing workflows, including media metadata, captions,
                  and scheduling details. Credentials are handled through official OAuth flows.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">Contact</h2>
                <p className="mt-2">
                  For privacy questions, contact{" "}
                  <a className="font-medium text-[var(--marketing-text)] underline" href="mailto:support@screndly.com">
                    support@screndly.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </MarketingLayout>
  );
}
