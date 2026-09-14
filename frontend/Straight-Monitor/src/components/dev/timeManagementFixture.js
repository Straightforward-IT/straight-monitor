export const timeManagementEmployee = {
  id: 'demo-employee-max', name: 'Max Mustermann', personalNr: 1042,
  employmentLabel: 'Teilzeit', monthlyHours: 108.25,
};
export const timeManagementMonth = '2026-09';

export function timeManagementFixture() {
  const shift = (id, day, label, amount, auftragNr) => ({
    id, date: `2026-09-${String(day).padStart(2, '0')}`, label, minutes: amount * 60,
    kind: 'productive', credited: true, source: `Einsatz · #${auftragNr}`,
    customerName: `${label.split(' · ')[0]} GmbH`, location: label.split(' · ')[0], activity: label.split(' · ')[1],
    // Demo references for the future Einsatz/Stundenerfassung adapter.
    einsatzId: `einsatz-${id}`, schichtId: `schicht-${id}`, auftragNr,
  });
  return {
    bankMinutes: 24 * 60,
    entries: [
      shift('shift-01', 1, 'Elbforum · Service', 8, 260901),
      shift('shift-02', 2, 'Elbforum · Service', 7.5, 260901),
      shift('shift-03a', 3, 'Hafenküche · Frühstück', 4, 260903),
      shift('shift-03b', 3, 'Hafenküche · Lunch', 4, 260903),
      shift('shift-04', 4, 'Messe · Empfang', 8, 260904),
      shift('shift-07', 7, 'Elbforum · Service', 8, 260907),
      shift('shift-a', 8, 'Deck10 · Service', 8, 260908),
      shift('shift-b', 8, 'Deck10 · Küche', 6, 260908),
      shift('shift-09', 9, 'Deck10 · Service', 7, 260909),
      shift('shift-10', 10, 'Messe · Empfang', 6, 260910),
      shift('shift-11', 11, 'Elbforum · Service', 5.5, 260911),
      { id: 'sick-14', date: '2026-09-14', code: 'K', label: 'Krank (mit Lohnfortzahlung)', kind: 'sick', minutes: 360, credited: true },
      { id: 'sick-15', date: '2026-09-15', code: 'K', label: 'Krank (mit Lohnfortzahlung)', kind: 'sick', minutes: 360, credited: true },
      { id: 'vacation-21', date: '2026-09-21', code: 'U', label: 'Urlaub (bezahlt)', kind: 'vacation', minutes: 360, credited: true },
      { id: 'planned-23', date: '2026-09-23', label: 'Elbforum · Service', kind: 'planned', source: 'Geplant', minutes: 480, credited: false },
      { id: 'planned-24', date: '2026-09-24', label: 'Elbforum · Service', kind: 'planned', source: 'Geplant', minutes: 480, credited: false },
      { id: 'planned-25', date: '2026-09-25', label: 'Hafenküche · Lunch', kind: 'planned', source: 'Geplant', minutes: 240, credited: false },
    ],
  };
}
