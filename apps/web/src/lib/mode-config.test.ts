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

  describe('admin aiAgents section', () => {
    it('admin mode includes /ai in aiAgents section', () => {
      const admin = getModeByKey('admin');
      expect(admin?.sections.aiAgents).toContain('/ai');
    });
  });

  describe('sections', () => {
    const modes = getModeDefinitions();

    it('each mode has sections with workspace, tools, and insights arrays', () => {
      for (const mode of modes) {
        expect(mode.sections).toBeDefined();
        expect(Array.isArray(mode.sections.workspace)).toBe(true);
        expect(Array.isArray(mode.sections.tools)).toBe(true);
        expect(Array.isArray(mode.sections.insights)).toBe(true);
      }
    });

    it('all section paths start with /', () => {
      for (const mode of modes) {
        const allPaths = [
          ...mode.sections.workspace,
          ...mode.sections.tools,
          ...mode.sections.insights,
          ...(mode.sections.aiAgents || []),
        ];
        for (const path of allPaths) {
          expect(path).toMatch(/^\//);
        }
      }
    });

    it('admin sections include expected paths', () => {
      const admin = modes.find((m) => m.key === 'admin')!;
      expect(admin.sections.workspace).toContain('/inbox');
      expect(admin.sections.workspace).toContain('/calendar');
      expect(admin.sections.workspace).toContain('/customers');
      expect(admin.sections.workspace).toContain('/bookings');
      expect(admin.sections.workspace).toContain('/waitlist');
      expect(admin.sections.tools).toContain('/services');
      expect(admin.sections.tools).toContain('/staff');
      expect(admin.sections.tools).toContain('/campaigns');
      expect(admin.sections.tools).toContain('/automations');
      expect(admin.sections.insights).toContain('/dashboard');
      expect(admin.sections.insights).toContain('/reports');
      expect(admin.sections.insights).toContain('/roi');
    });

    it('admin aiAgents includes AI sub-routes only (no marketing routes)', () => {
      const admin = modes.find((m) => m.key === 'admin')!;
      expect(admin.sections.aiAgents).toContain('/ai');
      expect(admin.sections.aiAgents).toContain('/ai/actions');
      expect(admin.sections.aiAgents).toContain('/ai/agents');
      expect(admin.sections.aiAgents).toContain('/ai/performance');
      expect(admin.sections.aiAgents).not.toContain('/marketing/queue');
      expect(admin.sections.aiAgents).not.toContain('/marketing/agents');
      expect(admin.sections.aiAgents).not.toContain('/marketing/sequences');
      expect(admin.sections.aiAgents).not.toContain('/marketing/rejection-analytics');
    });

    it('agent sections include expected paths', () => {
      const agent = modes.find((m) => m.key === 'agent')!;
      expect(agent.sections.workspace).toContain('/inbox');
      expect(agent.sections.workspace).toContain('/waitlist');
      expect(agent.sections.tools).toContain('/services');
      expect(agent.sections.insights).toContain('/dashboard');
      expect(agent.sections.insights).toContain('/reports');
    });

    it('provider sections include expected paths', () => {
      const provider = modes.find((m) => m.key === 'provider')!;
      expect(provider.sections.workspace).toContain('/calendar');
      expect(provider.sections.workspace).toContain('/bookings');
      expect(provider.sections.tools).toContain('/services');
      expect(provider.sections.insights).toContain('/dashboard');
    });

    it('no path appears in multiple sections within the same mode', () => {
      for (const mode of modes) {
        const allPaths = [
          ...mode.sections.workspace,
          ...mode.sections.tools,
          ...mode.sections.insights,
          ...(mode.sections.aiAgents || []),
        ];
        const unique = new Set(allPaths);
        expect(unique.size).toBe(allPaths.length);
      }
    });

    it('primaryNavPaths contains all paths from sections (backwards compat)', () => {
      for (const mode of modes) {
        const allSectionPaths = [
          ...mode.sections.workspace,
          ...mode.sections.tools,
          ...mode.sections.insights,
          ...(mode.sections.aiAgents || []),
        ];
        for (const path of allSectionPaths) {
          expect(mode.primaryNavPaths).toContain(path);
        }
      }
    });
  });
});
