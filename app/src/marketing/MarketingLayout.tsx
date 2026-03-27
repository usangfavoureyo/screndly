import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, X, ArrowUpRight, Moon, Sun } from "lucide-react";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const initialThemeRef = useRef<{
    datasetTheme?: string;
    hadDark: boolean;
    background: string;
    color: string;
    themeColor: string;
  } | null>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem("screndly_marketing_theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (initialThemeRef.current) {
      return;
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    initialThemeRef.current = {
      datasetTheme: document.documentElement.dataset.theme,
      hadDark: document.documentElement.classList.contains("dark"),
      background: document.body.style.backgroundColor,
      color: document.body.style.color,
      themeColor: themeColorMeta?.getAttribute("content") ?? "",
    };

    return () => {
      const snapshot = initialThemeRef.current;
      if (!snapshot) return;
      if (snapshot.datasetTheme) {
        document.documentElement.dataset.theme = snapshot.datasetTheme;
      } else {
        delete document.documentElement.dataset.theme;
      }
      if (snapshot.hadDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      document.body.style.backgroundColor = snapshot.background;
      document.body.style.color = snapshot.color;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", snapshot.themeColor);
    };
  }, []);

  useEffect(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    document.documentElement.dataset.theme = theme;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.style.backgroundColor = "#0c0d0f";
      document.body.style.color = "#f5f5f5";
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#0c0d0f");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.style.backgroundColor = "#f9f9f7";
      document.body.style.color = "#0b0b0b";
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#f9f9f7");
    }

    localStorage.setItem("screndly_marketing_theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerClasses = useMemo(() => {
    if (scrolled) {
      return "bg-[var(--marketing-surface)]/95 shadow-[0_1px_20px_rgba(0,0,0,0.06)] border-b border-[color:var(--marketing-border)]";
    }
    return "bg-[var(--marketing-surface)]/60 border-b border-transparent";
  }, [scrolled]);

  return (
    <div className="marketing-root bg-[var(--marketing-bg)] text-[var(--marketing-text)]" data-marketing-theme={theme}>
      <header className={`sticky top-0 z-50 backdrop-blur ${headerClasses}`}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
          <a href="/" className="flex items-center gap-3">
            <img
              src={
                theme === "dark"
                  ? "/marketing/screndly-logo-red-white.png"
                  : "/marketing/screndly-logo-red-black.png"
              }
              alt="Screndly"
              className="h-6 w-auto md:h-7"
            />
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--marketing-muted)] md:flex">
            {NAV_ITEMS.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-[var(--marketing-text)]">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/#product-preview"
              className="rounded-full border border-[color:var(--marketing-border)] px-4 py-2 text-sm font-medium text-[var(--marketing-text)] transition hover:border-[var(--marketing-text)]"
            >
              View Product
            </a>
            <a
              href="/app"
              className="rounded-full bg-[#ec1e24] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Open App
            </a>
            <button
              type="button"
              aria-label="Toggle theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--marketing-border)] text-[var(--marketing-text)] transition hover:border-[var(--marketing-text)]"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              aria-label="Toggle theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--marketing-border)] text-[var(--marketing-text)]"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--marketing-border)] p-2 text-[var(--marketing-text)]"
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-[color:var(--marketing-border)] bg-[var(--marketing-surface)] px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium text-[var(--marketing-muted)]">
              {NAV_ITEMS.map((item) => (
                <a key={item.label} href={item.href} className="transition hover:text-[var(--marketing-text)]">
                  {item.label}
                </a>
              ))}
              <div className="flex gap-3 pt-2">
                <a
                  href="/#product-preview"
                  className="flex-1 rounded-full border border-[color:var(--marketing-border)] px-4 py-2 text-center text-sm font-medium text-[var(--marketing-text)]"
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

      <footer id="contact" className="border-t border-[color:var(--marketing-border)] bg-[var(--marketing-surface)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 text-sm text-[var(--marketing-muted)] lg:px-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6">
              <a href="/privacy-policy" className="transition hover:text-[var(--marketing-text)]">
                Privacy Policy
              </a>
              <a href="/terms" className="transition hover:text-[var(--marketing-text)]">
                Terms of Service
              </a>
            </div>
            <a
              href="mailto:support@screndly.com"
              className="inline-flex items-center gap-2 font-medium text-[var(--marketing-text)] transition hover:text-[#ec1e24]"
            >
              Contact <ArrowUpRight size={16} />
            </a>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--marketing-muted-strong)]">© Screndly</p>
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
