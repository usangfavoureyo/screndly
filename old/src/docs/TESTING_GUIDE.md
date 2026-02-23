# Screndly Testing Guide

## Overview

This guide covers the testing infrastructure for Screndly, including unit tests, integration tests, and E2E test patterns.

---

## Table of Contents

1. [Setup](#setup)
2. [Running Tests](#running-tests)
3. [Writing Tests](#writing-tests)
4. [Test Coverage](#test-coverage)
5. [Best Practices](#best-practices)

---

## Setup

### Dependencies

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Configuration

Tests are configured in `/vitest.config.ts`:

- **Test Environment:** jsdom (browser-like)
- **Setup Files:** `/tests/setup.ts` (global mocks)
- **Coverage:** v8 provider with HTML reports

---

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test:watch
```

### Run with coverage
```bash
npm test:coverage
```

### Run specific test file
```bash
npm test youtube.test.ts
```

### Run tests matching pattern
```bash
npm test -- --grep "API"
```

---

## Writing Tests

### Unit Test Example (API Service)

```typescript
// tests/api/openai.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openaiApi } from '../../lib/api/openai';

describe('OpenAIApi', () => {
  describe('generateVislaPrompt', () => {
    it('should generate Visla prompt from job data', async () => {
      const jobData = {
        segments: [
          { startTime: 0, endTime: 15, text: 'Opening scene' }
        ],
        audioRules: { ducking: { enabled: true } },
        aspectRatio: '16:9'
      };

      const response = await openaiApi.generateVislaPrompt(jobData);
      
      expect(response.success).toBe(true);
      if (response.data) {
        expect(response.data).toHaveProperty('visla_prompt_text');
        expect(response.data).toHaveProperty('validation');
      }
    });

    it('should validate timestamps in generated prompt', () => {
      const jobData = {
        segments: [
          { startTime: 0, endTime: 15, text: 'Scene 1' },
          { startTime: 15, endTime: 30, text: 'Scene 2' }
        ]
      };
      
      const generatedPrompt = 'Video at 0-15s shows Scene 1. At 15-30s shows Scene 2.';
      
      const validation = openaiApi.validateTimestamps(jobData, generatedPrompt);
      
      expect(validation.valid).toBe(true);
      expect(validation.mismatches).toHaveLength(0);
    });
  });
});
```

### Integration Test Example (Store)

```typescript
// tests/store/notifications.test.ts
import { describe, it, expect } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

describe('Notification System', () => {
  it('should handle notification workflow', () => {
    const { addNotification, markAsRead, clearNotifications } = useAppStore.getState();
    
    // Add notification
    addNotification('Job Complete', 'Video generated successfully', 'success', 'videostudio');
    
    let state = useAppStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
    
    // Mark as read
    const notifId = state.notifications[0].id;
    markAsRead(notifId);
    
    state = useAppStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.notifications[0].read).toBe(true);
    
    // Clear all
    clearNotifications();
    
    state = useAppStore.getState();
    expect(state.notifications).toHaveLength(0);
  });
});
```

### Component Test Example

```typescript
// tests/components/VideoCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoCard } from '../../components/VideoCard';

describe('VideoCard', () => {
  const mockVideo = {
    id: '1',
    title: 'Inception Trailer',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '2:30',
    uploadDate: '2024-01-15',
    status: 'published',
    views: 1000000,
  };

  it('should render video information', () => {
    render(<VideoCard video={mockVideo} />);
    
    expect(screen.getByText('Inception Trailer')).toBeInTheDocument();
    expect(screen.getByText('2:30')).toBeInTheDocument();
    expect(screen.getByText(/1000000/)).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<VideoCard video={mockVideo} onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Inception Trailer'));
    
    expect(handleClick).toHaveBeenCalledWith(mockVideo);
  });

  it('should show correct status badge', () => {
    const { rerender } = render(<VideoCard video={mockVideo} />);
    expect(screen.getByText('published')).toBeInTheDocument();
    
    rerender(<VideoCard video={{ ...mockVideo, status: 'processing' }} />);
    expect(screen.getByText('processing')).toBeInTheDocument();
  });
});
```

### E2E Test Pattern Example

```typescript
// tests/e2e/upload-workflow.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

describe('Upload Workflow', () => {
  it('should complete full upload workflow', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Navigate to upload page
    await user.click(screen.getByText(/Upload/i));
    
    // Fill upload form
    const fileInput = screen.getByLabelText(/select files/i);
    const file = new File(['video'], 'trailer.mp4', { type: 'video/mp4' });
    await user.upload(fileInput, file);
    
    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, 'Inception Trailer');
    
    const descInput = screen.getByLabelText(/description/i);
    await user.type(descInput, 'Official trailer for Inception');
    
    // Submit form
    await user.click(screen.getByText(/Publish/i));
    
    // Select platforms
    await user.click(screen.getByText('YouTube'));
    await user.click(screen.getByText('X (Twitter)'));
    await user.click(screen.getByText('Confirm'));
    
    // Wait for success notification
    await waitFor(() => {
      expect(screen.getByText(/Upload complete/i)).toBeInTheDocument();
    });
  });
});
```

---

## Test Coverage

### Current Coverage Goals

- **API Services:** > 80%
- **Store (Zustand):** > 90%
- **Critical Components:** > 70%
- **Utility Functions:** > 85%

### Generate Coverage Report

```bash
npm test:coverage
```

View the HTML report at `coverage/index.html`.

### Coverage Report Example

```
-----------------------------|---------|----------|---------|---------|
File                         | % Stmts | % Branch | % Funcs | % Lines |
-----------------------------|---------|----------|---------|---------|
All files                    |   82.5  |   75.3   |   80.1  |   82.5  |
 lib/api                     |   85.2  |   78.9   |   83.4  |   85.2  |
  youtube.ts                 |   90.1  |   85.2   |   88.9  |   90.1  |
  openai.ts                  |   87.3  |   82.1   |   85.7  |   87.3  |
  vizla.ts                   |   82.5  |   75.4   |   80.2  |   82.5  |
 store                       |   92.1  |   88.5   |   91.3  |   92.1  |
  useAppStore.ts             |   92.1  |   88.5   |   91.3  |   92.1  |
 components                  |   75.8  |   70.2   |   73.5  |   75.8  |
  VideoCard.tsx              |   80.5  |   75.3   |   78.9  |   80.5  |
-----------------------------|---------|----------|---------|---------|
```

---

## Best Practices

### 1. Test Structure (AAA Pattern)

```typescript
it('should update job status', () => {
  // Arrange
  const jobId = 'job_123';
  const newStatus = 'completed';
  
  // Act
  updateJobStatus(jobId, newStatus);
  
  // Assert
  expect(getJob(jobId).status).toBe('completed');
});
```

### 2. Mock External Dependencies

```typescript
// Mock API calls
vi.mock('../../lib/api/youtube', () => ({
  youtubeApi: {
    uploadVideo: vi.fn().mockResolvedValue({
      success: true,
      data: { videoId: 'mock_123' }
    })
  }
}));
```

### 3. Test Edge Cases

```typescript
describe('validateTimestamps', () => {
  it('should handle empty segments', () => {
    const result = validateTimestamps({ segments: [] }, '');
    expect(result.valid).toBe(true);
  });
  
  it('should detect missing timestamps', () => {
    const result = validateTimestamps(
      { segments: [{ startTime: 0, endTime: 15 }] },
      'Video without timestamps'
    );
    expect(result.valid).toBe(false);
  });
});
```

### 4. Use Descriptive Test Names

✅ Good:
```typescript
it('should retry API call 3 times on network error')
```

❌ Bad:
```typescript
it('should work')
```

### 5. Clean Up After Tests

```typescript
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAppStore.getState().clearNotifications();
});
```

### 6. Test User Flows, Not Implementation

✅ Good:
```typescript
it('should display success message after upload completes', async () => {
  await user.upload(fileInput, file);
  await user.click(publishButton);
  expect(await screen.findByText('Upload successful')).toBeInTheDocument();
});
```

❌ Bad:
```typescript
it('should call setState with correct parameters', () => {
  expect(setState).toHaveBeenCalledWith({ uploading: true });
});
```

### 7. Use Testing Library Queries Correctly

**Preferred order:**
1. `getByRole` (most accessible)
2. `getByLabelText` (forms)
3. `getByPlaceholderText` (forms)
4. `getByText` (non-interactive)
5. `getByTestId` (last resort)

```typescript
// ✅ Good
screen.getByRole('button', { name: /publish/i });
screen.getByLabelText('Video Title');

// ❌ Bad
screen.getByTestId('publish-button');
```

---

## Critical Test Areas

### Must Test

1. **Upload Flow**
   - File selection
   - Multi-file upload
   - Progress tracking
   - Platform selection
   - Success/error states

2. **Video Studio**
   - Job creation
   - LLM prompt generation
   - Timestamp validation
   - Status polling
   - Preview generation

3. **Comment Automation**
   - Blacklist filtering
   - AI reply generation
   - Platform-specific rules
   - Throttling logic

4. **Settings Management**
   - Save/load from localStorage
   - API key validation
   - Per-platform configurations
   - Reset to defaults

5. **Notification System**
   - Add notifications
   - Mark as read
   - Real-time updates via WebSocket
   - Notification filtering

---

## Debugging Tests

### Run single test in debug mode

```bash
node --inspect-brk node_modules/.bin/vitest run tests/api/youtube.test.ts
```

### Use console.log in tests

```typescript
it('should debug test', () => {
  const state = useAppStore.getState();
  console.log('Current state:', state);
  expect(state.notifications).toHaveLength(0);
});
```

### Use screen.debug()

```typescript
it('should debug component', () => {
  render(<VideoCard video={mockVideo} />);
  screen.debug(); // Prints entire DOM
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Kent C. Dodds Testing Blog](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Support

For testing questions, contact the team or refer to the main documentation.
