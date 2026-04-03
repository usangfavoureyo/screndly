export class PsdSupportUnavailableError extends Error {
  cause?: unknown;

  constructor(message = 'Design Studio PSD support is unavailable in this environment.', cause?: unknown) {
    super(message);
    this.name = 'PsdSupportUnavailableError';
    this.cause = cause;
  }
}

type ReadPsdFn = (buffer: Buffer, options?: Record<string, unknown>) => any;

let cachedReadPsd: ReadPsdFn | null = null;

function isMissingOptionalDependency(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return code === 'MODULE_NOT_FOUND'
    || /Cannot find module 'canvas'/i.test(message)
    || /Cannot find module 'ag-psd'/i.test(message);
}

function loadReadPsd(): ReadPsdFn {
  if (cachedReadPsd) {
    return cachedReadPsd;
  }

  try {
    try {
      require('ag-psd/initialize-canvas');
    } catch (error) {
      if (!isMissingOptionalDependency(error)) {
        throw error;
      }
    }

    const { readPsd } = require('ag-psd') as { readPsd?: ReadPsdFn };
    if (typeof readPsd !== 'function') {
      throw new Error('ag-psd did not expose readPsd');
    }
    cachedReadPsd = readPsd;
    return cachedReadPsd;
  } catch (error) {
    if (isMissingOptionalDependency(error)) {
      throw new PsdSupportUnavailableError(
        'Design Studio PSD support is unavailable because ag-psd is not installed in this environment.',
        error
      );
    }

    throw error;
  }
}

export function readPsdSafely(buffer: Buffer, options?: Record<string, unknown>) {
  return loadReadPsd()(buffer, options);
}

export function isPsdSupportUnavailableError(error: unknown): error is PsdSupportUnavailableError {
  return error instanceof PsdSupportUnavailableError;
}
