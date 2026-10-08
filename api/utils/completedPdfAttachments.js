const { PDFDocument } = require('pdf-lib');

async function buildCompletedPdfAttachments(vorgang, pdfBuffer) {
  const pdfName = vorgang.fileName || `${vorgang.name || 'Signatur'}.pdf`;
  if (vorgang.typKey !== 'stundenliste' || !vorgang.stundenlisteDoppelausfertigung) {
    return [{ name: pdfName, contentType: 'application/pdf', content: pdfBuffer.toString('base64') }];
  }

  const source = await PDFDocument.load(pdfBuffer);
  const pageCount = source.getPageCount();
  // Only a two-page legacy document has an unambiguous split without metadata.
  const counts = vorgang.stundenlisteCopyPageCounts
    ?? (pageCount === 2 ? [1, 1] : null);
  if (!Array.isArray(counts) || counts.length !== 2
    || !counts.every((count) => Number.isInteger(count) && count > 0)
    || counts[0] + counts[1] !== pageCount) {
    throw new Error(`Seitengrenze der Doppelausfertigung fehlt oder passt nicht zum PDF (${pageCount} Seiten). Bitte die Seitenzahlen beider Ausfertigungen prüfen und hinterlegen.`);
  }

  const baseName = pdfName.replace(/\.pdf$/i, '');
  const attachments = [];
  let firstPageIndex = 0;
  for (let copyIndex = 0; copyIndex < 2; copyIndex += 1) {
    const output = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: counts[copyIndex] },
      (_, index) => firstPageIndex + index
    );
    const pages = await output.copyPages(source, pageIndices);
    pages.forEach((page) => output.addPage(page));
    attachments.push({
      name: `${baseName}-${copyIndex === 0 ? 'Signiert' : 'Unsigniert'}.pdf`,
      contentType: 'application/pdf',
      content: Buffer.from(await output.save()).toString('base64'),
    });
    firstPageIndex += counts[copyIndex];
  }
  return attachments;
}

module.exports = { buildCompletedPdfAttachments };
