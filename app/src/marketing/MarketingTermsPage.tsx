import { FadeIn, MarketingLayout } from "./MarketingLayout";

export function MarketingTermsPage() {
  return (
    <MarketingLayout>
      <section className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ec1e24]">Terms of Service</p>
            <h1 className="marketing-heading mt-5 text-3xl font-semibold text-[var(--marketing-text)] md:text-4xl">
              Screndly Terms of Service
            </h1>
            <p className="mt-4 text-sm text-[var(--marketing-muted)] md:text-base">
              Screndly provides a private dashboard for authorized publishing workflows. By using the service, you
              agree to operate within the permissions granted by connected platforms.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[var(--marketing-bg)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 text-sm text-[var(--marketing-muted)] lg:px-10 lg:py-20">
          <FadeIn>
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">Authorized publishing</h2>
                <p className="mt-2">
                  Screndly only publishes content when users connect their accounts through official OAuth flows and
                  explicitly initiate publishing actions.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">User responsibility</h2>
                <p className="mt-2">
                  Users are responsible for the accuracy, legality, and rights for the content they upload and publish
                  through Screndly.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">Service availability</h2>
                <p className="mt-2">
                  Screndly is provided as a private workflow tool. We may update features or integrations to comply
                  with platform requirements and maintain service quality.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--marketing-text)]">Contact</h2>
                <p className="mt-2">
                  Questions about these terms can be sent to{" "}
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
