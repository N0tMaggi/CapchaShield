export {
  createCaptchaShield,
  DEFAULT_COOKIE_NAME,
  DEFAULT_SCRIPT_URL,
} from './shield';

export {
  hasCookie,
  setCookie,
  clearCookie,
} from './cookies';

export { CaptchaShieldError } from './errors';

export type {
  ShieldConfig,
  ShieldController,
  ShieldOpenResult,
  ShieldRenderer,
  RendererContext,
  RendererHandle,
  CookieOptions,
  ModalOptions,
  ModalCopyOptions,
  ModalStyleOptions,
  VerifyOptions,
  StatusOptions,
  IntegrityOptions,
  ResolvedShieldConfig,
} from './types';
