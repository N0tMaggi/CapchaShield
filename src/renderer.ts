import { ResolvedIntegrityOptions, ResolvedShieldConfig, RendererHandle } from './types';

export interface RenderParams {
  challengeContainer: HTMLElement;
  config: ResolvedShieldConfig;
  close: () => void;
}

export function renderDefaultModal({ challengeContainer, config }: RenderParams): RendererHandle {
  const { integrity } = config;
  const overlay = document.createElement('div');
  const panel = document.createElement('div');
  const title = document.createElement('h2');
  const body = document.createElement('p');
  const helper = document.createElement('p');

  overlay.setAttribute('role', 'presentation');
  overlay.className = config.modal.styles.overlayClass;
  overlay.setAttribute('data-captcha-shield', 'overlay');

  panel.className = config.modal.styles.panelClass;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', config.modal.ariaLabel);
  panel.setAttribute('data-captcha-shield', 'panel');

  title.className = config.modal.styles.titleClass;
  title.textContent = config.modal.copy.title;

  body.className = config.modal.styles.bodyClass;
  body.textContent = config.modal.copy.body;

  helper.className = config.modal.styles.helperClass;
  helper.textContent = config.modal.copy.helperText;

  panel.appendChild(title);
  panel.appendChild(body);
  panel.appendChild(challengeContainer);
  panel.appendChild(helper);
  overlay.appendChild(panel);

  if (config.modal.injectDefaultStyle) {
    injectStyle(defaultStyleSheet(config.modal.styles.customCss), integrity);
  } else if (config.modal.styles.customCss.trim().length > 0) {
    injectStyle(config.modal.styles.customCss, integrity);
  }

  return {
    root: overlay,
    destroy: () => overlay.remove(),
  };
}

function injectStyle(css: string, integrity: ResolvedIntegrityOptions) {
  if (!css.trim()) return;
  const attrValue = integrity.scriptIntegrity ? 'true' : 'true';
  const existing = document.head.querySelector('style[data-captcha-shield-style="true"]');
  if (existing) {
    existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-captcha-shield-style', attrValue);
  style.textContent = css;
  document.head.appendChild(style);
}

function defaultStyleSheet(customCss: string): string {
  const base = `
.captcha-shield__overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 9999; }
.captcha-shield__panel { width: min(420px, 100%); background: #ffffff; color: #0f172a; border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18); padding: 20px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 12px; }
.captcha-shield__title { margin: 0; font-size: 1.1rem; font-weight: 700; }
.captcha-shield__body { margin: 0; line-height: 1.5; }
.captcha-shield__helper { margin: 0; font-size: 0.9rem; color: #475569; }
[data-captcha-shield="challenge"] { min-height: 70px; display: flex; align-items: center; justify-content: center; }
`;
  return `${base}${customCss ?? ''}`;
}
