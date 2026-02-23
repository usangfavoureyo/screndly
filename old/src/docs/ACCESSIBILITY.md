# Accessibility Documentation - Screndly

## Overview
Screndly is built with accessibility in mind, following WCAG 2.1 AA standards. This document outlines the accessibility features and best practices implemented throughout the application.

## Core Accessibility Features

### 1. Keyboard Navigation
- ✅ All interactive elements are keyboard accessible
- ✅ Visible focus indicators (2px red outline) on all focusable elements
- ✅ Logical tab order throughout the application
- ✅ Skip to main content link for screen reader users
- ✅ Arrow key navigation support in navigation menus

**Focus Styles:**
```css
*:focus-visible {
  outline: 2px solid var(--brand-red);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
```

### 2. Screen Reader Support
- ✅ Semantic HTML elements (`<nav>`, `<main>`, `<button>`, `<article>`)
- ✅ ARIA labels on all icon-only buttons
- ✅ ARIA live regions for dynamic content updates
- ✅ `aria-current` on active navigation items
- ✅ `aria-label` and `aria-labelledby` where appropriate
- ✅ `aria-hidden="true"` on decorative icons

**Example Implementation:**
```tsx
<button 
  aria-label="Open notifications"
  aria-expanded={isOpen}
>
  <Bell aria-hidden="true" />
</button>
```

### 3. Color Contrast
- ✅ Brand Red (#ec1e24) meets WCAG AA standards
- ✅ Text on backgrounds maintains 4.5:1 contrast ratio
- ✅ Interactive elements have 3:1 contrast ratio
- ✅ Dark mode fully implemented with proper contrast

**Primary Color Palette:**
- Brand Red: `#ec1e24` (primary actions)
- Black: `#000000` (dark mode background)
- White: `#FFFFFF` (light mode background)
- Gray scale for text hierarchy

### 4. Motion & Animation
- ✅ Respects `prefers-reduced-motion` media query
- ✅ All animations can be disabled for motion-sensitive users
- ✅ Smooth transitions with appropriate timing

**Implementation:**
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 5. Forms & Inputs
- ✅ All form fields have associated labels
- ✅ Error states clearly communicated
- ✅ Input validation with descriptive error messages
- ✅ Placeholder text is not sole source of information

### 6. Touch Targets
- ✅ Minimum 44x44px touch targets for mobile
- ✅ Adequate spacing between interactive elements
- ✅ Haptic feedback for mobile interactions

## Component-Specific Accessibility

### Navigation (Desktop & Mobile)
- Semantic `<nav>` elements
- Clear visual indicators for current page
- Keyboard-accessible dropdown menus
- Mobile bottom nav with proper ARIA labels

### Buttons
- Clear focus states
- Descriptive labels (not just icons)
- Disabled state properly communicated
- Loading states announced to screen readers

### Notifications
- ARIA live regions for new notifications
- Badge count announced to screen readers
- Keyboard accessible notification panel
- Clear visual and semantic structure

### Swipeable Components
- Touch gestures don't interfere with scrolling
- Alternative keyboard/click interactions provided
- Clear visual feedback during swipe

### Tables (Logs Activity)
- Proper `<table>` semantic structure
- `<th>` elements with scope attributes
- Row headers for screen reader context
- Responsive table design for mobile

### Modals & Dialogs
- Focus trap when opened
- Escape key to close
- Focus returns to trigger element on close
- Proper ARIA roles (`role="dialog"`)

## Testing

### Automated Testing
Run accessibility checks using:
```bash
npm run a11y
```

This uses pa11y-ci to check:
- WCAG 2.1 AA compliance
- Color contrast issues
- Missing ARIA labels
- Keyboard accessibility

### Manual Testing Checklist
- [ ] Navigate entire app using only keyboard
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Verify color contrast in light and dark modes
- [ ] Test with browser zoom at 200%
- [ ] Enable prefers-reduced-motion and verify animations
- [ ] Test touch targets on mobile devices
- [ ] Verify form validation and error messages

### Screen Reader Testing
Recommended screen readers:
- **Windows:** NVDA (free), JAWS
- **macOS:** VoiceOver (built-in)
- **iOS:** VoiceOver (built-in)
- **Android:** TalkBack (built-in)

## Known Issues & Future Improvements

### Current Limitations
- Some third-party library components may need additional ARIA attributes
- Complex drag-and-drop interactions may need keyboard alternatives

### Planned Improvements
- [ ] Add keyboard shortcuts documentation
- [ ] Implement more comprehensive ARIA live regions
- [ ] Add high contrast mode support
- [ ] Improve focus management in complex modals

## Resources & References

### WCAG Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Checklist](https://webaim.org/standards/wcag/checklist)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)

### Best Practices
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Contributing

When adding new features, ensure:
1. All interactive elements are keyboard accessible
2. Proper ARIA labels are added
3. Color contrast meets WCAG AA standards
4. Focus states are visible
5. Screen reader testing is performed
6. Automated tests pass (`npm run a11y`)

## Contact

For accessibility concerns or suggestions, please contact the development team or file an issue in the repository.

---

**Last Updated:** December 2024
**WCAG Compliance Level:** AA
**Testing Framework:** pa11y-ci, axe-core
