# CaptchaShield

Cloudflare Turnstile modal for web apps with strong customization and a cookie that suppresses the prompt until it expires. Bring your own UI or use the minimal default dialog.

## Quick start

```bash
npm install captchashield
```

```ts
import { createCaptchaShield } from 'captchashield';

const shield = createCaptchaShield({
  siteKey: '<your-turnstile-sitekey>',
  onVerified: (token) => {
    // Send token to your backend for verification
  },
});

shield.open();
```

If the verification cookie is still valid, `open()` resolves without rendering. After a successful Turnstile callback the modal closes, sets the cookie, and gives you the token.

## Configuration

- `siteKey` (required): Turnstile site key.
- `action` / `cData`: Optional Turnstile parameters.
- `turnstileScriptUrl`: Override the script URL. **Security Note:** Only use trusted URLs (defaults to official Cloudflare URL).
- `cookie`: `{ name, maxAgeSeconds, path, domain, sameSite, secure, useScopePrefix, scopeId }` to control skip-cookie behavior.
  - **Best Practice:** Default is `secure: true`, `sameSite: 'Lax'`. Do not downgrade these settings unless absolutely necessary (e.g. localhost development).
- `modal`: copy (`title`, `body`, `helperText`), classes, custom CSS, `ariaLabel`, `closeOnVerify`, `injectDefaultStyle` (true by default).
- `verify`: `{ endpoint, method, headers, timeoutMs, retries, buildBody, expectedStatus }`.
  - **Security Note:** Use `method: 'POST'` (default) to send tokens in the body. Avoid `GET` to prevent token leakage in URL logs.
- `statusCheck`: optional `{ endpoint, timeoutMs, expectedStatus }`.
- `integrity`: `{ scriptIntegrity, verifyTurnstileGlobal, enforceChallengePresence, monitorChallengeRemoval }`.
  - `scriptIntegrity`: If you pin a specific version of Turnstile, provide the SRI hash here.
  - `monitorChallengeRemoval`: Set to `true` to detect if the CAPTCHA widget is removed from the DOM by a malicious script or extension.
- `render`: full custom renderer hook.
- `onVerified(token)`, `onError(error)`: lifecycle hooks.
- `modal.styles.customCss`: **Warning:** This injects a `<style>` tag. Do not pass user-generated content (e.g. from URL params) to this field to avoid CSS injection attacks.

### Security Best Practices

1.  **Server-Side Verification:** Always verify the token on your backend using Cloudflare's `siteverify` API. The frontend cookie check is a UX optimization (skip), not a security gate.
2.  **HTTPS:** CaptureShield sets `Secure` cookies by default. Ensure your site is served over HTTPS.
3.  **Content Security Policy (CSP):** Ensure your CSP allows:
    - `script-src`: `https://challenges.cloudflare.com`
    - `frame-src`: `https://challenges.cloudflare.com`


### Custom renderer

Provide your own modal or inline UI via `render`:

```ts
const shield = createCaptchaShield({
  siteKey: '<sitekey>',
  render: ({ challengeContainer, close }) => {
    const overlay = document.createElement('div');
    overlay.className = 'my-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'my-dialog';
    dialog.append('Prove you are human');
    dialog.append(challengeContainer); // Turnstile mounts here

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => close();
    dialog.append(closeBtn);

    overlay.append(dialog);
    return { root: overlay };
  },
});

shield.open();
```

You control all markup and styling; CaptchaShield only mounts Turnstile into the provided `challengeContainer`. The library still manages Turnstile loading, callbacks, cookies, and state.

### Auto-verify to backend

```ts
const shield = createCaptchaShield({
  siteKey: '<sitekey>',
  verify: {
    endpoint: '/api/turnstile/verify', // POST, body {token} by default
    timeoutMs: 5000,
    retries: 1,
  },
  onError: (err) => console.error('Verification failed', err),
});

await shield.open();
```

The modal closes and sets the cookie only if the backend responds with the expected status (default: any 2xx). On failure, the widget is reset and `onError` fires so you can surface an error message.

### Multi-site / Subdomain usage

Use separate cookies per area, or share across subdomains via cookie settings:

```ts
createCaptchaShield({
  siteKey: '<sitekey>',
  cookie: {
    name: 'captchashield',
    useScopePrefix: true, // adds host/scope to cookie name
    scopeId: 'dashboard', // optional explicit scope identifier
    domain: '.example.com', // share across subdomains if needed
  },
});
```

### Integrity / anti-tamper

- `integrity.scriptIntegrity`: sets SRI hash + `crossorigin="anonymous"` on the Turnstile script.
- `integrity.verifyTurnstileGlobal`: ensure `window.turnstile.render` exists.
- `integrity.enforceChallengePresence`: error if the challenge container disappears during mount.
- `integrity.monitorChallengeRemoval`: watches for removal of the challenge node and triggers `onError` + cleanup.

## Configuration Templates

### 1. Strict Security (Production)
Use this for sensitive production environments. It enforces HTTPS, strict cookies, and integrity checks.

```ts
const strictConfig: ShieldConfig = {
  siteKey: '0x4AAAAAA...',
  cookie: {
    secure: true,
    sameSite: 'Strict', // Only strict if you don't need cross-site navigation persistence
    path: '/',
    maxAgeSeconds: 3600 // 1 hour short-lived session
  },
  integrity: {
    verifyTurnstileGlobal: true,
    enforceChallengePresence: true,
    monitorChallengeRemoval: true,
    // scriptIntegrity: 'sha384-...' // Optional: Pin specific Turnstile version SRI
  },
  modal: {
    styles: {
       customCss: '' // No custom CSS to reduce injection risk
    }
  },
  verify: {
    method: 'POST', // Always use POST
    endpoint: '/api/security/verify-captcha'
  }
};
```

### 2. Development / Localhost
Use this for local testing where HTTPS might not be available.

```ts
const devConfig: ShieldConfig = {
  siteKey: '1x00000000000000000000AA', // Cloudflare dummy sitekey always passes
  cookie: {
    secure: false, // Allow http://localhost
    sameSite: 'Lax',
    name: 'dev_captcha_verified'
  },
  verify: {
    // Mock endpoint or skip verification in dev
    endpoint: undefined 
  }
};
```

## Error Handling

All errors thrown by **CaptchaShield** are instances of `CaptchaShieldError` and carry the prefix `[CaptchaShield]`.
This ensures clear logs and helps distinguish library errors from application errors.

- **Sanitization:** Error messages are sanitized to avoid leaking sensitive data (e.g., tokens, full response bodies) to the client console.
- **Handling:** Listen to `onError` to handle failures gracefully.

```ts
const shield = createCaptchaShield({
  // ...
  onError: (error) => {
    if (error instanceof CaptchaShieldError) {
       console.error('Shield Error:', error.message); 
       // e.g. "Shield Error: [CaptchaShield] Server verification rejected token"
    }
    // Show user-friendly toast notification
    toaster.show('Verification failed. Please try again.');
  }
});
```


### Minimal backend example (Express)

```ts
import type { Request, Response } from 'express';
import fetch from 'node-fetch';

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET!;

export async function verifyTurnstile(req: Request, res: Response) {
  const token = req.body?.token;
  if (!token) return res.status(400).json({ error: 'missing token' });

  const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token }),
  });

  const payload = await cfRes.json();
  if (payload.success) return res.sendStatus(204);
  return res.status(400).json({ success: false, error: payload['error-codes'] });
}
```

## API surface

`createCaptchaShield(config)` returns a controller with:

- `open(): Promise<{ status: 'rendered' | 'already-verified'; reason?: 'cookie' | 'session' }>`
- `close()`: remove the modal without clearing state.
- `reset()`: clear token, cookie, and reset the Turnstile widget.
- `destroy()`: reset and close.
- `isVerified()`: whether the session or cookie is marked verified.
- `getToken()`: last Turnstile token (if any).

## Scripts

- `npm run dev` – tsup watch
- `npm run build` – bundle ESM/CJS + types
- `npm run test` – Vitest (jsdom)
- `npm run lint` – ESLint (flat config)
- `npm run typecheck` – TypeScript strict, no emit

## Notes

- **Security First:** Verification tokens must be validated server-side; the cookie only suppresses the prompt client-side.
- **Zero-Trust:** Never trust the client. Always re-verify important actions on the server.
- Default styles are minimal; set `injectDefaultStyle: false` when you supply your own CSS.

## License

MIT
