import test from 'node:test';
import assert from 'node:assert/strict';
import { onAuftragMutation, notifyAuftragMutation } from '../src/utils/auftragChanges.js';

test('announces order mutations from all editors without recursive note refresh or unrelated reads', () => {
  const events = [];
  const stop = onAuftragMutation(number => events.push(number));
  notifyAuftragMutation({ method: 'patch', url: '/api/auftraege/123/einsaetze/abc' });
  notifyAuftragMutation({ method: 'put', url: '/api/auftraege/123/planning' });
  notifyAuftragMutation({ method: 'delete', url: '/api/auftraege/456' });
  notifyAuftragMutation({ method: 'GET', url: '/api/auftraege/123/details' });
  notifyAuftragMutation({ method: 'post', url: '/api/auftraege/123/chronik/notes' });
  notifyAuftragMutation({ method: 'post', url: '/api/comments' });
  notifyAuftragMutation({ method: 'post', url: '/api/auftraege' });
  assert.deepEqual(events, [123, 123, 456]);
  stop();
  notifyAuftragMutation({ method: 'patch', url: '/api/auftraege/123' });
  assert.deepEqual(events, [123, 123, 456]);
});
