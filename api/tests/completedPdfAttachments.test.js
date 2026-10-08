const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const SignaturVorgang = require('../models/Signature/SignaturVorgang');
const { buildCompletedPdfAttachments } = require('../utils/completedPdfAttachments');

async function createPdf(pageCount) {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    doc.addPage([300 + index, 500]);
  }
  return Buffer.from(await doc.save());
}

async function pageWidths(attachment) {
  const doc = await PDFDocument.load(Buffer.from(attachment.content, 'base64'));
  return doc.getPages().map((page) => page.getWidth());
}

const doubleCopy = {
  typKey: 'stundenliste',
  stundenlisteDoppelausfertigung: true,
  fileName: 'Stundenliste.pdf',
};

describe('Completed PDF attachments', () => {
  for (const counts of [[2, 1], [1, 2], [3, 1], [2, 2]]) {
    it(`splits ${counts.join(' + ')} pages at the recorded boundary, preserving every page in order`, async () => {
      const total = counts[0] + counts[1];
      const buffer = await createPdf(total);
      const attachments = await buildCompletedPdfAttachments({
        ...doubleCopy, stundenlisteCopyPageCounts: counts,
      }, buffer);

      assert.deepEqual(attachments.map(({ name }) => name), ['Stundenliste-Signiert.pdf', 'Stundenliste-Unsigniert.pdf']);
      assert.ok(attachments.every(({ contentType }) => contentType === 'application/pdf'));
      const expected = Array.from({ length: total }, (_, index) => 300 + index);
      assert.deepEqual(await pageWidths(attachments[0]), expected.slice(0, counts[0]));
      assert.deepEqual(await pageWidths(attachments[1]), expected.slice(counts[0]));
    });
  }

  it('preserves the original PDF bytes for ordinary documents and single-copy Stundenlisten', async () => {
    const buffer = await createPdf(3);
    for (const vorgang of [
      { ...doubleCopy, typKey: 'anderer-typ' },
      { ...doubleCopy, stundenlisteDoppelausfertigung: false },
    ]) {
      const attachments = await buildCompletedPdfAttachments(vorgang, buffer);
      assert.equal(attachments.length, 1);
      assert.equal(attachments[0].name, 'Stundenliste.pdf');
      assert.deepEqual(Buffer.from(attachments[0].content, 'base64'), buffer);
    }
  });

  it('keeps unambiguous two-page legacy double copies working', async () => {
    const attachments = await buildCompletedPdfAttachments(doubleCopy, await createPdf(2));
    assert.deepEqual(await pageWidths(attachments[0]), [300]);
    assert.deepEqual(await pageWidths(attachments[1]), [301]);
  });

  it('does not guess boundaries of legacy odd or even multipage documents', async () => {
    for (const pageCount of [1, 3, 4]) {
      await assert.rejects(
        buildCompletedPdfAttachments(doubleCopy, await createPdf(pageCount)),
        /Seitengrenze/,
      );
    }
  });

  it('rejects malformed or stale layout metadata instead of delivering incorrect pages', async () => {
    const buffer = await createPdf(3);
    for (const counts of [[], [3], [1, 1], [0, 3], [-1, 4], [1.5, 1.5], ['2', 1], [1, 1, 1]]) {
      await assert.rejects(
        buildCompletedPdfAttachments({ ...doubleCopy, stundenlisteCopyPageCounts: counts }, buffer),
        /Seitengrenze/,
      );
    }
  });

  it('persists page counts on the signature model and validates positive integers', () => {
    const valid = new SignaturVorgang({ stundenlisteCopyPageCounts: [2, 1] });
    assert.deepEqual([...valid.stundenlisteCopyPageCounts], [2, 1]);
    assert.equal(valid.validateSync(['stundenlisteCopyPageCounts']), undefined);
    assert.equal(new SignaturVorgang().stundenlisteCopyPageCounts, undefined);
    for (const counts of [[], [1], [0, 3], [1.5, 1.5]]) {
      assert.ok(new SignaturVorgang({ stundenlisteCopyPageCounts: counts })
        .validateSync(['stundenlisteCopyPageCounts']));
    }
  });
});
