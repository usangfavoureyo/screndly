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

test('postVideoToThreads retries generic processing errors and eventually succeeds', async () => {
  const originalPost: AxiosPost = axios.post.bind(axios);
  const originalGet: AxiosGet = axios.get.bind(axios);
  const originalSetTimeout = global.setTimeout;

  let containerAttempt = 0;
  let publishAttempt = 0;
  let statusAttempt = 0;

  global.setTimeout = createImmediateSetTimeoutMock();

  axios.post = (async (url: string) => {
    if (url.includes('/threads_publish')) {
      publishAttempt += 1;
      return { data: { id: `publish-${publishAttempt}` } } as any;
    }

    containerAttempt += 1;
    return { data: { id: `container-${containerAttempt}` } } as any;
  }) as AxiosPost;

  axios.get = (async () => {
    statusAttempt += 1;
    if (statusAttempt === 1) {
      return {
        data: {
          status: 'ERROR',
          error_message: 'Error',
          error_code: 900,
          error_subcode: 42,
        },
      } as any;
    }

    return { data: { status: 'FINISHED' } } as any;
  }) as AxiosGet;

  try {
    const result = await metaService.postVideoToThreads('user-1', 'caption', 'https://example.com/video.mp4', 'token-1');

    assert.equal(result.success, true);
    assert.equal(containerAttempt, 2);
    assert.equal(statusAttempt, 2);
    assert.equal(publishAttempt, 1);
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    global.setTimeout = originalSetTimeout;
  }
});

test('postVideoToThreads returns a useful error for generic Threads processing failures', async () => {
  const originalPost: AxiosPost = axios.post.bind(axios);
  const originalGet: AxiosGet = axios.get.bind(axios);
  const originalSetTimeout = global.setTimeout;

  global.setTimeout = createImmediateSetTimeoutMock();

  axios.post = (async (url: string) => {
    if (url.includes('/threads_publish')) {
      return { data: { id: 'publish-1' } } as any;
    }

    return { data: { id: 'container-1' } } as any;
  }) as AxiosPost;

  axios.get = (async () => ({
    data: {
      status: 'ERROR',
      error_message: 'Error',
      error_code: 900,
      error_subcode: 42,
    },
  })) as AxiosGet;

  try {
    const result = await metaService.postVideoToThreads('user-1', 'caption', 'https://example.com/video.mp4', 'token-1');

    assert.equal(result.success, false);
    assert.equal(
      result.error,
      'Threads media processing failed with status ERROR (code 900, subcode 42)',
    );
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    global.setTimeout = originalSetTimeout;
  }
});

test('postToThreads polls only supported Threads media status fields', async () => {
  const originalPost: AxiosPost = axios.post.bind(axios);
  const originalGet: AxiosGet = axios.get.bind(axios);

  const requestedFields: string[] = [];

  axios.post = (async (url: string) => {
    if (url.includes('/threads_publish')) {
      return { data: { id: 'publish-1' } } as any;
    }

    return { data: { id: 'container-1' } } as any;
  }) as AxiosPost;

  axios.get = (async (_url: string, config?: any) => {
    requestedFields.push(String(config?.params?.fields || ''));
    return { data: { status: 'FINISHED' } } as any;
  }) as AxiosGet;

  try {
    const result = await metaService.postToThreads(
      'user-1',
      'caption',
      ['https://example.com/image.png'],
      'token-1',
    );

    assert.equal(result.success, true);
    assert.deepEqual(requestedFields, ['status,error_message']);
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
  }
});

test('postToThreads retries transient Threads publish errors with code 1 and subcode 2207052', async () => {
  const originalPost: AxiosPost = axios.post.bind(axios);
  const originalGet: AxiosGet = axios.get.bind(axios);
  const originalSetTimeout = global.setTimeout;

  let publishAttempts = 0;

  global.setTimeout = createImmediateSetTimeoutMock();

  axios.post = (async (url: string) => {
    if (url.includes('/threads_publish')) {
      publishAttempts += 1;
      if (publishAttempts === 1) {
        const error = new Error('temporary publish failure') as Error & { response?: unknown };
        error.response = {
          status: 400,
          data: {
            error: {
              message: 'An unknown error occurred',
              code: 1,
              error_subcode: 2207052,
            },
          },
        };
        throw error;
      }

      return { data: { id: 'publish-2' } } as any;
    }

    return { data: { id: 'container-1' } } as any;
  }) as AxiosPost;

  axios.get = (async () => ({ data: { status: 'FINISHED' } })) as AxiosGet;

  try {
    const result = await metaService.postToThreads(
      'user-1',
      'caption',
      ['https://example.com/image.png'],
      'token-1',
    );

    assert.equal(result.success, true);
    assert.equal(publishAttempts, 2);
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    global.setTimeout = originalSetTimeout;
  }
});

test('postToThreads returns detailed Meta error payload fields for publish failures', async () => {
  const originalPost: AxiosPost = axios.post.bind(axios);
  const originalGet: AxiosGet = axios.get.bind(axios);

  axios.post = (async (url: string) => {
    if (url.includes('/threads_publish')) {
      const error = new Error('publish failed') as Error & { response?: unknown };
      error.response = {
        status: 400,
        data: {
          error: {
            message: 'An unknown error occurred',
            code: 1,
            error_subcode: 2207052,
            error_user_title: 'Media download failed',
            error_user_msg: 'The media URI does not meet our requirements.',
            fbtrace_id: 'trace-123',
          },
        },
      };
      throw error;
    }

    return { data: { id: 'container-1' } } as any;
  }) as AxiosPost;

  axios.get = (async () => ({ data: { status: 'FINISHED' } })) as AxiosGet;

  try {
    const result = await metaService.postToThreads(
      'user-1',
      'caption',
      ['https://example.com/image.png'],
      'token-1',
    );

    assert.equal(result.success, false);
    assert.equal(result.error, 'An unknown error occurred (code 1, subcode 2207052)');
    assert.equal((result as any).errorCode, 'THREADS_MEDIA_FETCH_FAILED');
    assert.equal((result as any).errorUserTitle, 'Media download failed');
    assert.equal((result as any).errorUserMessage, 'The media URI does not meet our requirements.');
    assert.equal((result as any).fbtraceId, 'trace-123');
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
  }
});
