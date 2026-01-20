import { ResolvedCookieOptions } from './types';

export function hasCookie(name: string): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((item) => item.trim().startsWith(`${name}=`));
}

export function setCookie(options: ResolvedCookieOptions, value: string) {
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
