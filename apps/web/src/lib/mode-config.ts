export type AppMode = 'admin' | 'agent' | 'provider';

export interface NavSections {
  workspace: string[];
  tools: string[];
  insights: string[];
}

export interface ModeDefinition {
  key: AppMode;
  labels: Record<string, string>; // per vertical pack name
  /** @deprecated — use `sections` instead. Kept for backwards compat. */
  primaryNavPaths: string[];
  /** @deprecated — use `sections` instead. Kept for backwards compat. */
  secondaryNavPaths: string[];
  /** 3-section nav model: Workspace / Tools / Insights */
  sections: NavSections;
  defaultLandingPath: string;
  allowedRoles: string[];
}

function flattenSections(s: NavSections): { primary: string[]; secondary: string[] } {
  return {
    primary: [...s.workspace, ...s.tools, ...s.insights],
    secondary: [],
  };
}

const adminSections: NavSections = {
  workspace: ['/inbox', '/calendar', '/customers', '/bookings'],
  tools: [
    '/services',
    '/staff',
    '/campaigns',
    '/automations',
    '/marketing/queue',
    '/marketing/agents',
    '/marketing/sequences',
    '/testimonials',
  ],
  insights: ['/dashboard', '/reports', '/roi', '/ai'],
};

const agentSections: NavSections = {
  workspace: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
  tools: ['/services'],
  insights: ['/dashboard', '/reports'],
};

const providerSections: NavSections = {
  workspace: ['/calendar', '/bookings'],
  tools: ['/services', '/service-board'],
  insights: ['/dashboard'],
};

const MODES: ModeDefinition[] = [
  {
    key: 'admin',
    labels: {
      general: 'Admin',
      aesthetic: 'Clinic Manager',
      dealership: 'Service Manager',
    },
    sections: adminSections,
    primaryNavPaths: flattenSections(adminSections).primary,
    secondaryNavPaths: [],
    defaultLandingPath: '/dashboard',
    allowedRoles: ['ADMIN'],
  },
  {
    key: 'agent',
    labels: {
      general: 'Agent',
      aesthetic: 'Reception',
      dealership: 'Service Advisor',
    },
    sections: agentSections,
    primaryNavPaths: flattenSections(agentSections).primary,
    secondaryNavPaths: [],
    defaultLandingPath: '/inbox',
    allowedRoles: ['ADMIN', 'AGENT'],
  },
  {
    key: 'provider',
    labels: {
      general: 'Provider',
      aesthetic: 'Provider',
      dealership: 'Technician',
    },
    sections: providerSections,
    primaryNavPaths: flattenSections(providerSections).primary,
    secondaryNavPaths: [],
    defaultLandingPath: '/calendar',
    allowedRoles: ['ADMIN', 'SERVICE_PROVIDER'],
  },
];

export function getModeDefinitions(): ModeDefinition[] {
  return MODES;
}

export function getAvailableModes(role: string): ModeDefinition[] {
  return MODES.filter((m) => m.allowedRoles.includes(role));
}

export function getModeLabel(mode: AppMode, packName: string): string {
  const def = MODES.find((m) => m.key === mode);
  if (!def) return mode;
  return def.labels[packName] || def.labels['general'] || mode;
}

export function getDefaultMode(role: string): AppMode {
  if (role === 'ADMIN') return 'admin';
  if (role === 'AGENT') return 'agent';
  return 'provider';
}

export function getModeByKey(key: AppMode): ModeDefinition | undefined {
  return MODES.find((m) => m.key === key);
}
