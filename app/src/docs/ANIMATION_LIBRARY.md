# Screndly Animation Library

Comprehensive guide to all animations and motion patterns used in Screndly.

---

## 🎯 Animation Philosophy

**Screndly uses animations to:**
1. **Guide attention** - Draw focus to important actions and changes
2. **Provide feedback** - Confirm user actions and system status
3. **Create continuity** - Smooth transitions between states
4. **Add delight** - Make the experience feel polished and premium

**Key Principles:**
- ✅ **Purposeful** - Every animation serves a function
- ✅ **Subtle** - Animations enhance, not distract
- ✅ **Fast** - Most animations complete in 150-400ms
- ✅ **Accessible** - Respect `prefers-reduced-motion`

---

## 🎨 CSS Animation Classes

### Basic Animations

#### 1. **Fade In**
```css
.animate-fade-in
```
**Duration:** 400ms  
**Easing:** ease-out  
**Effect:** Fades in with slight upward movement

**Usage:**
```tsx
<div className="animate-fade-in">
  Content appears smoothly
</div>
```

**Best for:** Page content, cards, modals

---

#### 2. **Slide In (Left)**
```css
.animate-slide-in-left
```
**Duration:** 400ms  
**Easing:** ease-out  
**Effect:** Slides in from left with fade

**Usage:**
```tsx
<div className="animate-slide-in-left">
  Content slides in from left
</div>
```

**Best for:** Sidebar panels, navigation items

---

#### 3. **Slide In (Right)**
```css
.animate-slide-in-right
```
**Duration:** 400ms  
**Easing:** ease-out  
**Effect:** Slides in from right with fade

**Usage:**
```tsx
<div className="animate-slide-in-right">
  Content slides in from right
</div>
```

**Best for:** Settings panels, notification drawer

---

#### 4. **Slide Up**
```css
.animate-slide-up
```
**Duration:** 400ms  
**Easing:** ease-out  
**Effect:** Slides up from bottom with fade

**Usage:**
```tsx
<div className="animate-slide-up">
  Content slides up from bottom
</div>
```

**Best for:** Mobile modals, bottom sheets, toasts

---

#### 5. **Scale In**
```css
.animate-scale-in
```
**Duration:** 300ms  
**Easing:** ease-out  
**Effect:** Scales from 95% to 100% with fade

**Usage:**
```tsx
<div className="animate-scale-in">
  Content zooms in
</div>
```

**Best for:** Dialogs, popovers, tooltips

---

#### 6. **Rotate Scale In**
```css
.animate-rotate-scale-in
```
**Duration:** 500ms  
**Easing:** bounce (cubic-bezier(0.68, -0.55, 0.265, 1.55))  
**Effect:** Scales and rotates with playful bounce

**Usage:**
```tsx
<div className="animate-rotate-scale-in">
  Playful entrance
</div>
```

**Best for:** Success messages, celebration moments

---

#### 7. **Blur In**
```css
.animate-blur-in
```
**Duration:** 500ms  
**Easing:** ease-out  
**Effect:** Fades in while removing blur filter

**Usage:**
```tsx
<div className="animate-blur-in">
  Content materializes
</div>
```

**Best for:** Hero images, feature showcases

---

### Continuous Animations

#### 8. **Pulse (Slow)**
```css
.animate-pulse-slow
```
**Duration:** 2s infinite  
**Easing:** cubic-bezier(0.4, 0, 0.6, 1)  
**Effect:** Gentle opacity pulse

**Usage:**
```tsx
<div className="animate-pulse-slow">
  Attention indicator
</div>
```

**Best for:** Loading states, recording indicators

---

#### 9. **Spin**
```css
.animate-spin
```
**Duration:** 1s infinite linear  
**Effect:** 360° rotation

**Usage:**
```tsx
<div className="animate-spin">
  ⟳
</div>
```

**Best for:** Loading spinners

---

#### 10. **Glow Pulse**
```css
.animate-glow-pulse
```
**Duration:** 2s infinite  
**Easing:** ease-in-out  
**Effect:** Pulsing red glow (box-shadow)

**Usage:**
```tsx
<button className="animate-glow-pulse">
  Live Now
</button>
```

**Best for:** Live indicators, urgent notifications

---

#### 11. **Shimmer**
```css
.animate-shimmer
```
**Duration:** 2s infinite  
**Effect:** Horizontal shimmer sweep

**Usage:**
```tsx
<div className="animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent">
  Loading skeleton
</div>
```

**Best for:** Loading skeletons

---

#### 12. **Bounce (Slow)**
```css
.animate-bounce-slow
```
**Duration:** 2s infinite  
**Easing:** ease-in-out  
**Effect:** Vertical bounce

**Usage:**
```tsx
<div className="animate-bounce-slow">
  ↓ Scroll down
</div>
```

**Best for:** Scroll indicators, attention arrows

---

### List Animations

#### 13. **Stagger**
```css
.animate-stagger
```
**Duration:** 500ms  
**Easing:** ease-out backwards  
**Effect:** Delays based on position (use with CSS animation-delay)

**Usage:**
```tsx
{items.map((item, index) => (
  <div 
    key={item.id}
    className="animate-stagger"
    style={{ animationDelay: `${index * 0.1}s` }}
  >
    {item.content}
  </div>
))}
```

**Best for:** List items, grid cards

---

### Hover Effects

#### 14. **Hover Lift**
```css
.hover-lift
```
**Duration:** 300ms  
**Easing:** cubic-bezier(0.4, 0, 0.2, 1)  
**Effect:** Translates up 4px + increases shadow

**Usage:**
```tsx
<div className="hover-lift">
  Hover to lift
</div>
```

**Best for:** Cards, interactive elements

---

#### 15. **Hover Scale**
```css
.hover-scale
```
**Duration:** 200ms  
**Easing:** ease-in-out  
**Effect:** Scales to 1.02

**Usage:**
```tsx
<button className="hover-scale">
  Hover to scale
</button>
```

**Best for:** Buttons, thumbnails

---

#### 16. **Hover Glow**
```css
.hover-glow
```
**Effect:** Adds red glow shadow on hover

**Usage:**
```tsx
<button className="hover-glow">
  Primary CTA
</button>
```

**Best for:** Primary action buttons

---

## 🎬 Motion (Framer Motion) Patterns

### Installation
```tsx
import { motion } from 'motion/react';
```

### Basic Animations

#### Page Transitions
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  Page content
</motion.div>
```

#### Hover Animations
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 0.2 }}
>
  Interactive Button
</motion.button>
```

#### Drag & Drop
```tsx
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300, top: 0, bottom: 300 }}
  dragElastic={0.1}
>
  Draggable element
</motion.div>
```

---

### Advanced Motion Patterns

#### 1. **Staggered Children**
```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

<motion.div variants={container} initial="hidden" animate="show">
  {items.map((item) => (
    <motion.div key={item.id} variants={item}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

---

#### 2. **Layout Animations**
```tsx
<motion.div layout transition={{ duration: 0.3 }}>
  Content that animates when layout changes
</motion.div>
```

---

#### 3. **Scroll-Based Animations**
```tsx
import { useScroll, useTransform } from 'motion/react';

const { scrollYProgress } = useScroll();
const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

<motion.div style={{ opacity }}>
  Fades out on scroll
</motion.div>
```

---

#### 4. **Exit Animations**
```tsx
import { AnimatePresence } from 'motion/react';

<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      Content
    </motion.div>
  )}
</AnimatePresence>
```

---

#### 5. **Gestures**
```tsx
<motion.div
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
  whileFocus={{ outline: '2px solid #ec1e24' }}
>
  Gesture-aware element
</motion.div>
```

---

## 🎯 Animation Recipes

### Loading State
```tsx
<div className="flex items-center gap-2">
  <div className="w-4 h-4 animate-spin border-2 border-[#ec1e24] border-t-transparent rounded-full" />
  <span>Loading...</span>
</div>
```

### Success Checkmark
```tsx
<motion.svg
  className="w-12 h-12 text-green-500"
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ type: 'spring', stiffness: 200 }}
>
  <motion.path
    d="M5 13l4 4L19 7"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    initial={{ pathLength: 0 }}
    animate={{ pathLength: 1 }}
    transition={{ duration: 0.5 }}
  />
</motion.svg>
```

### Card Hover Effect
```tsx
<motion.div
  className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl p-6"
  whileHover={{
    y: -4,
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)'
  }}
  transition={{ duration: 0.3 }}
>
  Card content
</motion.div>
```

### Modal Enter/Exit
```tsx
<AnimatePresence>
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 m-auto w-full max-w-md h-fit bg-white dark:bg-[#000000] rounded-2xl p-6 z-50"
      >
        Modal content
      </motion.div>
    </>
  )}
</AnimatePresence>
```

### Notification Toast
```tsx
<motion.div
  initial={{ opacity: 0, y: 50, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, x: 100 }}
  transition={{ duration: 0.3 }}
  className="fixed bottom-4 right-4 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-xl shadow-xl p-4 z-80"
>
  Toast message
</motion.div>
```

---

## ♿ Accessibility

### Respecting User Preferences
```tsx
import { useReducedMotion } from 'motion/react';

function Component() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={shouldReduceMotion ? {} : { opacity: [0, 1], y: [20, 0] }}
    >
      Content
    </motion.div>
  );
}
```

### CSS Media Query
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 🎮 Performance Tips

### 1. **Use Transform & Opacity**
```tsx
/* Good - GPU accelerated */
transform: translateY(10px);
opacity: 0.5;

/* Avoid - triggers layout reflow */
top: 10px;
margin-top: 10px;
```

### 2. **Will-Change Hint**
```css
.animated-element {
  will-change: transform, opacity;
}
```

### 3. **Limit Simultaneous Animations**
```tsx
/* Avoid animating too many elements at once */
{items.slice(0, 10).map((item, i) => (
  <motion.div
    key={item.id}
    custom={i}
    variants={itemVariants}
  >
    {item.content}
  </motion.div>
))}
```

---

## 📋 Quick Reference

| Animation Class | Duration | Use Case |
|-----------------|----------|----------|
| `animate-fade-in` | 400ms | Page content |
| `animate-slide-in-left` | 400ms | Sidebars |
| `animate-slide-in-right` | 400ms | Panels |
| `animate-scale-in` | 300ms | Modals |
| `animate-rotate-scale-in` | 500ms | Success states |
| `animate-glow-pulse` | 2s loop | Live indicators |
| `animate-spin` | 1s loop | Loading |
| `hover-lift` | 300ms | Cards |
| `hover-scale` | 200ms | Buttons |

---

## 🔗 Resources

- [Motion (Framer Motion) Docs](https://motion.dev/)
- [CSS Animations (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations)
- [Web Animation Best Practices](https://web.dev/animations/)
- [Screndly globals.css](../styles/globals.css)
