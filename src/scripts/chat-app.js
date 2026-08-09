// AI 助手前端逻辑：对话 / 生图 / 主题切换 / 设置 / 本地存储
const STORAGE_KEY = 'gpt_clone_v1';
const THEME_KEY = 'gpt_clone_theme';

const $ = (sel) => document.querySelector(sel);

const els = {
  newChat: $('#new-chat-btn'),
  convList: $('#conv-list'),
  menuBtn: $('#menu-btn'),
  sidebarOverlay: $('#sidebar-overlay'),
  topbarTitle: $('#topbar-title'),
  themeToggle: $('#theme-toggle'),
  settingsBtn: $('#settings-btn'),
  emptyState: $('#empty-state'),
  messages: $('#messages'),
  chatArea: $('#chat-area'),
  input: $('#input'),
  sendBtn: $('#send-btn'),
  uploadBtn: $('#upload-btn'),
  uploadInput: $('#upload-input'),
  imagePreview: $('#image-preview'),
  previewImg: $('#preview-img'),
  previewRemove: $('#preview-remove'),
  modeSwitch: $('#mode-switch'),
  settingsModal: $('#settings-modal'),
  closeSettings: $('#close-settings'),
  saveSettings: $('#save-settings'),
  clearData: $('#clear-data-btn'),
  chatUrl: $('#chat-url'),
  chatKey: $('#chat-key'),
  chatModel: $('#chat-model'),
  imageUrl: $('#image-url'),
  imageKey: $('#image-key'),
  imageModel: $('#image-model'),
  toast: $('#toast'),
};

// ---------- 图标 ----------
const ICONS = {
  sun: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
};
const ICON_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';

// 生成图片操作按钮（编辑 / 下载），hover 时显示
function makeImgAction(className, title, icon, handler) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  btn.innerHTML = icon;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    handler();
  });
  return btn;
}

// ---------- 状态 ----------
let settings = {
  chat: { apiUrl: '', apiKey: '', model: 'gpt-5.5' },
  image: { apiUrl: '', apiKey: '', model: 'gpt-image-2' },
};
let conversations = [];
let activeId = null;
let sending = false;
let toastTimer = null;
let uploadedImage = null; // 生图模式上传的图片（压缩后的 data URL）

// ---------- 本地存储 ----------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      settings = {
        chat: { ...settings.chat, ...(data.settings?.chat || {}) },
        image: { ...settings.image, ...(data.settings?.image || {}) },
      };
      conversations = Array.isArray(data.conversations) ? data.conversations : [];
      activeId = data.activeId || null;
    }
  } catch (e) {
    console.error('读取本地数据失败', e);
  }
  if (conversations.length === 0) {
    conversations = [createConversation()];
  }
  if (!activeId || !conversations.some((c) => c.id === activeId)) {
    activeId = conversations[0].id;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, conversations, activeId }));
}

// ---------- 工具 ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createConversation() {
  return { id: uid(), title: '新对话', mode: 'chat', messages: [], createdAt: Date.now() };
}

function getActive() {
  return conversations.find((c) => c.id === activeId) || null;
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

// ---------- 主题 ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  els.themeToggle.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  let theme = 'light';
  try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
  applyTheme(theme);
}

// ---------- 渲染 ----------
function renderSidebar() {
  els.convList.innerHTML = '';
  for (const conv of conversations) {
    const item = document.createElement('div');
    item.className = 'conv-item' + (conv.id === activeId ? ' active' : '');
    item.dataset.id = conv.id;

    const title = document.createElement('div');
    title.className = 'conv-title';
    title.textContent = conv.title;
    title.title = conv.title;

    const del = document.createElement('button');
    del.className = 'conv-delete';
    del.title = '删除对话';
    del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });

    item.appendChild(title);
    item.appendChild(del);
    item.addEventListener('click', () => setActive(conv.id));
    els.convList.appendChild(item);
  }
}

function renderMessages() {
  const conv = getActive();
  els.messages.innerHTML = '';
  if (!conv) return;
  for (const msg of conv.messages) {
    els.messages.appendChild(createMessageEl(msg));
  }
  scrollToBottom();
}

function createMessageEl(msg) {
  const row = document.createElement('div');
  row.className = 'msg-row ' + (msg.role === 'user' ? 'user' : 'assistant') + (msg.error ? ' msg-error' : '');
  row.dataset.mid = msg.id || '';

  const isUser = msg.role === 'user';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + (isUser ? 'user' : 'bot');
  avatar.title = isUser ? '你' : 'AI';
  avatar.innerHTML = isUser
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4m0 0h-2m2 0h2"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17h6"/></svg>';

  const content = document.createElement('div');
  content.className = 'msg-content';

  if (!msg.pending && msg.image) {
    const wrap = document.createElement('div');
    wrap.className = 'img-wrap';
    const img = document.createElement('img');
    img.className = 'msg-image';
    img.src = msg.image;
    img.alt = '上传图片';
    img.addEventListener('click', () => openLightbox(msg.image));
    const edit = makeImgAction('img-edit', '编辑这张图片', ICON_EDIT, () => editImage(msg.image));
    const dl = makeImgAction('img-download', '下载图片', ICON_DOWNLOAD, () => downloadImage(msg.image));
    wrap.appendChild(img);
    wrap.appendChild(edit);
    wrap.appendChild(dl);
    content.appendChild(wrap);
  }

  if (msg.pending) {
    const p = document.createElement('div');
    p.className = 'pending';
    p.textContent = msg.type === 'image' ? '正在生成图片，请稍候...' : '正在思考...';
    content.appendChild(p);
  } else if (msg.type === 'image' && (msg.images || []).length) {
    const label = document.createElement('div');
    label.className = 'msg-image-label';
    label.textContent = '生成的图片';
    content.appendChild(label);
    for (const url of msg.images) {
      const wrap = document.createElement('div');
      wrap.className = 'img-wrap';
      const img = document.createElement('img');
      img.className = 'msg-image';
      img.src = url;
      img.alt = '生成图片';
      img.addEventListener('click', () => openLightbox(url));
      const edit = makeImgAction('img-edit', '编辑这张图片', ICON_EDIT, () => editImage(url));
      const dl = makeImgAction('img-download', '下载图片', ICON_DOWNLOAD, () => downloadImage(url));
      wrap.appendChild(img);
      wrap.appendChild(edit);
      wrap.appendChild(dl);
      content.appendChild(wrap);
    }
  } else {
    const t = document.createElement('div');
    t.className = 'msg-text';
    t.textContent = msg.content || '';
    content.appendChild(t);
  }

  row.appendChild(avatar);
  row.appendChild(content);
  return row;
}

function renderAll() {
  renderSidebar();
  const conv = getActive();
  els.topbarTitle.textContent = conv ? conv.title : '';
  els.emptyState.hidden = !conv || conv.messages.length > 0;
  els.messages.hidden = !conv || conv.messages.length === 0;
  renderMessages();
  updateModeUI(conv ? conv.mode : 'chat');
}

function scrollToBottom() {
  els.chatArea.scrollTop = els.chatArea.scrollHeight;
}

// ---------- 图片查看 / 下载 ----------
function openLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '查看图片';
  img.addEventListener('click', (e) => e.stopPropagation());
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', close);
  const esc = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', esc);
    }
  };
  document.addEventListener('keydown', esc);
}

function downloadImage(url) {
  const fallback = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'image-' + Date.now() + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  // 先尝试以 blob 方式下载（跨域图片若允许 CORS 也能正常保存）
  fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'image-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    })
    .catch(fallback);
}

// 把历史消息中的图片重新加入输入框，继续编辑
function editImage(src) {
  const conv = getActive();
  if (!conv) return;
  if (conv.mode !== 'image') switchMode('image');
  uploadedImage = src;
  els.previewImg.src = src;
  els.imagePreview.hidden = false;
  els.input.focus();
}

// ---------- 对话切换 / 新建 / 删除 ----------
// 移动端抽屉侧边栏
function closeSidebar() {
  document.body.classList.remove('menu-open');
}

function setActive(id) {
  if (sending) return;
  activeId = id;
  saveData();
  renderAll();
  closeSidebar();
}

function newConversationHandler() {
  if (sending) return;
  const conv = createConversation();
  conversations.push(conv);
  activeId = conv.id;
  saveData();
  renderAll();
  els.input.focus();
  closeSidebar();
}

function deleteConversation(id) {
  if (sending) return;
  if (!confirm('确定删除该对话吗？')) return;
  conversations = conversations.filter((c) => c.id !== id);
  if (conversations.length === 0) conversations.push(createConversation());
  if (activeId === id) activeId = conversations[0].id;
  saveData();
  renderAll();
}

// ---------- 模式切换 ----------
function updateModeUI(mode) {
  els.modeSwitch.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const isImage = mode === 'image';
  els.uploadBtn.hidden = !isImage;
  if (!isImage && uploadedImage) clearUploadedImage();
  els.input.placeholder = isImage ? '描述你想生成的图片，可上传参考图...' : '给 AI 发送消息...';
}

function switchMode(mode) {
  const conv = getActive();
  if (conv) {
    conv.mode = mode;
    saveData();
  }
  updateModeUI(mode);
}

// ---------- 图片上传 ----------
// 读取图片并压缩为 data URL（限制最长边，控制请求体积）
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const isPng = file.type === 'image/png';
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function handleUploadedFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('请选择图片文件');
    return;
  }
  compressImage(file, 1024, 0.85)
    .then((dataUrl) => {
      uploadedImage = dataUrl;
      els.previewImg.src = dataUrl;
      els.imagePreview.hidden = false;
    })
    .catch((e) => toast(e.message || '图片处理失败'));
}

function clearUploadedImage() {
  uploadedImage = null;
  els.imagePreview.hidden = true;
  els.previewImg.removeAttribute('src');
  els.uploadInput.value = '';
}

// ---------- API 调用 ----------
// 统一走本地 /api 代理（服务端转发到 AI 接口），避免浏览器跨域问题

// 对话：流式输出
async function* streamChat(messages, cfg) {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, model: cfg.model, messages }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error('请求失败 (' + resp.status + ')：' + (text.slice(0, 300) || resp.statusText));
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) yield delta;
      } catch (e) { /* 忽略无法解析的片段 */ }
    }
  }
}

// 生图：一次请求返回图片 URL（或 base64）；可携带上传的参考图（图生图/图片编辑）
async function generateImage(prompt, cfg, imageDataUrl) {
  const resp = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey, model: cfg.model, prompt, image: imageDataUrl || null }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error('请求失败 (' + resp.status + ')：' + (text.slice(0, 300) || resp.statusText));
  }
  const data = await resp.json();
  const items = Array.isArray(data.data) ? data.data : [];
  return items.map((it) => {
    if (it.url) return it.url;
    if (it.b64_json) return 'data:image/png;base64,' + it.b64_json;
    return null;
  }).filter(Boolean);
}

// ---------- 发送 ----------
function validateConfig(mode) {
  const cfg = mode === 'image' ? settings.image : settings.chat;
  if (!cfg.apiUrl || !cfg.apiKey) {
    toast('请先在设置中填写' + (mode === 'image' ? '生图' : '对话') + '的 API 地址和 Key');
    openSettings();
    return false;
  }
  return true;
}

async function send() {
  const conv = getActive();
  if (!conv || sending) return;
  const text = els.input.value.trim();
  const isImageMode = conv.mode === 'image';
  // 生图模式支持"只传图片不写文字"，其余情况必须有内容
  if (!text && !(isImageMode && uploadedImage)) return;
  if (!validateConfig(conv.mode)) return;

  els.input.value = '';
  autoResize();
  sending = true;
  els.sendBtn.disabled = true;

  const userMsg = { id: uid(), role: 'user', type: 'text', content: text, image: isImageMode ? uploadedImage : null };
  if (uploadedImage) clearUploadedImage();
  conv.messages.push(userMsg);
  if (conv.title === '新对话' && text) conv.title = text.slice(0, 24);
  saveData();
  renderAll();

  const assistantMsg = { id: uid(), role: 'assistant', type: conv.mode === 'image' ? 'image' : 'text', content: '', images: [], pending: true };
  conv.messages.push(assistantMsg);
  const liveEl = createMessageEl(assistantMsg);
  els.messages.appendChild(liveEl);
  scrollToBottom();

  try {
    if (conv.mode === 'image') {
      const urls = await generateImage(text || '根据上传的参考图进行编辑', settings.image, userMsg.image);
      if (urls.length === 0) throw new Error('未返回图片');
      assistantMsg.images = urls;
      assistantMsg.pending = false;
    } else {
      const history = conv.messages
        .filter((m) => m.role !== 'assistant' || !m.pending)
        .map((m) => ({ role: m.role, content: m.content }));
      const textEl = liveEl.querySelector('.msg-content .pending');
      if (textEl) {
        textEl.classList.remove('pending');
        textEl.classList.add('msg-text');
      }
      for await (const delta of streamChat(history, settings.chat)) {
        assistantMsg.content += delta;
        if (textEl) textEl.textContent = assistantMsg.content;
        scrollToBottom();
      }
      assistantMsg.pending = false;
      if (!assistantMsg.content) throw new Error('返回内容为空');
    }
  } catch (err) {
    assistantMsg.pending = false;
    assistantMsg.error = true;
    assistantMsg.content = (assistantMsg.content ? assistantMsg.content + '\n\n' : '') + '⚠️ ' + (err.message || '请求失败');
  } finally {
    sending = false;
    els.sendBtn.disabled = false;
    saveData();
    renderSidebar();
    renderMessages();
    scrollToBottom();
  }
}

// ---------- 设置弹窗 ----------
function openSettings() {
  els.chatUrl.value = settings.chat.apiUrl || '';
  els.chatKey.value = settings.chat.apiKey || '';
  els.chatModel.value = settings.chat.model || '';
  els.imageUrl.value = settings.image.apiUrl || '';
  els.imageKey.value = settings.image.apiKey || '';
  els.imageModel.value = settings.image.model || '';
  els.settingsModal.hidden = false;
}

function closeSettings() {
  els.settingsModal.hidden = true;
}

function saveSettings() {
  settings.chat = {
    apiUrl: els.chatUrl.value.trim(),
    apiKey: els.chatKey.value.trim(),
    model: els.chatModel.value.trim() || 'gpt-5.5',
  };
  settings.image = {
    apiUrl: els.imageUrl.value.trim(),
    apiKey: els.imageKey.value.trim(),
    model: els.imageModel.value.trim() || 'gpt-image-2',
  };
  saveData();
  closeSettings();
  toast('设置已保存');
}

function clearData() {
  if (!confirm('确定清除浏览器中保存的所有信息吗？\n（包括 API 设置与全部对话记录）')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(THEME_KEY);
  location.reload();
}

// ---------- 输入框 ----------
function autoResize() {
  els.input.style.height = 'auto';
  els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px';
}

// ---------- 事件绑定 ----------
function bindEvents() {
  els.themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  els.settingsBtn.addEventListener('click', openSettings);
  els.closeSettings.addEventListener('click', closeSettings);
  els.saveSettings.addEventListener('click', saveSettings);
  els.clearData.addEventListener('click', clearData);
  els.settingsModal.addEventListener('click', (e) => {
    if (e.target === els.settingsModal) closeSettings();
  });

  els.newChat.addEventListener('click', newConversationHandler);
  // 移动端抽屉侧边栏开关
  els.menuBtn.addEventListener('click', () => {
    document.body.classList.toggle('menu-open');
  });
  els.sidebarOverlay.addEventListener('click', closeSidebar);
  els.sendBtn.addEventListener('click', send);
  els.uploadBtn.addEventListener('click', () => els.uploadInput.click());
  els.uploadInput.addEventListener('change', () => handleUploadedFile(els.uploadInput.files[0]));
  els.previewRemove.addEventListener('click', clearUploadedImage);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  els.input.addEventListener('input', autoResize);

  els.modeSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (btn) switchMode(btn.dataset.mode);
  });
}

// ---------- 初始化 ----------
initTheme();
loadData();
renderAll();
bindEvents();
els.input.focus();
