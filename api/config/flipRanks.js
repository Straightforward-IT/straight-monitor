/**
 * Flip Rank Group Definitions
 *
 * Tiers sind nach Anzahl vergangener Einsätze gestaffelt.
 * Die Reihenfolge ist entscheidend: höchster Rang zuerst.
 */

const RANKS = [
  { key: "immortal", label: "Immortal", minEinsaetze: 1000, groupId: "4fd991e7-b05e-4690-a74a-6abe8a4c5eb1" },
  { key: "legend",   label: "Legend",   minEinsaetze: 500,  groupId: "15db8312-0838-4313-9e9e-86bf357e775f" },
  { key: "rainbow",  label: "Rainbow",  minEinsaetze: 201,  groupId: "b9addc87-d870-4f05-a653-2b2c438c7bc8" },
  { key: "onyx",     label: "Onyx",     minEinsaetze: 101,  groupId: "56b27091-926e-4e1a-a2a4-582ebda5c9f1" },
  { key: "diamond",  label: "Diamant",  minEinsaetze: 51,   groupId: "3df2ab95-bb94-4ce8-a857-95c4bceb773f" },
  { key: "gold",     label: "Gold",     minEinsaetze: 21,   groupId: "bba6d8f5-5682-4542-96e6-07631d6868b5" },
  { key: "silver",   label: "Silber",   minEinsaetze: 6,    groupId: "51615fc8-b8bc-483e-98f8-69a6f90bf297" },
  { key: "bronze",   label: "Bronze",   minEinsaetze: 1,    groupId: "7f64528c-4396-4ecb-904e-e72cca7d134e" },
];

/** Parent-Gruppe aller Rang-Gruppen (für spätere Referenzen / Bereinigung) */
const RANKS_PARENT_GROUP_ID = "8ea9a6ab-ebe5-48e4-8241-abd124c68f41";

/** Set aller Rang-Group-IDs für schnelle Lookup-Checks */
const RANK_GROUP_IDS = new Set(RANKS.map(r => r.groupId));

/**
 * Ermittelt den passenden Rang-Tier für eine Einsatz-Anzahl.
 * @param {number} count
 * @returns {{ key: string, label: string, groupId: string } | null}
 */
function getRankTier(count) {
  if (!count || count < 1) return null;
  return RANKS.find(r => count >= r.minEinsaetze) || null;
}

module.exports = { RANKS, RANKS_PARENT_GROUP_ID, RANK_GROUP_IDS, getRankTier };
