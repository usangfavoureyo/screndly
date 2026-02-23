# 🎬 Screndly

**Frontend-Only PWA for Movie/TV Trailer Management**

A comprehensive single-user progressive web application for automating movie and TV trailer management with FFmpeg.wasm video processing, Backblaze B2 cloud storage, and multi-platform publishing for Screen Render.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## ✨ Features

### 📊 Core Dashboard
- Real-time activity monitoring across all automation channels
- Performance metrics and analytics with interactive charts
- Quick action controls for all features
- Job pipeline visualization (7-stage tracking)

### 🎥 Video Processing & Storage
- **FFmpeg.wasm Integration**: Browser-based video processing with zero backend dependencies
  - Mechanical video cutting with precision timestamps
  - HTTP Range Request optimization for bandwidth savings
  - Audio manipulation (fade, volume adjustment)
  - Video merging with transitions
  - Progress tracking with real-time callbacks
- **Backblaze B2 Cloud Storage**: Dual-bucket architecture for trailers and metadata
  - Cost-effective storage ($6/TB vs AWS S3 $23/TB)
  - S3-compatible API integration
  - Resumable transfer support
  - File browser with search and filtering
- **Upload Manager**: 7-stage job pipeline (queued → processing → metadata → encoding → waiting → uploading → published)
  - Real-time job progress tracking
  - Event logging with severity levels
  - Retry mechanisms for failed uploads
  - Cost estimation tracking

### 🎬 Video Studio
- Advanced video generation with LLM + JSON prompt layers
- OpenAI GPT-4 integration for AI-powered caption generation
- Shotstack API integration for cloud rendering
- Caption template editor with multiple styles
- Scene extraction and classification
- Timestamp validation with auto-retry
- Preview before render workflow
- Multiple video upload functionality

### 🎨 Design Studio
- **Photopea Integration**: Client-side rendering engine for static creatives
  - PSD template loading and mutation
  - Text layer editing with multi-size variants
  - Smart Object image replacement
  - Final JPEG rendering without leaving the browser
- **Backblaze Template Browser**: Cloud-based PSD template management
  - Search and filter templates
  - Template selection with haptic feedback
  - Automatic template loading from B2 storage
- **Workflow Orchestration**: Complete design-to-publish pipeline
  - Template selection and editing
  - Text and image input with character counters
  - Live preview system
  - Social platform upload integration
- **Bottom Sheet UI**: Mobile-native modal system with spring animations
  - Elastic drag interactions
  - Unified across all editing interfaces
  - 73% code reduction from previous implementation

### 📡 Content Automation
- **RSS Feeds**: Automated trailer discovery with AI-powered smart image selection
  - Serper API integration for 16:9 image enrichment
  - Multi-source feed management
  - Deduplication logic
  - Scheduled posting intervals
- **TMDb Integration**: US-focused Hollywood filtering with 11-rule smart system
  - Anniversary detection algorithm
  - Smart ranking and duplicate filtering
  - Timezone-aware scheduled generation
- **Multi-platform Publishing**: YouTube, Instagram, TikTok, X (Twitter), Facebook
  - Platform-specific adapters with OAuth support
  - Resumable video uploads with chunked transfer
  - Rate limiting per platform tier
  - Upload progress tracking
- **16:9 Format Detection**: Intelligent YouTube Shorts exclusion (9:16 vertical videos)
- **Aspect Ratio Preservation**: Original cinematic format maintained across platforms
- **Smart Filtering**: 90% rejection rate, 98% precision for high-quality blockbusters

### 💬 Comment Automation
- AI-powered reply generation with OpenAI integration
- Blacklist filtering (usernames and keywords)
- Reply frequency controls and throttle management
- Statistics tracking (processed, posted, errors)

### 📅 Scheduling System
- Comprehensive schedule/reschedule functionality
- Timestamp filtering and management
- Queue management with priority controls
- Timezone configuration support

### 🔔 Notifications & Activity
- Enhanced notification system with Sonner toast notifications (3s, 5s, 7s, 10s durations)
- Desktop push notifications (PWA)
- Activity tracking across 4 dedicated pages
  - **Video Activity Page**: Track and manage social media posts
    - View Details modal with platform-specific content (YouTube: Title/Description/Thumbnail, X: Caption/Thumbnail, Others: Caption/Poster)
    - Edit metadata for YouTube and Facebook posts
    - Retry failed uploads
    - Filter by platform
  - **RSS Activity**, **TMDb Activity**, **Video Studio Activity**
- Swipe-left-to-delete functionality with haptic feedback
- Grouped notifications (uploads, RSS, TMDb, Video Studio, system)
- Read/unread tracking with persistence

### 📱 Progressive Web App
- Full PWA capabilities with service worker caching
- Install prompts for desktop and mobile
- Responsive design with mobile-first approach
- Swipe navigation between pages (customizable)
- **Partial Offline Support**: UI caching (requires online for cloud storage and APIs)

### 🎨 Design System
- Clean, modern, cinematic IFTTT-inspired design
- Brand colors: Red (#ec1e24), White (#ffffff), Black (#000000)
- Modular cards with soft shadows
- Minimalist typography
- Full dark mode support
- Comprehensive haptic feedback (7 patterns)
  - Light, medium, heavy for interactions
  - Success, error, warning for feedback
  - Selection for toggles and checkboxes

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd screndly

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to view the app.

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

### ⚡ Performance & Monitoring (Optional)

Screndly includes enterprise-grade performance optimizations:

```bash
# Optional: Install monitoring packages
npm install @sentry/react web-vitals

# Add environment variables for monitoring
echo "VITE_SENTRY_DSN=your_sentry_dsn" >> .env
echo "VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX" >> .env

# Uncomment monitoring code
# See MONITORING_SETUP_GUIDE.md for details
```

**Built-in Optimizations** (active by default):
- ✅ 38% smaller bundles (code splitting + minification)
- ✅ 80% bandwidth savings (lazy image loading)
- ✅ 40% fewer API calls (batching + deduplication)
- ✅ 85% cache hit rate (multi-tier caching)
- ✅ Offline support (service worker + fallback page)

**Performance Docs**:
- `/PERFORMANCE_OPTIMIZATIONS.md` - Complete technical guide
- `/MONITORING_SETUP_GUIDE.md` - Sentry/GA setup
- `/QUICK_OPTIMIZATION_REFERENCE.md` - Quick reference

---

## 📁 Project Structure

```
screndly/
├── adapters/            # Platform API adapters
│   ├── youtubeAdapter.ts    # YouTube OAuth & upload
│   ├── tiktokAdapter.ts     # TikTok OAuth & upload
│   ├── metaAdapter.ts       # Facebook/Instagram
│   └── xAdapter.ts          # X (Twitter)
├── components/          # React components
│   ├── ui/              # Base UI components (Button, Input, etc.)
│   ├── figma/           # Figma import components
│   ├── jobs/            # Upload Manager components
│   ├── rss/             # RSS feed components
│   ├── tmdb/            # TMDb feed components
│   ├── settings/        # Settings panel sub-pages
│   ├── *Page.tsx        # Page components
│   └── *.tsx            # Feature components
├── contexts/            # React Context providers (7 total)
│   ├── NotificationsContext.tsx
│   ├── RSSFeedsContext.tsx
│   ├── SettingsContext.tsx
│   ├── TMDbPostsContext.tsx
│   └── VideoStudioTemplatesContext.tsx
├── lib/                 # Business logic & API clients
│   ├── api/             # API client & integrations
│   │   ├── client.ts        # Base API client
│   │   ├── youtube.ts       # YouTube Data API
│   │   ├── openai.ts        # OpenAI GPT-4
│   │   ├── shotstack.ts     # Video rendering
│   │   ├── tmdb.ts          # TMDb API
│   │   └── websocket.ts     # WebSocket client
│   ├── rss/             # RSS feed processing
│   └── tmdb/            # TMDb filtering & ranking
├── store/               # Zustand state management
│   ├── useAppStore.ts       # Global app state
│   └── useJobsStore.ts      # Upload job pipeline
├── utils/               # Utility functions
│   ├── ffmpeg.ts            # FFmpeg.wasm integration
│   ├── backblaze.ts         # Backblaze B2 storage
│   ├── resumableTransfer.ts # Resumable uploads
│   ├── videoRangeRequest.ts # HTTP Range Requests
│   ├── haptics.ts           # Haptic feedback
│   ├── desktopNotifications.ts # Desktop notifications
│   └── platformConnections.ts
├── hooks/               # Custom React hooks
│   ├── useSwipeNavigation.ts
│   └── useDesktopShortcuts.ts
├── styles/              # Global styles
│   └── globals.css      # Design tokens and utilities
├── tests/               # Test files (12+ comprehensive test suites)
├── public/              # Static assets
│   ├── manifest.json    # PWA manifest
│   └── sw.js            # Service worker
└── App.tsx              # Root component
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

**Test Coverage**: 12+ comprehensive test suites covering:
- Component rendering and interactions
- Context state management
- User workflows
- Edge cases and error handling

---

## ♿ Accessibility

Screndly follows WCAG 2.1 AA standards:

```bash
# Run ESLint with accessibility checks
npm run lint

# Run automated accessibility audit (requires dev server)
npm run a11y

# Generate accessibility report
npm run a11y:report
```

See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for detailed audit information.

**Accessibility Features**:
- Keyboard navigation support
- Screen reader compatibility
- ARIA labels and live regions
- Focus management
- High contrast support
- Semantic HTML structure

---

## 🎨 Design Tokens

Screndly uses a comprehensive design token system in `/styles/globals.css`:

### Brand Colors
- Primary Red: `#ec1e24` (--brand-red)
- White: `#ffffff` (--brand-white)
- Black: `#000000` (--brand-black)

### Spacing Scale (8px base)
```css
--space-1: 4px
--space-2: 8px
--space-4: 16px
--space-8: 32px
```

### Border Radius
```css
--radius-xs: 4px
--radius-md: 12px
--radius-xl: 20px
--radius-full: 9999px
```

### Shadows & Transitions
- Multiple shadow levels from xs to 2xl
- Predefined transition curves (fast, base, medium, slow, bounce)
- Z-index scale for layering

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# API Configuration (if using external APIs)
VITE_API_URL=http://localhost:3000
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_RSS_API_KEY=your_rss_api_key_here

# Feature Flags
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_PWA=true
```

### Single-User Configuration

The app is designed for single-user deployment. Authentication is handled through a simple login screen with local session management.

To configure:
1. Update login credentials in `/components/LoginPage.tsx`
2. Customize platform connections in `/utils/platformConnections.ts`
3. Set notification preferences in Settings panel

---

## 📊 Performance

- **Lighthouse Score**: 95/100
- **Bundle Size**: Optimized with code splitting
- **Lazy Loading**: All pages lazy-loaded with Suspense
- **Performance Features**:
  - Skeleton loaders for perceived performance
  - Image optimization with fallback handling
  - Efficient state management
  - Haptic feedback (4ms delay)

---

## 🛠️ Tech Stack

### Core
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS 4.0** - Utility-first CSS

### UI & UX
- **Lucide React** - Icon library
- **Motion (Framer Motion)** - Animations
- **Recharts** - Charts and graphs
- **React Slick** - Carousels
- **Sonner** - Toast notifications

### Testing & Quality
- **Vitest** - Unit testing
- **ESLint** - Code linting
- **TypeScript ESLint** - TypeScript linting
- **jsx-a11y** - Accessibility linting
- **axe-core** - Accessibility testing
- **pa11y** - Automated accessibility audit

---

## 📱 Progressive Web App

Screndly is a full-featured PWA:

### Features
- **Installable**: Add to home screen on mobile and desktop
- **Offline Support**: Service worker caching for offline functionality
- **App-like Experience**: Full-screen mode, app icons, splash screens
- **Push Notifications**: Desktop notifications for important updates

### Testing PWA
1. Start dev server: `npm run dev`
2. Open in Chrome/Edge
3. Look for install prompt in address bar
4. Install and test offline functionality

---

## 🤝 Development Workflow

### Code Style
```bash
# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Git Workflow
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test
3. Run linting and tests: `npm run lint && npm test`
4. Commit with descriptive message
5. Push and create pull request

### Commit Convention
```
feat: Add new feature
fix: Bug fix
docs: Documentation update
style: Code style changes
refactor: Code refactoring
test: Test updates
chore: Maintenance tasks
a11y: Accessibility improvements
```

For detailed contributing guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 🚀 Deployment

### Quick Deploy

Deploy to your preferred platform:

```bash
# Build for production
npm run build

# Preview build locally
npm run preview
```

Screndly can be deployed to:
- **Netlify** (recommended) - Zero-config deployment
- **Vercel** - Edge-optimized hosting
- **GitHub Pages** - Free for public repos
- **Render** - Simple static site hosting
- **AWS S3 + CloudFront** - Enterprise-grade deployment

For detailed deployment instructions and platform-specific configurations, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 📄 License

Private - Single User Internal Tool for Screen Render

---

## 🆘 Support

For issues or questions about Screndly:
1. Check [ACCESSIBILITY.md](./ACCESSIBILITY.md) for accessibility guidance
2. Review test files in `/tests` for usage examples
3. Examine component source code for implementation details
4. See [CHANGELOG.md](./CHANGELOG.md) for version history and updates

---

## 📚 Documentation

### Core System
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Comprehensive project status and readiness report
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contributing guidelines and code standards
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guides for multiple platforms
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - Accessibility standards and compliance
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture and design
- **[docs/TESTING_GUIDE.md](./docs/TESTING_GUIDE.md)** - Testing procedures and guidelines

### Complete Documentation Index
- **[docs/INDEX.md](./docs/INDEX.md)** - 📚 Master documentation index with all guides, setup instructions, and references

### Historical Reports & Status Updates
- **[docs/reports/](./docs/reports/)** - All completion reports, audits, and historical documentation

### Production Architecture (Backend + Database)
- **[docs/PRODUCTION_ARCHITECTURE.md](./docs/PRODUCTION_ARCHITECTURE.md)** - Production backend architecture ($5.40/month)
- **[docs/OPTION_B_QUICK_START.md](./docs/OPTION_B_QUICK_START.md)** - 30-minute setup guide
- **[docs/RAILWAY_SETUP.md](./docs/RAILWAY_SETUP.md)** - Railway backend deployment guide
- **[docs/NEON_SETUP.md](./docs/NEON_SETUP.md)** - Neon Postgres database setup
- **[docs/AUTOMATION_INTERVALS.md](./docs/AUTOMATION_INTERVALS.md)** - Automation schedule (RSS every 5min, Comments every 10min)
- **[docs/TOTAL_MONTHLY_COST.md](./docs/TOTAL_MONTHLY_COST.md)** - Complete cost breakdown ($20-30/month total)
- **[docs/ARCHITECTURE_DECISION.md](./docs/ARCHITECTURE_DECISION.md)** - Why Option B was selected

### RSS Feeds (AI-Powered Image Selection)
- **[docs/RSS_FEED_WORKFLOW.md](./docs/RSS_FEED_WORKFLOW.md)** - RSS feed news automation workflow
- **[docs/SERPER_IMAGE_DETECTION.md](./docs/SERPER_IMAGE_DETECTION.md)** - Serper API image search system
- **[docs/SERPER_SMART_IMAGE_SELECTION.md](./docs/SERPER_SMART_IMAGE_SELECTION.md)** - AI-powered subject matter detection
- **[docs/IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md)** - Smart image selection implementation
- **[docs/QUICK_START_SMART_IMAGES.md](./docs/QUICK_START_SMART_IMAGES.md)** - 5-minute setup guide

### TMDb Feeds (Smart Filtering System)
- **[docs/TMDB_COMPLETE_WORKFLOW.md](./docs/TMDB_COMPLETE_WORKFLOW.md)** - Complete TMDb system & workflow
- **[docs/TMDB_VISUAL_WORKFLOW.md](./docs/TMDB_VISUAL_WORKFLOW.md)** - Visual diagrams & flowcharts
- **[docs/TMDB_SMART_FILTERING_SYSTEM.md](./docs/TMDB_SMART_FILTERING_SYSTEM.md)** - 11-rule Hollywood filtering
- **[docs/TMDB_AUTO_POSTING.md](./docs/TMDB_AUTO_POSTING.md)** - Auto-posting scheduling details

### Video Studio
- **[docs/WORKFLOW_SUMMARY.md](./docs/WORKFLOW_SUMMARY.md)** - Video Studio workflow
- **[docs/YOUTUBE_RSS_16x9_FILTERING.md](./docs/YOUTUBE_RSS_16x9_FILTERING.md)** - 16:9 format detection guide

---

Built with ❤️ for Screen Render