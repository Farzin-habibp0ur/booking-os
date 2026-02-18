export type AppMode = 'admin' | 'agent' | 'provider';

export interface ModeDefinition {
  key: AppMode;
  labels: Record<string, string>; // per vertical pack name
  primaryNavPaths: string[];
  secondaryNavPaths: string[];
  defaultLandingPath: string;
  allowedRoles: string[];
}

const MODES: ModeDefinition[] = [
  {
    key: 'admin',
    labels: {
      general: 'Admin',
      aesthetic: 'Clinic Manager',
      dealership: 'Service Manager',
    },
    primaryNavPaths: ['/dashboard', '/reports', '/staff', '/campaigns', '/automations'],
    secondaryNavPaths: [
      '/inbox',
      '/calendar',
      '/customers',
      '/bookings',
      '/services',
      '/waitlist',
      '/service-board',
      '/roi',
      '/settings',
      '/settings/autonomy',
    ],
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
    primaryNavPaths: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
    secondaryNavPaths: ['/dashboard', '/services', '/reports', '/service-board', '/settings'],
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
    primaryNavPaths: ['/calendar', '/bookings', '/services', '/service-board'],
    secondaryNavPaths: ['/dashboard', '/settings'],
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
