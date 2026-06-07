let iconHost: HTMLDivElement | null = null;
let popupHost: HTMLDivElement | null = null;
let currentText: string | null = null;
let savedRect: DOMRect | null = null;

const ICON_HTML = `
<style>
  :host { all: initial; }
  .trans-icon {
    width: 32px;
    height: 32px;
    background: #4f46e5;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(79, 70, 229, 0.35);
    animation: iconIn 0.15s ease-out;
    transition: transform 0.15s;
  }
  .trans-icon:hover {
    transform: scale(1.1);
    background: #4338ca;
  }
  @keyframes iconIn {
    from { opacity: 0; transform: scale(0.7); }
    to { opacity: 1; transform: scale(1); }
  }
  .icon-svg {
    width: 16px;
    height: 16px;
    fill: #ffffff;
  }
</style>
<div class="trans-icon" id="transIcon">
  <svg class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
  </svg>
</div>
`;

const POPUP_HTML = `
<style>
  :host { all: initial; }
  .popup {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 16px;
    width: 360px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1a1a2e;
    animation: fadeIn 0.15s ease-out;
    position: relative;
  }
  .popup::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid #ffffff;
    filter: drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.04));
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .section-label {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .source-text {
    font-size: 13px;
    color: #475569;
    margin-bottom: 12px;
    line-height: 1.5;
    word-break: break-word;
  }
  .source-text.truncated::after {
    content: ' [原文已截断]';
    color: #f59e0b;
    font-size: 11px;
  }
  .loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #94a3b8;
    font-size: 13px;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid #e2e8f0;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .result-text {
    font-size: 15px;
    color: #1e1b4b;
    font-weight: 500;
    line-height: 1.6;
    margin-bottom: 12px;
    word-break: break-word;
  }
  .error {
    color: #dc3545;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn {
    padding: 4px 12px;
    font-size: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    line-height: 1.5;
  }
  .btn:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
  .btn-copied {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #86efac;
  }
</style>
<div class="popup" id="popup">
  <div class="section-label">原文</div>
  <div class="source-text" id="source"></div>
  <div id="loading">
    <div class="loading">
      <div class="spinner"></div>
      <span>翻译中...</span>
    </div>
  </div>
  <div id="result" style="display:none">
    <div class="section-label">译文</div>
    <div class="result-text" id="resultText"></div>
    <div class="actions">
      <button class="btn" id="copyBtn">复制</button>
    </div>
  </div>
  <div id="error" style="display:none">
    <div class="section-label">译文</div>
    <div class="error">
      <span id="errorText"></span>
      <button class="btn" id="retryBtn">重试</button>
    </div>
  </div>
</div>
`;

const MAX_TEXT_LENGTH = 5000;

document.addEventListener('mouseup', (event) => {
  setTimeout(() => handleSelection(event), 0);
});

function handleSelection(event: MouseEvent) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    return;
  }

  if (isInsideWidget(event.target as HTMLElement)) {
    return;
  }

  const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  currentText = truncated;
  savedRect = selection.getRangeAt(0).getBoundingClientRect();
  removePopup();
  showIcon();
}

function isInsideWidget(target: HTMLElement): boolean {
  return !!(iconHost && iconHost.contains(target)) || !!(popupHost && popupHost.contains(target));
}

function showIcon() {
  if (!savedRect) return;
  removeIcon();

  const rect = savedRect;

  iconHost = document.createElement('div');
  iconHost.id = '__trans-icon-host';
  const shadow = iconHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = ICON_HTML;
  document.body.appendChild(iconHost);

  iconHost.style.cssText = `
    position: fixed;
    z-index: 2147483646;
    left: ${rect.right + 4}px;
    top: ${rect.top - 28}px;
  `;

  shadow.getElementById('transIcon')!.addEventListener('click', (e) => {
    e.stopPropagation();
    removeIcon();
    showPopup(currentText!);
  });
}

function showPopup(text: string) {
  if (!savedRect) return;
  const rect = savedRect;
  const x = rect.left + rect.width / 2;
  const y = rect.bottom + 8;

  removePopup();

  popupHost = document.createElement('div');
  popupHost.id = '__trans-popup-host';
  const shadow = popupHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = POPUP_HTML;
  document.body.appendChild(popupHost);
  bindPopupEvents(shadow);

  popupHost.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    left: ${x}px;
    top: ${y}px;
    transform: translateX(-50%);
  `;

  getEl(shadow, 'source').textContent = text;
  updatePopupState(shadow, 'loading');
  requestTranslation(text, shadow);
}

function getEl(shadow: ShadowRoot, id: string): HTMLElement {
  return shadow.getElementById(id)!;
}

function updatePopupState(shadow: ShadowRoot, state: 'loading' | 'result' | 'error', translatedText?: string, errorText?: string) {
  const loadingEl = getEl(shadow, 'loading');
  const resultEl = getEl(shadow, 'result');
  const errorEl = getEl(shadow, 'error');

  loadingEl.style.display = state === 'loading' ? 'block' : 'none';
  resultEl.style.display = state === 'result' ? 'block' : 'none';
  errorEl.style.display = state === 'error' ? 'block' : 'none';

  if (state === 'result' && translatedText) {
    getEl(shadow, 'resultText').textContent = translatedText;
  }
  if (state === 'error' && errorText) {
    getEl(shadow, 'errorText').textContent = errorText;
  }
}

function bindPopupEvents(shadow: ShadowRoot) {
  getEl(shadow, 'copyBtn').addEventListener('click', () => {
    const text = getEl(shadow, 'resultText').textContent;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = getEl(shadow, 'copyBtn');
        btn.textContent = '已复制';
        btn.classList.add('btn-copied');
        setTimeout(() => {
          btn.textContent = '复制';
          btn.classList.remove('btn-copied');
        }, 2000);
      });
    }
  });

  getEl(shadow, 'retryBtn').addEventListener('click', () => {
    if (currentText) {
      updatePopupState(shadow, 'loading');
      requestTranslation(currentText, shadow);
    }
  });
}

function requestTranslation(text: string, shadow: ShadowRoot) {
  chrome.runtime.sendMessage({ type: 'TRANSLATE', text }, (response) => {
    if (!popupHost) return;

    if (chrome.runtime.lastError) {
      updatePopupState(shadow, 'error', undefined, '翻译请求失败: ' + chrome.runtime.lastError.message);
    } else if (response?.success) {
      updatePopupState(shadow, 'result', response.translated);
    } else {
      updatePopupState(shadow, 'error', undefined, response?.error || '翻译失败');
    }
  });
}

function removeIcon() {
  if (iconHost) {
    iconHost.remove();
    iconHost = null;
  }
}

function removePopup() {
  if (popupHost) {
    popupHost.remove();
    popupHost = null;
  }
}

document.addEventListener('click', (event) => {
  const target = event.target as Node;
  if (iconHost && !iconHost.contains(target)) {
    removeIcon();
    savedRect = null;
  }
  if (popupHost && !popupHost.contains(target)) {
    removePopup();
    currentText = null;
    savedRect = null;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    removeIcon();
    removePopup();
    currentText = null;
    savedRect = null;
  }
});
