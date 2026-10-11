/** API 客户端：统一错误处理（金额单位为「分」） */
async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* 忽略非 JSON */ }
  if (!res.ok) throw new Error(data.error || '请求失败，请稍后再试');
  return data;
}

export const api = {
  overview: () => req('GET', '/api/overview'),
  child: (id) => req('GET', `/api/children/${id}`),
  addChild: (b) => req('POST', '/api/children', b),
  deleteChild: (id) => req('DELETE', `/api/children/${id}`),
  addTransaction: (childId, b) => req('POST', `/api/children/${childId}/transactions`, b),
  deleteTransaction: (id) => req('DELETE', `/api/transactions/${id}`),
  income: (childId, days) => req('GET', `/api/children/${childId}/income?days=${days}`),
  products: () => req('GET', '/api/products'),
  invest: (childId, b) => req('POST', `/api/children/${childId}/investments`, b),
  redeem: (investId) => req('POST', `/api/investments/${investId}/redeem`),
  reset: () => req('POST', '/api/demo/reset'),
};
