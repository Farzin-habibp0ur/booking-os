import {
  SETTINGS_CATEGORIES,
  getSettingsCategoriesForRole,
  getFirstPageForCategory,
  type SettingsCategory,
} from './settings-config';

describe('settings-config', () => {
  describe('SETTINGS_CATEGORIES', () => {
    it('defines exactly 7 categories', () => {
      expect(SETTINGS_CATEGORIES).toHaveLength(8);
    });

    it('has the expected category keys', () => {
      const keys = SETTINGS_CATEGORIES.map((c) => c.key);
      expect(keys).toEqual([
        'account',
        'operations',
        'communication',
        'ai',
        'growth',
        'integrations',
        'billing',
        'appearance',
      ]);
    });

    it('each category has required fields', () => {
      for (const cat of SETTINGS_CATEGORIES) {
        expect(cat.key).toBeTruthy();
        expect(cat.label).toBeTruthy();
        expect(cat.description).toBeTruthy();
        expect(cat.icon).toBeDefined();
        expect(cat.accent).toBeTruthy();
        expect(Array.isArray(cat.pages)).toBe(true);
        expect(Array.isArray(cat.roles)).toBe(true);
        expect(cat.roles.length).toBeGreaterThan(0);
      }
    });

    it('Account & Security is visible to all roles', () => {
      const account = SETTINGS_CATEGORIES.find((c) => c.key === 'account');
      expect(account?.roles).toContain('ADMIN');
      expect(account?.roles).toContain('AGENT');
      expect(account?.roles).toContain('SERVICE_PROVIDER');
    });

    it('Appearance is visible to all roles', () => {
      const appearance = SETTINGS_CATEGORIES.find((c) => c.key === 'appearance');
      expect(appearance?.roles).toContain('ADMIN');
      expect(appearance?.roles).toContain('AGENT');
      expect(appearance?.roles).toContain('SERVICE_PROVIDER');
    });

    it('Operations is ADMIN only', () => {
      const operations = SETTINGS_CATEGORIES.find((c) => c.key === 'operations');
      expect(operations?.roles).toEqual(['ADMIN']);
    });

    it('Billing is ADMIN only', () => {
      const billing = SETTINGS_CATEGORIES.find((c) => c.key === 'billing');
      expect(billing?.roles).toEqual(['ADMIN']);
    });
  });

  describe('getSettingsCategoriesForRole', () => {
    it('returns all 7 categories for ADMIN', () => {
      const categories = getSettingsCategoriesForRole('ADMIN');
      expect(categories).toHaveLength(8);
    });

    it('returns only categories with AGENT in roles for AGENT', () => {
      const categories = getSettingsCategoriesForRole('AGENT');
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.length).toBeLessThan(8);
      for (const cat of categories) {
        expect(cat.roles).toContain('AGENT');
      }
    });

    it('returns only categories with SERVICE_PROVIDER in roles', () => {
      const categories = getSettingsCategoriesForRole('SERVICE_PROVIDER');
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.length).toBeLessThan(8);
      for (const cat of categories) {
        expect(cat.roles).toContain('SERVICE_PROVIDER');
      }
    });

    it('AGENT and SERVICE_PROVIDER see Account & Appearance', () => {
      const agentCats = getSettingsCategoriesForRole('AGENT');
      const providerCats = getSettingsCategoriesForRole('SERVICE_PROVIDER');
      expect(agentCats.map((c) => c.key)).toContain('account');
      expect(agentCats.map((c) => c.key)).toContain('appearance');
      expect(providerCats.map((c) => c.key)).toContain('account');
      expect(providerCats.map((c) => c.key)).toContain('appearance');
    });

    it('returns empty array for unknown role', () => {
      const categories = getSettingsCategoriesForRole('UNKNOWN_ROLE');
      expect(categories).toHaveLength(0);
    });
  });

  describe('getFirstPageForCategory', () => {
    it('returns first page path for category with pages', () => {
      const account = SETTINGS_CATEGORIES.find((c) => c.key === 'account')!;
      expect(getFirstPageForCategory(account)).toBe('/settings/account');
    });

    it('returns /settings/branding for appearance category', () => {
      const appearance = SETTINGS_CATEGORIES.find((c) => c.key === 'appearance')!;
      expect(getFirstPageForCategory(appearance)).toBe('/settings/branding');
    });

    it('returns correct first page for each multi-page category', () => {
      const operations = SETTINGS_CATEGORIES.find((c) => c.key === 'operations')!;
      expect(getFirstPageForCategory(operations)).toBe('/settings/calendar');

      const ai = SETTINGS_CATEGORIES.find((c) => c.key === 'ai')!;
      expect(getFirstPageForCategory(ai)).toBe('/settings/ai');
    });
  });
});
