/**
 * HTML → PDF export service.
 *
 * Clones any DOM element (with live form values and rendered canvases),
 * injects it together with ALL document stylesheets into a hidden iframe
 * and triggers the browser print dialog. Saving as PDF produces a fully
 * readable, text-selectable document — no rasterization.
 *
 * Elements marked with `data-pdf-ignore` are stripped from the export.
 */

const IGNORE_ATTR = 'data-pdf-ignore';

const BASE_PRINT_CSS = `
  @page { margin: 12mm; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body > * {
    position: static !important;
    width: 100% !important;
    max-width: 100% !important;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    box-shadow: none !important;
  }
`;

/** Serialize every accessible stylesheet; collect cross-origin ones as links. */
function collectDocumentStyles() {
  let css = '';
  const links = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        css += rule.cssText + '\n';
      }
    } catch {
      // Cross-origin stylesheet (e.g. CDN fonts) — reference it instead
      if (sheet.href) links.push(sheet.href);
    }
  }
  return { css, links };
}

/** Copy live form state (lost by cloneNode) onto the cloned tree. */
function syncFormState(source, clone) {
  const selector = 'input, textarea, select';
  const srcFields = source.querySelectorAll(selector);
  const cloneFields = clone.querySelectorAll(selector);
  srcFields.forEach((field, i) => {
    const target = cloneFields[i];
    if (!target) return;
    if (field.tagName === 'TEXTAREA') {
      target.textContent = field.value;
    } else if (field.tagName === 'SELECT') {
      Array.from(target.options).forEach((opt, j) => {
        opt.toggleAttribute('selected', field.options[j]?.selected ?? false);
      });
    } else if (field.type === 'checkbox' || field.type === 'radio') {
      target.toggleAttribute('checked', field.checked);
    } else {
      target.setAttribute('value', field.value);
    }
  });
}

/** Replace cloned canvases (blank after cloneNode) with rendered snapshots. */
function snapshotCanvases(source, clone) {
  const srcCanvases = source.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');
  srcCanvases.forEach((canvas, i) => {
    const target = cloneCanvases[i];
    if (!target) return;
    try {
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.style.cssText = `width:${canvas.clientWidth}px;height:${canvas.clientHeight}px;`;
      target.replaceWith(img);
    } catch {
      // Tainted canvas — leave the (blank) clone in place
    }
  });
}

function waitForImages(doc) {
  const pending = Array.from(doc.images)
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })
    );
  return Promise.all(pending);
}

/**
 * Export a DOM element as a readable PDF via the browser print dialog.
 *
 * @param {HTMLElement} element  Element to export.
 * @param {object}      [options]
 * @param {string}      [options.title]    Document title (suggested PDF filename).
 * @param {string}      [options.extraCss] Additional CSS overrides for the export.
 * @returns {Promise<void>} Resolves once the print dialog has been handed off.
 */
export async function exportElementToPdf(element, { title = 'Dokument', extraCss = '' } = {}) {
  if (!element) throw new Error('exportElementToPdf: element is required');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;

  // Preserve theme classes (e.g. dark mode) so CSS variables resolve identically
  doc.documentElement.className = document.documentElement.className;
  doc.body.className = document.body.className;
  doc.title = title;

  const meta = doc.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  doc.head.appendChild(meta);

  const { css, links } = collectDocumentStyles();
  for (const href of links) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    doc.head.appendChild(link);
  }
  const style = doc.createElement('style');
  style.textContent = css + BASE_PRINT_CSS + extraCss;
  doc.head.appendChild(style);

  const clone = element.cloneNode(true);
  clone.querySelectorAll(`[${IGNORE_ATTR}]`).forEach((node) => node.remove());
  syncFormState(element, clone);
  snapshotCanvases(element, clone);
  doc.body.appendChild(clone);

  await Promise.all([doc.fonts?.ready ?? Promise.resolve(), waitForImages(doc)]);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  // Safety net for browsers that never fire afterprint on iframes
  setTimeout(cleanup, 60_000);

  win.focus();
  win.print();
}

export default { exportElementToPdf };
