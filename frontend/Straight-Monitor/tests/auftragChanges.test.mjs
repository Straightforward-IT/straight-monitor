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

test('announces each committed batch order once, never staged submissions or pending dates', () => {
  const events = [];
  const stop = onAuftragMutation(number => events.push(number));
  notifyAuftragMutation({ method: 'post', url: '/api/auftraege/editor/submissions' }, { id: 'submission', total: 125 });
  notifyAuftragMutation({ method: 'post', url: '/api/auftraege/editor/submissions/submission/process' }, {
    status: 'incomplete', pendingDays: ['2026-10-20'], orders: [{ auftragNr: 123 }, { auftragNr: 456 }, { auftragNr: 123 }],
  });
  assert.deepEqual(events, [123, 456]);
  stop();
});
