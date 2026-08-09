// 拼接完整 API 地址：若已包含后缀则原样使用，否则追加
export function buildUrl(base, suffix) {
  const url = (base || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  return url.toLowerCase().includes(suffix) ? url : url + suffix;
}
