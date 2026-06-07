let popupHost: HTMLDivElement | null = null;
let currentText: string | null = null;

const POPUP_HTML = `
<style>
  :host {
    all: initial;
  }
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
  .btn-primary {
    background: #4f46e5;
    color: #ffffff;
    border-color: #4f46e5;
  }
  .btn-primary:hover {
    background: #4338ca;
    border-color: #4338ca;
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
    removePopup();
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    removePopup();
    return;
  }

  if (isClickInsidePopup(event.target as HTMLElement)) {
    return;
  }

  const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  showPopup(truncated, selection);
}

function isClickInsidePopup(target: HTMLElement): boolean {
  return !!(popupHost && popupHost.contains(target));
}

function getPopupPosition(selection: Selection): { x: number; y: number } {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.bottom + window.scrollY + 8,
  };
}

function showPopup(text: string, selection: Selection) {
  const { x, y } = getPopupPosition(selection);
  currentText = text;

  if (!popupHost) {
    popupHost = document.createElement('div');
    popupHost.id = '__trans-popup-host';
    const shadow = popupHost.attachShadow({ mode: 'open' });
    shadow.innerHTML = POPUP_HTML;
    document.body.appendChild(popupHost);
    bindPopupEvents(shadow);
  }

  popupHost.style.cssText = `
    position: absolute;
    z-index: 2147483647;
    left: ${x}px;
    top: ${y}px;
    transform: translateX(-50%);
  `;

  updateState('loading');
  requestTranslation(text);
}

function getEl(shadow: ShadowRoot, id: string): HTMLElement {
  return shadow.getElementById(id)!;
}

function updateState(state: 'loading' | 'result' | 'error', translatedText?: string, errorText?: string) {
  if (!popupHost) return;
  const shadow = popupHost.shadowRoot;
  if (!shadow) return;

  const sourceEl = getEl(shadow, 'source');
  const loadingEl = getEl(shadow, 'loading');
  const resultEl = getEl(shadow, 'result');
  const errorEl = getEl(shadow, 'error');

  const truncated = currentText && currentText.length > MAX_TEXT_LENGTH;
  sourceEl.textContent = truncated ? (currentText || '').slice(0, MAX_TEXT_LENGTH) : (currentText || '');
  sourceEl.className = truncated ? 'source-text truncated' : 'source-text';

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
      updateState('loading');
      requestTranslation(currentText);
    }
  });
}

function requestTranslation(text: string) {
  chrome.runtime.sendMessage({ type: 'TRANSLATE', text }, (response) => {
    if (!popupHost) return;

    if (chrome.runtime.lastError) {
      updateState('error', undefined, '翻译请求失败: ' + chrome.runtime.lastError.message);
    } else if (response?.success) {
      updateState('result', response.translated);
    } else {
      updateState('error', undefined, response?.error || '翻译失败');
    }
  });
}

function removePopup() {
  if (popupHost) {
    popupHost.remove();
    popupHost = null;
    currentText = null;
  }
}

document.addEventListener('click', (event) => {
  if (popupHost && !popupHost.contains(event.target as Node)) {
    removePopup();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && popupHost) {
    removePopup();
  }
});
