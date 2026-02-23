# Screndly API Contract Documentation

## Overview

This document defines the API contract between the Screndly frontend and backend services. Use this as a reference for backend implementation.

**Base URL:** `https://api.screndly.com/v1`  
**Authentication:** Bearer token in `Authorization` header  
**Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [YouTube API](#youtube-api)
3. [OpenAI API](#openai-api)
4. [Shotstack API](#shotstack-api)
5. [TMDb API](#tmdb-api)
6. [Video Studio API](#video-studio-api)
7. [RSS API](#rss-api)
8. [Analytics API](#analytics-api)
9. [WebSocket Events](#websocket-events)
10. [Error Handling](#error-handling)

---

## Authentication

### POST `/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin"
    },
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

### POST `/auth/logout`

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## YouTube API

### POST `/youtube/upload`

Upload a video to YouTube.

**Headers:** `Authorization: Bearer {token}`

**Request (multipart/form-data):**
```
file: <video_file>
title: "Movie Title - Official Trailer"
description: "Watch the official trailer..."
tags: "trailer,movie,action"
category: "Film & Animation"
privacy: "public"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "abc123xyz",
    "url": "https://youtube.com/watch?v=abc123xyz",
    "status": "processing"
  }
}
```

### GET `/youtube/videos/{videoId}`

Get video details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "Movie Title - Official Trailer",
    "description": "Watch the official trailer...",
    "thumbnailUrl": "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
    "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "channelTitle": "Screen Render",
    "publishedAt": "2024-01-15T10:30:00Z",
    "duration": "PT2M30S",
    "viewCount": 1000000,
    "likeCount": 50000,
    "commentCount": 2500
  }
}
```

### GET `/youtube/videos/{videoId}/comments`

Get video comments for AI reply automation.

**Headers:** `X-Max-Results: 100`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "comment_123",
      "videoId": "abc123",
      "authorName": "Movie Fan",
      "authorChannelId": "UC_abc",
      "text": "This looks amazing!",
      "likeCount": 50,
      "publishedAt": "2024-01-15T11:00:00Z",
      "isReply": false
    }
  ]
}
```

### POST `/youtube/comments/reply`

Reply to a comment using AI-generated response.

**Request:**
```json
{
  "commentId": "comment_123",
  "text": "Thanks for your support! Be sure to check it out in theaters."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "reply_456",
    "videoId": "abc123",
    "parentId": "comment_123",
    "text": "Thanks for your support! Be sure to check it out in theaters.",
    "publishedAt": "2024-01-15T11:05:00Z"
  }
}
```

---

## OpenAI API

### POST `/openai/chat/completions`

Generate LLM completions for prompt generation.

**Request:**
```json
{
  "model": "gpt-4.1",
  "messages": [
    {
      "role": "system",
      "content": "You are an editor-prompt generator..."
    },
    {
      "role": "user",
      "content": "{\"segments\": [...], \"timestamps\": [...], \"audio_rules\": {...}}"
    }
  ],
  "temperature": 0,
  "top_p": 0.95,
  "max_tokens": 4096,
  "response_format": { "type": "json_object" }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "chatcmpl-123",
    "model": "gpt-4.1",
    "choices": [
      {
        "message": {
          "role": "assistant",
          "content": "{\"visla_prompt_text\": \"Create a 60-second video...\", \"validation\": {...}}"
        },
        "finish_reason": "stop",
        "index": 0
      }
    ],
    "usage": {
      "prompt_tokens": 500,
      "completion_tokens": 300,
      "total_tokens": 800
    }
  }
}
```

---

## Shotstack API

### POST `/shotstack/jobs`

Create a video generation job.

**Request:**
```json
{
  "prompt": "Create a 60-second movie trailer mashup featuring action scenes at 0:00-0:15, dramatic moments at 0:15-0:30, and title reveal at 0:30-0:45. Apply cinematic color grading. Use audio ducking during voiceover segments. Aspect ratio: 16:9.",
  "aspectRatio": "16:9",
  "duration": 60,
  "segments": [
    {
      "startTime": 0,
      "endTime": 15,
      "text": "Action-packed opening scene",
      "keywords": ["action", "explosion", "car chase"],
      "voiceover": {
        "text": "In a world on the brink...",
        "voice": "male_cinematic"
      }
    }
  ],
  "audioRules": {
    "ducking": {
      "enabled": true,
      "reduction": 60,
      "duringVoiceover": true
    },
    "backgroundMusic": {
      "enabled": true,
      "genre": "cinematic",
      "intensity": "high"
    }
  },
  "captionTemplate": "template_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_20240115_abc123",
    "status": "queued",
    "createdAt": "2024-01-15T12:00:00Z",
    "estimatedCompletion": "2024-01-15T12:05:00Z"
  }
}
```

### GET `/shotstack/jobs/{jobId}/status`

Get job status (poll every 5 seconds).

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_20240115_abc123",
    "status": "processing",
    "progress": 65,
    "currentStep": "Generating video scenes...",
    "previewUrl": "https://shotstack.io/previews/job_20240115_abc123.mp4"
  }
}
```

**Final Status (Completed):**
```json
{
  "success": true,
  "data": {
    "jobId": "job_20240115_abc123",
    "status": "completed",
    "progress": 100,
    "outputUrl": "https://shotstack.io/videos/job_20240115_abc123.mp4",
    "previewUrl": "https://shotstack.io/previews/job_20240115_abc123.mp4"
  }
}
```

### POST `/shotstack/jobs/{jobId}/cancel`

Cancel a running job.

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

---

## TMDb API

### GET `/tmdb/search/movie`

Search for movies.

**Headers:**
- `X-Query: "Inception"`
- `X-Page: 1`
- `X-Year: 2010` (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 27205,
        "title": "Inception",
        "overview": "Cobb, a skilled thief...",
        "poster_path": "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
        "backdrop_path": "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
        "release_date": "2010-07-16",
        "vote_average": 8.4,
        "vote_count": 35000,
        "genre_ids": [28, 878, 53],
        "popularity": 95.5
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### GET `/tmdb/movies/upcoming`

Get upcoming movie releases.

**Headers:** `X-Page: 1`

**Response:** Same structure as search

### POST `/tmdb/anniversaries`

Get movie anniversaries for a specific date.

**Request:**
```json
{
  "date": "2024-01-15T00:00:00Z",
  "yearsAgo": [10, 20, 30, 40, 50]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 12345,
      "title": "Classic Movie",
      "overview": "A timeless classic...",
      "release_date": "1994-01-15",
      "anniversary_years": 30,
      "poster_path": "/path.jpg"
    }
  ]
}
```

---

## Video Studio API

### POST `/videostudio/jobs`

Create a Video Studio job (Video Review or Monthly Releases).

**Request:**
```json
{
  "title": "January 2024 Movie Releases",
  "type": "monthly_releases",
  "config": {
    "aspectRatio": "16:9",
    "duration": 60,
    "segments": [...],
    "audioRules": {...},
    "llmModel": "gpt-4.1",
    "llmTemperature": 0,
    "llmMaxTokens": 4096
  },
  "captionTemplate": {
    "id": "template_001",
    "name": "Cinematic Bold",
    "fontFamily": "Montserrat",
    "fontSize": 48,
    "color": "#FFFFFF",
    "backgroundColor": "#000000",
    "position": "bottom",
    "animation": "fade"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "vs_job_123",
    "title": "January 2024 Movie Releases",
    "status": "pending",
    "createdAt": "2024-01-15T12:00:00Z",
    "shotstackJobId": null
  }
}
```

### GET `/videostudio/jobs/{id}`

Get Video Studio job status.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "vs_job_123",
    "title": "January 2024 Movie Releases",
    "status": "completed",
    "progress": 100,
    "createdAt": "2024-01-15T12:00:00Z",
    "completedAt": "2024-01-15T12:05:00Z",
    "shotstackJobId": "job_20240115_abc123",
    "outputUrl": "https://shotstack.io/videos/job_20240115_abc123.mp4"
  }
}
```

---

## RSS API

### GET `/rss/feeds`

Get all configured RSS feeds.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "feed_123",
      "url": "https://example.com/rss",
      "title": "Movie News Feed",
      "enabled": true,
      "lastFetched": "2024-01-15T10:00:00Z",
      "itemCount": 150
    }
  ]
}
```

### POST `/rss/post`

Post an RSS item to social platforms.

**Request:**
```json
{
  "itemId": "item_456",
  "platforms": ["x", "threads", "facebook"],
  "customText": "Check out this amazing movie news!",
  "imageCount": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "postId": "post_789",
    "platforms": {
      "x": {
        "success": true,
        "url": "https://twitter.com/screenrender/status/123"
      },
      "threads": {
        "success": true,
        "url": "https://threads.net/@screenrender/post/456"
      },
      "facebook": {
        "success": false,
        "error": "Rate limit exceeded"
      }
    }
  }
}
```

---

## Analytics API

### GET `/analytics/overview`

Get dashboard analytics overview.

**Headers:** `X-Period: week`

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "week",
    "metrics": {
      "uploads": 25,
      "views": 500000,
      "engagement": 75000,
      "comments": 12500,
      "shares": 5000
    },
    "trends": {
      "uploadsChange": 15.5,
      "viewsChange": -5.2,
      "engagementChange": 22.8
    }
  }
}
```

---

## WebSocket Events

**URL:** `wss://api.screndly.com/ws`

### Connection

```javascript
// Connect with auth token
ws.send(JSON.stringify({
  type: 'auth',
  payload: { token: 'your_jwt_token' }
}));
```

### Event: `job_status_update`

Sent when Video Studio or Shotstack job status changes.

```json
{
  "type": "job_status_update",
  "payload": {
    "jobId": "job_20240115_abc123",
    "status": "processing",
    "progress": 45,
    "message": "Generating scene 3 of 5...",
    "outputUrl": null
  },
  "timestamp": "2024-01-15T12:02:30Z"
}
```

### Event: `notification`

General notifications for user actions.

```json
{
  "type": "notification",
  "payload": {
    "id": "notif_123",
    "title": "Upload Complete",
    "message": "Your video has been uploaded to YouTube",
    "type": "success",
    "source": "upload"
  },
  "timestamp": "2024-01-15T12:03:00Z"
}
```

### Event: `upload_progress`

Real-time upload progress.

```json
{
  "type": "upload_progress",
  "payload": {
    "uploadId": "upload_456",
    "progress": 65,
    "bytesUploaded": 65000000,
    "totalBytes": 100000000
  },
  "timestamp": "2024-01-15T12:03:15Z"
}
```

### Event: `comment_received`

New comment detected for AI reply.

```json
{
  "type": "comment_received",
  "payload": {
    "commentId": "comment_789",
    "videoId": "abc123",
    "authorName": "Movie Fan",
    "text": "This looks incredible!",
    "requiresReply": true
  },
  "timestamp": "2024-01-15T12:04:00Z"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "duration",
      "issue": "Duration must be greater than 0"
    },
    "statusCode": 400
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `API_ERROR` | 500 | External API failure |
| `NETWORK_ERROR` | 0 | Network connectivity issue |
| `TIMEOUT` | 408 | Request timeout |
| `PARSE_ERROR` | 500 | Failed to parse response |

### Retry Strategy

- **5xx errors**: Auto-retry up to 3 times with exponential backoff
- **429 errors**: Respect `Retry-After` header
- **Network errors**: Auto-retry up to 3 times
- **All others**: No automatic retry

---

## Rate Limits

- **YouTube API**: 10,000 units/day (1 upload = 1600 units)
- **OpenAI API**: Model-specific (GPT-4.1: 10 RPM, GPT-4o-mini: 500 RPM)
- **TMDb API**: 40 requests per 10 seconds
- **Shotstack API**: 100 jobs/day per account

---

## Testing

For development, mock API responses are available at:

```
https://api-mock.screndly.com/v1
```

All endpoints return realistic mock data matching this contract.

---

## Support

- **API Issues**: api-support@screndly.com
- **Documentation**: https://docs.screndly.com
- **Status**: https://status.screndly.com
