import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { fields, families, getSettingDefinition, getCodeMetadaten, getConditionUsage, formatSetting, getSettingHint } from '../src/utils/wageTypeSettings';

const require = createRequire(import.meta.url);
const backend = require('../../../api/domain/payroll/wageTypeSettings');

describe('Shared wage type setting presentation', () => {
  it('returns identical meanings, hints and source references in frontend and backend for every catalogue entry', () => {
    expect(fields).toEqual(backend.fields);
    for (const [family, definition] of Object.entries(families)) {
      for (const type of definition.types) {
        expect(getSettingDefinition(family, type.code)).toEqual(backend.getSettingDefinition(family, type.code));
      }
    }
  });

  it('keeps missing and unknown display values distinct from known zero', () => {
    expect(formatSetting({}, 'steuerartCode')).toBe('Nicht geliefert');
    expect(formatSetting({ steuerartCode: '' }, 'steuerartCode')).toBe('Nicht geliefert');
    expect(formatSetting({ steuerartCode: 0 }, 'steuerartCode')).toBe('0 · Steuerpflichtig');
    expect(formatSetting({ steuerartCode: '99' }, 'steuerartCode')).toBe('99 · Unbekannter Code');
    expect(getSettingHint({ steuerartCode: '99' }, 'steuerartCode')).toContain('99');
  });

  it('uses API metadata where available and derives the same metadata for existing rows', () => {
    const row = { berechnungsartCode: '2', durchschnittsspeicherCode: '1', durchschnittsspeicher2Code: '0', verrechnungCode: '3' };
    expect(getCodeMetadaten(row)).toEqual(backend.getCodeMetadaten(row));
    expect(formatSetting(row, 'verrechnungCode')).toBe('3 · ÜTZ');
    const enriched = { ...row, codeMetadaten: backend.getCodeMetadaten(row) };
    expect(formatSetting(enriched, 'verrechnungCode')).toBe(formatSetting(row, 'verrechnungCode'));
    expect(getSettingHint(enriched, 'verrechnungCode')).toBe(getSettingHint(row, 'verrechnungCode'));
  });

  it('does not infer metadata from legacy aliases or invent tariff offset code four', () => {
    const row = { steuerSpezialCode: '0', branchenzuschlagCode: '3', IBGSPALTESTD_SUB: '1' };
    expect(formatSetting(row, 'steuerungSpeicherungCode')).toBe('Nicht geliefert');
    expect(formatSetting(row, 'verrechnungCode')).toBe('Nicht geliefert');
    expect(getSettingDefinition('offset', '4')).toBeNull();
    expect(families.offset.unmappedOptions[0].code).toBeUndefined();
  });

  it('separates customer F/L usage from numeric condition provision', () => {
    expect(getConditionUsage('F').label).toBe('Faktur');
    expect(getConditionUsage('L').label).toBe('Lohn');
    expect(getConditionUsage('3')).toBeNull();
    expect(getSettingDefinition('conditionProvision', '3').label).toBe('Weder Lohn noch Faktur');
  });
});
