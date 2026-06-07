import { getConfig } from './storage';

export async function translate(text: string): Promise<string> {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error('API Key 未配置，请在插件选项中设置。');
  }

  const basePrompt = config.systemPrompt.replace('{target}', targetLangLabel(config.targetLang));
  const thinkingSuffix = config.enableThinking
    ? '\n\n请先仔细分析原文的语境、语义和隐含含义，然后再给出准确流畅的翻译。只输出译文，分析过程不要输出。'
    : '';
  const systemPrompt = basePrompt + thinkingSuffix;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API 错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim();

    if (!translated) {
      throw new Error('翻译返回为空');
    }

    return translated;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('翻译请求超时，请检查网络或 API 服务');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function targetLangLabel(code: string): string {
  const labels: Record<string, string> = {
    'zh-CN': '简体中文',
    'en': 'English',
    'ja': '日本語',
    'ko': '한국어',
    'fr': 'Français',
    'de': 'Deutsch',
    'es': 'Español',
    'pt': 'Português',
    'ru': 'Русский',
    'ar': 'العربية',
  };
  return labels[code] || code;
}
