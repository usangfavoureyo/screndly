# Screndly Architecture Documentation

## Overview

Screndly is a production-grade automation dashboard for movie/TV trailer management, built with React, TypeScript, Tailwind CSS, and Zustand for state management.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [State Management](#state-management)
4. [API Layer](#api-layer)
5. [Real-Time Communication](#real-time-communication)
6. [Design System](#design-system)
7. [Testing Strategy](#testing-strategy)
8. [Performance Optimization](#performance-optimization)
9. [Security](#security)
10. [Deployment](#deployment)

---

## Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Styling:** Tailwind CSS v4.0 (CSS variables)
- **State Management:** Zustand (with persistence)
- **Animation:** Motion/React (Framer Motion)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Forms:** React Hook Form
- **HTTP Client:** Custom fetch wrapper with retry logic
- **WebSocket:** Native WebSocket with reconnection

### Backend (API Contract Defined)
- **Language:** Node.js/TypeScript recommended
- **Framework:** Express or Fastify
- **Database:** PostgreSQL
- **Cache:** Redis
- **Storage:** AWS S3
- **Queue:** Bull or BullMQ
- **Real-time:** WebSocket (ws library)

### External APIs
- **YouTube Data API v3:** Video uploads, comments
- **YouTube RSS Feeds:** No-API-key trailer discovery with 16:9 format detection
- **OpenAI API:** GPT-4.1 for prompt generation
- **TMDb API:** Movie database
- **Vizla API:** Video generation
- **Social Platforms:** X, Threads, Facebook, Instagram

---

## Project Structure

```
/
├── components/              # React components
│   ├── ui/                 # Base UI components (buttons, inputs)
│   ├── settings/           # Settings page components
│   ├── VideoCard.tsx       # Video display component
│   ├── SettingsPanel.tsx   # Main settings panel
│   └── ...
├── lib/                    # Utility libraries
│   ├── api/               # API layer
│   │   ├── client.ts      # HTTP client with retry
│   │   ├── youtube.ts     # YouTube API service
│   │   ├── openai.ts      # OpenAI API service
│   │   ├── vizla.ts       # Vizla API service
│   │   ├── tmdb.ts        # TMDb API service
│   │   ├── websocket.ts   # WebSocket client
│   │   ├── types.ts       # TypeScript definitions
│   │   └── index.ts       # Exports
│   └── ...
├── store/                  # Zustand store
│   └── useAppStore.ts     # Global state management
├── utils/                  # Utility functions
│   ├── breakpoints.ts     # Responsive breakpoints
│   ├── haptics.ts         # Haptic feedback
│   └── ...
├── styles/                 # Global styles
│   └── globals.css        # Design tokens + CSS vars
├── tests/                  # Test files
│   ├── setup.ts           # Test configuration
│   ├── api/               # API tests
│   ├── store/             # Store tests
│   └── components/        # Component tests
├── docs/                   # Documentation
│   ├── API_CONTRACT.md    # Backend API contract
│   ├── TESTING_GUIDE.md   # Testing documentation
│   └── ARCHITECTURE.md    # This file
├── App.tsx                 # Main app component
├── vitest.config.ts        # Test configuration
└── package.json            # Dependencies
```

---

## State Management

### Zustand Store (`/store/useAppStore.ts`)

#### Why Zustand?
- ✅ No prop drilling
- ✅ Minimal boilerplate
- ✅ TypeScript-first
- ✅ Built-in persistence
- ✅ Excellent performance
- ✅ DevTools integration

#### Store Structure

```typescript
interface AppState {
  // Navigation
  currentPage: string;
  navigate: (page: string) => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (...) => void;
  markAsRead: (id: string) => void;
  
  // Settings
  settings: Settings;
  updateSetting: <K>(key: K, value: Settings[K]) => void;
  
  // Video Studio Settings
  videoStudioSettings: VideoStudioSettings;
  updateVideoStudioSetting: (...) => void;
  
  // Video Studio Jobs
  videoStudioJobs: VideoStudioJob[];
  addJob: (job: ...) => string;
  updateJobStatus: (...) => void;
  
  // UI State
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  activeModal: string | null;
  openModal: (id: string) => void;
}
```

#### Usage Example

```typescript
// In any component
import { useAppStore } from './store/useAppStore';

function MyComponent() {
  const { addNotification, navigate } = useAppStore();
  
  const handleSuccess = () => {
    addNotification('Success', 'Job completed', 'success', 'videostudio');
    navigate('dashboard');
  };
  
  return <button onClick={handleSuccess}>Complete Job</button>;
}
```

#### Persistence

Settings and notifications automatically persist to localStorage via Zustand middleware.

---

## API Layer

### Architecture

```
Component → API Service → HTTP Client → Backend API
                ↓
         Type Definitions
                ↓
           Error Handling
                ↓
          Retry Logic
```

### HTTP Client (`/lib/api/client.ts`)

**Features:**
- Automatic retry with exponential backoff
- Request timeout handling
- Bearer token authentication
- Typed responses
- Error standardization
- File upload with progress

**Example:**
```typescript
const response = await apiClient.post<YouTubeUploadResponse>(
  '/youtube/upload',
  { title: 'My Video', ... }
);

if (response.success) {
  console.log('Uploaded:', response.data.videoId);
} else {
  console.error('Error:', response.error.message);
}
```

### API Services

#### YouTube API (`/lib/api/youtube.ts`)
- `searchVideos()` - Search YouTube
- `uploadVideo()` - Upload with progress
- `getComments()` - Fetch comments for AI replies
- `replyToComment()` - Post AI-generated reply

#### OpenAI API (`/lib/api/openai.ts`)
- `generateVislaPrompt()` - JSON → Visla prompt
- `generateCommentReply()` - AI comment responses
- `validateTimestamps()` - Server-side validation
- `generateVislaPromptWithRetry()` - Auto-retry on failure

#### Vizla API (`/lib/api/vizla.ts`)
- `createJob()` - Start video generation
- `getJobStatus()` - Poll job progress
- `pollJobStatus()` - Automated polling with callback
- `createPreviewJob()` - 15s preview
- `validateJobRequest()` - Client-side validation

#### TMDb API (`/lib/api/tmdb.ts`)
- `searchMovies()` - Movie search
- `getUpcoming()` - Upcoming releases
- `getAnniversaries()` - Anniversary detection
- `getFeeds()` - Configured feeds

### Error Handling

```typescript
interface ApiError {
  code: string;           // Error code (VALIDATION_ERROR, etc.)
  message: string;        // Human-readable message
  details?: any;          // Additional context
  statusCode: number;     // HTTP status code
}
```

**Automatic Retries:**
- 5xx errors: 3 retries with exponential backoff
- Network errors: 3 retries
- 429 (rate limit): Respect `Retry-After` header
- All others: No retry

---

## Real-Time Communication

### WebSocket Client (`/lib/api/websocket.ts`)

**Features:**
- Automatic reconnection with exponential backoff
- Event-based subscription system
- Authentication on connect
- Typed event handlers

**Connection:**
```typescript
import { wsClient } from './lib/api';

// Connect
await wsClient.connect();

// Subscribe to events
wsClient.onJobStatusUpdate((jobId, status) => {
  console.log(`Job ${jobId} is now ${status.status}`);
  updateJobStatus(jobId, status.status, status.progress);
});

// Disconnect
wsClient.disconnect();
```

**Event Types:**
- `job_status_update` - Video generation progress
- `notification` - System notifications
- `upload_progress` - File upload progress
- `comment_received` - New comment for AI reply
- `error` - Error notifications

**Auto-Reconnection:**
- Max 5 attempts
- Exponential backoff (1s, 2s, 4s, 8s, 16s)
- Preserves subscriptions across reconnects

---

## Design System

### CSS Design Tokens (`/styles/globals.css`)

**60+ tokens including:**
```css
/* Spacing Scale */
--spacing-xs: 0.25rem;     /* 4px */
--spacing-sm: 0.5rem;      /* 8px */
--spacing-md: 1rem;        /* 16px */
--spacing-lg: 1.5rem;      /* 24px */
--spacing-xl: 2rem;        /* 32px */

/* Border Radius */
--radius-sm: 0.25rem;      /* 4px */
--radius-md: 0.5rem;       /* 8px */
--radius-lg: 0.75rem;      /* 12px */

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);

/* Transitions */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);

/* Z-Index */
--z-dropdown: 1000;
--z-modal: 1100;
--z-toast: 1200;
```

### Brand Colors
- **Primary Red:** `#ec1e24`
- **White:** `#FFFFFF`
- **Black:** `#000000`
- **Dark Background:** `#1A1A1A`
- **Border Dark:** `#333333`

### Responsive Breakpoints (`/utils/breakpoints.ts`)
```typescript
export const breakpoints = {
  sm: 640,   // Mobile landscape
  md: 768,   // Tablet
  lg: 1024,  // Laptop
  xl: 1280,  // Desktop
  '2xl': 1536 // Large desktop
};
```

---

## Testing Strategy

### Unit Tests
- API services (`/tests/api/`)
- Store functions (`/tests/store/`)
- Utility functions

### Integration Tests
- Multi-step workflows
- State management flows
- Component interactions

### E2E Test Patterns
- Upload workflow
- Video Studio generation
- Comment automation
- Settings management

**Coverage Goals:**
- API Services: > 80%
- Store: > 90%
- Critical Components: > 70%

**Run Tests:**
```bash
npm test              # Run all tests
npm test:watch        # Watch mode
npm test:coverage     # Generate coverage report
```

See `/docs/TESTING_GUIDE.md` for details.

---

## Performance Optimization

### 1. Code Splitting
```typescript
// Lazy load heavy components
const VideoStudioPage = lazy(() => import('./pages/VideoStudioPage'));
```

### 2. Memoization
```typescript
const expensiveValue = useMemo(() => calculateValue(data), [data]);
const memoizedCallback = useCallback(() => handleClick(), [dependency]);
```

### 3. Virtual Scrolling
For long lists (videos, notifications), use `react-window` or `react-virtual`.

### 4. Image Optimization
- Use WebP format
- Lazy load images
- Responsive images with `srcset`

### 5. Bundle Analysis
```bash
npm run build
npx vite-bundle-visualizer
```

### 6. Debouncing/Throttling
```typescript
// Search input
const debouncedSearch = useDebouncedValue(searchQuery, 300);

// Scroll handler
const throttledScroll = useThrottledCallback(handleScroll, 100);
```

---

## Security

### 1. API Keys
- Never commit API keys
- Use environment variables
- Store encrypted in backend
- Rotate keys regularly

### 2. Authentication
- JWT tokens with expiry
- Refresh token flow
- Secure token storage (httpOnly cookies)

### 3. Input Validation
- Client-side validation (UX)
- Server-side validation (security)
- Sanitize user input
- TypeScript for type safety

### 4. CORS
```typescript
// Backend configuration
app.use(cors({
  origin: 'https://screndly.com',
  credentials: true
}));
```

### 5. Rate Limiting
- Per-user rate limits
- IP-based throttling
- Exponential backoff on client

### 6. Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline';">
```

---

## Deployment

### Frontend (Vercel/Netlify)

```bash
# Build
npm run build

# Preview locally
npm run preview

# Deploy
vercel --prod
# or
netlify deploy --prod
```

### Backend (AWS/Docker)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment Variables

**Frontend:**
```env
VITE_API_URL=https://api.screndly.com/v1
VITE_WS_URL=wss://api.screndly.com/ws
```

**Backend:**
```env
YOUTUBE_API_KEY=...
OPENAI_API_KEY=...
TMDB_API_KEY=...
VIZLA_API_KEY=...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
S3_BUCKET=screndly-videos
JWT_SECRET=...
```

### CI/CD Pipeline

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test:coverage

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - uses: vercel/action@v2
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

---

## Monitoring & Analytics

### Application Monitoring
- **Sentry:** Error tracking
- **LogRocket:** Session replay
- **Datadog:** Performance monitoring

### User Analytics
- **PostHog:** Product analytics
- **Google Analytics:** User behavior
- **Mixpanel:** Event tracking

### API Monitoring
- **Uptime Robot:** Endpoint monitoring
- **New Relic:** API performance
- **Prometheus + Grafana:** Custom metrics

---

## Scaling Considerations

### Horizontal Scaling
- Stateless API servers
- Redis for session storage
- Load balancer (AWS ALB)

### Database Optimization
- Connection pooling
- Read replicas
- Query optimization
- Indexing strategy

### Caching Strategy
```
Browser Cache → CDN → Redis → Database
```

### Queue System
- Bull for background jobs
- Separate queues for:
  - Video uploads
  - Comment replies
  - RSS processing
  - Video generation

---

## Future Enhancements

### Phase 1 (Current)
- ✅ State management with Zustand
- ✅ API layer abstraction
- ✅ WebSocket real-time updates
- ✅ Testing infrastructure

### Phase 2 (Next)
- [ ] React Query for server state
- [ ] Optimistic UI updates
- [ ] Offline support (PWA)
- [ ] Advanced analytics dashboard

### Phase 3 (Future)
- [ ] Mobile app (React Native)
- [ ] AI-powered caption generation
- [ ] Multi-language support
- [ ] Team collaboration features

---

## Resources

- [API Contract](/docs/API_CONTRACT.md)
- [Testing Guide](/docs/TESTING_GUIDE.md)
- [Design System](Settings → Company → Design System)
- [GitHub Repository](#)

---

## Support

For architecture questions or contributions, contact the development team or open an issue on GitHub.

**Last Updated:** January 2024  
**Version:** 2.0.0