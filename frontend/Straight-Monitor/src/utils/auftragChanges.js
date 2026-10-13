const listeners = new Set();

// Only announces committed app mutations; the server remains the source of the history.
export function notifyAuftragMutation(config = {}, data) {
  if (!['post', 'put', 'patch', 'delete'].includes(String(config.method).toLowerCase())) return;
  if (/\/api\/auftraege\/editor\/submissions\/[^/]+\/process(?:\?|$)/.test(String(config.url || ''))) {
    const numbers = new Set((data?.orders || []).map(order => Number(order.auftragNr)).filter(Number.isSafeInteger));
    for (const number of numbers) for (const listener of listeners) listener(number);
    return;
  }
  const match = String(config.url || '').match(/\/api\/auftraege\/(\d+)(\/[^?]*)?(?:\?|$)/);
  if (!match || match[2]?.startsWith('/chronik')) return;
  for (const listener of listeners) listener(Number(match[1]));
}

export function onAuftragMutation(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
