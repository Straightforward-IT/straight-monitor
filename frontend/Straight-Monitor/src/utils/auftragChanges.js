const listeners = new Set();

// Only announces committed app mutations; the server remains the source of the history.
export function notifyAuftragMutation(config = {}) {
  if (!['post', 'put', 'patch', 'delete'].includes(String(config.method).toLowerCase())) return;
  const match = String(config.url || '').match(/\/api\/auftraege\/(\d+)(\/[^?]*)?(?:\?|$)/);
  if (!match || match[2]?.startsWith('/chronik')) return;
  for (const listener of listeners) listener(Number(match[1]));
}

export function onAuftragMutation(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
