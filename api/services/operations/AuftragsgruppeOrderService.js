const Auftrag = require('../../models/Event/Auftrag');

const SHARED_ORDER_FIELDS = ['einsatzort', 'bestelltext', 'eventTitel', 'referenz', 'bestDatum'];
const NEW_SHARED_ORDER_FIELDS = ['eventTitel', 'referenz', 'bestDatum'];
const OVERRIDE_FIELDS = SHARED_ORDER_FIELDS.map(field => `${field}Override`);

function sharedOrderValue(field, value) {
  if (field === 'bestDatum') return value == null || value === '' ? null : new Date(value);
  if (field === 'einsatzort') return value?._id || value || null;
  return value === undefined ? '' : value;
}
function sharedOrderValuesEqual(field, left, right) {
  return JSON.stringify(sharedOrderValue(field, left)) === JSON.stringify(sharedOrderValue(field, right));
}
async function resolveGroupOrderDefaults(group) {
  if (!group) return null;
  const resolved = group.toObject ? group.toObject() : { ...group };
  const missing = NEW_SHARED_ORDER_FIELDS.filter(field => !Object.hasOwn(resolved, field));
  if (missing.length) {
    const canonical = await Auftrag.findOne({ auftragsgruppe: resolved._id }).sort({ auftragNr: 1, _id: 1 })
      .select(NEW_SHARED_ORDER_FIELDS.join(' ')).lean();
    for (const field of missing) resolved[field] = sharedOrderValue(field, canonical?.[field]);
  }
  resolved.legacyOrderFields = [...new Set([...(resolved.legacyOrderFields || []), ...missing])];
  return resolved;
}
function resolveOrderOverrides(order, group) {
  return Object.fromEntries(SHARED_ORDER_FIELDS.map(field => {
    const key = `${field}Override`;
    let overridden = order[key] === true;
    // Legacy differences are already local intent, not permission to rewrite historical values.
    if (group && NEW_SHARED_ORDER_FIELDS.includes(field)
      && ((group.legacyOrderFields || []).includes(field) || typeof order[key] !== 'boolean')) {
      overridden ||= !sharedOrderValuesEqual(field, order[field], group[field]);
    }
    return [key, overridden];
  }));
}
function resolveOrderView(order, group) {
  const overrides = resolveOrderOverrides(order, group);
  const resolved = { ...order, ...overrides };
  if (group) for (const field of SHARED_ORDER_FIELDS) {
    // Keep the populated site and its historical address snapshot; selecting a site is a separate edit.
    if (field !== 'einsatzort' && !overrides[`${field}Override`]) resolved[field] = sharedOrderValue(field, group[field]);
  }
  for (const field of NEW_SHARED_ORDER_FIELDS) resolved[field] = sharedOrderValue(field, resolved[field]);
  return resolved;
}

module.exports = { SHARED_ORDER_FIELDS, NEW_SHARED_ORDER_FIELDS, OVERRIDE_FIELDS,
  sharedOrderValue, sharedOrderValuesEqual, resolveGroupOrderDefaults, resolveOrderOverrides, resolveOrderView };
