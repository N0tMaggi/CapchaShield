import { CaptchaShieldError } from './errors';

/**
 * Executes a fetch request with a timeout.
 * 
 * FIX: This implementation now properly cleans up event listeners on AbortSignals to prevent memory leaks.
 */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const timeoutController = new AbortController();
  const merged = mergeSignals([init.signal, timeoutController.signal].filter(Boolean) as AbortSignal[]);
  
  const timer = setTimeout(() => timeoutController.abort(new CaptchaShieldError('Request timed out')), timeoutMs);
  
  try {
    const signal = merged ? merged.signal : init.signal;
    return await fetch(url, { ...init, signal });
  } finally {
    clearTimeout(timer);
    merged?.cleanup();
  }
}

export function isExpectedStatus(status: number, expected: number | ((status: number) => boolean)): boolean {
  if (typeof expected === 'function') {
    return expected(status);
  }
  return status === expected;
}

/**
 * Appends the turnstile token to the endpoint URL.
 * 
 * FIX: Included handling for relative URLs.
 */
export function appendTokenQuery(endpoint: string, token: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new CaptchaShieldError('Cannot append token: "endpoint" is empty.');
  }

  // Check if valid absolute URL
  try {
    const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
    if (isAbsolute) {
      const url = new URL(trimmed);
      url.searchParams.append('token', token);
      return url.toString();
    }
  } catch {
    // Ignore URL parse errors to fall through to relative handling if it looked absolute but wasn't
  }

  // Handle relative URLs (preserves ./, /, or plain paths)
  const [pathPart, queryPart] = trimmed.split('?', 2);
  const params = new URLSearchParams(queryPart);
  params.append('token', token);

  return `${pathPart}?${params.toString()}`;
}

/**
 * Merges multiple AbortSignals into one.
 * Returns a tuple of the new signal and a cleanup function.
 */
function mergeSignals(signals: AbortSignal[]): { signal: AbortSignal; cleanup: () => void } | undefined {
  if (signals.length === 0) return undefined;

  const controller = new AbortController();
  const abortHandler = (event: Event) => {
    const signal = event.target as AbortSignal | null;
    controller.abort(signal?.reason);
  };

  signals.forEach(sig => {
    if (sig.aborted) {
       if (!controller.signal.aborted) controller.abort(sig.reason);
    } else {
      sig.addEventListener('abort', abortHandler, { once: true });
    }
  });

  const cleanup = () => {
    signals.forEach(sig => sig.removeEventListener('abort', abortHandler));
  };

  if (controller.signal.aborted) {
    cleanup();
    return { signal: controller.signal, cleanup: () => {} };
  }

  controller.signal.addEventListener('abort', cleanup, { once: true });

  return { signal: controller.signal, cleanup };
}