import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// 静态 + SSR 混合：页面默认静态预渲染（生成 index.html），API 端点通过 prerender=false 走服务端渲染（@astrojs/node 独立模式）
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  server: {
    // 监听所有网卡，保证容器化部署下平台能访问到应用
    host: true,
  },
});
