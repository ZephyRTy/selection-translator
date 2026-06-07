export interface AppConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  targetLang: string;
}

const defaultConfig: AppConfig = {
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  systemPrompt: '你是一个翻译助手，将用户输入的文本翻译成{target}，只输出译文不要解释。',
  targetLang: 'zh-CN',
};

export async function getConfig(): Promise<AppConfig> {
  const result = await chrome.storage.sync.get('config');
  if (result.config) {
    return { ...defaultConfig, ...result.config };
  }
  return defaultConfig;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await chrome.storage.sync.set({ config });
}
