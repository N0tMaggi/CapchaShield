import { CaptchaShieldError } from './errors';

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function validateRequestEndpoint(endpoint: string, fieldName: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new CaptchaShieldError(`Configuration field "${fieldName}" cannot be empty.`);
  }

  if (trimmed.startsWith('//')) {
    throw new CaptchaShieldError(`Configuration field "${fieldName}" must not use protocol-relative URLs.`);
  }

  if (!ABSOLUTE_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new CaptchaShieldError(`Configuration field "${fieldName}" must be a valid URL.`);
  }

  if (url.protocol === 'https:') {
    return url.toString();
  }

  if (url.protocol === 'http:' && LOCALHOST_HOSTNAMES.has(url.hostname)) {
    return url.toString();
  }

  throw new CaptchaShieldError(
    `Configuration field "${fieldName}" must use HTTPS. Plain HTTP is only allowed for localhost development.`
  );
}

export function validateTurnstileScriptUrl(scriptUrl: string): string {
  let url: URL;
  try {
    url = new URL(scriptUrl);
  } catch {
    throw new CaptchaShieldError('turnstileScriptUrl must be a valid absolute URL.');
  }

  if (url.protocol !== 'https:') {
    throw new CaptchaShieldError('turnstileScriptUrl must use HTTPS.');
  }

  if (url.hostname !== 'challenges.cloudflare.com' || !url.pathname.startsWith('/turnstile/')) {
    throw new CaptchaShieldError(
      'turnstileScriptUrl must point to the official Cloudflare Turnstile host.'
    );
  }

  return url.toString();
}
