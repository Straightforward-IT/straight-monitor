import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse, compileScript } from '@vue/compiler-sfc';
import { createRenderer, nextTick, reactive } from 'vue';
import * as xlsx from 'xlsx';
import {
  documentFilename, documentFormat, validateDocumentUrl, fetchDocumentBlob, worksheetPreview,
} from '../src/utils/documentPreview.js';

test('signed R2 filenames and content types select the appropriate safe renderer', () => {
  const url = 'https://bucket.example/file?response-content-disposition=' + encodeURIComponent('inline; filename="Übersicht September.pdf"');
  assert.equal(documentFilename(url), 'Übersicht September.pdf');
  assert.equal(documentFilename('https://bucket.example/docs/Arbeitsvertrag%20neu.PDF?signature=secret'), 'Arbeitsvertrag neu.PDF');
  for (const [filename, kind] of Object.entries({ 'test.PDF': 'pdf', 'foto.jpg': 'image', 'plan.xlsx': 'spreadsheet', 'data.csv': 'spreadsheet', 'notes.md': 'text', 'clip.mp4': 'video', 'song.mp3': 'audio', 'file.docx': 'unsupported' })) {
    assert.equal(documentFormat(filename, 'application/octet-stream').kind, kind);
  }
  assert.equal(documentFormat('no-extension', 'application/pdf').kind, 'pdf');
  assert.equal(documentFormat('page.html', 'text/html').mime, 'text/plain');
  assert.equal(documentFormat('data.xml', 'application/xml').kind, 'text');
  assert.equal(documentFormat('unexpected.pdf', 'text/html').kind, 'text');
});

test('document URLs reject executable schemes and foreign blob origins', () => {
  const base = 'https://app.example/documents';
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///private/file', 'blob:https://other.example/id', 'https://user:password@example.com/file']) {
    assert.throws(() => validateDocumentUrl(url, base));
  }
  assert.equal(validateDocumentUrl('/signed.pdf', base), 'https://app.example/signed.pdf');
  assert.equal(validateDocumentUrl('blob:https://app.example/id', base), 'blob:https://app.example/id');
});

test('spreadsheet preview bounds sparse ranges and escapes cells through plain values', () => {
  const sheet = { A1: { t: 's', v: '<img src=x onerror=alert(1)>' }, '!ref': 'A1:XFD1048576' };
  const preview = worksheetPreview(sheet, xlsx.utils);
  assert.equal(preview.truncated, true);
  assert.equal(preview.rows.length, 500);
  assert.equal(preview.rows[0].length, 100);
  assert.equal(preview.rows[0][0], '<img src=x onerror=alert(1)>');
  assert.deepEqual(worksheetPreview({}, xlsx.utils), { rows: [], truncated: false });
});

test('R2 fetch sends no app credentials and reports expired links', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: 'https://app.example/' } };
  const controller = new AbortController();
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://bucket.example/test.pdf');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
      assert.equal(options.headers, undefined);
      assert.equal(options.signal, controller.signal);
      return new Response('expired', { status: 403 });
    };
    await assert.rejects(fetchDocumentBlob('https://bucket.example/test.pdf', controller.signal), /HTTP 403/);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

const filename = new URL('../src/components/Modals/DocumentPreviewModal.vue', import.meta.url);
const { descriptor } = parse(await readFile(filename, 'utf8'));
const compiled = compileScript(descriptor, { id: 'document-preview-test' }).content
  .replace(/import ModalFrame from '[^']+';/, 'const ModalFrame = {};')
  .replace(/import ContextMenu from '[^']+';/, 'const ContextMenu = {};')
  .replace(/import \{ exportElementToPdf \} from '[^']+';/, 'const exportElementToPdf = async () => {};')
  .replace("from '@/utils/documentPreview'", `from '${new URL('../src/utils/documentPreview.js', import.meta.url)}'`)
  .replace(/from '(vue|@fortawesome\/[^']+)'/g, (_, module) => `from '${import.meta.resolve(module)}'`);
const { default: Preview } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const settle = async () => { await nextTick(); await new Promise(resolve => setImmediate(resolve)); };

function setup(values) {
  const props = reactive({ modelValue: true, url: '', filename: 'sample.txt', mimeType: '', resolveUrl: undefined, loadBlob: undefined, minimizable: false, minimizeId: '', ...values });
  // Mount setup with real Vue lifecycle ownership; the renderers are checked in-browser.
  const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null });
  let state;
  const app = renderer.createApp({ setup() {
    state = Preview.setup(props, { expose() {}, emit() {} });
    return () => null;
  } });
  app.mount({});
  return { props, state, scope: { stop: () => app.unmount() } };
}

test('switching documents ignores late responses and releases object URLs on close', async () => {
  let resolveFirst;
  let firstSignal;
  const { props, state, scope } = setup({ loadBlob: ({ signal }) => {
    firstSignal = signal;
    return new Promise(resolve => { resolveFirst = resolve; });
  } });
  try {
    props.loadBlob = async () => new Blob(['second document'], { type: 'text/plain' });
    await settle();
    const secondUrl = state.previewUrl.value;
    assert.equal(firstSignal.aborted, true);
    assert.equal(state.textContent.value, 'second document');
    resolveFirst(new Blob(['outdated document'], { type: 'text/plain' }));
    await settle();
    assert.equal(state.textContent.value, 'second document');
    assert.equal(state.previewUrl.value, secondUrl);
    props.modelValue = false;
    await settle();
    assert.equal(state.previewUrl.value, '');
    await assert.rejects(fetch(secondUrl));
  } finally { scope.stop(); }
});

test('failed loads can be retried, and media/unsupported formats disable printing', async () => {
  let requests = 0;
  const { props, state, scope } = setup({ loadBlob: async () => {
    if (++requests === 1) throw new Error('Link abgelaufen');
    return new Blob(['recovered'], { type: 'text/plain' });
  } });
  try {
    await settle();
    assert.equal(state.error.value, 'Link abgelaufen');
    state.retry.value++;
    await settle();
    assert.equal(state.error.value, '');
    assert.equal(state.textContent.value, 'recovered');
    assert.equal(state.canPrint.value, true);
    props.filename = 'video.mp4';
    props.loadBlob = async () => new Blob(['video'], { type: 'video/mp4' });
    await settle();
    assert.equal(state.canPrint.value, false);
    assert.equal(state.canOpenTab.value, true);
    props.filename = 'archive.zip';
    props.loadBlob = async () => new Blob(['zip'], { type: 'application/zip' });
    await settle();
    assert.equal(state.format.value.kind, 'unsupported');
    assert.equal(state.canPrint.value, false);
  } finally { scope.stop(); }
});

test('tab and download actions retain independent blob URLs and preserve the filename', async () => {
  const originals = { window: globalThis.window, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timeout: globalThis.setTimeout };
  const created = [];
  const revoked = [];
  const opened = [];
  const downloads = [];
  const timers = [];
  globalThis.window = { location: { href: 'https://app.example/' }, open: (...args) => { opened.push(args); } };
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { downloads.push({ href: this.href, download: this.download, rel: this.rel }); }, remove() {} }) };
  URL.createObjectURL = blob => { const url = `blob:https://app.example/${created.length}`; created.push({ blob, url }); return url; };
  URL.revokeObjectURL = url => revoked.push(url);
  globalThis.setTimeout = callback => { timers.push(callback); return timers.length; };
  const { state, scope } = setup({ filename: 'diagram.svg', loadBlob: async () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }) });
  try {
    await settle();
    const previewUrl = state.previewUrl.value;
    await state.handleAction('tab');
    await state.handleAction('download');
    assert.equal(opened[0][1], '_blank');
    assert.equal(opened[0][2], 'noopener,noreferrer');
    assert.equal(created[1].blob.type, 'text/plain'); // SVG must not execute at the app's origin.
    assert.equal(created[2].blob.type, 'image/svg+xml');
    assert.equal(downloads[0].download, 'diagram.svg');
    scope.stop();
    assert.deepEqual(revoked, [previewUrl]);
    for (const callback of timers) callback();
    assert.deepEqual(revoked, created.map(item => item.url));
  } finally {
    scope.stop();
    globalThis.window = originals.window;
    globalThis.document = originals.document;
    globalThis.setTimeout = originals.timeout;
    URL.createObjectURL = originals.create;
    URL.revokeObjectURL = originals.revoke;
  }
});

test('R2 CORS failures retain a direct PDF fallback while HTTP failures remain retryable', async () => {
  const originals = { window: globalThis.window, fetch: globalThis.fetch };
  globalThis.window = { location: { href: 'https://app.example/' } };
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  const { state, scope } = setup({ filename: 'document.pdf', url: 'https://bucket.example/document.pdf' });
  try {
    await settle();
    assert.equal(state.previewUrl.value, 'https://bucket.example/document.pdf');
    assert.equal(state.error.value, '');
    assert.equal(state.canPrint.value, false);
    assert.match(state.notice.value, /Direkte PDF-Vorschau/);
    globalThis.fetch = async () => new Response('expired', { status: 403 });
    state.retry.value++;
    await settle();
    assert.match(state.error.value, /HTTP 403/);
    assert.equal(state.previewUrl.value, '');
  } finally {
    scope.stop();
    globalThis.window = originals.window;
    globalThis.fetch = originals.fetch;
  }
});
