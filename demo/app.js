import { createCaptchaShield, DEFAULT_COOKIE_NAME } from '../dist/index.mjs';

const logRoot = document.querySelector('#event-log');
const configPreview = document.querySelector('#config-preview');
const stateVerified = document.querySelector('#state-verified');
const stateToken = document.querySelector('#state-token');
const stateCookie = document.querySelector('#state-cookie');
const stateResult = document.querySelector('#state-result');

const fields = {
  title: document.querySelector('#title'),
  body: document.querySelector('#body'),
  helper: document.querySelector('#helper'),
  customCss: document.querySelector('#custom-css'),
  verifyMode: document.querySelector('#verify-mode'),
  statusMode: document.querySelector('#status-mode'),
  cookieMode: document.querySelector('#cookie-mode'),
  sameSite: document.querySelector('#same-site'),
  closeOnVerify: document.querySelector('#close-on-verify'),
  injectStyle: document.querySelector('#inject-style'),
  monitorRemoval: document.querySelector('#monitor-removal'),
  enforcePresence: document.querySelector('#enforce-presence'),
};

let shield = null;
let instanceKey = '';
let lastResult = 'none';
let widgetCounter = 0;
const widgetRegistry = new Map();

installMockTurnstile();
wireActions();
renderPreview();
refreshState();
appendLog('ready', 'Demo page loaded. Choose a scenario and open the modal.');

function wireActions() {
  document.querySelector('#open-default').addEventListener('click', () => openShield('default'));
  document.querySelector('#open-custom').addEventListener('click', () => openShield('custom'));
  document.querySelector('#reuse-instance').addEventListener('click', () => reuseShield());
  document.querySelector('#recreate-instance').addEventListener('click', () => {
    shield?.close();
    shield = null;
    instanceKey = '';
    appendLog('config', 'Instance cleared without touching trusted cookie.');
    refreshState();
  });
  document.querySelector('#reset-instance').addEventListener('click', () => {
    shield?.reset();
    appendLog('reset', 'Shield instance reset.');
    refreshState();
  });
  document.querySelector('#destroy-instance').addEventListener('click', () => {
    shield?.destroy();
    shield = null;
    instanceKey = '';
    appendLog('destroy', 'Shield instance destroyed.');
    refreshState();
  });
  document.querySelector('#clear-cookie').addEventListener('click', () => {
    clearDemoCookie();
    appendLog('cookie', 'Trusted cookie cleared.');
    refreshState();
  });
  document.querySelector('#simulate-tamper').addEventListener('click', () => {
    const challenge = document.querySelector('[data-captcha-shield="challenge"]');
    if (!challenge) {
      appendLog('tamper', 'No active challenge to remove.');
      return;
    }
    challenge.remove();
    appendLog('tamper', 'Challenge container removed from DOM.');
  });

  Object.values(fields).forEach((element) => {
    element.addEventListener('input', renderPreview);
    element.addEventListener('change', renderPreview);
  });
}

async function openShield(rendererMode) {
  ensureShield(rendererMode);
  try {
    const result = await shield.open();
    lastResult = JSON.stringify(result);
    appendLog('open', `open() resolved with ${lastResult}`);
  } catch (error) {
    lastResult = error instanceof Error ? error.message : String(error);
    appendLog('error', `open() rejected: ${lastResult}`);
  }
  refreshState();
}

async function reuseShield() {
  if (!shield) {
    appendLog('reuse', 'No existing instance. Creating default instance first.');
    await openShield('default');
    return;
  }

  try {
    const result = await shield.open();
    lastResult = JSON.stringify(result);
    appendLog('reuse', `Existing instance returned ${lastResult}`);
  } catch (error) {
    lastResult = error instanceof Error ? error.message : String(error);
    appendLog('error', `Existing instance failed: ${lastResult}`);
  }
  refreshState();
}

function ensureShield(rendererMode) {
  const config = buildConfig(rendererMode);
  const nextKey = JSON.stringify({ rendererMode, config });
  if (shield && nextKey === instanceKey) {
    return;
  }

  shield?.close();
  shield = createCaptchaShield(config);
  instanceKey = nextKey;
  appendLog('config', `Created ${rendererMode} instance with current settings.`);
  refreshState();
}

function buildConfig(rendererMode) {
  const trustClientCookie = fields.cookieMode.value === 'trusted';
  const verifyMode = fields.verifyMode.value;
  const statusMode = fields.statusMode.value;

  return {
    siteKey: 'demo-site-key',
    modal: {
      closeOnVerify: fields.closeOnVerify.checked,
      injectDefaultStyle: fields.injectStyle.checked,
      copy: {
        title: fields.title.value,
        body: fields.body.value,
        helperText: fields.helper.value,
      },
      styles: {
        customCss: fields.customCss.value,
      },
    },
    cookie: {
      secure: false,
      sameSite: fields.sameSite.value,
      trustClientCookie,
      name: DEFAULT_COOKIE_NAME,
      maxAgeSeconds: 3600,
      path: '/',
    },
    integrity: {
      monitorChallengeRemoval: fields.monitorRemoval.checked,
      enforceChallengePresence: fields.enforcePresence.checked,
      verifyTurnstileGlobal: true,
    },
    verify: verifyMode === 'off'
      ? undefined
      : {
          endpoint: `/api/verify?mode=${verifyMode}`,
          timeoutMs: verifyMode === 'slow' ? 2000 : 1000,
        },
    statusCheck: statusMode === 'off'
      ? undefined
      : {
          endpoint: `/api/status?mode=${statusMode}`,
          timeoutMs: 1000,
        },
    render: rendererMode === 'custom' ? createCustomRenderer() : undefined,
    onVerified: (token) => {
      appendLog('verified', `onVerified fired with token "${token}"`);
      refreshState();
    },
    onError: (error) => {
      appendLog('error', error.message);
      refreshState();
    },
  };
}

function createCustomRenderer() {
  return ({ challengeContainer, close, config }) => {
    const root = document.createElement('div');
    root.className = 'custom-shell';

    const panel = document.createElement('section');
    panel.className = 'custom-shell__panel';

    const label = document.createElement('p');
    label.className = 'custom-shell__label';
    label.textContent = 'Custom renderer';

    const title = document.createElement('h2');
    title.textContent = config.modal.copy.title;

    const body = document.createElement('p');
    body.textContent = config.modal.copy.body;

    const helper = document.createElement('p');
    helper.textContent = config.modal.copy.helperText;

    const footer = document.createElement('div');
    footer.className = 'custom-shell__footer';

    const note = document.createElement('p');
    note.textContent = 'This version uses the render hook instead of the built-in modal.';

    const closeButton = document.createElement('button');
    closeButton.className = 'custom-shell__close';
    closeButton.type = 'button';
    closeButton.textContent = 'Close preview';
    closeButton.addEventListener('click', close);

    footer.append(note, closeButton);
    panel.append(label, title, body, challengeContainer, helper, footer);
    root.append(panel);

    return {
      root,
      destroy: () => root.remove(),
    };
  };
}

function installMockTurnstile() {
  const mountWidget = (widgetId, element, options) => {
    const root = document.createElement('section');
    root.className = 'mock-turnstile';
    root.dataset.widgetId = widgetId;

    const header = document.createElement('div');
    header.className = 'mock-turnstile__header';

    const title = document.createElement('strong');
    title.textContent = 'Mock Turnstile Widget';

    const meta = document.createElement('span');
    meta.className = 'mock-turnstile__meta';
    meta.textContent = 'Local test widget';

    const body = document.createElement('p');
    body.textContent =
      'Use the controls below to simulate a success token, an error callback, or a timeout callback.';

    const actions = document.createElement('div');
    actions.className = 'mock-turnstile__actions';

    const verifyButton = createWidgetButton('verify', 'Verify challenge', () => {
      const token = `demo-token-${Date.now()}`;
      appendLog('widget', `Mock widget emitted token ${token}`);
      options.callback?.(token);
    });

    const errorButton = createWidgetButton('error', 'Emit error', () => {
      appendLog('widget', 'Mock widget emitted error callback.');
      options['error-callback']?.('Mock turnstile error');
    });

    const timeoutButton = createWidgetButton('timeout', 'Emit timeout', () => {
      appendLog('widget', 'Mock widget emitted timeout callback.');
      options['timeout-callback']?.();
    });

    header.append(title, meta);
    actions.append(verifyButton, errorButton, timeoutButton);
    root.append(header, body, actions);
    element.replaceChildren(root);
    widgetRegistry.set(widgetId, { element, options });
  };

  window.turnstile = {
    render(element, options) {
      const widgetId = `mock-widget-${++widgetCounter}`;
      mountWidget(widgetId, element, options);
      return widgetId;
    },
    reset(widgetId) {
      const widget = widgetRegistry.get(widgetId);
      if (!widget) {
        return;
      }
      appendLog('widget', `Mock widget reset for ${widgetId}`);
      mountWidget(widgetId, widget.element, widget.options);
    },
    remove(widgetId) {
      const widget = widgetRegistry.get(widgetId);
      if (!widget) {
        return;
      }
      widget.element.replaceChildren();
      widgetRegistry.delete(widgetId);
      appendLog('widget', `Mock widget removed for ${widgetId}`);
    },
  };
}

function createWidgetButton(action, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderPreview() {
  const previewConfig = buildConfig('default');
  configPreview.textContent = JSON.stringify(previewConfig, null, 2)
    .replace(/"render": undefined,\n/g, '')
    .replace(/"verify": undefined,\n/g, '')
    .replace(/"statusCheck": undefined,\n/g, '');
}

function refreshState() {
  stateVerified.textContent = String(shield?.isVerified?.() ?? false);
  stateToken.textContent = shield?.getToken?.() ?? 'none';
  stateCookie.textContent = document.cookie || 'empty';
  stateResult.textContent = lastResult;
}

function appendLog(type, message) {
  const entry = document.createElement('div');
  entry.className = 'log__entry';
  const stamp = document.createElement('strong');
  stamp.textContent = timestamp();
  entry.append(stamp, ` [${type}] ${message}`);
  logRoot.prepend(entry);
}

function clearDemoCookie() {
  document.cookie = `${DEFAULT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function timestamp() {
  return new Date().toLocaleTimeString();
}
