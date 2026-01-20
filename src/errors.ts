export class CaptchaShieldError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(`[CaptchaShield] ${message}`);
    this.name = 'CaptchaShieldError';
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if ('captureStackTrace' in Error) {
      (Error as any).captureStackTrace(this, CaptchaShieldError);
    }
  }
}
