import { buildUrl } from '../../lib/api-utils.js';

// Hybrid 模式下强制该端点服务端渲染（不做静态预渲染）
export const prerender = false;

// 生图代理：无图走 /images/generations（JSON），带图走 /images/edits（multipart，支持图生图/图片编辑）
export async function POST({ request }) {
  try {
    const { apiUrl, apiKey, model, prompt, image } = await request.json();
    const hasImage = typeof image === 'string' && (image.startsWith('data:image/') || /^https?:\/\//i.test(image));
    const url = buildUrl(apiUrl, hasImage ? '/images/edits' : '/images/generations');
    if (!url) {
      return new Response(JSON.stringify({ error: '未配置 API 地址' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = { Authorization: 'Bearer ' + (apiKey || '').trim() };
    let body;

    if (hasImage) {
      // 图片来源：data URL 直接解出二进制；远程 URL 由服务端下载（无浏览器跨域限制）
      let buf;
      let mime = 'image/png';
      if (image.startsWith('data:')) {
        const m = image.match(/^data:(.*?);base64,(.*)$/);
        if (!m) {
          return new Response(JSON.stringify({ error: '图片数据格式不正确' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        mime = m[1];
        buf = Buffer.from(m[2], 'base64');
      } else {
        const imgResp = await fetch(image);
        if (!imgResp.ok) {
          return new Response(JSON.stringify({ error: '图片下载失败（' + imgResp.status + '）' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        buf = Buffer.from(await imgResp.arrayBuffer());
        mime = imgResp.headers.get('content-type') || mime;
      }
      const extMap = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };
      const ext = extMap[mime.split(';')[0]] || 'png';
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', prompt || '编辑这张图片');
      form.append('n', '1');
      form.append('size', '1024x1024');
      form.append('image', new Blob([buf], { type: mime.split(';')[0] }), 'upload.' + ext);
      body = form; // Content-Type（含 boundary）由 fetch 自动生成
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ model, prompt, n: 1, size: '1024x1024' });
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const data = await upstream.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || '代理请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
