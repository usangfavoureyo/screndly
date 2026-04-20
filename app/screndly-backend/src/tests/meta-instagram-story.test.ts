import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { metaService } from '../services/platforms/meta';

type AxiosPost = typeof axios.post;
type AxiosGet = typeof axios.get;
type TimeoutHandler = Parameters<typeof setTimeout>[0];

function createImmediateSetTimeoutMock(): typeof setTimeout {
  return ((handler: TimeoutHandler) => {
    if (typeof handler === 'function') {
      handler();
    }
    return 0 as any;
  }) as typeof setTimeout;
}

test('postToInstagramStory waits for image readiness and retries media_publish when media id is not available', async () => {
  const originalPost: AxiosPost = axios.post.bind(axios);
  const originalGet: AxiosGet = axios.get.bind(axios);
  const originalSetTimeout = global.setTimeout;

  let createCount = 0;
  let statusCount = 0;
  let publishCount = 0;

  global.setTimeout = createImmediateSetTimeoutMock();

  axios.post = (async (url: string) => {
    if (url.includes('/media_publish')) {
      publishCount += 1;
      if (publishCount === 1) {
        const error = new Error('Media ID is not available') as Error & { response?: any };
        error.response = {
          data: {
            error: {
              message: 'Media ID is not available',
              code: 9007,
              error_subcode: 2207027,
            },
          },
        };
        throw error;
      }

      return { data: { id: 'published-story-id' } } as any;
    }

    if (url.includes('/media')) {
      createCount += 1;
      return { data: { id: `story-container-${createCount}` } } as any;
    }

    throw new Error(`Unexpected POST ${url}`);
  }) as AxiosPost;

  axios.get = (async (url: string) => {
    if (url.includes('/story-container-1')) {
      statusCount += 1;
      return { data: { status: 'FINISHED' } } as any;
    }

    throw new Error(`Unexpected GET ${url}`);
  }) as AxiosGet;

  try {
    const result = await metaService.postToInstagramStory(
      'ig-user-1',
      'https://example.com/story.jpg',
      'token-1',
      'image',
    );

    assert.equal(result.success, true);
    assert.equal(createCount, 1);
    assert.equal(statusCount, 1);
    assert.equal(publishCount, 2);
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    global.setTimeout = originalSetTimeout;
  }
});

test('postToInstagramStory retries transient generic Meta code 1 failures for videos', async () => {
  const originalPost: AxiosPost = axios.post.bind(axios);
  const originalGet: AxiosGet = axios.get.bind(axios);
  const originalSetTimeout = global.setTimeout;

  let createCount = 0;
  let statusCount = 0;
  let publishCount = 0;

  global.setTimeout = createImmediateSetTimeoutMock();

  axios.post = (async (url: string) => {
    if (url.includes('/media_publish')) {
      publishCount += 1;
      if (publishCount === 1) {
        const error = new Error('An unknown error has occurred.') as Error & { response?: any };
        error.response = {
          data: {
            error: {
              message: 'An unknown error has occurred.',
              code: 1,
            },
          },
        };
        throw error;
      }

      return { data: { id: 'published-story-video-id' } } as any;
    }

    if (url.includes('/media')) {
      createCount += 1;
      return { data: { id: `story-video-container-${createCount}` } } as any;
    }

    throw new Error(`Unexpected POST ${url}`);
  }) as AxiosPost;

  axios.get = (async (url: string) => {
    if (url.includes('/story-video-container-1')) {
      statusCount += 1;
      return { data: { status_code: 'FINISHED' } } as any;
    }

    throw new Error(`Unexpected GET ${url}`);
  }) as AxiosGet;

  try {
    const result = await metaService.postToInstagramStory(
      'ig-user-1',
      'https://example.com/story-video.mp4',
      'token-1',
      'video',
    );

    assert.equal(result.success, true);
    assert.equal(createCount, 1);
    assert.equal(statusCount, 1);
    assert.equal(publishCount, 2);
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    global.setTimeout = originalSetTimeout;
  }
});
