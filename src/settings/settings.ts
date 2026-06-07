import { getConfig, saveConfig } from '../utils/storage';
import type { AppConfig } from '../utils/storage';

const form = document.getElementById('settingsForm') as HTMLFormElement;
const toast = document.getElementById('toast')!;
const testBtn = document.getElementById('testBtn')!;
const testResult = document.getElementById('testResult')!;
const toggleKeyBtn = document.getElementById('toggleKey')!;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;

async function init() {
  const config = await getConfig();
  (document.getElementById('endpoint') as HTMLInputElement).value = config.endpoint;
  (document.getElementById('apiKey') as HTMLInputElement).value = config.apiKey;
  (document.getElementById('model') as HTMLInputElement).value = config.model;
  (document.getElementById('systemPrompt') as HTMLTextAreaElement).value = config.systemPrompt;
  (document.getElementById('targetLang') as HTMLSelectElement).value = config.targetLang;
}

function readForm(): AppConfig {
  return {
    endpoint: (document.getElementById('endpoint') as HTMLInputElement).value.trim(),
    apiKey: (document.getElementById('apiKey') as HTMLInputElement).value.trim(),
    model: (document.getElementById('model') as HTMLInputElement).value.trim(),
    systemPrompt: (document.getElementById('systemPrompt') as HTMLTextAreaElement).value.trim(),
    targetLang: (document.getElementById('targetLang') as HTMLSelectElement).value,
  };
}

function showToast(message: string, type: 'success' | 'error') {
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const config = readForm();

  if (!config.endpoint) {
    showToast('请输入 API Endpoint', 'error');
    return;
  }

  await saveConfig(config);
  showToast('配置已保存', 'success');
});

testBtn.addEventListener('click', async () => {
  const config = readForm();

  if (!config.apiKey) {
    showToast('请先填写 API Key', 'error');
    return;
  }

  if (!config.endpoint) {
    showToast('请先填写 API Endpoint', 'error');
    return;
  }

  testResult.style.display = 'block';
  testResult.className = 'test-result loading';
  testResult.textContent = '测试中...';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'Reply with exactly: ok' },
          { role: 'user', content: 'hi' },
        ],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      testResult.className = 'test-result success';
      testResult.textContent = '连接成功！API 配置正确。';
    } else {
      const errorText = await response.text().catch(() => '');
      testResult.className = 'test-result error';
      testResult.textContent = `连接失败 (${response.status}): ${errorText}`;
    }
  } catch (err: unknown) {
    testResult.className = 'test-result error';
    if (err instanceof DOMException && err.name === 'AbortError') {
      testResult.textContent = '连接超时，请检查网络或 API 地址';
    } else {
      testResult.textContent = `连接失败: ${err instanceof Error ? err.message : '未知错误'}`;
    }
  }
});

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.textContent = isPassword ? '🙈' : '👁';
});

init();
