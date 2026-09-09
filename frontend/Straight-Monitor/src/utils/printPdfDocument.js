import { exportElementToPdf } from './htmlToPdfService';

/** Render all PDF pages for printing without relying on cross-origin PDF plugin APIs. */
export async function printPdfDocument(blob, { title, signal, onProgress = () => {} }) {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  signal?.throwIfAborted();
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
  const cancel = () => { void task.destroy(); };
  signal?.addEventListener('abort', cancel, { once: true });
  const container = document.createElement('div');
  container.className = 'document-print-pages';
  try {
    const pdf = await task.promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      signal?.throwIfAborted();
      onProgress(`Druck wird vorbereitet: Seite ${number} von ${pdf.numPages}…`);
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 2400 / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const image = document.createElement('img');
      image.src = canvas.toDataURL('image/png');
      image.alt = `Seite ${number}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'document-print-page';
      wrapper.appendChild(image);
      container.appendChild(wrapper);
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
    signal?.throwIfAborted();
    await exportElementToPdf(container, {
      title,
      extraCss: '.document-print-page { break-after: page; text-align: center; } .document-print-page:last-child { break-after: auto; } .document-print-page img { display: block; max-width: 100%; max-height: 270mm; width: auto; height: auto; margin: auto; }',
    });
  } finally {
    signal?.removeEventListener('abort', cancel);
    await task.destroy();
    container.replaceChildren();
  }
}
