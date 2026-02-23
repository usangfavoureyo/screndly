# Screndly Responsive Design Strategy

## Overview
Screndly implements a **mobile-first responsive design** strategy using Tailwind CSS breakpoints. The app adapts seamlessly from mobile devices (320px) to large desktop screens (2560px+).

---

## Breakpoint System

### Standard Breakpoints
```css
/* Tailwind CSS Breakpoints (also defined in globals.css as CSS variables) */
sm:  640px   /* Small tablets & large phones */
md:  768px   /* Tablets & small desktops */
lg:  1024px  /* Desktops & laptops (sidebar appears) */
xl:  1280px  /* Large desktop screens */
2xl: 1536px  /* Extra large desktop screens */
```

### CSS Variables
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

---

## Layout Patterns

### 1. **Navigation System**

#### Mobile (< 1024px)
- Hidden sidebar navigation
- Bottom navigation bar with 5 main actions
- Full-width content area
- Slide-over panels for notifications/settings

```tsx
/* Sidebar - Hidden on mobile */
<nav className="hidden lg:block lg:w-64">
  Sidebar content
</nav>

/* Mobile Bottom Nav */
<div className="lg:hidden fixed bottom-0 left-0 right-0">
  Mobile navigation
</div>
```

#### Desktop (>= 1024px)
- Fixed left sidebar (256px width)
- Content area with left padding
- No bottom navigation
- Side panels overlay on right

```tsx
/* Main content with sidebar offset */
<main className="lg:pl-64">
  Content
</main>
```

---

### 2. **Grid Systems**

#### Responsive Columns
```tsx
/* Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns */
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  Card items
</div>

/* Mobile: 1 column, Desktop: 2 columns */
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  Video cards
</div>
```

#### Stats/Metrics Cards
```tsx
/* Stack on mobile, 2 cols on tablet, 4 cols on desktop */
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  Stat cards
</div>
```

---

### 3. **Modal & Panel Behavior**

#### Mobile
- Full screen width
- Slide up from bottom
- Full viewport height

```tsx
<div className="fixed inset-0 lg:right-auto lg:w-[450px]">
  Modal content
</div>
```

#### Desktop
- Fixed width (450px typical)
- Slide in from right
- Full height, partial width

---

### 4. **Typography Scaling**

```tsx
/* Responsive text sizes */
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Heading
</h1>

<p className="text-sm md:text-base">
  Body text
</p>
```

---

## Component-Specific Patterns

### Dashboard Cards
```tsx
<div className="bg-white dark:bg-[#000000] 
                border border-gray-200 dark:border-[#333333] 
                rounded-2xl shadow-sm p-4 md:p-6">
  <!-- Less padding on mobile -->
</div>
```

### Form Layouts
```tsx
<div className="space-y-4">
  <!-- Stack all form fields on mobile -->
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Side-by-side on desktop -->
  </div>
</div>
```

### Video Upload Grid
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  <!-- 2 cols mobile, 3 cols tablet, 4 cols desktop -->
</div>
```

---

## Key Responsive Features

### 1. **Platform Cards (Platforms Page)**
- Mobile: Stack vertically
- Tablet: 2 columns
- Desktop: 3 columns

### 2. **Settings Panel**
- Mobile: Full screen overlay
- Desktop: Slide-in from right

### 3. **Video Studio**
- Mobile: Stacked controls
- Desktop: Side-by-side preview and controls

### 4. **Activity Logs**
- Mobile: Simplified table view (hide less important columns)
- Desktop: Full table with all columns

### 5. **Notification Panel**
- Mobile: Full screen width
- Desktop: 450px fixed width on right

---

## Touch Targets

All interactive elements follow touch-friendly sizing:

```css
/* Minimum touch target size */
min-height: 44px;  /* iOS guideline */
min-width: 44px;

/* Buttons */
padding: 12px 24px;  /* Adequate tap area */

/* Icon buttons */
padding: 12px;  /* 44px total with icon */
```

---

## Spacing Strategy

### Container Padding
```tsx
/* Mobile: 16px, Desktop: 24px */
<div className="p-4 md:p-6">
  Content
</div>

/* Page-level padding */
<div className="px-4 md:px-6 lg:px-8">
  Page content
</div>
```

### Gap Spacing
```tsx
/* Mobile: 16px, Desktop: 24px */
<div className="space-y-4 md:space-y-6">
  Sections
</div>

/* Grid gaps */
<div className="gap-4 md:gap-6">
  Grid items
</div>
```

---

## Testing Checklist

### Mobile (320px - 767px)
- [ ] Bottom navigation visible
- [ ] Sidebar hidden
- [ ] Cards stack vertically
- [ ] Touch targets adequate (44px min)
- [ ] Text readable without zoom
- [ ] Forms usable with on-screen keyboard

### Tablet (768px - 1023px)
- [ ] 2-column layouts appear
- [ ] Bottom nav still visible
- [ ] Modals are appropriately sized
- [ ] Touch targets maintained

### Desktop (1024px+)
- [ ] Sidebar navigation appears
- [ ] Bottom nav hidden
- [ ] Multi-column layouts active
- [ ] Hover states functional
- [ ] Proper use of whitespace

---

## Common Patterns

### Hide/Show Elements
```tsx
/* Hide on mobile, show on desktop */
<div className="hidden lg:block">
  Desktop only content
</div>

/* Show on mobile, hide on desktop */
<div className="lg:hidden">
  Mobile only content
</div>
```

### Responsive Flex Direction
```tsx
/* Stack on mobile, row on desktop */
<div className="flex flex-col lg:flex-row gap-4">
  Items
</div>
```

### Conditional Rendering (JS)
```tsx
const isMobile = window.innerWidth < 1024;

{isMobile ? <MobileView /> : <DesktopView />}
```

---

## Dark Mode Responsive Considerations

Dark mode works identically across all breakpoints:

```tsx
<div className="bg-white dark:bg-[#000000] 
                border border-gray-200 dark:border-[#333333]">
  <!-- Same responsive behavior in both themes -->
</div>
```

---

## Performance Considerations

1. **Images**: Use responsive image loading
   ```tsx
   <img 
     src={image} 
     className="w-full h-auto"
     loading="lazy"
   />
   ```

2. **Content**: Lazy load below-the-fold content on mobile

3. **Animations**: Respect `prefers-reduced-motion`

---

## Future Enhancements

- [ ] Add container queries for component-level responsiveness
- [ ] Implement viewport-based font scaling (clamp())
- [ ] Add landscape-specific mobile layouts
- [ ] Optimize for foldable devices

---

## Resources

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [CSS Variables Documentation](../styles/globals.css)
