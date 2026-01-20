import { ResolvedIntegrityOptions, TurnstileGlobal } from './types';
import { CaptchaShieldError } from './errors';

let turnstileLoader: Promise<TurnstileGlobal> | null = null;

export function ensureTurnstile(scriptUrl: string, integrity: ResolvedIntegrityOptions): Promise<TurnstileGlobal> {
  requireDom();
  if (window.turnstile) {
    assertTurnstile(integrity);
    return Promise.resolve(window.turnstile);
  }

  if (!turnstileLoader) {
    turnstileLoader = loadTurnstileScript(scriptUrl, integrity);
  }

  return turnstileLoader;
}

function loadTurnstileScript(scriptUrl: string, integrity: ResolvedIntegrityOptions): Promise<TurnstileGlobal> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    if (integrity.scriptIntegrity) {
      script.integrity = integrity.scriptIntegrity;
      script.crossOrigin = 'anonymous';
    }
    script.onload = () => {
      if (window.turnstile) {
        try {
          assertTurnstile(integrity);
          resolve(window.turnstile);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new CaptchaShieldError('Turnstile script loaded but "window.turnstile" is missing.'));
      }
    };
    script.onerror = () => reject(new CaptchaShieldError(`Failed to load Turnstile script from ${scriptUrl}`));
    document.head.appendChild(script);
  });
}

function assertTurnstile(integrity: ResolvedIntegrityOptions) {
  if (!integrity.verifyTurnstileGlobal) return;
  const t = window.turnstile;
  if (!t || typeof t.render !== 'function') {
    throw new CaptchaShieldError('Global integrity check failed: window.turnstile.render is missing.');
  }
}

export function requireDom() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new CaptchaShieldError('Library requires a browser DOM environment.');
  }
}
