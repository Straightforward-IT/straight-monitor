const assert = require('node:assert/strict');
const { fields, families, getSettingDefinition, getCodeMetadaten, getConditionUsage } = require('../domain/payroll/wageTypeSettings');

describe('Wage type setting definitions', () => {
  it('covers the documented code sets without filling undocumented gaps', () => {
    const ranges = {
      calculation: ['0', '1', '2', '3', '4', '5', '6', '7', '17'],
      averageStorage: ['0', '1', '2', '3', '4', '5', '6', '7'],
      tax: [...Array.from({ length: 21 }, (_, n) => String(n)), '22'],
      storage: ['0', ...Array.from({ length: 8 }, (_, n) => String(n + 2)), ...Array.from({ length: 29 }, (_, n) => String(n + 11))],
      azk: ['0', '1', '2'], garnishment: ['0', '1', '2', '3'],
      socialInsurance: ['0', '1', '2', '3', '4', '5', '6'], bg: ['0', '1'],
      conditionProvision: ['0', '1', '2', '3'], offset: ['0', '1', '2', '3'],
      absenceTreatment: ['0', '1'], periodTransfer: ['M'], conditionUsage: ['F', 'L'],
    };
    for (const [family, codes] of Object.entries(ranges)) {
      assert.deepEqual(families[family].types.map(type => type.code), codes, family);
      for (const code of codes) {
        const definition = getSettingDefinition(family, code);
        assert.equal(definition.code, code);
        assert.ok(definition.key);
        assert.ok(definition.label);
        assert.ok(definition.note);
        assert.ok(definition.source.length);
      }
    }
    assert.equal(getSettingDefinition('tax', '21'), null);
    assert.equal(getSettingDefinition('storage', '1'), null);
    assert.equal(getSettingDefinition('storage', '10'), null);
  });

  it('keeps missing, real zero and unknown source codes distinct', () => {
    for (const missing of [undefined, null, '', '   ']) {
      const result = getCodeMetadaten({ steuerartCode: missing }).steuerartCode;
      assert.equal(result.status, 'missing');
      assert.equal(result.code, null);
      assert.equal(result.key, null);
    }
    for (const zero of [0, '0', ' 0 ']) {
      const result = getCodeMetadaten({ steuerartCode: zero }).steuerartCode;
      assert.equal(result.status, 'known');
      assert.equal(result.code, '0');
      assert.equal(result.key, 'TAXABLE');
    }
    const source = { steuerartCode: '999' };
    const result = getCodeMetadaten(source).steuerartCode;
    assert.equal(result.status, 'unknown');
    assert.equal(result.code, '999');
    assert.equal(source.steuerartCode, '999');
    for (const invalid of [false, true, {}, [], NaN, Infinity]) {
      assert.equal(getSettingDefinition('tax', invalid), null);
    }
  });

  it('keeps SP1 and SP2 independent and preserves the corrected code-zero day meaning', () => {
    const metadata = getCodeMetadaten({ durchschnittsspeicherCode: '1', durchschnittsspeicher2Code: '0' });
    assert.equal(metadata.durchschnittsspeicherCode.key, 'ADD_ALL');
    assert.equal(metadata.durchschnittsspeicher2Code.key, 'NO_AMOUNT_ADDITION');
    const zero = getSettingDefinition('averageStorage', 0);
    assert.deepEqual(zero.contributions, { days: null, hours: 0, amount: 0 });
    assert.match(zero.note, /separate Einstellung/);
  });

  it('uses family-specific meanings for the same numeric code', () => {
    const row = { steuerartCode: '1', sozialversicherungCode: '1', gleitzeitCode: '1', verrechnungCode: '1' };
    const result = getCodeMetadaten(row);
    assert.equal(result.steuerartCode.label, 'Steuerfrei');
    assert.equal(result.sozialversicherungCode.label, 'Sozialversicherungsfrei');
    assert.equal(result.gleitzeitCode.label, 'Stunden der Lohnart in AZK-Stunden addieren');
    assert.equal(result.verrechnungCode.label, 'Branchenzuschlag');
  });

  it('describes all four condition provision options without globally disabling wage types', () => {
    const expected = [[true, true], [true, false], [false, true], [false, false]];
    expected.forEach(([wage, invoice], code) => {
      const result = getSettingDefinition('conditionProvision', code);
      assert.equal(result.wage, wage);
      assert.equal(result.invoice, invoice);
      assert.match(result.note, /Kein globaler Ausschluss/);
    });
    assert.equal(getConditionUsage('F').label, 'Faktur');
    assert.equal(getConditionUsage('L').label, 'Lohn');
    assert.equal(getConditionUsage('0'), null);
    assert.equal(getConditionUsage(null), null);
    assert.equal(getSettingDefinition('conditionProvision', 'F'), null);
  });

  it('describes ÜTZ offset without assigning code 4 to the unproven tariff supplement', () => {
    const result = getCodeMetadaten({ verrechnungCode: '3', verrechnungslohnartNummer: '602', verrechnungsPrioritaet: '1' });
    assert.equal(result.verrechnungCode.key, 'ABOVE_TARIFF_ALLOWANCE');
    assert.equal(result.verrechnungCode.label, 'ÜTZ');
    assert.match(result.verrechnungCode.note, /Vorzeichen, Reihenfolge und Begrenzung sind noch ungeklärt/);
    assert.equal(getSettingDefinition('offset', '4'), null);
    assert.equal(families.offset.unmappedOptions[0].label, 'Tariflicher Zuschlag');
    assert.equal(families.offset.unmappedOptions[0].code, undefined);
    assert.equal(result.verrechnungslohnartNummer, undefined);
    assert.equal(result.verrechnungsPrioritaet, undefined);
  });

  it('retains unbound K3, K5 and BG2 catalogues without assigning misleading legacy fields', () => {
    for (const family of ['supplementaryPension', 'alternativeFlatTax', 'paidHoursBg']) {
      assert.equal(families[family].catalogOnly, true);
      assert.ok(getSettingDefinition(family, 0));
      assert.ok(!Object.values(fields).some(field => field.family === family));
    }
    for (const field of ['steuerSpezialCode', 'bgSPALTE', 'IBGSPALTESTD_SUB', 'branchenzuschlagCode', 'branchenzuschlagLohnartNummer', 'branchenzuschlagPrioritaet']) {
      assert.equal(fields[field], undefined);
    }
    const result = getCodeMetadaten({ steuerSpezialCode: '0', bgSPALTE: '1', branchenzuschlagCode: '3' });
    assert.equal(result.steuerungSpeicherungCode.status, 'missing');
    assert.equal(result.bgPflichtCode.status, 'missing');
    assert.equal(result.verrechnungCode.status, 'missing');
  });

  it('represents observed absence/month-transfer options without coercing blank values', () => {
    assert.equal(getSettingDefinition('absenceTreatment', '1').label, 'Ganze Tage, Urlaubslohnart');
    assert.equal(getSettingDefinition('periodTransfer', 'M').label, 'Monat Betrag');
    assert.equal(getSettingDefinition('periodTransfer', '0'), null);
    assert.equal(getCodeMetadaten({ tagesMonatsuebergabeCode: '' }).tagesMonatsuebergabeCode.status, 'missing');
  });

  it('documents Art 17 hours handoff as an independent setting, without changing its formula', () => {
    const type = getSettingDefinition('calculation', '17');
    assert.equal(type.formula, 'hours * hourlyRate');
    assert.match(type.note, /Stundenübergabe ist eine eigene Einstellung/);
    assert.match(type.note, /keine automatische Berechnung/);
  });

  it('exposes immutable descriptive registry values', () => {
    assert.ok(Object.isFrozen(fields));
    assert.ok(Object.isFrozen(families));
    assert.ok(Object.isFrozen(families.tax.types));
    assert.ok(Object.isFrozen(getSettingDefinition('tax', 0)));
  });
});
