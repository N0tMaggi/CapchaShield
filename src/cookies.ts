import { CaptchaShieldError } from './errors';
import { ResolvedCookieOptions } from './types';

// RFC 6265 §4.1.1: cookie-name must be a US-ASCII "token" —
// printable characters excluding control chars and the listed separators.
const COOKIE_NAME_RE = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;

function assertValidCookieName(name: string): void {
  if (!name || !COOKIE_NAME_RE.test(name)) {
    throw new CaptchaShieldError(
      `Invalid cookie.name "${name}": must be a valid RFC 6265 token (printable ASCII, no separators or control characters).`
    );
  }
}

// RFC 6265 §4.1.1: cookie attribute values must not contain semicolons.
function assertValidCookieAttributeValue(value: string, attr: string): void {
  if (value.includes(';')) {
    throw new CaptchaShieldError(
      `Invalid cookie.${attr} "${value}": must not contain semicolons.`
    );
  }
}

export function hasCookie(name: string): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((item) => item.trim().startsWith(`${name}=`));
}

export function setCookie(options: ResolvedCookieOptions, value: string) {
  assertValidCookieName(options.name);
  if (options.domain) assertValidCookieAttributeValue(options.domain, 'domain');
  assertValidCookieAttributeValue(options.path, 'path');

  const attributes = [
    `path=${options.path}`,
    `max-age=${options.maxAgeSeconds}`,
    options.domain ? `domain=${options.domain}` : '',
    options.secure ? 'secure' : '',
    options.sameSite ? `samesite=${options.sameSite}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  document.cookie = `${options.name}=${encodeURIComponent(value)}; ${attributes}`;
}

export function clearCookie(options: ResolvedCookieOptions) {
  assertValidCookieName(options.name);
  if (options.domain) assertValidCookieAttributeValue(options.domain, 'domain');
  assertValidCookieAttributeValue(options.path, 'path');

  const attributes = [
    `expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `path=${options.path}`,
    options.domain ? `domain=${options.domain}` : '',
    options.secure ? 'secure' : '',
    options.sameSite ? `samesite=${options.sameSite}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  document.cookie = `${options.name}=; ${attributes}`;
}

export function deriveCookieName(baseName: string, options: ResolvedCookieOptions): string {
  if (!options.useScopePrefix) return baseName;
  const scope = options.scopeId ?? deriveScopeId();
  return scope ? `${baseName}_${scope}` : baseName;
}

function deriveScopeId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.location.hostname.replace(/\./g, '_');
  } catch {
    return undefined;
  }
}
