export type AppMode = 'admin' | 'agent' | 'provider';

export interface NavSections {
  workspace: string[];
  tools: string[];
  insights: string[];
  aiAgents?: string[];
  overflow?: {
    tools?: string[];
    insights?: string[];
    aiAgents?: string[];
  };
}

export interface SplitSection {
  primary: string[];
  overflow: string[];
}

export interface SplitSections {
  workspace: SplitSection;
  tools: SplitSection;
  insights: SplitSection;
  aiAgents: SplitSection;
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
    primary: [...s.workspace, ...s.tools, ...s.insights, ...(s.aiAgents || [])],
    secondary: [],
  };
}

function getAdminSections(packName?: string): NavSections {
  const isDealership = packName === 'dealership';
  return {
    workspace: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
    tools: [
      '/services',
      '/staff',
      ...(isDealership ? ['/inventory', '/pipeline'] : []),
      '/invoices',
      '/marketing',
      '/packages',
    ],
    insights: ['/dashboard', '/reports', '/reports/monthly-review', '/roi'],
    aiAgents: ['/ai', '/ai/agents', '/ai/actions', '/ai/performance'],
    overflow: {
      tools: ['/packages'],
      insights: ['/reports/monthly-review', '/roi'],
      aiAgents: ['/ai/actions', '/ai/agents', '/ai/performance'],
    },
  };
}

function getAgentSections(packName?: string): NavSections {
  const isDealership = packName === 'dealership';
  return {
    workspace: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
    tools: ['/services', ...(isDealership ? ['/inventory', '/pipeline'] : [])],
    insights: ['/dashboard', '/reports'],
  };
}

const providerSections: NavSections = {
  workspace: ['/inbox', '/calendar', '/customers', '/bookings'],
  tools: ['/services', '/service-board'],
  insights: ['/dashboard'],
};

function getModes(packName?: string): ModeDefinition[] {
  const adminSections = getAdminSections(packName);
  const agentSections = getAgentSections(packName);
  return [
    {
      key: 'admin',
      labels: {
        general: 'Admin',
        aesthetic: 'Clinic Manager',
        dealership: 'Service Manager',
        wellness: 'Studio Manager',
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
        wellness: 'Front Desk',
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
        wellness: 'Practitioner',
      },
      sections: providerSections,
      primaryNavPaths: flattenSections(providerSections).primary,
      secondaryNavPaths: [],
      defaultLandingPath: '/calendar',
      allowedRoles: ['ADMIN', 'SERVICE_PROVIDER'],
    },
  ];
}

/**
 * Splits each section's paths into primary (shown in sidebar) and overflow
 * (shown under a collapsible "More" section). If no overflow is declared,
 * all paths are primary — backward compatible.
 */
export function splitSectionPaths(sections: NavSections): SplitSections {
  const overflowTools = new Set(sections.overflow?.tools ?? []);
  const overflowInsights = new Set(sections.overflow?.insights ?? []);
  const overflowAiAgents = new Set(sections.overflow?.aiAgents ?? []);

  return {
    workspace: {
      primary: sections.workspace,
      overflow: [],
    },
    tools: {
      primary: sections.tools.filter((p) => !overflowTools.has(p)),
      overflow: sections.tools.filter((p) => overflowTools.has(p)),
    },
    insights: {
      primary: sections.insights.filter((p) => !overflowInsights.has(p)),
      overflow: sections.insights.filter((p) => overflowInsights.has(p)),
    },
    aiAgents: {
      primary: (sections.aiAgents ?? []).filter((p) => !overflowAiAgents.has(p)),
      overflow: (sections.aiAgents ?? []).filter((p) => overflowAiAgents.has(p)),
    },
  };
}

export function getModeDefinitions(packName?: string): ModeDefinition[] {
  return getModes(packName);
}

export function getAvailableModes(role: string, packName?: string): ModeDefinition[] {
  return getModes(packName).filter((m) => m.allowedRoles.includes(role));
}

export function getModeLabel(mode: AppMode, packName: string): string {
  const def = getModes(packName).find((m) => m.key === mode);
  if (!def) return mode;
  return def.labels[packName] || def.labels['general'] || mode;
}

export function getDefaultMode(role: string): AppMode {
  if (role === 'ADMIN') return 'admin';
  if (role === 'AGENT') return 'agent';
  return 'provider';
}

export function getModeByKey(key: AppMode, packName?: string): ModeDefinition | undefined {
  return getModes(packName).find((m) => m.key === key);
}
