import { FadeIn, MarketingLayout } from "./MarketingLayout";

export function MarketingPrivacyPage() {
  return (
    <MarketingLayout>
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ec1e24]">Privacy Policy</p>
            <h1 className="marketing-heading mt-5 text-3xl font-semibold text-neutral-900 md:text-4xl">
              Screndly Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-neutral-600 md:text-base">
              Screndly is a private publishing workspace. This policy explains how data is accessed and used when
              connecting social platforms.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[#f9f9f7]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 text-sm text-neutral-600 lg:px-10 lg:py-20">
          <FadeIn>
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Authorized access only</h2>
                <p className="mt-2">
                  Screndly only connects to Pinterest and TikTok after explicit user authorization. Access is scoped to
                  create, schedule, and publish posts.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Private workspace</h2>
                <p className="mt-2">
                  The Screndly dashboard is private. Content created within the dashboard is not publicly accessible
                  unless the user publishes it through an authorized platform.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Data handling</h2>
                <p className="mt-2">
                  We store only the data required to operate publishing workflows, including media metadata, captions,
                  and scheduling details. Credentials are handled through official OAuth flows.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Contact</h2>
                <p className="mt-2">
                  For privacy questions, contact{" "}
                  <a className="font-medium text-neutral-900 underline" href="mailto:support@screndly.com">
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
