import { ResolvedShieldConfig, RendererHandle } from './types';

export interface RenderParams {
  challengeContainer: HTMLElement;
  config: ResolvedShieldConfig;
  close: () => void;
}

export function renderDefaultModal({ challengeContainer, config, close }: RenderParams): RendererHandle {
  const overlay = document.createElement('div');
  const panel = document.createElement('div');
  const header = document.createElement('div');
  const title = document.createElement('h2');
  const closeButton = document.createElement('button');
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

  header.className = 'captcha-shield__header';

  title.className = config.modal.styles.titleClass;
  title.textContent = config.modal.copy.title;

  closeButton.type = 'button';
  closeButton.className = 'captcha-shield__close';
  closeButton.setAttribute('aria-label', 'Close verification dialog');
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', close);

  body.className = config.modal.styles.bodyClass;
  body.textContent = config.modal.copy.body;

  helper.className = config.modal.styles.helperClass;
  helper.textContent = config.modal.copy.helperText;

  header.appendChild(title);
  header.appendChild(closeButton);
  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(challengeContainer);
  panel.appendChild(helper);
  overlay.appendChild(panel);

  if (config.modal.injectDefaultStyle) {
    injectStyle(defaultStyleSheet(config.modal.styles.customCss));
  } else if (config.modal.styles.customCss.trim().length > 0) {
    injectStyle(config.modal.styles.customCss);
  }

  return {
    root: overlay,
    destroy: () => overlay.remove(),
  };
}

function injectStyle(css: string) {
  if (!css.trim()) return;
  const attrValue = 'true';
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
.captcha-shield__overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.48); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 9999; }
.captcha-shield__panel { width: min(480px, 100%); background: #ffffff; color: #111827; border: 1px solid #d4d4d8; border-radius: 10px; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.12); padding: 20px; font-family: inherit; display: flex; flex-direction: column; gap: 16px; }
.captcha-shield__header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.captcha-shield__title { margin: 0; font-size: 1.125rem; line-height: 1.35; font-weight: 650; }
.captcha-shield__close { appearance: none; border: 1px solid #d4d4d8; background: #ffffff; color: #374151; border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
.captcha-shield__close:hover { background: #f4f4f5; }
.captcha-shield__body { margin: 0; line-height: 1.6; color: #1f2937; }
.captcha-shield__helper { margin: 0; font-size: 0.9375rem; color: #52525b; }
[data-captcha-shield="challenge"] { min-height: 70px; display: flex; align-items: center; justify-content: center; }
`;
  return `${base}${customCss ?? ''}`;
}
