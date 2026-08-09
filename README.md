# AI 助手（ChatGPT 风格）

基于 **Astro 5** 构建的 ChatGPT 风格 Web 应用，支持对话与 AI 生图，数据全部保存在浏览器本地。

## 功能特性

- 💬 **对话模式**：流式输出（SSE），ChatGPT 风格消息布局（AI 左 / 用户右，带头像）
- 🎨 **生图模式**：AI 生图、上传参考图（图生图 / 图片编辑）
- 🖼️ **图片能力**：
  - 点击图片全屏灯箱查看
  - 所有图片统一提供「下载」和「编辑」按钮
  - 编辑按钮可把图片重新加入输入框继续生成
- 🌙 **日夜主题切换**（默认白天，持久化保存）
- ⚙️ **设置弹窗**：对话与生图两套 API 配置（地址 / Key / 模型），存浏览器
- 💾 **本地存储**：对话记录、API 设置、主题均保存在 localStorage，并提供一键清除
- 📁 **多对话管理**：左侧栏新建 / 切换 / 删除对话

## 技术栈

- [Astro 5](https://astro.build/)（SSR 模式 + `@astrojs/node` 适配器）
- 原生 JavaScript（无前端框架）
- 纯 CSS 变量实现主题切换

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（默认 http://localhost:4321）
npm run dev

# 生产构建
npm run build

# 本地预览构建产物
npm run preview
```

> 国内网络可先切换 npm 镜像源：
> `npm config set registry https://registry.npmmirror.com`

## 使用说明

1. 打开页面后点击右上角 **设置** 按钮
2. 分别填写「对话配置」和「生图配置」的 API 地址、Key 与模型
   - 对话示例：`https://api.openai.com/v1`，模型如 `gpt-4o-mini`
   - 生图示例：`https://api.openai.com/v1`，模型如 `gpt-image-1`
3. 点击保存即可开始对话或生图

### 生图模式

- 切换到「生图」标签，输入描述生成图片
- 可点击图片图标上传参考图，实现图生图 / 图片编辑（走 `/images/edits` 接口）
- 支持只传图不写文字（自动使用默认提示词）

## 跨域解决方案

浏览器直连外部 AI API 会触发跨域限制，本项目采用 **SSR + 服务端代理**：

- 前端统一请求同源 `/api/chat`、`/api/image`
- Node 服务端在 [src/pages/api](src/pages/api) 中转发到上游 AI 接口，并透传 SSE 流

### 代理端点

| 端点 | 上游接口 | 说明 |
| --- | --- | --- |
| `POST /api/chat` | `/chat/completions` | 对话，流式转发 SSE |
| `POST /api/image` | `/images/generations` / `/images/edits` | 生图；带图时走 edits（multipart） |

API 地址拼接规则见 [src/lib/api-utils.js](src/lib/api-utils.js)：已包含对应后缀则原样使用，否则自动追加。

## 目录结构

```
├── astro.config.mjs          # SSR 配置（output: server + node 适配器）
├── package.json
└── src
    ├── pages
    │   ├── index.astro       # 主页面（HTML 结构）
    │   └── api
    │       ├── chat.js       # 对话代理端点（SSE 流式转发）
    │       └── image.js      # 生图代理端点（JSON / multipart）
    ├── scripts
    │   └── chat-app.js       # 前端全部交互逻辑
    ├── styles
    │   └── global.css        # 全局样式（主题变量、布局、组件）
    └── lib
        └── api-utils.js      # API 地址拼接工具
```

## 数据存储

所有数据存于浏览器 localStorage：

- `gpt_clone_v1`：API 设置 + 对话记录 + 当前会话
- `gpt_clone_theme`：主题偏好

可在设置弹窗底部点击「清除浏览器中保存的信息」一键清空并刷新。

## 注意事项

- API Key 仅保存在本地浏览器，并由服务端代理转发，不会暴露在前端日志之外
- 生成/上传的图片在本地仅存数据引用，未持久化到服务器
- 对话内容由 AI 生成，请自行甄别
