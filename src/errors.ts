export class CaptchaShieldError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(`[CaptchaShield] ${message}`);
    this.name = 'CaptchaShieldError';

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    type ConstructorLike = abstract new (...args: unknown[]) => unknown;
    const maybeCaptureStackTrace = (
      Error as unknown as { captureStackTrace?: (target: object, ctor?: ConstructorLike) => void }
    ).captureStackTrace;
    maybeCaptureStackTrace?.(this, CaptchaShieldError as unknown as ConstructorLike);
  }
}
