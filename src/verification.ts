import { fetchWithTimeout, isExpectedStatus } from './network';
import { ResolvedStatusOptions, ResolvedVerifyOptions } from './types';
import { CaptchaShieldError } from './errors';

export async function runStatusCheck(status: ResolvedStatusOptions) {
  if (!status.endpoint) return;
  const response = await fetchWithTimeout(status.endpoint, { method: 'GET' }, status.timeoutMs);
  if (!isExpectedStatus(response.status, status.expectedStatus)) {
    throw new CaptchaShieldError(`Status check failed with status: ${response.status}`);
  }
}

export async function verifyTokenWithServer(token: string, verify: ResolvedVerifyOptions): Promise<boolean> {
  if (!verify.endpoint) return true;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= verify.retries; attempt++) {
    try {
      const response = await requestVerification(token, verify);
      if (isExpectedStatus(response.status, verify.expectedStatus)) {
        return true;
      }
      lastError = new CaptchaShieldError(`Verification failed with status: ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new CaptchaShieldError(String(err));
    }
  }

  if (lastError) {
    throw lastError;
  }

  return false;
}

async function requestVerification(token: string, verify: ResolvedVerifyOptions): Promise<Response> {
  const init: RequestInit = {
    method: verify.method,
    headers: verify.headers,
  };

  const body = verify.buildBody(token);
  if (body) {
    init.body = body;
  }

  return fetchWithTimeout(verify.endpoint ?? '', init, verify.timeoutMs);
}
