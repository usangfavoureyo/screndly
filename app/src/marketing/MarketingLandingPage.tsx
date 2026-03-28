import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Film,
  Lock,
  PenTool,
  Rss,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { motion } from "motion/react";
import { FadeIn, MarketingLayout } from "./MarketingLayout";

const FEATURES = [
  {
    title: "AI Caption Generation",
    description: "Generate post copy for editorial, promotional, and feed-driven content.",
    icon: Sparkles,
  },
  {
    title: "Content Scheduling",
    description: "Plan and queue posts from a single dashboard.",
    icon: CalendarClock,
  },
  {
    title: "Media Management",
    description: "Prepare images and videos for publishing.",
    icon: UploadCloud,
  },
  {
    title: "Feed Automation",
    description: "Run content pipelines from RSS, TMDB, video feeds, and internal workflows.",
    icon: Rss,
  },
  {
    title: "Editorial Posting",
    description: "Create formatted posts with consistent structure.",
    icon: PenTool,
  },
  {
    title: "Private Dashboard Control",
    description: "Operate publishing tasks inside a secured internal workspace.",
    icon: Lock,
  },
];

const WORKFLOW_STEPS = [
  {
    title: "Prepare media",
    description: "Upload or select the image or video for the post.",
  },
  {
    title: "Write or generate caption",
    description: "Create the title, description, and supporting text.",
  },
  {
    title: "Review schedule",
    description: "Choose timing and publishing settings.",
  },
  {
    title: "Publish through authorized platforms",
    description: "Send content to connected platforms including Pinterest and TikTok.",
  },
];

const PREVIEWS = [
  {
    title: "Dashboard overview",
    label: "Workspace overview with queues, activity, and channels.",
    image: "/marketing/screenshots/dashboard-overview-mobile.jpg",
    imageAlt: "Screndly dashboard overview showing log metrics and recent post activity.",
  },
  { title: "Post creation interface", label: "Compose posts with media, captions, and metadata." },
  { title: "Scheduling page", label: "Timeline view for queued and scheduled posts." },
  { title: "Pinterest publishing workflow", label: "Board selection, title, description, and preview." },
  { title: "TikTok video publishing flow", label: "Video upload, caption editing, and publish status." },
];

const HERO_VIDEO = "/marketing/video/hero-nebula.mp4";
const HERO_VIDEO_POSTER = "/marketing/video/hero-nebula-poster.jpg";

export function MarketingLandingPage() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-[color:var(--marketing-border)] bg-black">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_VIDEO_POSTER}
          aria-hidden="true"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.62)_34%,rgba(0,0,0,0.38)_62%,rgba(0,0,0,0.58)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,30,36,0.18),transparent_34%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.58))]" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-16 md:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-24 lg:pt-20">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ec1e24]">
              Private publishing workspace
            </p>
            <h1 className="marketing-heading mt-6 text-3xl font-semibold leading-tight text-white md:text-4xl lg:text-5xl">
              Private AI publishing and automation workspace for modern content operations.
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 md:text-lg">
              Private dashboard to manage media, generate captions, schedule posts, and run feed-driven
              publishing across social platforms.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 rounded-full bg-[#ec1e24] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                View How It Works <ArrowRight size={16} />
              </a>
              <a
                href="/app"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                Open Dashboard
              </a>
            </div>
          </FadeIn>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-[32px] border border-white/12 bg-black/55 shadow-[0_30px_60px_rgba(0,0,0,0.28)] backdrop-blur-md">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,15,15,0.82),rgba(15,15,15,0.54)_42%,rgba(236,30,36,0.12)_100%)]" />
              <div className="relative p-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs uppercase tracking-[0.25em] text-white/65">
                  <span>Screndly Dashboard</span>
                  <span className="rounded-full bg-[#ec1e24]/20 px-3 py-1 text-[10px] font-semibold text-white">
                    Private
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        Queue
                      </p>
                      <div className="mt-3 space-y-2">
                        <div className="h-2 w-full rounded-full bg-white/15" />
                        <div className="h-2 w-4/5 rounded-full bg-white/20" />
                        <div className="h-2 w-2/3 rounded-full bg-white/10" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        Channels
                      </p>
                      <div className="mt-3 space-y-2 text-xs font-medium text-white/75">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#ec1e24]" />
                          Pinterest Boards
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-white/50" />
                          TikTok Studio
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-white/40" />
                          Editorial Feed
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                        Compose
                      </p>
                      <Film size={16} className="text-[#ec1e24]" />
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="h-28 rounded-xl bg-white/8" />
                      <div className="h-2 w-full rounded-full bg-white/15" />
                      <div className="h-2 w-4/5 rounded-full bg-white/20" />
                      <div className="h-2 w-3/4 rounded-full bg-white/10" />
                      <div className="flex items-center gap-2 pt-2 text-xs font-medium text-white/75">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ec1e24]/20 text-[#ff6b6f]">
                          <ClipboardList size={14} />
                        </span>
                        Review + schedule before publishing
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-[#ec1e24]/10 blur-2xl" />
          </motion.div>
        </div>
      </section>

      <section id="features" className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-bg)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <h2 className="marketing-heading text-2xl font-semibold text-[var(--marketing-text)] md:text-3xl">
              Built for controlled publishing workflows
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-[var(--marketing-muted)] md:text-base">
              Every publishing step stays inside a private workspace, from ingestion to scheduling.
            </p>
          </FadeIn>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <FadeIn key={feature.title} delay={index * 0.05}>
                  <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[var(--marketing-text)]">{feature.title}</h3>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#ec1e24]/10 text-[#ec1e24]">
                        <Icon size={18} />
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--marketing-muted)]">{feature.description}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pinterest" className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-20">
          <FadeIn>
            <h2 className="marketing-heading text-2xl font-semibold text-[var(--marketing-text)] md:text-3xl">
              Pinterest Integration
            </h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--marketing-muted)] md:text-base">
              <p>Screndly supports Pinterest publishing through the official Pinterest API.</p>
              <p>Users prepare media, title, description, and scheduling inside the dashboard.</p>
              <p>After authorization, Screndly publishes to boards using the official API.</p>
              <p>Screndly does not scrape Pinterest or bypass platform permissions.</p>
              <p>Publishing only occurs after user authorization.</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="rounded-3xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface-alt)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-muted-strong)]">
                Pinterest flow
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] p-4 text-sm text-[var(--marketing-muted)]">
                  Board selection + metadata
                </div>
                <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] p-4 text-sm text-[var(--marketing-muted)]">
                  Scheduled publish window
                </div>
                <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] p-4 text-sm text-[var(--marketing-muted)]">
                  API delivery status
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="tiktok" className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-bg)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-20">
          <FadeIn>
            <div className="rounded-3xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-muted-strong)]">
                TikTok flow
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface-alt)] p-4 text-sm text-[var(--marketing-muted)]">
                  OAuth login + account identity
                </div>
                <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface-alt)] p-4 text-sm text-[var(--marketing-muted)]">
                  Video upload + caption
                </div>
                <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface-alt)] p-4 text-sm text-[var(--marketing-muted)]">
                  Content Posting API publish
                </div>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="marketing-heading text-2xl font-semibold text-[var(--marketing-text)] md:text-3xl">
              TikTok Integration
            </h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--marketing-muted)] md:text-base">
              <p>Screndly integrates with TikTok using TikTok Login Kit and the Content Posting API.</p>
              <p>Users connect their TikTok account through OAuth authorization.</p>
              <p>Screndly retrieves basic profile data to identify the connected account.</p>
              <p>Users upload videos, write captions, and publish from the Screndly dashboard.</p>
              <p>Videos are transferred through the official TikTok Content Posting API.</p>
              <p>Publishing only occurs after user authorization.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="workflow" className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <h2 className="marketing-heading text-2xl font-semibold text-[var(--marketing-text)] md:text-3xl">
              How the workflow works
            </h2>
          </FadeIn>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((step, index) => (
              <FadeIn key={step.title} delay={index * 0.05}>
                <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface-alt)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-muted-strong)]">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 text-base font-semibold text-[var(--marketing-text)]">{step.title}</h3>
                  <p className="mt-2 text-sm text-[var(--marketing-muted)]">{step.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="product-preview" className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-bg)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <h2 className="marketing-heading text-2xl font-semibold text-[var(--marketing-text)] md:text-3xl">
              Product Preview
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-[var(--marketing-muted)] md:text-base">
              Visual snapshots of the private dashboard experience.
            </p>
          </FadeIn>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {PREVIEWS.map((preview, index) => (
              <FadeIn key={preview.title} delay={index * 0.05}>
                <div className="rounded-3xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] p-5">
                  <div className="rounded-2xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface-alt)] p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--marketing-muted-strong)]">
                      <span>{preview.title}</span>
                      <span className="rounded-full bg-[#ec1e24]/10 px-3 py-1 text-[10px] font-semibold text-[#ec1e24]">
                        Preview
                      </span>
                    </div>
                    {preview.image ? (
                      <div className="mt-4 flex justify-center rounded-xl bg-[var(--marketing-surface)] p-3">
                        <div className="w-full max-w-[210px] overflow-hidden rounded-[1.6rem] border border-black/10 bg-black shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
                          <img
                            src={preview.image}
                            alt={preview.imageAlt}
                            className="block h-auto w-full"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 h-36 rounded-xl bg-[var(--marketing-surface)]" />
                    )}
                  </div>
                  <p className="mt-4 text-sm text-[var(--marketing-muted)]">{preview.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="border-b border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <h2 className="marketing-heading text-2xl font-semibold text-[var(--marketing-text)] md:text-3xl">
              Privacy and Data Handling
            </h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--marketing-muted)] md:text-base">
              <p>Screndly uses authorized platform connections for publishing workflows.</p>
              <p>Access is limited to creating, scheduling, and publishing posts.</p>
              <p>Private dashboard content is not publicly exposed.</p>
              <p>User data is handled according to the Privacy Policy and Terms of Service.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-4">
              <a
                href="/privacy-policy"
                className="rounded-full border border-[color:var(--marketing-border)] px-4 py-2 text-sm font-medium text-[var(--marketing-text)] transition hover:border-neutral-900"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="rounded-full border border-[color:var(--marketing-border)] px-4 py-2 text-sm font-medium text-[var(--marketing-text)] transition hover:border-neutral-900"
              >
                Terms of Service
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[var(--marketing-bg)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
          <FadeIn>
            <div className="rounded-3xl border border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] p-8 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ec1e24]">
                Reviewer Access Information
              </p>
              <h2 className="marketing-heading mt-4 text-2xl font-semibold text-[var(--marketing-text)] md:text-3xl">
                Public overview for platform verification
              </h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--marketing-muted)] md:text-base">
                <p>This public page provides an overview of Screndly and its platform integrations.</p>
                <p>The working Screndly dashboard is private and protected.</p>
                <p>The website explains product workflows and integrations without requiring login.</p>
                <p>Review access to the dashboard can be provided separately if requested.</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </MarketingLayout>
  );
}
