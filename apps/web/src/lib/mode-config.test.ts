import {
  getAvailableModes,
  getModeLabel,
  getDefaultMode,
  getModeByKey,
  getModeDefinitions,
} from './mode-config';

describe('mode-config', () => {
  describe('getAvailableModes', () => {
    it('returns all 3 modes for ADMIN role', () => {
      const modes = getAvailableModes('ADMIN');
      expect(modes).toHaveLength(3);
      expect(modes.map((m) => m.key)).toEqual(['admin', 'agent', 'provider']);
    });

    it('returns only agent mode for AGENT role', () => {
      const modes = getAvailableModes('AGENT');
      expect(modes).toHaveLength(1);
      expect(modes[0].key).toBe('agent');
    });

    it('returns only provider mode for SERVICE_PROVIDER role', () => {
      const modes = getAvailableModes('SERVICE_PROVIDER');
      expect(modes).toHaveLength(1);
      expect(modes[0].key).toBe('provider');
    });

    it('returns empty for unknown role', () => {
      const modes = getAvailableModes('UNKNOWN');
      expect(modes).toHaveLength(0);
    });
  });

  describe('getModeLabel', () => {
    it('returns vertical-specific label for admin mode', () => {
      expect(getModeLabel('admin', 'aesthetic')).toBe('Clinic Manager');
      expect(getModeLabel('admin', 'dealership')).toBe('Service Manager');
      expect(getModeLabel('admin', 'general')).toBe('Admin');
    });

    it('returns vertical-specific label for agent mode', () => {
      expect(getModeLabel('agent', 'aesthetic')).toBe('Reception');
      expect(getModeLabel('agent', 'dealership')).toBe('Service Advisor');
      expect(getModeLabel('agent', 'general')).toBe('Agent');
    });

    it('returns vertical-specific label for provider mode', () => {
      expect(getModeLabel('provider', 'aesthetic')).toBe('Provider');
      expect(getModeLabel('provider', 'dealership')).toBe('Technician');
      expect(getModeLabel('provider', 'general')).toBe('Provider');
    });

    it('falls back to general label for unknown pack', () => {
      expect(getModeLabel('admin', 'unknown-pack')).toBe('Admin');
    });
  });

  describe('getDefaultMode', () => {
    it('returns admin for ADMIN role', () => {
      expect(getDefaultMode('ADMIN')).toBe('admin');
    });

    it('returns agent for AGENT role', () => {
      expect(getDefaultMode('AGENT')).toBe('agent');
    });

    it('returns provider for SERVICE_PROVIDER role', () => {
      expect(getDefaultMode('SERVICE_PROVIDER')).toBe('provider');
    });

    it('returns provider for unknown role', () => {
      expect(getDefaultMode('OTHER')).toBe('provider');
    });
  });

  describe('getModeByKey', () => {
    it('returns mode definition for valid key', () => {
      const mode = getModeByKey('admin');
      expect(mode).toBeDefined();
      expect(mode?.defaultLandingPath).toBe('/dashboard');
    });

    it('returns undefined for invalid key', () => {
      expect(getModeByKey('invalid' as any)).toBeUndefined();
    });
  });

  describe('getModeDefinitions', () => {
    it('returns all mode definitions', () => {
      const defs = getModeDefinitions();
      expect(defs).toHaveLength(3);
    });

    it('each mode has required fields', () => {
      const defs = getModeDefinitions();
      for (const def of defs) {
        expect(def.key).toBeTruthy();
        expect(def.labels).toBeDefined();
        expect(def.primaryNavPaths.length).toBeGreaterThan(0);
        expect(def.defaultLandingPath).toBeTruthy();
        expect(def.allowedRoles.length).toBeGreaterThan(0);
      }
    });
  });

  describe('autonomy settings navigation', () => {
    it('admin mode includes /settings/autonomy in secondary nav', () => {
      const admin = getModeByKey('admin');
      expect(admin?.secondaryNavPaths).toContain('/settings/autonomy');
    });
  });
});
