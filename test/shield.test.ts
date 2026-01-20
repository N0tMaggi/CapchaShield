import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCaptchaShield, DEFAULT_COOKIE_NAME } from '../src';

type RenderArgs = {
  callback?: (token: string) => void;
  'error-callback'?: (message?: string) => void;
  'timeout-callback'?: () => void;
};

const turnstileMock = {
  render: vi.fn((_el: HTMLElement, opts: RenderArgs) => {
    opts.callback?.('token-default');
    return 'widget-1';
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  window.turnstile = turnstileMock as any;
  document.body.innerHTML = '';
  document.cookie = `${DEFAULT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))) as any;
  turnstileMock.render.mockImplementation((_el: HTMLElement, opts: RenderArgs) => {
    opts.callback?.('token-default');
    return 'widget-1';
  });
  turnstileMock.reset.mockImplementation(() => undefined);
  turnstileMock.remove.mockImplementation(() => undefined);
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as any).turnstile;
});

describe('createCaptchaShield', () => {
  it('renders, verifies, closes, and sets cookie', async () => {
    let receivedToken: string | null = null;
    const shield = createCaptchaShield({
      siteKey: 'site-key',
      onVerified: (token) => {
        receivedToken = token;
      },
    });

    const result = await shield.open();

    expect(result.status).toBe('rendered');
    expect(receivedToken).toBe('token-default');
    expect(shield.isVerified()).toBe(true);
    expect(document.cookie).toContain(`${DEFAULT_COOKIE_NAME}=`);
    expect(document.querySelector('[data-captcha-shield="overlay"]')).toBeNull();
  });

  it('skips rendering when cookie is present', async () => {
    document.cookie = `${DEFAULT_COOKIE_NAME}=1; max-age=3600; path=/`;
    const shield = createCaptchaShield({ siteKey: 'site-key' });

    const result = await shield.open();

    expect(result.status).toBe('already-verified');
    expect(result.reason).toBe('cookie');
    expect(turnstileMock.render).not.toHaveBeenCalled();
  });

  it('supports custom renderer and keeps challenge container', async () => {
    turnstileMock.render.mockImplementation((el: HTMLElement) => {
      // Do not auto-resolve to keep modal visible
      return 'widget-custom';
    });

    const renderer = vi.fn(({ challengeContainer }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'custom-modal';
      wrapper.appendChild(challengeContainer);
      return { root: wrapper };
    });

    const shield = createCaptchaShield({ siteKey: 'site-key', render: renderer });
    await shield.open();

    expect(renderer).toHaveBeenCalled();
    expect(document.querySelector('.custom-modal')).toBeTruthy();
    expect(turnstileMock.render).toHaveBeenCalled();
  });

  it('resets state and cookie', async () => {
    const shield = createCaptchaShield({ siteKey: 'site-key' });
    await shield.open();
    shield.reset();

    expect(shield.isVerified()).toBe(false);
    expect(document.cookie.includes(`${DEFAULT_COOKIE_NAME}=`)).toBe(false);
    expect(turnstileMock.reset).toHaveBeenCalled();
  });

  it('invokes onError when Turnstile signals error', async () => {
    const onError = vi.fn();
    turnstileMock.render.mockImplementation((_el: HTMLElement, opts: RenderArgs) => {
      opts['error-callback']?.('boom');
      return 'widget-err';
    });

    const shield = createCaptchaShield({ siteKey: 'site-key', onError });
    await shield.open();

    expect(onError).toHaveBeenCalled();
  });

  it('verifies token against backend before setting cookie', async () => {
    (global.fetch as any).mockResolvedValue(new Response(null, { status: 200 }));

    const shield = createCaptchaShield({
      siteKey: 'site-key',
      verify: { endpoint: '/api/verify' },
    });

    await shield.open();
    await flush();
    await flush();

    expect(global.fetch).toHaveBeenCalledWith('/api/verify', expect.objectContaining({ method: 'POST' }));
    expect(shield.isVerified()).toBe(true);
    expect(document.cookie).toContain(`${DEFAULT_COOKIE_NAME}=`);
  });

  it('keeps modal open and reports error if backend verification fails', async () => {
    (global.fetch as any).mockResolvedValue(new Response(null, { status: 500 }));
    const onError = vi.fn();

    const shield = createCaptchaShield({
      siteKey: 'site-key',
      verify: { endpoint: '/api/verify' },
      onError,
    });

    await shield.open();
    await flush();
    await flush();

    expect(onError).toHaveBeenCalled();
    expect(shield.isVerified()).toBe(false);
    expect(document.cookie.includes(`${DEFAULT_COOKIE_NAME}=`)).toBe(false);
    expect(turnstileMock.reset).toHaveBeenCalled();
    expect(document.querySelector('[data-captcha-shield="overlay"]')).toBeTruthy();
  });
});
