import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ConsoleMessagingPage from './page';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/console/messaging',
}));

const { api } = jest.requireMock<{ api: jest.Mocked<(typeof import('@/lib/api'))['api']> }>(
  '@/lib/api',
);

const mockDashboard = {
  messagesSent: 500,
  messagesDelivered: 450,
  messagesFailed: 20,
  deliveryRate: 90,
  remindersSent: 80,
  remindersFailed: 5,
  reminderSuccessRate: 94,
  activeConversations: 30,
};

const mockFailures = {
  topReasons: [
    { reason: 'INVALID_NUMBER', count: 10 },
    { reason: 'RATE_LIMITED', count: 5 },
  ],
  impactedTenants: [
    {
      businessId: 'biz1',
      businessName: 'Clinic A',
      failureCount: 8,
      lastFailure: '2026-02-20T10:00:00Z',
    },
    {
      businessId: 'biz2',
      businessName: 'Clinic B',
      failureCount: 3,
      lastFailure: '2026-02-19T10:00:00Z',
    },
  ],
};

const mockWebhook = {
  isHealthy: true,
  recentInbound24h: 100,
  recentOutbound24h: 200,
  failedOutbound24h: 5,
};

const mockTenantStatuses = [
  {
    businessId: 'biz1',
    businessName: 'Clinic A',
    hasWhatsappConfig: true,
    locationCount: 3,
    configuredLocationCount: 2,
    recentDeliveryRate: 92,
    lastMessageAt: '2026-02-20T10:00:00Z',
  },
  {
    businessId: 'biz2',
    businessName: 'Clinic B',
    hasWhatsappConfig: false,
    locationCount: 1,
    configuredLocationCount: 0,
    recentDeliveryRate: 0,
    lastMessageAt: null,
  },
];

const mockChecklist = {
  businessName: 'Clinic A',
  items: [
    {
      id: 'whatsapp-config',
      label: 'WhatsApp configuration',
      status: 'ok',
      description: 'At least one location has WhatsApp configured',
    },
    {
      id: 'recent-messages',
      label: 'Recent message delivery',
      status: 'ok',
      description: 'Messages delivered in the last 7 days',
    },
    {
      id: 'stuck-reminders',
      label: 'Reminder processing',
      status: 'error',
      description: '3 reminders stuck',
    },
    {
      id: 'active-conversations',
      label: 'Active conversations',
      status: 'warning',
      description: 'No active conversations',
    },
  ],
};

function setupMocks() {
  api.get.mockImplementation((url: string) => {
    if (url.includes('/dashboard')) return Promise.resolve(mockDashboard);
    if (url.includes('/failures')) return Promise.resolve(mockFailures);
    if (url.includes('/webhook-health')) return Promise.resolve(mockWebhook);
    if (url.includes('/tenant-status')) return Promise.resolve(mockTenantStatuses);
    if (url.includes('/fix-checklist')) return Promise.resolve(mockChecklist);
    return Promise.resolve({});
  });
}

describe('ConsoleMessagingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('shows loading state initially', () => {
    api.get.mockImplementation(() => new Promise(() => {}));
    render(<ConsoleMessagingPage />);
    expect(screen.getByTestId('messaging-loading')).toBeInTheDocument();
  });

  it('renders KPI cards on dashboard tab', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('messages-sent')).toHaveTextContent('500');
    });
    expect(screen.getByTestId('delivery-rate')).toHaveTextContent('90%');
    expect(screen.getByTestId('messages-failed')).toHaveTextContent('20');
    expect(screen.getByTestId('reminders-sent')).toHaveTextContent('80');
  });

  it('renders webhook health banner as healthy', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('webhook-health-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Healthy/)).toBeInTheDocument();
  });

  it('renders webhook health banner as degraded', async () => {
    api.get.mockImplementation((url: string) => {
      if (url.includes('/dashboard')) return Promise.resolve(mockDashboard);
      if (url.includes('/failures')) return Promise.resolve(mockFailures);
      if (url.includes('/webhook-health'))
        return Promise.resolve({ ...mockWebhook, isHealthy: false });
      return Promise.resolve({});
    });
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByText(/Degraded/)).toBeInTheDocument();
    });
  });

  it('renders failure reasons list', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('failure-reasons')).toBeInTheDocument();
    });
    expect(screen.getByText('INVALID_NUMBER')).toBeInTheDocument();
    expect(screen.getByText('RATE_LIMITED')).toBeInTheDocument();
  });

  it('renders impacted tenants table', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('impacted-tenants')).toBeInTheDocument();
    });
    expect(screen.getByText('Clinic A')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    api.get.mockRejectedValue(new Error('API error'));
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('messaging-error')).toBeInTheDocument();
    });
    expect(screen.getByText('API error')).toBeInTheDocument();
  });

  it('shows empty state when no messages', async () => {
    api.get.mockImplementation((url: string) => {
      if (url.includes('/dashboard')) return Promise.resolve({ ...mockDashboard, messagesSent: 0 });
      if (url.includes('/failures'))
        return Promise.resolve({ topReasons: [], impactedTenants: [] });
      if (url.includes('/webhook-health')) return Promise.resolve(mockWebhook);
      return Promise.resolve({});
    });
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('switches to tenant status tab', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('messaging-tabs')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-tenant-status'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('tenant-status-tab')).toBeInTheDocument();
    });
  });

  it('renders tenant status table with WhatsApp badges', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('messaging-tabs')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-tenant-status'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('tenant-status-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('whatsapp-badge-biz1')).toHaveTextContent('Connected');
    expect(screen.getByTestId('whatsapp-badge-biz2')).toHaveTextContent('Not configured');
  });

  it('expands tenant row to show fix checklist', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('messaging-tabs')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-tenant-status'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('tenant-row-biz1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('tenant-row-biz1'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('fix-checklist')).toBeInTheDocument();
    });
    expect(screen.getByTestId('checklist-item-whatsapp-config')).toBeInTheDocument();
    expect(screen.getByTestId('checklist-item-stuck-reminders')).toBeInTheDocument();
  });

  it('renders tab navigation', async () => {
    render(<ConsoleMessagingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('messaging-tabs')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tab-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('tab-tenant-status')).toBeInTheDocument();
  });
});
