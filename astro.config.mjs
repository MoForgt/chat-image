import { defineConfig } from 'astro/config';
import edgeone from '@edgeone/astro';

// Astro 5 静态模式：页面静态预渲染（生成 index.html），API 端点保持服务端渲染（带 adapter）
export default defineConfig({
  output: 'static',
  adapter: edgeone(),
});
