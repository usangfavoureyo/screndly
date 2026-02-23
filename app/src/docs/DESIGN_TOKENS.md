# Screndly Design Tokens

Complete reference for all design tokens used throughout Screndly's design system.

---

## 🎨 Brand Colors

### Primary Brand Colors
```css
--brand-red: #ec1e24;           /* Primary brand color - CTAs, highlights */
--brand-red-hover: #d01a20;     /* Hover state for red elements */
--brand-red-light: rgba(236, 30, 36, 0.1);  /* Light red backgrounds */
--brand-red-glow: rgba(236, 30, 36, 0.3);   /* Glow effects */
--brand-black: #000000;         /* Dark mode primary background */
--brand-white: #FFFFFF;         /* Light mode primary background */
```

### Usage Examples
```tsx
/* Primary CTA Button */
<button className="bg-[#ec1e24] hover:bg-[#d01a20] text-white">
  Upload Video
</button>

/* Light red background for highlights */
<div className="bg-[rgba(236,30,36,0.1)]">
  Highlighted content
</div>

/* Glow effect on focus */
<input className="focus:shadow-[0_0_20px_rgba(236,30,36,0.3)]" />
```

---

## 📏 Spacing Scale

### Spacing Tokens
```css
--spacing-xs: 0.25rem;   /* 4px  - Tight spacing */
--spacing-sm: 0.5rem;    /* 8px  - Small spacing */
--spacing-md: 0.75rem;   /* 12px - Medium spacing */
--spacing-lg: 1rem;      /* 16px - Standard spacing */
--spacing-xl: 1.5rem;    /* 24px - Large spacing */
--spacing-2xl: 2rem;     /* 32px - Extra large spacing */
--spacing-3xl: 3rem;     /* 48px - Section spacing */
--spacing-4xl: 4rem;     /* 64px - Page section spacing */
```

### Tailwind Equivalents
```tsx
/* xs */ className="p-1"    /* 4px */
/* sm */ className="p-2"    /* 8px */
/* md */ className="p-3"    /* 12px */
/* lg */ className="p-4"    /* 16px */
/* xl */ className="p-6"    /* 24px */
/* 2xl */ className="p-8"   /* 32px */
/* 3xl */ className="p-12"  /* 48px */
/* 4xl */ className="p-16"  /* 64px */
```

### Common Usage Patterns
```tsx
/* Card padding */
<div className="p-6">           /* 24px - standard card padding */

/* Section spacing */
<div className="space-y-6">     /* 24px vertical gaps between sections */

/* Page container */
<div className="px-4 md:px-6">  /* Responsive horizontal padding */

/* Button padding */
<button className="px-6 py-3">  /* 24px horizontal, 12px vertical */
```

---

## 🔘 Border Radius

### Radius Tokens
```css
--radius-xs: 0.25rem;    /* 4px  - Small elements (badges) */
--radius-sm: 0.5rem;     /* 8px  - Buttons, inputs */
--radius-md: 0.75rem;    /* 12px - Small cards */
--radius-lg: 1rem;       /* 16px - Standard cards */
--radius-xl: 1.5rem;     /* 24px - Modal dialogs */
--radius-2xl: 2rem;      /* 32px - Feature cards */
--radius-full: 9999px;   /* Full rounded - Pills, avatars */
```

### Component Mapping
```tsx
/* Buttons & Inputs */
<button className="rounded-lg">   /* 8px (--radius-sm) */

/* Standard Cards */
<div className="rounded-2xl">     /* 16px (--radius-lg) */

/* Feature Cards (Dashboard) */
<div className="rounded-[2rem]">  /* 32px (--radius-2xl) */

/* Pills & Badges */
<span className="rounded-full">   /* 9999px (--radius-full) */

/* Status Labels */
<span className="rounded-full">   /* Full rounded */

/* Modal Dialogs */
<div className="rounded-3xl">     /* 24px (--radius-xl) */
```

---

## 🌑 Shadows

### Shadow Scale
```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15), 0 10px 10px rgba(0, 0, 0, 0.04);
--shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.25);
--shadow-red: 0 0 20px var(--brand-red-glow);
```

### Usage Guidelines
```tsx
/* Cards (standard) */
<div className="shadow-sm">       /* Light shadow for cards */

/* Hover states */
<div className="hover:shadow-md">  /* Elevated on hover */

/* Modals & Panels */
<div className="shadow-xl">       /* Strong shadow for overlays */

/* Red glow (focus/active states) */
<button className="focus:shadow-[0_0_20px_rgba(236,30,36,0.3)]">
```

### Dark Mode Shadows
```tsx
/* Dark mode uses light shadows */
<div className="shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)]">
```

---

## ⚡ Transitions

### Timing Tokens
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-bounce: 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Default Easing Curve
```
cubic-bezier(0.4, 0, 0.2, 1)  /* Tailwind's ease-out equivalent */
```

### Usage Examples
```tsx
/* Button hover (fast) */
<button className="transition-all duration-150">

/* Color transitions (base) */
<div className="transition-colors duration-200">

/* Layout changes (slow) */
<div className="transition-all duration-300">

/* Playful animations (bounce) */
<div className="transition-transform duration-[400ms] ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]">
```

### Common Transition Patterns
```css
/* All properties (use sparingly) */
transition: all 0.2s ease-in-out;

/* Specific properties (preferred) */
transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
            box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Color only */
transition: background-color 0.2s ease-in-out, 
            color 0.2s ease-in-out;
```

---

## 📚 Z-Index Scale

### Layer Tokens
```css
--z-base: 0;             /* Default layer */
--z-dropdown: 10;        /* Dropdown menus */
--z-sticky: 20;          /* Sticky elements */
--z-fixed: 30;           /* Fixed position elements */
--z-modal-backdrop: 40;  /* Modal backdrop */
--z-modal: 50;           /* Modal content */
--z-popover: 60;         /* Popovers */
--z-tooltip: 70;         /* Tooltips */
--z-toast: 80;           /* Toast notifications */
```

### Component Mapping
```tsx
/* Navigation sidebar */
z-30  /* --z-fixed */

/* Modal backdrop */
z-40  /* --z-modal-backdrop */

/* Modal content */
z-50  /* --z-modal */

/* Notification panel */
z-50  /* --z-modal */

/* Toast notifications */
z-80  /* --z-toast */
```

---

## 🔤 Typography

### Font Weights
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
```

### Base Font Size
```css
--font-size: 16px;  /* Root font size */
```

### Typography Scale (from globals.css)
```css
h1: var(--text-2xl);      /* ~24px */
h2: var(--text-xl);       /* ~20px */
h3: var(--text-lg);       /* ~18px */
h4: var(--text-base);     /* 16px */
p: var(--text-base);      /* 16px */
```

### Usage Guidelines
```tsx
/* Headings - Use semantic HTML, avoid Tailwind text classes */
<h1>Page Title</h1>           /* Automatically styled */
<h2>Section Title</h2>        /* Automatically styled */

/* Body text */
<p>Body content</p>           /* Automatically styled */

/* Override only when necessary */
<h1 className="text-3xl">Custom size</h1>
```

---

## 🎯 Breakpoints

### Responsive Tokens
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;   /* Sidebar appears */
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

### Usage in JavaScript
```tsx
const isMobile = window.innerWidth < 1024;

// Or use matchMedia
const isLargeScreen = window.matchMedia('(min-width: 1024px)').matches;
```

### Tailwind Responsive Prefixes
```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
  /* Full width mobile, half tablet, third desktop */
</div>
```

---

## 🎨 Semantic Color Tokens

### From Tailwind Theme
```css
/* Light Mode */
--foreground: oklch(0.145 0 0);          /* Near black text */
--background: #ffffff;                    /* White background */
--border: rgba(0, 0, 0, 0.1);            /* Light gray borders */

/* Dark Mode */
--foreground: oklch(0.985 0 0);          /* Near white text */
--background: oklch(0.145 0 0);          /* Near black background */
--border: oklch(0.269 0 0);              /* Dark gray borders */
```

### Usage
```tsx
/* Use semantic classes */
<div className="bg-background text-foreground border border-border">
  Content
</div>

/* Screndly-specific overrides */
<div className="bg-white dark:bg-[#000000]">
  /* Pure black in dark mode */
</div>
```

---

## 📦 Component-Specific Tokens

### Status Labels
```tsx
/* Success */
className="bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]"

/* Error */
className="bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]"

/* Active */
className="bg-[#ec1e24] text-white"
```

### Platform Labels
```tsx
/* Base style */
className="px-2 py-1 rounded text-xs text-white"

/* Platform-specific backgrounds */
YouTube:   bg-[#FF0000]
X:         bg-[#000000]
Instagram: bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]
TikTok:    bg-[#000000]
Facebook:  bg-[#1877F2]
Threads:   bg-[#000000]
```

---

## 🎬 Animation Tokens

### Standard Animations (CSS)
```css
.animate-fade-in         /* Fade + translate up */
.animate-slide-in-left   /* Slide from left */
.animate-slide-in-right  /* Slide from right */
.animate-slide-up        /* Slide from bottom */
.animate-scale-in        /* Zoom in */
.animate-rotate-scale-in /* Rotate + zoom with bounce */
.animate-glow-pulse      /* Pulsing red glow */
.animate-spin            /* 360° rotation */
```

### Hover Effects
```css
.hover-lift    /* Translate up + shadow increase */
.hover-scale   /* Scale to 1.02 */
.hover-glow    /* Red glow on hover */
```

### Motion (Framer Motion) Tokens
```tsx
/* Common animation props */
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.3 }}
```

---

## 🔄 Usage Best Practices

### 1. **Prefer CSS Variables for Values**
```tsx
/* Good - uses tokens */
<div style={{ padding: 'var(--spacing-xl)' }}>

/* Avoid - hardcoded values */
<div style={{ padding: '24px' }}>
```

### 2. **Use Tailwind Classes for Responsive Design**
```tsx
/* Good - responsive with Tailwind */
<div className="p-4 md:p-6 lg:p-8">

/* Avoid - manual media queries */
<div style={{ padding: isMobile ? '16px' : '24px' }}>
```

### 3. **Maintain Consistency**
```tsx
/* Good - consistent card styling */
<div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm p-6">

/* Avoid - inconsistent styling */
<div className="bg-white rounded-xl shadow p-5">
```

### 4. **Document Custom Values**
```tsx
/* If you must use custom values, document why */
<div className="h-[72px]">  {/* Height matches iOS notch safe area */}
```

---

## 📚 Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [CSS Variables (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [Design Tokens (Design Systems Guide)](https://www.designsystems.com/design-tokens/)
- [Screndly globals.css](../styles/globals.css)
