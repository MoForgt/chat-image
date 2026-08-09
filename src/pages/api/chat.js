import { buildUrl } from '../../lib/api-utils.js';

// Hybrid 模式下强制该端点服务端渲染（不做静态预渲染）
export const prerender = false;

// 对话代理：把前端的对话请求转发到上游 /chat/completions，并把 SSE 流原样回传
export async function POST({ request }) {
  try {
    const { apiUrl, apiKey, model, messages } = await request.json();
    const url = buildUrl(apiUrl, '/chat/completions');
    if (!url) {
      return new Response(JSON.stringify({ error: '未配置 API 地址' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (apiKey || '').trim(),
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return new Response(text || upstream.statusText, { status: upstream.status });
    }

    const reader = upstream.body.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || '代理请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
