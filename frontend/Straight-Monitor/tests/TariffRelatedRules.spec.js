import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TariffRelatedRules from '../src/components/tariffs/TariffRelatedRules.vue';
import { foreignKeyLabel, groupWageRules, matrixRangeLabel, ruleDecimal } from '../src/components/tariffs/tariffRelatedRules';

const rule = (raw, row = 2) => ({ values: raw, source: { filename: 'Tarifregeln.xlsx', sheet: 'Export', row, raw } });
const payGroups = [{ legacyId: '21016', position: 1, name: 'EG 1' }, { legacyId: '24932', position: 3, name: 'EG 2b' }];
const stages = [{ legacyId: '21025', position: 1, name: 'Eingangsstufe' }];
const fixture = () => ({
  contract: { legacyId: '17055', name: 'IGZ ./. DGB', vacationRules: [rule({ IJAHR: 0, ITAGE: 24, GUELTIGBISJAHR: 2020 }), rule({ IJAHR: 0, ITAGE: 25, GUELTIGBISJAHR: null })], noticePeriods: [rule({ IANZAHLANG: 15, ITYPANG: 3, IANZAHLKUEND: 6, ITYPKUEND: 2 })] },
  group: { legacyId: '21015', name: 'Lohn Ost KZF', payGroups, stages, referenceWages: [rule({ IGRUPPE: 6, ISTUFE: 2, IOPTHOECHERWERT: 7 })] },
  period: { legacyId: '1108622', employeeGroupId: '21015', validFrom: '2026-09-01', validUntil: null,
    wageRules: [rule({ ILOHNARTNR: 166, DPROZENT: '25', DAB: 23, DBIS: 24, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, BERECHNUNGSART: 99 }), rule({ ILOHNARTNR: '166', DPROZENT: '25', DAB: 0, DBIS: 6, ID_LCS_TARIFGRUPPEN: -1, ID_LCS_TARIFSTUFEN: 0 }, 3), rule({ ILOHNARTNR: 100, ID_LCS_TARIFGRUPPEN: null, ID_LCS_TARIFSTUFEN: null }, 4)],
    specialPayments: [rule({ CBEZEICHNUNG: 'Urlaubsgeld', CSTICHTAG1: '30.06.', IAUSZAHLMONAT: 6, ILOHNARTNR: 318, MINMITGLIEDSCHAFTMONATE: 12, KUENBER: 7 })],
    assignmentAllowances: [rule({ IGRUPPEAB: 1, IGRUPPEBIS: 3, ISTUFEAB: 1, ISTUFEBIS: 1, IABMONATEEINSATZ: 9, IABMONATEEINTRITT: 14, DZULAGE: '0.20' })],
  },
  payGroup: payGroups[0], stage: stages[0],
});

describe('Zugehörige Tarifregeln', () => {
  it('zeigt jede Beziehungsebene mit ihrem Kontext und zählt Regelzeilen unabhängig von Lohnartgruppen', () => {
    const wrapper = mount(TariffRelatedRules, { props: fixture() });
    expect(wrapper.text()).toContain('9 importierte Regelzeilen');
    expect(wrapper.find('[data-rule-scope="contract"]').text()).toContain('Tarifvertrag 17055');
    expect(wrapper.find('[data-rule-scope="variant"]').text()).toContain('Lohn Ost KZF');
    expect(wrapper.find('[data-rule-scope="period"]').text()).toContain('01.09.2026 – offen');
    expect(wrapper.find('[data-rule-scope="period"]').text()).toContain('Tarifperiode 1108622');
    expect(wrapper.text()).toContain('2 Lohnarten · 3 Regelzeilen');
    expect(wrapper.text()).toContain('Ausgewählte Entgeltgruppe: EG 1 · Stufe: Eingangsstufe');
    expect(wrapper.findAll('[data-wage-number]')).toHaveLength(2);
    expect(wrapper.find('table[aria-label="Regeln für Lohnart 166"] > tbody').element.children).toHaveLength(2);
  });

  it('löst echte Fremdschlüssel in Namen auf, hält Sentinelwerte sichtbar und berechnet keine Anwendbarkeit', () => {
    const wrapper = mount(TariffRelatedRules, { props: fixture() });
    const wage = wrapper.find('[data-wage-number="166"]');
    expect(wage.text()).toContain('EG 1 · ID 21016');
    expect(wage.text()).toContain('Eingangsstufe · ID 21025');
    expect(wage.text()).toContain('Quellkennzeichen -1');
    expect(wage.text()).toContain('Quellkennzeichen 0');
    expect(wrapper.text()).toContain('Anwendbarkeit oder Berechnung wird hier nicht bestimmt');
    expect(wrapper.text()).not.toMatch(/gilt für alle|anwendbar|Nachtzuschlag/);
    expect(foreignKeyLabel(rule({ ID_LCS_TARIFGRUPPEN: 999 }), 'ID_LCS_TARIFGRUPPEN', payGroups)).toBe('Verweis 999 · nicht aufgelöst');
  });

  it('hält Urlaubsstände auseinander und lässt unbekannte Kündigungs- und Ecklohncodes uninterpretiert', () => {
    const wrapper = mount(TariffRelatedRules, { props: fixture() });
    expect(wrapper.text()).toContain('Gültig bis einschließlich 2020');
    expect(wrapper.text()).toContain('Offener Regelstand · ohne Endjahr');
    expect(wrapper.text()).toContain('15 · Typcode 3');
    expect(wrapper.text()).toContain('6 · Typcode 2');
    expect(wrapper.text()).toContain('Gruppenparameter');
    expect(wrapper.text()).toContain('Stufenparameter');
    expect(wrapper.text()).not.toMatch(/15 Jahre|6 Wochen/);
    expect(wrapper.find('[data-rule-scope="variant"]').text()).toContain('Verwendung der Parameter ist ungeklärt');
  });

  it('benennt dokumentierte Matrixbereiche, beide Monatsschwellen und den Zulagenwert ohne erfundene Einheit', () => {
    const wrapper = mount(TariffRelatedRules, { props: fixture() });
    const table = wrapper.find('table[aria-label="Einsatzzulagen"]');
    expect(table.text()).toContain('EG 1 – EG 2b · IY 1–3');
    expect(table.text()).toContain('Eingangsstufe · IX 1');
    expect(table.text()).toContain('9'); expect(table.text()).toContain('14');
    expect(table.text()).toContain('0,20'); expect(table.text()).not.toContain('€');
    expect(wrapper.text()).toContain('Juni');
    expect(wrapper.text()).toContain('konkrete Sonderzahlungsbeträge stehen in dieser Tabelle nicht');
    expect(matrixRangeLabel(rule({ IGRUPPEAB: -1, IGRUPPEBIS: 0 }), 'IGRUPPEAB', 'IGRUPPEBIS', payGroups, 'IY')).toBe('Quellbereich -1 – 0');
  });

  it('hält die Originalspalten nur in ausklappbaren Quelldetails zugänglich', () => {
    const wrapper = mount(TariffRelatedRules, { props: fixture() });
    const sources = wrapper.findAll('details.tariff-source');
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => !source.attributes('open'))).toBe(true);
    const code = sources.find((source) => source.text().includes('BERECHNUNGSART'));
    expect(code.text()).toContain('99');
    expect(code.text()).toContain('Tarifregeln.xlsx / Export · Zeile 2');
    expect(wrapper.findAll('thead > tr > th').filter((cell) => cell.text() === 'BERECHNUNGSART')).toHaveLength(0);
  });

  it('aktualisiert die Periodenregeln beim Kontextwechsel und unterstützt fehlende optionale Ebenen', async () => {
    const wrapper = mount(TariffRelatedRules, { props: fixture() });
    await wrapper.setProps({ period: { legacyId: '1107092', employeeGroupId: '21015', validFrom: '2026-01-01', validUntil: '2026-08-31', wageRules: [], specialPayments: [], assignmentAllowances: [] } });
    expect(wrapper.text()).toContain('Tarifperiode 1107092');
    expect(wrapper.findAll('[data-wage-number]')).toHaveLength(0);
    expect(wrapper.text()).toContain('4 importierte Regelzeilen');
    await wrapper.setProps({ contract: null, group: null, period: null, payGroup: null, stage: null });
    expect(wrapper.findAll('[data-rule-scope]')).toHaveLength(0);
    expect(wrapper.text()).toContain('Wähle eine Tarifbasis');
  });

  it('bewahrt Dezimaltext und sämtliche Regeln einer mehrfach verwendeten Lohnart', () => {
    expect(ruleDecimal(rule({ DPROZENT: '25,1234567890123456789' }), 'DPROZENT')).toBe('25,1234567890123456789');
    const one = rule({ ILOHNARTNR: 166, DAB: 23 }), two = rule({ ILOHNARTNR: '0166', DAB: 0 });
    expect(groupWageRules([one, two])).toEqual([{ key: '166', number: '166', records: [one, two] }]);
  });
});
