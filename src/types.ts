declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

export interface TurnstileGlobal {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
  reset?: (widgetId?: string) => void;
  remove?: (widgetId: string) => void;
}

export interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  cData?: string;
  callback?: (token: string) => void;
  'error-callback'?: (message?: string) => void;
  'timeout-callback'?: () => void;
}

export interface CookieOptions {
  name?: string;
  maxAgeSeconds?: number;
  path?: string;
  domain?: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
  scopeId?: string;
  useScopePrefix?: boolean;
}

export interface ModalCopyOptions {
  title?: string;
  body?: string;
  helperText?: string;
}

export interface ModalStyleOptions {
  overlayClass?: string;
  panelClass?: string;
  titleClass?: string;
  bodyClass?: string;
  helperClass?: string;
  /**
   * Custom CSS to inject into the document head.
   * 
   * @security **Warning**: This string is injected directly into a <style> tag.
   * Do NOT pass user-generated content here as it may lead to CSS injection attacks 
   * (e.g., data exfiltration via background images). Ensure this content is static or sanitized.
   */
  customCss?: string;
}

export interface ModalOptions {
  copy?: ModalCopyOptions;
  styles?: ModalStyleOptions;
  ariaLabel?: string;
  closeOnVerify?: boolean;
  injectDefaultStyle?: boolean;
}

export interface VerifyOptions {
  endpoint?: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  buildBody?: (token: string) => BodyInit | null | undefined;
  expectedStatus?: number | ((status: number) => boolean);
}

export interface StatusOptions {
  endpoint?: string;
  timeoutMs?: number;
  expectedStatus?: number | ((status: number) => boolean);
}

export interface IntegrityOptions {
  scriptIntegrity?: string;
  verifyTurnstileGlobal?: boolean;
  enforceChallengePresence?: boolean;
  monitorChallengeRemoval?: boolean;
}

export interface ShieldConfig {
  siteKey: string;
  action?: string;
  cData?: string;
  turnstileScriptUrl?: string;
  modal?: ModalOptions;
  cookie?: CookieOptions;
  verify?: VerifyOptions;
  statusCheck?: StatusOptions;
  integrity?: IntegrityOptions;
  render?: ShieldRenderer;
  onVerified?: (token: string) => void;
  onError?: (error: Error) => void;
}

export interface ShieldOpenResult {
  status: 'rendered' | 'already-verified';
  reason?: 'cookie' | 'session';
}

export interface ShieldController {
  open: () => Promise<ShieldOpenResult>;
  close: () => void;
  reset: () => void;
  destroy: () => void;
  isVerified: () => boolean;
  getToken: () => string | null;
}

export interface RendererContext {
  challengeContainer: HTMLElement;
  config: ResolvedShieldConfig;
  close: () => void;
}

export interface RendererHandle {
  root: HTMLElement;
  destroy?: () => void;
}

export type ShieldRenderer = (context: RendererContext) => RendererHandle;

export interface ResolvedCookieOptions {
  name: string;
  maxAgeSeconds: number;
  path: string;
  domain?: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure: boolean;
  scopeId?: string;
  useScopePrefix: boolean;
}

export interface ResolvedVerifyOptions {
  endpoint?: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  timeoutMs: number;
  retries: number;
  buildBody: (token: string) => BodyInit | null | undefined;
  expectedStatus: number | ((status: number) => boolean);
}

export interface ResolvedStatusOptions {
  endpoint?: string;
  timeoutMs: number;
  expectedStatus: number | ((status: number) => boolean);
}

export interface ResolvedIntegrityOptions {
  scriptIntegrity?: string;
  verifyTurnstileGlobal: boolean;
  enforceChallengePresence: boolean;
  monitorChallengeRemoval: boolean;
}

export interface ResolvedShieldConfig {
  siteKey: string;
  action?: string;
  cData?: string;
  turnstileScriptUrl: string;
  modal: Required<ModalOptions> & { copy: Required<ModalCopyOptions>; styles: Required<ModalStyleOptions> };
  cookie: ResolvedCookieOptions;
  verify: ResolvedVerifyOptions;
  statusCheck: ResolvedStatusOptions;
  integrity: ResolvedIntegrityOptions;
  render?: ShieldRenderer;
  onVerified?: (token: string) => void;
  onError?: (error: Error) => void;
}

export interface IntegrityWatch {
  observer?: MutationObserver;
  stop: () => void;
}
