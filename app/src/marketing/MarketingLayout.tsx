import { useEffect, useMemo, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

const NAV_ITEMS = [
  { label: "Features", href: "/#features" },
  { label: "Pinterest Integration", href: "/#pinterest" },
  { label: "TikTok Integration", href: "/#tiktok" },
  { label: "Workflow", href: "/#workflow" },
  { label: "Privacy", href: "/#privacy" },
  { label: "Contact", href: "/#contact" },
];

type MarketingLayoutProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
};

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme;
    const hadDark = document.documentElement.classList.contains("dark");
    const previousBackground = document.body.style.backgroundColor;
    const previousColor = document.body.style.color;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const previousThemeColor = themeColorMeta?.getAttribute("content") ?? "";

    document.documentElement.dataset.theme = "light";
    document.documentElement.classList.remove("dark");
    document.body.style.backgroundColor = "#f9f9f7";
    document.body.style.color = "#0b0b0b";
    if (themeColorMeta) themeColorMeta.setAttribute("content", "#f9f9f7");

    return () => {
      if (previousTheme) {
        document.documentElement.dataset.theme = previousTheme;
      } else {
        delete document.documentElement.dataset.theme;
      }
      if (hadDark) {
        document.documentElement.classList.add("dark");
      }
      document.body.style.backgroundColor = previousBackground;
      document.body.style.color = previousColor;
      if (themeColorMeta) themeColorMeta.setAttribute("content", previousThemeColor);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerClasses = useMemo(() => {
    if (scrolled) {
      return "bg-white/95 shadow-[0_1px_20px_rgba(0,0,0,0.06)] border-b border-neutral-200/70";
    }
    return "bg-white/60 border-b border-transparent";
  }, [scrolled]);

  return (
    <div className="marketing-root bg-[#f9f9f7] text-neutral-900">
      <header className={`sticky top-0 z-50 backdrop-blur ${headerClasses}`}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
          <a href="/" className="text-lg font-semibold tracking-[0.2em] uppercase">
            Screndly
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-700 md:flex">
            {NAV_ITEMS.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-neutral-900">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/#product-preview"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:border-neutral-900"
            >
              View Product
            </a>
            <a
              href="/app"
              className="rounded-full bg-[#ec1e24] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Open App
            </a>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 p-2 text-neutral-800 md:hidden"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-neutral-200 bg-white px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium text-neutral-700">
              {NAV_ITEMS.map((item) => (
                <a key={item.label} href={item.href} className="transition hover:text-neutral-900">
                  {item.label}
                </a>
              ))}
              <div className="flex gap-3 pt-2">
                <a
                  href="/#product-preview"
                  className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-center text-sm font-medium text-neutral-900"
                >
                  View Product
                </a>
                <a
                  href="/app"
                  className="flex-1 rounded-full bg-[#ec1e24] px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  Open App
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer id="contact" className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 text-sm text-neutral-700 lg:px-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6">
              <a href="/privacy-policy" className="transition hover:text-neutral-900">
                Privacy Policy
              </a>
              <a href="/terms" className="transition hover:text-neutral-900">
                Terms of Service
              </a>
            </div>
            <a
              href="mailto:support@screndly.com"
              className="inline-flex items-center gap-2 font-medium text-neutral-900 transition hover:text-[#ec1e24]"
            >
              Contact <ArrowUpRight size={16} />
            </a>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">© Screndly</p>
        </div>
      </footer>
    </div>
  );
}

export const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay }}
    viewport={{ once: true, margin: "-80px" }}
  >
    {children}
  </motion.div>
);
