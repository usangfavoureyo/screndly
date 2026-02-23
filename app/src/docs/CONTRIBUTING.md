# Contributing to Screndly

Thank you for your interest in contributing to Screndly! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Testing Guidelines](#testing-guidelines)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Project Architecture](#project-architecture)
9. [Design System Guidelines](#design-system-guidelines)
10. [Accessibility Requirements](#accessibility-requirements)

---

## Code of Conduct

This project is a single-user internal tool for Screen Render. All contributions should maintain professional standards and align with the project's goals.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Git
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Basic knowledge of React, TypeScript, and Tailwind CSS

### Initial Setup

```bash
# Clone the repository
git clone [your-repo-url]
cd screndly

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:5173
```

### Development Environment

- **IDE**: VS Code recommended with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features
- **Browser DevTools**: Chrome DevTools or Firefox Developer Tools
- **Testing**: Vitest UI for interactive testing

---

## Development Workflow

### 1. Create a Feature Branch

```bash
# Always branch from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Keep changes focused and atomic
- Follow the code standards below
- Test your changes thoroughly
- Update documentation if needed

### 3. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### 4. Lint Your Code

```bash
# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### 5. Commit Changes

Follow the [commit guidelines](#commit-guidelines) below.

### 6. Push and Create Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name

# Create pull request on GitHub
# Provide clear description and link to any issues
```

---

## Code Standards

### TypeScript

- **Strict Mode**: Always enabled
- **Type Annotations**: Explicit for function parameters and return types
- **No `any`**: Use proper types or `unknown`
- **Interfaces over Types**: Use interfaces for object shapes

```typescript
// ✅ Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps): JSX.Element {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ❌ Bad
export function Button(props: any) {
  return <button onClick={props.onClick}>{props.label}</button>;
}
```

### React

- **Functional Components**: Always use function components with hooks
- **Component File Structure**:
  ```typescript
  // 1. Imports
  import { useState } from 'react';
  import { Button } from './ui/button';
  
  // 2. Types/Interfaces
  interface MyComponentProps {
    title: string;
  }
  
  // 3. Component
  export function MyComponent({ title }: MyComponentProps) {
    // 4. Hooks
    const [state, setState] = useState(false);
    
    // 5. Event handlers
    const handleClick = () => {
      setState(true);
    };
    
    // 6. Render
    return <div>{title}</div>;
  }
  ```

### Tailwind CSS

- **Important Rules**:
  - **NO font-size classes** (text-xl, text-2xl, etc.) unless explicitly requested
  - **NO font-weight classes** (font-bold, font-semibold, etc.) unless explicitly requested
  - **NO line-height classes** (leading-tight, leading-relaxed, etc.) unless explicitly requested
  - Typography is handled by design tokens in `/styles/globals.css`
  
- **Color Classes**: Use brand colors consistently
  ```tsx
  // ✅ Good - Use semantic colors
  <div className="bg-white dark:bg-[#000000] text-gray-900 dark:text-white">
  
  // ✅ Good - Use brand colors for accents
  <button className="bg-[#ec1e24] text-white">
  
  // ❌ Bad - Grey #292929 backgrounds
  <div className="bg-[#292929]">
  ```

- **Dark Mode**: Always provide dark mode variants
  ```tsx
  <div className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
  ```

- **Spacing**: Use consistent spacing scale (4px base)
  ```tsx
  // Prefer: p-4, m-2, gap-8, space-y-6
  // Avoid: arbitrary values like p-[13px]
  ```

### File Naming

- **Components**: PascalCase (e.g., `VideoCard.tsx`)
- **Utilities**: camelCase (e.g., `haptics.ts`)
- **Tests**: Match source file with `.test.ts` suffix (e.g., `haptics.test.ts`)
- **Documentation**: UPPERCASE with underscores (e.g., `CONTRIBUTING.md`)

### Code Organization

```
components/
├── ui/              # Reusable UI components
├── settings/        # Settings-specific components
├── jobs/            # Upload Manager components
├── rss/             # RSS feed components
├── tmdb/            # TMDb components
└── *Page.tsx        # Full page components
```

---

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle user interaction', () => {
    const mockFn = vi.fn();
    render(<MyComponent onClick={mockFn} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockFn).toHaveBeenCalledOnce();
  });
});
```

### Testing Checklist

- [ ] Component renders without errors
- [ ] Props are correctly passed and used
- [ ] User interactions work as expected
- [ ] Edge cases are handled
- [ ] Error states are tested
- [ ] Loading states are tested
- [ ] Accessibility attributes are present

### Coverage Goals

- **Minimum**: 70% overall coverage
- **Critical Paths**: 90%+ coverage for core features
- **UI Components**: Focus on user interaction testing

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic changes)
- `refactor`: Code refactoring
- `test`: Test updates
- `chore`: Build process or auxiliary tool changes
- `a11y`: Accessibility improvements
- `perf`: Performance improvements

### Examples

```bash
feat(video-studio): add caption template editor

Implement advanced caption editor with:
- Multiple caption styles
- Real-time preview
- Template saving/loading

Closes #123

---

fix(rss): handle invalid feed URLs gracefully

Add try-catch around URL parsing to prevent crashes
when users enter malformed URLs

---

docs(readme): update installation instructions

Add troubleshooting section for common setup issues

---

a11y(navigation): improve keyboard navigation

- Add proper ARIA labels
- Fix focus management
- Implement skip links
```

### Commit Best Practices

- **Atomic commits**: One logical change per commit
- **Present tense**: "Add feature" not "Added feature"
- **Imperative mood**: "Fix bug" not "Fixes bug"
- **Reference issues**: Include issue numbers when applicable
- **Clear subject**: Max 50 characters
- **Detailed body**: Explain what and why, not how

---

## Pull Request Process

### 1. Pre-PR Checklist

- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed
- [ ] Accessibility verified
- [ ] Tested on multiple screen sizes
- [ ] Dark mode tested

### 2. PR Title

Use the same format as commit messages:

```
feat(video-studio): add caption template editor
```

### 3. PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Tested on mobile
- [ ] Tested in dark mode
- [ ] Accessibility verified

## Screenshots
(If applicable)

## Related Issues
Closes #123
```

### 4. Review Process

- At least one approval required
- All comments must be resolved
- CI/CD checks must pass
- No merge conflicts

---

## Project Architecture

### Component Hierarchy

```
App.tsx
├── ThemeProvider
├── SettingsProvider
├── NotificationsProvider
├── RSSFeedsProvider
├── VideoStudioTemplatesProvider
├── TMDbPostsProvider
└── UndoProvider
    └── AppContent
        ├── Navigation (Desktop)
        ├── MobileBottomNav (Mobile)
        ├── SettingsPanel
        ├── NotificationPanel
        └── Page Components
```

### State Management

**Zustand Stores**:
- `useAppStore`: Global app state (videos, channels, platforms)
- `useJobsStore`: Upload job pipeline state

**React Context**:
- `SettingsContext`: User settings and preferences
- `NotificationsContext`: Notification management
- `RSSFeedsContext`: RSS feed state
- `TMDbPostsContext`: TMDb posts state
- `VideoStudioTemplatesContext`: Video Studio templates

### Data Flow

```
User Interaction
    ↓
Component Event Handler
    ↓
Store/Context Update
    ↓
Component Re-render
    ↓
API Call (if needed)
    ↓
Store/Context Update
    ↓
Component Re-render
```

---

## Design System Guidelines

### Brand Colors

```typescript
// Primary
const brandRed = '#ec1e24';    // Accent, buttons, links
const brandWhite = '#ffffff';  // Light mode backgrounds
const brandBlack = '#000000';  // Dark mode backgrounds

// Grays
const gray50 = '#F9FAFB';      // Light background
const gray200 = '#E5E7EB';     // Light borders
const gray300 = '#D1D5DB';     // Disabled text
const gray600 = '#4B5563';     // Body text (light mode)
const gray900 = '#111827';     // Headings (light mode)

// Dark mode specifics
const darkBorder = '#333333';  // Dark mode borders
const darkHover = '#1A1A1A';   // Dark mode hover states
const darkText = '#9CA3AF';    // Dark mode secondary text
```

### Spacing Scale

Use the 8px base scale:
- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-6`: 24px
- `space-8`: 32px
- `space-12`: 48px
- `space-16`: 64px

### Typography

Typography is defined in `/styles/globals.css`. Do NOT override with Tailwind classes unless specifically requested.

```css
h1: 32px / 40px / 700 (Inter)
h2: 24px / 32px / 600 (Inter)
h3: 20px / 28px / 600 (Inter)
p:  16px / 24px / 400 (Inter)
```

### Component Patterns

**Buttons**:
```tsx
// Primary
<Button className="bg-[#ec1e24] text-white hover:bg-[#c91920]">

// Outline
<Button variant="outline" className="border-[#ec1e24] text-[#ec1e24]">

// Danger
<Button variant="outline" className="border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white">
```

**Input Focus States**:
```tsx
// Always use #292929 for focus states
<Input className="focus:border-[#292929] focus:ring-[#292929]" />
```

**Cards**:
```tsx
<div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-6">
  {/* Content */}
</div>
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

All features must meet WCAG 2.1 Level AA standards.

### Checklist

- [ ] **Semantic HTML**: Use proper HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
- [ ] **ARIA Labels**: Add labels for icon-only buttons and complex widgets
- [ ] **Keyboard Navigation**: All interactive elements accessible via keyboard
- [ ] **Focus Indicators**: Visible focus states (`:focus-visible`)
- [ ] **Color Contrast**: 4.5:1 minimum for text, 3:1 for large text
- [ ] **Alt Text**: Descriptive alt text for all images
- [ ] **Form Labels**: All inputs have associated labels
- [ ] **Error Messages**: Clear, descriptive error messages
- [ ] **Live Regions**: Use `aria-live` for dynamic content updates
- [ ] **Screen Reader Testing**: Test with NVDA or VoiceOver

### Code Examples

```tsx
// ✅ Good - Semantic HTML with ARIA
<button 
  onClick={handleClick}
  aria-label="Delete video"
  className="..."
>
  <Trash2 className="w-5 h-5" />
  <span className="sr-only">Delete</span>
</button>

// ✅ Good - Proper form labeling
<div>
  <Label htmlFor="video-title">Video Title</Label>
  <Input 
    id="video-title"
    type="text"
    aria-required="true"
    aria-describedby="title-error"
  />
  <p id="title-error" className="text-red-500">
    {error}
  </p>
</div>

// ✅ Good - Keyboard navigation
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  {children}
</div>
```

### Testing Accessibility

```bash
# Run accessibility linting
npm run lint

# Manual testing
# 1. Test with keyboard only (Tab, Enter, Space, Arrow keys)
# 2. Test with screen reader (NVDA on Windows, VoiceOver on Mac)
# 3. Test color contrast in DevTools
# 4. Test focus indicators visibility
```

---

## Haptic Feedback Guidelines

All user interactions should include haptic feedback:

```typescript
import { haptics } from '../utils/haptics';

// Light - for subtle interactions
haptics.light();  // Focus, hover, selection

// Medium - for standard interactions
haptics.medium(); // Button clicks, form submissions

// Heavy - for important actions
haptics.heavy();  // Deletions, confirmations

// Feedback patterns
haptics.success(); // Successful operations
haptics.error();   // Error states
haptics.warning(); // Warning states
haptics.selection(); // Toggle switches, checkboxes
```

### When to Use Haptics

- **Focus events**: Light haptic on input focus
- **Change events**: Light haptic on value change
- **Button clicks**: Medium haptic on click
- **Toggle switches**: Selection haptic on toggle
- **Deletions**: Heavy haptic + error pattern
- **Success**: Success pattern for completed actions

---

## Additional Resources

- **[README.md](./README.md)** - Project overview and features
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Detailed architecture documentation
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - Accessibility standards and audits
- **[TESTING_GUIDE.md](./docs/TESTING_GUIDE.md)** - Comprehensive testing guide
- **[DESIGN_TOKENS.md](./docs/DESIGN_TOKENS.md)** - Design system tokens
- **[API_CONTRACT.md](./docs/API_CONTRACT.md)** - Backend API contract

---

## Questions or Issues?

For questions or issues:
1. Check existing documentation
2. Search existing issues
3. Create a new issue with detailed description
4. Tag appropriately (bug, feature, question, etc.)

---

**Thank you for contributing to Screndly!** 🎬
