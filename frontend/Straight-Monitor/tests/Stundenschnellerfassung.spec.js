import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CustomTooltip from '../src/components/CustomTooltip.vue';
import Stundenschnellerfassung from '../src/components/ui-elements/Stundenschnellerfassung.vue';

let wrapper;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe('Stundenschnellerfassung row handoff', () => {
  it('releases one row and withdraws a locked row independently', async () => {
    const auftrag = { auftragNr: 260914, eventTitel: 'Testauftrag' };
    const schicht = { _id: 'shift-1', auftragNr: auftrag.auftragNr, bezeichnung: 'Service', datumVon: '2026-09-14', uhrzeitVon: '10:00', uhrzeitBis: '18:00' };
    const einsaetze = [
      { _id: 'entry-open', auftragNr: auftrag.auftragNr, personalNr: 1001, schicht: schicht._id, datumVon: schicht.datumVon, mitarbeiterData: { vorname: 'Anna', nachname: 'Offen' } },
      { _id: 'entry-released', auftragNr: auftrag.auftragNr, personalNr: 1002, schicht: schicht._id, datumVon: schicht.datumVon, timeReleased: true, mitarbeiterData: { vorname: 'Ben', nachname: 'Übergeben' } },
    ];
    const zeiten = einsaetze.map(einsatz => ({ einsatzId: einsatz._id, start: '10:00', end: '18:00', breakMinutes: 30, paidBreakMinutes: 0 }));

    wrapper = mount(Stundenschnellerfassung, { props: { connected: true, auftrag, schichten: [schicht], einsaetze, zeiten } });

    const tooltips = wrapper.findAllComponents(CustomTooltip);
    expect(tooltips.map(tooltip => tooltip.props('text'))).toEqual([
      'Übertragen in die Stundenerfassung',
      'Rücknahme aus der Stundenerfassung',
    ]);

    const rows = wrapper.findAll('tbody tr').filter(row => row.find('.quick-time__person').exists());
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(false);
    expect(rows[1].findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true);

    const actions = wrapper.findAll('.quick-time__transfer-action');
    await actions[0].trigger('click');
    expect(wrapper.emitted('submit')[0][0]).toMatchObject({
      action: 'release',
      entries: [{ einsatzId: 'entry-open' }],
    });
    expect(wrapper.emitted('submit')[0][0].entries).toHaveLength(1);

    await actions[1].trigger('click');
    expect(wrapper.emitted('submit')[1][0]).toMatchObject({
      action: 'withdraw',
      entries: [{ einsatzId: 'entry-released' }],
    });
    expect(wrapper.emitted('submit')[1][0].entries).toHaveLength(1);
  });
});