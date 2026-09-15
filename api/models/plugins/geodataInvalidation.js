// Address content is the cache identity, so imports/bulk writes automatically
// look up the new address. These hooks additionally retire old keys after edits.
module.exports = function geodataInvalidation(schema, { fields, addresses }) {
  const { normalizeAddress } = require('../../services/geodata/address');
  const affectsAddress = update => {
    if (Array.isArray(update)) return true;
    const paths = Object.entries(update || {}).flatMap(([key, value]) => key.startsWith('$') ? Object.keys(value || {}) : [key]);
    return paths.some(path => fields.some(field => path === field || path.startsWith(`${field}.`) || field.startsWith(`${path}.`)));
  };

  async function snapshot(Model, filter, session) {
    const rows = await Model.find(filter).select(fields.join(' ')).session(session || null).lean();
    return Promise.all(rows.map(async row => ({
      id: row._id,
      addresses: await addresses(row, session),
    })));
  }

  async function invalidateChanged(before, after, session) {
    const current = new Map(after.map(row => [String(row.id), new Set(row.addresses.map(address => normalizeAddress(address).normalizedKey))]));
    const removed = before.flatMap(row => row.addresses.filter(address => !current.get(String(row.id))?.has(normalizeAddress(address).normalizedKey)));
    if (removed.length) await require('../../services/geodata/GeodataService').invalidateAddresses(removed, { session });
  }

  schema.pre('save', async function () {
    if (this.isNew || !fields.some(field => this.isModified(field))) return;
    this.$locals.geodataBefore = await snapshot(this.constructor, { _id: this._id }, this.$session());
  });
  schema.post('save', async function () {
    const before = this.$locals.geodataBefore;
    delete this.$locals.geodataBefore;
    if (!before) return;
    try {
      await invalidateChanged(before, [{ id: this._id, addresses: await addresses(this, this.$session()) }], this.$session());
    } catch { console.warn('[map] Old geodata cache entry could not be retired.'); }
  });

  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'findOneAndDelete', 'deleteOne', 'deleteMany']) {
    schema.pre(operation, { query: true, document: false }, async function () {
      const deleting = /delete/i.test(operation);
      if (!deleting && !/replace/i.test(operation) && !affectsAddress(this.getUpdate())) return;
      let query = this.model.find(this.getFilter()).select('_id').session(this.getOptions().session || null);
      if (!operation.endsWith('Many')) query = query.limit(1);
      const rows = await query.lean();
      this._geodataBefore = await snapshot(this.model, { _id: { $in: rows.map(row => row._id) } }, this.getOptions().session);
    });
    schema.post(operation, { query: true, document: false }, async function () {
      if (!this._geodataBefore?.length) return;
      try {
        const session = this.getOptions().session;
        const after = await snapshot(this.model, { _id: { $in: this._geodataBefore.map(row => row.id) } }, session);
        await invalidateChanged(this._geodataBefore, after, session);
      } catch { console.warn('[map] Old geodata cache entry could not be retired.'); }
    });
  }
};
