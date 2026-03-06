/**
 * Shared PDF rendering utilities used by both template and Vorgang routes.
 */
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Returns template.pdfs sorted by their `order` field.
 */
function sortedPdfs(template) {
  return [...template.pdfs].sort((a, b) => a.order - b.order);
}

/**
 * Merge all PDFs in a template and draw placements using the provided values map.
 * @param {Object} template - PdfTemplate mongoose doc
 * @param {Object} values   - { bookmarkId: value, ... }
 * @returns {Buffer} filled PDF as a Buffer
 */
async function buildFilledPdf(template, values = {}) {
  const ordered = sortedPdfs(template);
  const mergedDoc = await PDFDocument.create();

  // Copy each source PDF's pages into the merged document
  const pageMaps = []; // pageMaps[i] = { startIdx, pageCount }
  let globalOffset = 0;
  for (let i = 0; i < ordered.length; i++) {
    const srcDoc = await PDFDocument.load(ordered[i].pdfData);
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    const startIdx = globalOffset;
    for (const page of copiedPages) mergedDoc.addPage(page);
    pageMaps.push({ startIdx, pageCount: ordered[i].pageCount });
    globalOffset += ordered[i].pageCount;
  }

  const font = await mergedDoc.embedFont(StandardFonts.Helvetica);
  const pages = mergedDoc.getPages();

  for (const pl of template.placements) {
    const pdfMap = pageMaps[pl.pdfIndex];
    if (!pdfMap) continue;

    const globalPageIdx = pdfMap.startIdx + pl.page;
    const page = pages[globalPageIdx];
    if (!page) continue;

    const bm = template.bookmarks.find(b => b.id === pl.bookmarkId);
    if (!bm) continue;

    const raw = values[pl.bookmarkId];
    const value = raw !== undefined ? String(raw) : (bm.defaultValue || '');

    const { width: pageW, height: pageH } = page.getSize();
    const absX = (pl.x / 100) * pageW;
    const absY = pageH - (pl.y / 100) * pageH;
    const absW = (pl.width / 100) * pageW;
    const absH = (pl.height / 100) * pageH;

    if (bm.dataType === 'checkbox') {
      const checked = value === 'true' || value === '1' || value === 'ja';
      if (checked) {
        page.drawLine({ start: { x: absX, y: absY - absH }, end: { x: absX + absW, y: absY }, thickness: 1.5, color: rgb(0, 0, 0) });
        page.drawLine({ start: { x: absX + absW, y: absY - absH }, end: { x: absX, y: absY }, thickness: 1.5, color: rgb(0, 0, 0) });
      }
    } else if (value) {
      const fs = pl.fontSize || 11;
      const fieldBottom = absY - (fs * 1.5);
      page.drawText(value, {
        x: absX,
        y: fieldBottom + fs * 0.2,
        size: fs,
        font,
        color: rgb(0, 0, 0),
        maxWidth: absW,
      });
    }
  }

  return Buffer.from(await mergedDoc.save());
}

module.exports = { sortedPdfs, buildFilledPdf };
