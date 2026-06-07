# 划词翻译浏览器插件 — 设计文档

## 概述

一款 Chromium 划词翻译浏览器插件。用户选中网页文本后，在选区附近弹出翻译弹窗，通过 OpenAI 兼容 API 进行 AI 翻译。支持自定义 API 配置和目标语言选择。

## 技术栈

- **平台**: Chrome/Edge (Chromium), Manifest V3
- **语言**: TypeScript
- **构建**: Vite + @crxjs/vite-plugin
- **弹窗隔离**: Shadow DOM
- **存储**: chrome.storage.sync

## 项目结构

```
trans/
├── src/
│   ├── manifest.json
│   ├── content/
│   │   ├── content.ts          # 监听划词、注入弹窗
│   │   └── popup/
│   │       ├── index.html      # 弹窗 HTML
│   │       ├── popup.ts        # 弹窗逻辑
│   │       └── popup.css       # 弹窗样式 (Shadow DOM)
│   ├── background/
│   │   └── service-worker.ts   # 转发 API 请求
│   ├── settings/
│   │   ├── index.html          # 选项页面
│   │   ├── settings.ts
│   │   └── settings.css
│   ├── utils/
│   │   ├── translator.ts       # OpenAI 翻译调用
│   │   └── storage.ts          # chrome.storage 封装
│   └── assets/
│       └── icons/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 核心流程

### 用户操作

```
选中文本 → 鼠标松开 → 显示翻译弹窗 → 点击外部/ESC → 关闭弹窗
                         ↳ 加载中... → 展示译文
```

### 数据流

```
[页面划词]
    ↓ mouseup
[Content Script] 获取选中文本、计算位置
    ↓ chrome.runtime.sendMessage
[Service Worker] 读取 API 配置
    ↓ fetch
[OpenAI API] Chat Completions
    ↓
[Service Worker] → Content Script
    ↓
[Shadow DOM 弹窗] 渲染译文
```

## 组件说明

### Content Script

- 监听 `mouseup` 事件
- 获取 `window.getSelection()` 选中文本
- 校验：非空、不超过 5000 字符
- 计算弹窗位置（选区下方居中）
- 创建 Shadow DOM Host，渲染弹窗
- `document.addEventListener('click')` 关闭弹窗
- `keydown ESC` 关闭弹窗
- 通过 `chrome.runtime.sendMessage` 请求翻译

### Service Worker

- 接收翻译请求 `{text, targetLang}`
- 从 `chrome.storage.sync` 读取 API 配置
- 调用 OpenAI Chat Completions API
- 返回译文给 Content Script
- 15 秒超时

### 弹窗组件 (Shadow DOM)

三种状态：

| 状态 | 内容 |
|------|------|
| 加载中 | 原文 + 旋转动画 + "翻译中..." |
| 翻译结果 | 原文 + 译文(加粗) + 复制按钮 |
| 错误 | 原文 + 错误提示 + 重试按钮 |

交互：
- 复制按钮 → 复制译文，按钮变为 "已复制 ✓"
- 点击外部/ESC → 150ms 淡出
- 新选中文本 → 旧弹窗直接替换

### 设置页面

单页表单，字段：

| 字段 | 类型 | 默认值 |
|------|------|--------|
| API Endpoint | text | `https://api.openai.com/v1` |
| API Key | password | 空 |
| Model | text | `gpt-4o-mini` |
| System Prompt | textarea | 翻译助手提示词 |
| Target Language | select | zh-CN |

带"测试连接"按钮和自动保存提示。

## 数据结构

```ts
interface AppConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  targetLang: string;
}

interface TranslateRequest {
  text: string;
  targetLang: string;
}
```

## 错误处理

| 场景 | 处理 |
|------|------|
| 未配置 API Key | 弹窗提示 "请先配置 API Key"，带设置页链接 |
| 网络错误/超时 | 弹窗显示错误 + 重试按钮 (15s 超时) |
| API 返回 4xx/5xx | 显示 API 错误信息 |
| 选中文本为空/纯空格 | 不触发弹窗 |
| 选中文本 > 5000 字符 | 截断发送，标注 "原文已截断" |

## 目标语言选项

中文（简体）、English、日本語、한국어、Français、Deutsch、Español、Português、Русский、العربية
