import { isPhase1Enabled, getPhase1Config, PHASE1_DEFAULTS } from './types';
import { ServiceKind } from './enums';

describe('ServiceKind', () => {
  it('has exactly three values', () => {
    const values = Object.values(ServiceKind);
    expect(values).toHaveLength(3);
    expect(values).toContain('CONSULT');
    expect(values).toContain('TREATMENT');
    expect(values).toContain('OTHER');
  });

  it('has string values matching the keys', () => {
    expect(ServiceKind.CONSULT).toBe('CONSULT');
    expect(ServiceKind.TREATMENT).toBe('TREATMENT');
    expect(ServiceKind.OTHER).toBe('OTHER');
  });
});

describe('isPhase1Enabled', () => {
  it('returns false for null packConfig', () => {
    expect(isPhase1Enabled(null, 'outcomeTracking')).toBe(false);
  });

  it('returns false for undefined packConfig', () => {
    expect(isPhase1Enabled(undefined, 'outcomeTracking')).toBe(false);
  });

  it('returns false when phase1 key is missing', () => {
    expect(isPhase1Enabled({}, 'outcomeTracking')).toBe(false);
  });

  it('returns false when flag is not set in phase1', () => {
    expect(isPhase1Enabled({ phase1: {} }, 'outcomeTracking')).toBe(false);
  });

  it('returns false when flag is explicitly false', () => {
    expect(isPhase1Enabled({ phase1: { outcomeTracking: false } }, 'outcomeTracking')).toBe(false);
  });

  it('returns true when flag is true', () => {
    expect(isPhase1Enabled({ phase1: { outcomeTracking: true } }, 'outcomeTracking')).toBe(true);
  });

  it('reads each flag independently', () => {
    const packConfig = {
      phase1: {
        outcomeTracking: true,
        beforeAfterPhotos: false,
        treatmentPlans: true,
      },
    };
    expect(isPhase1Enabled(packConfig, 'outcomeTracking')).toBe(true);
    expect(isPhase1Enabled(packConfig, 'beforeAfterPhotos')).toBe(false);
    expect(isPhase1Enabled(packConfig, 'treatmentPlans')).toBe(true);
    expect(isPhase1Enabled(packConfig, 'consentForms')).toBe(false);
  });
});

describe('getPhase1Config', () => {
  it('returns all defaults for null packConfig', () => {
    expect(getPhase1Config(null)).toEqual(PHASE1_DEFAULTS);
  });

  it('returns all defaults for undefined packConfig', () => {
    expect(getPhase1Config(undefined)).toEqual(PHASE1_DEFAULTS);
  });

  it('returns all defaults when phase1 key is missing', () => {
    expect(getPhase1Config({})).toEqual(PHASE1_DEFAULTS);
  });

  it('merges partial config with defaults', () => {
    const packConfig = {
      phase1: { outcomeTracking: true, consentForms: true },
    };
    expect(getPhase1Config(packConfig)).toEqual({
      outcomeTracking: true,
      beforeAfterPhotos: false,
      treatmentPlans: false,
      consentForms: true,
      productRecommendations: false,
    });
  });

  it('returns full config when all flags are set', () => {
    const allTrue = {
      phase1: {
        outcomeTracking: true,
        beforeAfterPhotos: true,
        treatmentPlans: true,
        consentForms: true,
        productRecommendations: true,
      },
    };
    expect(getPhase1Config(allTrue)).toEqual({
      outcomeTracking: true,
      beforeAfterPhotos: true,
      treatmentPlans: true,
      consentForms: true,
      productRecommendations: true,
    });
  });

  it('does not mutate PHASE1_DEFAULTS', () => {
    const config = getPhase1Config(null);
    config.outcomeTracking = true;
    expect(PHASE1_DEFAULTS.outcomeTracking).toBe(false);
  });
});
