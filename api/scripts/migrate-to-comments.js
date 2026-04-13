/**
 * Migration script: DispoKommentar + Mitarbeiter.dispoAktivitaetsLog → Comment
 *
 * Run once:  node api/scripts/migrate-to-comments.js
 *
 * Safe to re-run: skips documents already migrated (checks for duplicates
 * by storing the legacy _id in comment.context.legacyId).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const DispoKommentar = require('../models/DispoKommentar');
const Mitarbeiter = require('../models/Mitarbeiter');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // ─── 1. Migrate DispoKommentar → scope: dispo_day ──────────────────────
  const legacyKommentare = await DispoKommentar.find({}).lean();
  console.log(`Found ${legacyKommentare.length} DispoKommentar documents`);

  let skipped = 0;
  let inserted = 0;
  for (const k of legacyKommentare) {
    const alreadyMigrated = await Comment.exists({
      scope: 'dispo_day',
      'context.legacyId': k._id,
    });
    if (alreadyMigrated) { skipped++; continue; }

    await Comment.create({
      scope: 'dispo_day',
      text: k.text,
      author: k.author,
      authorId: k.authorId,
      readBy: k.readBy ?? [],
      context: {
        mitarbeiter: k.mitarbeiter,
        datum: k.datum,
        legacyId: k._id,
      },
      createdAt: k.timestamp ?? k._id.getTimestamp(),
      updatedAt: k.timestamp ?? k._id.getTimestamp(),
    });
    inserted++;
  }
  console.log(`dispo_day: ${inserted} migrated, ${skipped} already done`);

  // ─── 2. Migrate Mitarbeiter.dispoAktivitaetsLog → scope: chronik ───────
  const mitarbeiter = await Mitarbeiter.find(
    { 'dispoAktivitaetsLog.0': { $exists: true } },
    '_id dispoAktivitaetsLog'
  ).lean();
  console.log(`Found ${mitarbeiter.length} Mitarbeiter with Aktivitätslog entries`);

  let chronikSkipped = 0;
  let chronikInserted = 0;
  for (const ma of mitarbeiter) {
    for (const entry of ma.dispoAktivitaetsLog ?? []) {
      const alreadyMigrated = await Comment.exists({
        scope: 'chronik',
        'context.legacyId': entry._id,
      });
      if (alreadyMigrated) { chronikSkipped++; continue; }

      await Comment.create({
        scope: 'chronik',
        text: entry.text,
        author: entry.authorName || '',
        authorId: entry.createdBy || new mongoose.Types.ObjectId(), // fallback if missing
        readBy: entry.readBy ?? [],
        context: {
          mitarbeiter: ma._id,
          legacyId: entry._id,
        },
        createdAt: entry.createdAt ?? entry._id?.getTimestamp?.() ?? new Date(),
        updatedAt: entry.createdAt ?? new Date(),
      });
      chronikInserted++;
    }
  }
  console.log(`chronik: ${chronikInserted} migrated, ${chronikSkipped} already done`);

  console.log('\nMigration complete.');
  console.log('You can now safely remove DispoKommentar documents and dispoAktivitaetsLog fields');
  console.log('after verifying the data in the Comment collection.\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
