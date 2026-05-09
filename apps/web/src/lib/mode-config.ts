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

function getAdminSections(): NavSections {
  // Primary order per BCC-PIVOT-MASTER-PLAN.md v3 Phase 6:
  //   Inbox, AI Front Desk (/ai), Calendar, Waitlist, Customers, Bookings
  // Secondary/overflow:
  //   Campaigns, Marketing, Invoices, Reports, Performance, Automations
  // /campaigns lives in the tools section but is hidden by getNavItems()
  // unless business.campaignsEnabled === true (default false during pilot).
  return {
    workspace: ['/inbox', '/ai', '/calendar', '/waitlist', '/customers', '/bookings'],
    tools: ['/services', '/staff', '/campaigns', '/marketing', '/invoices'],
    insights: ['/dashboard', '/reports', '/reports/monthly-review', '/roi'],
    aiAgents: ['/ai/agents', '/ai/actions', '/ai/automations', '/ai/settings', '/ai/performance'],
    overflow: {
      tools: ['/campaigns', '/marketing', '/invoices'],
      insights: ['/reports', '/reports/monthly-review', '/roi'],
      aiAgents: ['/ai/agents', '/ai/actions', '/ai/automations', '/ai/settings', '/ai/performance'],
    },
  };
}

function getAgentSections(): NavSections {
  return {
    workspace: ['/inbox', '/calendar', '/customers', '/bookings', '/waitlist'],
    tools: ['/services'],
    insights: ['/dashboard', '/reports'],
  };
}

const providerSections: NavSections = {
  workspace: ['/inbox', '/calendar', '/customers', '/bookings'],
  tools: ['/services'],
  insights: ['/dashboard'],
};

function getModes(packName?: string): ModeDefinition[] {
  const adminSections = getAdminSections();
  const agentSections = getAgentSections();
  return [
    {
      key: 'admin',
      labels: {
        general: 'Admin',
        aesthetic: 'Clinic Manager',
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
