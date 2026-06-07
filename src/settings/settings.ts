import { getConfig, saveConfig } from '../utils/storage';
import type { AppConfig } from '../utils/storage';

const form = document.getElementById('settingsForm') as HTMLFormElement;
const toast = document.getElementById('toast')!;
const testBtn = document.getElementById('testBtn')!;
const testResult = document.getElementById('testResult')!;
const toggleKeyBtn = document.getElementById('toggleKey')!;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const fetchModelsBtn = document.getElementById('fetchModelsBtn') as HTMLButtonElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const modelList = document.getElementById('modelList') as HTMLDataListElement;

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

fetchModelsBtn.addEventListener('click', async () => {
  const config = readForm();

  if (!config.endpoint) {
    showToast('请先填写 API Endpoint', 'error');
    return;
  }

  fetchModelsBtn.textContent = '获取中...';
  fetchModelsBtn.disabled = true;

  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const endpoint = config.endpoint.replace(/\/+$/, '');
    const response = await fetch(`${endpoint}/models`, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      showToast(`获取失败 (${response.status})，此 API 可能不支持模型列表接口`, 'error');
      return;
    }

    const data = await response.json();
    const models: string[] = (data.data || [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id);

    if (models.length === 0) {
      showToast('未获取到模型列表', 'error');
      return;
    }

    modelList.innerHTML = models
      .sort()
      .map((m) => `<option value="${m}">`)
      .join('');

    if (!modelInput.value || !models.includes(modelInput.value)) {
      const preferred = models.find((m) =>
        m.includes('gpt-4o-mini') || m.includes('deepseek-chat') || m.includes('qwen')
      );
      if (preferred) modelInput.value = preferred;
    }

    showToast(`已获取 ${models.length} 个模型`, 'success');
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      showToast('请求超时', 'error');
    } else {
      showToast('获取模型列表失败', 'error');
    }
  } finally {
    fetchModelsBtn.textContent = '获取模型';
    fetchModelsBtn.disabled = false;
  }
});

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.textContent = isPassword ? '🙈' : '👁';
});

init();
