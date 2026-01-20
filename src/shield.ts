import { clearCookie, deriveCookieName, hasCookie, setCookie } from './cookies';
import { renderDefaultModal } from './renderer';
import { ensureTurnstile, requireDom } from './turnstile';
import { runStatusCheck, verifyTokenWithServer } from './verification';
import { CaptchaShieldError } from './errors';
import {
  CookieOptions,
  IntegrityWatch,
  ModalCopyOptions,
  ModalOptions,
  ModalStyleOptions,
  ResolvedCookieOptions,
  ResolvedIntegrityOptions,
  ResolvedShieldConfig,
  ResolvedStatusOptions,
  ResolvedVerifyOptions,
  ShieldConfig,
  ShieldController,
  ShieldOpenResult,
  ShieldRenderer,
  TurnstileGlobal,
} from './types';

export const DEFAULT_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const DEFAULT_COOKIE_NAME = 'captchaShieldVerified';

const DEFAULT_MODAL_COPY: Required<ModalCopyOptions> = {
  title: 'Please verify you are human',
  body: 'Complete the Cloudflare Turnstile check to continue. A short-lived cookie will skip this step until it expires.',
  helperText: 'No data is stored beyond the verification cookie and the Turnstile token.',
};

const DEFAULT_MODAL_STYLES: Required<ModalStyleOptions> = {
  overlayClass: 'captcha-shield__overlay',
  panelClass: 'captcha-shield__panel',
  titleClass: 'captcha-shield__title',
  bodyClass: 'captcha-shield__body',
  helperClass: 'captcha-shield__helper',
  customCss: '',
};

const DEFAULT_MODAL: Required<ModalOptions> & { copy: Required<ModalCopyOptions>; styles: Required<ModalStyleOptions> } = {
  copy: DEFAULT_MODAL_COPY,
  styles: DEFAULT_MODAL_STYLES,
  ariaLabel: 'Human verification dialog',
  closeOnVerify: true,
  injectDefaultStyle: true,
};

const DEFAULT_COOKIE: ResolvedCookieOptions = {
  name: DEFAULT_COOKIE_NAME,
  maxAgeSeconds: 60 * 60 * 24,
  path: '/',
  sameSite: 'Lax',
  secure: true,
  scopeId: undefined,
  useScopePrefix: false,
};

const DEFAULT_VERIFY: ResolvedVerifyOptions = {
  endpoint: undefined,
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  timeoutMs: 5000,
  retries: 1,
  buildBody: (token: string) => JSON.stringify({ token }),
  expectedStatus: (status: number) => status >= 200 && status < 300,
};

const DEFAULT_STATUS: ResolvedStatusOptions = {
  endpoint: undefined,
  timeoutMs: 3000,
  expectedStatus: (status: number) => status >= 200 && status < 400,
};

const DEFAULT_INTEGRITY: ResolvedIntegrityOptions = {
  scriptIntegrity: undefined,
  verifyTurnstileGlobal: true,
  enforceChallengePresence: true,
  monitorChallengeRemoval: false,
};

export function createCaptchaShield(config: ShieldConfig): ShieldController {
  const resolved = resolveConfig(config);

  let verified = false;
  let token: string | null = null;
  let rendererHandle: { root: HTMLElement; destroy?: () => void } | null = null;
  let challengeTarget: HTMLElement | null = null;
  let widgetId: string | null = null;
  let opening: Promise<ShieldOpenResult> | null = null;
  let lastTurnstile: TurnstileGlobal | null = null;
  let verifying: Promise<void> | null = null;
  let integrityWatch: IntegrityWatch | null = null;
  let currentOpenId = 0; // Tracks the validity of the current open request

  const isAlreadyVerified = () => verified || hasCookie(resolved.cookie.name);

  const close = () => {
    // Invalidate any pending open operations
    currentOpenId++;

    if (widgetId && lastTurnstile?.remove) {
      lastTurnstile.remove(widgetId);
      widgetId = null;
    }

    if (rendererHandle) {
      rendererHandle.destroy?.();
      rendererHandle.root.remove();
      rendererHandle = null;
    }
    if (integrityWatch) {
      integrityWatch.stop();
      integrityWatch = null;
    }
    challengeTarget = null;
  };

  const reset = () => {
    token = null;
    verified = false;
    clearCookie(resolved.cookie);
    if (widgetId && lastTurnstile?.reset) {
      lastTurnstile.reset(widgetId);
    }
    widgetId = null;
  };

  const destroy = () => {
    reset();
    close();
  };

  const renderModal = (turnstile: TurnstileGlobal) => {
    const challengeContainer = document.createElement('div');
    challengeContainer.setAttribute('data-captcha-shield', 'challenge');

    const handle = resolved.render
      ? resolved.render({ challengeContainer, config: resolved, close })
      : renderDefaultModal({ challengeContainer, config: resolved, close });

    if (!handle.root.contains(challengeContainer)) {
      handle.root.appendChild(challengeContainer);
    }

    document.body.appendChild(handle.root);
    lastTurnstile = turnstile;
    rendererHandle = handle;
    challengeTarget = challengeContainer;

    if (resolved.integrity.monitorChallengeRemoval) {
      integrityWatch = startIntegrityWatch(challengeContainer, () => {
        handleError('Challenge container was removed. Possible tampering detected.');
        destroy();
      });
    }
  };

  const open = async (): Promise<ShieldOpenResult> => {
    const cookieVerified = hasCookie(resolved.cookie.name);
    if (verified || cookieVerified) {
      verified = true;
      return { status: 'already-verified', reason: cookieVerified ? 'cookie' : 'session' };
    }

    if (opening) {
      return opening;
    }

    // Associate this request with an ID to detect cancellation/closure during async steps
    const myId = ++currentOpenId;

    opening = (async () => {
      requireDom();
      await runStatusCheck(resolved.statusCheck);
      if (myId !== currentOpenId) throw new CaptchaShieldError('Operation cancelled by close()');

      const turnstile = await ensureTurnstile(resolved.turnstileScriptUrl, resolved.integrity);
      if (myId !== currentOpenId) throw new CaptchaShieldError('Operation cancelled by close()');

      renderModal(turnstile);
      if (!challengeTarget) {
        if (resolved.integrity.enforceChallengePresence) {
          throw new CaptchaShieldError('Failed to mount a challenge container.');
        }
        challengeTarget = document.createElement('div');
      }

      widgetId = turnstile.render(challengeTarget, {
        sitekey: resolved.siteKey,
        action: resolved.action,
        cData: resolved.cData,
        callback: handleVerified,
        'error-callback': (message?: string) => handleError(message ?? 'Turnstile error'),
        'timeout-callback': () => handleError('Turnstile timed out'),
      });

      return { status: 'rendered' as const };
    })();

    try {
      return await opening;
    } finally {
      opening = null;
    }
  };

  const handleVerified = (turnstileToken: string) => {
    token = turnstileToken;
    const finalize = () => {
      verified = true;
      setCookie(resolved.cookie, '1');
      resolved.onVerified?.(turnstileToken);
      if (resolved.modal.closeOnVerify) {
        close();
      }
    };

    const resetWidget = () => {
      if (widgetId && lastTurnstile?.reset) {
        lastTurnstile.reset(widgetId);
      }
    };

    const executeVerification = async () => {
      if (!resolved.verify.endpoint) {
        finalize();
        return;
      }

      const ok = await verifyTokenWithServer(turnstileToken, resolved.verify);
      if (!ok) {
        resetWidget();
        handleError('Server verification rejected token');
        return;
      }

      finalize();
    };

    if (!verifying) {
      verifying = executeVerification()
        .catch((err) => {
          resetWidget();
          handleError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          verifying = null;
        });
    }
  };

  const handleError = (message: string) => {
    resolved.onError?.(new CaptchaShieldError(message));
  };

  return {
    open,
    close,
    reset,
    destroy,
    isVerified: () => isAlreadyVerified(),
    getToken: () => token,
  };
}

function resolveConfig(config: ShieldConfig): ResolvedShieldConfig {
  if (!config.siteKey) {
    throw new CaptchaShieldError('Configuration missing required "siteKey".');
  }

  const modalCopy = { ...DEFAULT_MODAL_COPY, ...(config.modal?.copy ?? {}) };
  const modalStyles = { ...DEFAULT_MODAL_STYLES, ...(config.modal?.styles ?? {}) };
  const modal = {
    ...DEFAULT_MODAL,
    ...(config.modal ?? {}),
    copy: modalCopy,
    styles: modalStyles,
  };

  const cookieBase: CookieOptions = config.cookie ?? {};
  const cookie: ResolvedCookieOptions = { ...DEFAULT_COOKIE, ...cookieBase };
  cookie.name = deriveCookieName(cookieBase.name ?? DEFAULT_COOKIE_NAME, cookie);

  const verify = { ...DEFAULT_VERIFY, ...(config.verify ?? {}) };
  const statusCheck = { ...DEFAULT_STATUS, ...(config.statusCheck ?? {}) };
  const integrity = { ...DEFAULT_INTEGRITY, ...(config.integrity ?? {}) };

  return {
    siteKey: config.siteKey,
    action: config.action,
    cData: config.cData,
    turnstileScriptUrl: config.turnstileScriptUrl ?? DEFAULT_SCRIPT_URL,
    modal,
    cookie,
    verify,
    statusCheck,
    integrity,
    render: config.render as ShieldRenderer | undefined,
    onVerified: config.onVerified,
    onError: config.onError,
  };
}

function startIntegrityWatch(element: HTMLElement, onTamper: () => void): IntegrityWatch {
  if (!element.isConnected) {
    onTamper();
    return { stop: () => undefined };
  }

  const observer = new MutationObserver(() => {
    if (!element.isConnected) {
      onTamper();
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    observer,
    stop: () => observer.disconnect(),
  };
}
