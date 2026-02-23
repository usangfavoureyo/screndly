import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Palette, 
  Type, 
  Box, 
  Sparkles, 
  Grid, 
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle
} from 'lucide-react';
import { haptics } from '../utils/haptics';

interface DesignSystemPageProps {
  onNavigate: (page: string) => void;
}

export function DesignSystemPage({ onNavigate }: DesignSystemPageProps) {
  const [activeSection, setActiveSection] = useState<'colors' | 'spacing' | 'radius' | 'shadows' | 'transitions' | 'responsive' | 'components'>('colors');

  const sections = [
    { id: 'colors' as const, label: 'Colors', icon: Palette },
    { id: 'spacing' as const, label: 'Spacing', icon: Grid },
    { id: 'radius' as const, label: 'Border Radius', icon: Box },
    { id: 'shadows' as const, label: 'Shadows', icon: Sparkles },
    { id: 'transitions' as const, label: 'Transitions', icon: Type },
    { id: 'responsive' as const, label: 'Responsive', icon: Monitor },
    { id: 'components' as const, label: 'Components', icon: Box },
  ];

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => {
            haptics.light();
            // Desktop: go to dashboard, Mobile/Tablet: go to settings
            const isDesktop = window.innerWidth >= 1024; // lg breakpoint
            onNavigate(isDesktop ? 'dashboard' : 'settings');
          }}
          className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2M9 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-gray-900 dark:text-white mb-2">Design System</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF]">Screndly's comprehensive design tokens and component library.</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-2">
        <div className="flex gap-1 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  haptics.light();
                  setActiveSection(section.id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === section.id
                    ? 'bg-[#ec1e24] text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <motion.div key={activeSection} {...fadeIn}>
        {activeSection === 'colors' && <ColorsSection />}
        {activeSection === 'spacing' && <SpacingSection />}
        {activeSection === 'radius' && <RadiusSection />}
        {activeSection === 'shadows' && <ShadowsSection />}
        {activeSection === 'transitions' && <TransitionsSection />}
        {activeSection === 'responsive' && <ResponsiveSection />}
        {activeSection === 'components' && <ComponentsSection />}
      </motion.div>
    </div>
  );
}

function ColorsSection() {
  const brandColors = [
    { name: 'Brand Red', var: '--brand-red', value: '#ec1e24' },
    { name: 'Brand Red Light', var: '--brand-red-light', value: 'rgba(236, 30, 36, 0.1)' },
    { name: 'Brand White', var: '--brand-white', value: '#ffffff' },
    { name: 'Brand Black', var: '--brand-black', value: '#000000' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h2 className="text-gray-900 dark:text-white mb-4">Brand Colors</h2>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-6">
          Screndly's cinematic color palette featuring the signature #ec1e24 red.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brandColors.map((color) => (
            <div key={color.var} className="space-y-2">
              <div 
                className="h-24 rounded-lg border border-gray-200 dark:border-[#333333]"
                style={{ backgroundColor: color.value }}
              />
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{color.name}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono">{color.var}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{color.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h3 className="text-gray-900 dark:text-white mb-4">Usage Guidelines</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Use <code className="bg-gray-100 dark:bg-[#1A1A1A] px-2 py-0.5 rounded text-[#ec1e24]">--brand-red</code> for primary CTAs, active states, and key brand moments
            </p>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Avoid using red for error states - reserve brand red for positive brand actions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpacingSection() {
  const spacingScale = [
    { name: 'space-0', value: '0', px: '0px' },
    { name: 'space-1', value: '0.25rem', px: '4px' },
    { name: 'space-2', value: '0.5rem', px: '8px' },
    { name: 'space-3', value: '0.75rem', px: '12px' },
    { name: 'space-4', value: '1rem', px: '16px' },
    { name: 'space-5', value: '1.25rem', px: '20px' },
    { name: 'space-6', value: '1.5rem', px: '24px' },
    { name: 'space-8', value: '2rem', px: '32px' },
    { name: 'space-10', value: '2.5rem', px: '40px' },
    { name: 'space-12', value: '3rem', px: '48px' },
    { name: 'space-16', value: '4rem', px: '64px' },
    { name: 'space-20', value: '5rem', px: '80px' },
    { name: 'space-24', value: '6rem', px: '96px' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h2 className="text-gray-900 dark:text-white mb-4">Spacing Scale</h2>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-6">
          8px base spacing system for consistent layout rhythm.
        </p>
        <div className="space-y-4">
          {spacingScale.map((space) => (
            <div key={space.name} className="flex items-center gap-4">
              <div className="w-32">
                <p className="text-sm text-gray-900 dark:text-white font-mono">--{space.name}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{space.px}</p>
              </div>
              <div className="flex-1 h-12 bg-gray-100 dark:bg-[#1A1A1A] rounded-lg flex items-center">
                <div 
                  className="h-8 bg-[#ec1e24] rounded"
                  style={{ width: space.value }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h3 className="text-gray-900 dark:text-white mb-4">Usage in CSS</h3>
        <div className="bg-gray-100 dark:bg-[#1A1A1A] rounded-lg p-4 font-mono text-sm">
          <pre className="text-gray-900 dark:text-white overflow-x-auto">
{`.card {
  padding: var(--space-6);
  margin-bottom: var(--space-4);
  gap: var(--space-3);
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function RadiusSection() {
  const radiusScale = [
    { name: 'radius-xs', value: '0.25rem', px: '4px' },
    { name: 'radius-sm', value: '0.5rem', px: '8px' },
    { name: 'radius-md', value: '0.75rem', px: '12px' },
    { name: 'radius-lg', value: '1rem', px: '16px' },
    { name: 'radius-xl', value: '1.25rem', px: '20px' },
    { name: 'radius-2xl', value: '1.5rem', px: '24px' },
    { name: 'radius-3xl', value: '2rem', px: '32px' },
    { name: 'radius-full', value: '9999px', px: 'Full' },
  ];

  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
      <h2 className="text-gray-900 dark:text-white mb-4">Border Radius</h2>
      <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-6">
        Screndly uses generous border radius for a modern, friendly aesthetic.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {radiusScale.map((radius) => (
          <div key={radius.name} className="space-y-3">
            <div 
              className="h-24 bg-[#ec1e24] border border-gray-200 dark:border-[#333333]"
              style={{ borderRadius: radius.value }}
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-white font-mono">--{radius.name}</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{radius.px}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShadowsSection() {
  const shadows = [
    { name: 'shadow-xs', value: '0 1px 2px rgba(0, 0, 0, 0.05)' },
    { name: 'shadow-sm', value: '0 2px 4px rgba(0, 0, 0, 0.05)' },
    { name: 'shadow-md', value: '0 4px 8px rgba(0, 0, 0, 0.08)' },
    { name: 'shadow-lg', value: '0 8px 16px rgba(0, 0, 0, 0.1)' },
    { name: 'shadow-xl', value: '0 12px 24px rgba(0, 0, 0, 0.12)' },
    { name: 'shadow-2xl', value: '0 16px 32px rgba(0, 0, 0, 0.15)' },
    { name: 'shadow-brand', value: '0 0 20px rgba(236, 30, 36, 0.3)' },
  ];

  return (
    <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
      <h2 className="text-gray-900 dark:text-white mb-4">Shadow Scale</h2>
      <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-6">
        Subtle shadows for depth and hierarchy. Note: Buttons use flat design without shadows.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shadows.map((shadow) => (
          <div key={shadow.name} className="space-y-3">
            <div 
              className="h-24 bg-white dark:bg-[#1A1A1A] rounded-lg flex items-center justify-center"
              style={{ boxShadow: shadow.value }}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">--{shadow.name}</p>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono break-all">
              {shadow.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransitionsSection() {
  const transitions = [
    { name: 'transition-fast', value: '150ms cubic-bezier(0.4, 0, 0.2, 1)', duration: '150ms' },
    { name: 'transition-base', value: '200ms cubic-bezier(0.4, 0, 0.2, 1)', duration: '200ms' },
    { name: 'transition-medium', value: '300ms cubic-bezier(0.4, 0, 0.2, 1)', duration: '300ms' },
    { name: 'transition-slow', value: '500ms cubic-bezier(0.4, 0, 0.2, 1)', duration: '500ms' },
    { name: 'transition-bounce', value: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)', duration: '400ms' },
  ];

  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h2 className="text-gray-900 dark:text-white mb-4">Transition Timings</h2>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-6">
          Consistent easing curves for smooth, natural animations.
        </p>
        <div className="space-y-4">
          {transitions.map((transition, index) => (
            <div key={transition.name}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white font-mono">--{transition.name}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{transition.duration}</p>
                </div>
                <button
                  onClick={() => {
                    setAnimatingIndex(index);
                    setTimeout(() => setAnimatingIndex(null), parseInt(transition.duration));
                  }}
                  className="px-4 py-2 bg-[#ec1e24] text-white rounded-lg text-sm"
                >
                  Play
                </button>
              </div>
              <div className="h-12 bg-gray-100 dark:bg-[#1A1A1A] rounded-lg flex items-center p-2">
                <motion.div
                  className="w-12 h-8 bg-[#ec1e24] rounded"
                  animate={{
                    x: animatingIndex === index ? 'calc(100% - 48px)' : 0
                  }}
                  transition={{
                    duration: parseInt(transition.duration) / 1000,
                    ease: transition.value.includes('cubic-bezier') 
                      ? [0.4, 0, 0.2, 1] 
                      : 'easeInOut'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResponsiveSection() {
  const breakpoints = [
    { 
      name: 'Mobile', 
      icon: Smartphone, 
      range: '< 640px', 
      var: '--breakpoint-sm',
      description: 'Single column layouts, bottom navigation, full-width cards'
    },
    { 
      name: 'Tablet', 
      icon: Tablet, 
      range: '640px - 1024px', 
      var: '--breakpoint-md',
      description: '2-column grids, condensed sidebar, responsive typography'
    },
    { 
      name: 'Laptop', 
      icon: Laptop, 
      range: '1024px - 1280px', 
      var: '--breakpoint-lg',
      description: 'Full sidebar navigation, 3-column grids, optimal reading width'
    },
    { 
      name: 'Desktop', 
      icon: Monitor, 
      range: '> 1280px', 
      var: '--breakpoint-xl',
      description: '4-column grids, expanded layouts, maximum content visibility'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h2 className="text-gray-900 dark:text-white mb-4">Responsive Breakpoints</h2>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-6">
          Screndly follows a mobile-first responsive strategy with Tailwind's breakpoint system.
        </p>
        <div className="space-y-4">
          {breakpoints.map((bp) => {
            const Icon = bp.icon;
            return (
              <div key={bp.name} className="flex gap-4 p-4 bg-gray-50 dark:bg-[#1A1A1A] rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-[#ec1e24] rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-gray-900 dark:text-white">{bp.name}</h3>
                    <span className="text-xs bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                      {bp.range}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono mb-2">{bp.var}</p>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{bp.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h3 className="text-gray-900 dark:text-white mb-4">Responsive Strategy</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm text-gray-900 dark:text-white mb-2">Mobile First Approach</h4>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Base styles target mobile, then enhance with <code className="bg-gray-100 dark:bg-[#1A1A1A] px-1 py-0.5 rounded">md:</code>, <code className="bg-gray-100 dark:bg-[#1A1A1A] px-1 py-0.5 rounded">lg:</code>, <code className="bg-gray-100 dark:bg-[#1A1A1A] px-1 py-0.5 rounded">xl:</code> prefixes.
            </p>
          </div>
          <div>
            <h4 className="text-sm text-gray-900 dark:text-white mb-2">Navigation Pattern</h4>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Mobile: Bottom navigation bar • Desktop: Left sidebar (256px fixed)
            </p>
          </div>
          <div>
            <h4 className="text-sm text-gray-900 dark:text-white mb-2">Grid Layouts</h4>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Mobile: 1 column • Tablet: 2 columns • Laptop: 3 columns • Desktop: 4 columns
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComponentsSection() {
  const components = [
    {
      name: 'Button',
      variants: ['Primary', 'Secondary', 'Outline', 'Ghost'],
      description: 'Flat design with no shadows, uses brand red for primary actions'
    },
    {
      name: 'Card',
      variants: ['Default', 'Hover Lift', 'Interactive'],
      description: 'Rounded corners (radius-2xl), subtle shadows, responsive padding'
    },
    {
      name: 'Status Badge',
      variants: ['Success', 'Error', 'Warning', 'Info'],
      description: 'Consistent styling across logs, activities, and notifications'
    },
    {
      name: 'Platform Label',
      variants: ['YouTube', 'Instagram', 'TikTok', 'X', 'Threads', 'Facebook'],
      description: 'Unified appearance for platform indicators throughout the app'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h2 className="text-gray-900 dark:text-white mb-4">Component Library</h2>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-6">
          Reusable UI components built on our design system tokens.
        </p>
        <div className="space-y-6">
          {components.map((component) => (
            <div key={component.name} className="border-t border-gray-200 dark:border-[#333333] pt-6 first:border-0 first:pt-0">
              <h3 className="text-gray-900 dark:text-white mb-2">{component.name}</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-3">{component.description}</p>
              <div className="flex flex-wrap gap-2">
                {component.variants.map((variant) => (
                  <span 
                    key={variant}
                    className="px-3 py-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 rounded-lg text-sm"
                  >
                    {variant}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">
        <h3 className="text-gray-900 dark:text-white mb-4">Examples</h3>
        <div className="space-y-6">
          {/* Buttons */}
          <div>
            <h4 className="text-sm text-gray-900 dark:text-white mb-3">Buttons</h4>
            <div className="flex flex-wrap gap-3">
              <button className="px-6 py-2 bg-[#ec1e24] text-white rounded-lg hover:bg-[#d11a1f] transition-colors">
                Primary
              </button>
              <button className="px-6 py-2 bg-gray-100 dark:bg-[#1A1A1A] text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-[#333333] transition-colors">
                Secondary
              </button>
              <button className="px-6 py-2 border border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-colors">
                Outline
              </button>
            </div>
          </div>

          {/* Status Badges */}
          <div>
            <h4 className="text-sm text-gray-900 dark:text-white mb-3">Status Badges</h4>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 rounded-full bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]">
                Success
              </span>
              <span className="px-3 py-1 rounded-full bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]">
                Failed
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">
                Processing
              </span>
            </div>
          </div>

          {/* Notification Icons */}
          <div>
            <h4 className="text-sm text-gray-900 dark:text-white mb-3">Notification States</h4>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#ec1e24]" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Success</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#ec1e24]" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Error</span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#ec1e24]" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Info</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#ec1e24]" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Warning</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}