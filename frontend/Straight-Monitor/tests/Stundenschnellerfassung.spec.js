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
  it('inserts the required minimum break from the warning action', async () => {
    const auftrag = { auftragNr: 260914, eventTitel: 'Testauftrag' };
    const einsaetze = [{
      _id: 'entry-break', auftragNr: auftrag.auftragNr, personalNr: 1001,
      datumVon: '2026-09-14', uhrzeitVon: '09:30', uhrzeitBis: '18:00',
      mitarbeiterData: { vorname: 'Anna', nachname: 'Pause' },
    }];
    const zeiten = [{ einsatzId: 'entry-break', start: '09:30', end: '18:00', breakMinutes: 0, paidBreakMinutes: 0 }];

    wrapper = mount(Stundenschnellerfassung, { props: { connected: true, auftrag, einsaetze, zeiten } });

    const action = wrapper.get('.quick-time__apply-break');
    expect(action.text()).toBe('30 Min. Pause eintragen');
    await action.trigger('click');

    expect(wrapper.get('select[aria-label="Pause in Minuten – Pause, Anna"]').element.value).toBe('30');
    expect(wrapper.find('.quick-time__warning-row').exists()).toBe(false);
  });

  it('releases one row and withdraws a locked row independently', async () => {
    const auftrag = { auftragNr: 260914, eventTitel: 'Testauftrag' };
    const einsaetze = [
      { _id: 'entry-open', auftragNr: auftrag.auftragNr, personalNr: 1001, datumVon: '2026-09-14', uhrzeitVon: '10:00', uhrzeitBis: '18:00', mitarbeiterData: { vorname: 'Anna', nachname: 'Offen' } },
      { _id: 'entry-released', auftragNr: auftrag.auftragNr, personalNr: 1002, datumVon: '2026-09-14', uhrzeitVon: '10:00', uhrzeitBis: '18:00', timeReleased: true, mitarbeiterData: { vorname: 'Ben', nachname: 'Übergeben' } },
    ];
    const zeiten = einsaetze.map(einsatz => ({ einsatzId: einsatz._id, start: '10:00', end: '18:00', breakMinutes: 30, paidBreakMinutes: 0 }));

    wrapper = mount(Stundenschnellerfassung, { props: { connected: true, auftrag, einsaetze, zeiten } });

    const tooltips = wrapper.findAllComponents(CustomTooltip);
    expect(tooltips.map(tooltip => tooltip.props('text'))).toEqual([
      'Soll-Zeiten übernehmen – Offen, Anna',
      'Zurücksetzen – Offen, Anna',
      'Zeile leeren – Offen, Anna',
      'Übertragen in die Stundenerfassung',
      'Soll-Zeiten übernehmen – Übergeben, Ben',
      'Zurücksetzen – Übergeben, Ben',
      'Zeile leeren – Übergeben, Ben',
      'Rücknahme aus der Stundenerfassung',
    ]);

    const rows = wrapper.findAll('tbody tr').filter(row => row.find('.quick-time__person').exists());
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll('select').every(select => select.attributes('disabled') !== undefined)).toBe(false);
    expect(rows[1].findAll('select').every(select => select.attributes('disabled') !== undefined)).toBe(true);

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