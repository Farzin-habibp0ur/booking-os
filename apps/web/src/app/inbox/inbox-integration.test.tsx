/**
 * Integration tests for Inbox page agentic features
 * (ActionCardBadge + OutboundCompose integration)
 */
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    slug: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/use-socket', () => ({
  useSocket: () => {},
  getGlobalSocket: () => ({ emit: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
jest.mock('@/components/booking-form-modal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ai-suggestions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ai-booking-panel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ai-summary', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/intake-card', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/saved-views', () => ({
  ViewPicker: () => null,
}));
jest.mock('@/components/action-card', () => ({
  ActionCardBadge: ({ count }: { count: number }) => (
    <div data-testid="action-card-badge">{count} pending</div>
  ),
}));
jest.mock('@/components/outbound', () => ({
  OutboundCompose: ({ customerId, customerName, onSend, onClose }: any) => (
    <div data-testid="outbound-compose-modal">
      <span>Compose to {customerName}</span>
      <button data-testid="outbound-send" onClick={() => onSend({ customerId, content: 'Hello!' })}>
        Send
      </button>
      <button data-testid="outbound-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

// Needed by jsdom
Element.prototype.scrollIntoView = jest.fn();

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { api } from '@/lib/api';
import InboxPage from './page';

const mockApi = api as jest.Mocked<typeof api>;

const mockConversation = {
  id: 'conv-1',
  customerId: 'cust-1',
  customer: { id: 'cust-1', name: 'Emma Wilson', phone: '+1234' },
  status: 'OPEN',
  lastMessageAt: '2026-02-18T10:00:00Z',
  tags: [],
  assignedTo: null,
  messages: [{ content: 'Hello' }],
};

function setupMocks(actionCardCount = 5) {
  mockApi.get.mockImplementation((path: string) => {
    if (path.includes('/conversations/counts'))
      return Promise.resolve({
        all: 1,
        unassigned: 0,
        mine: 0,
        overdue: 0,
        waiting: 0,
        snoozed: 0,
        closed: 0,
      });
    if (path.includes('/messages'))
      return Promise.resolve([
        {
          id: 'm1',
          content: 'Hello',
          direction: 'INBOUND',
          createdAt: '2026-02-18T10:00:00Z',
        },
      ]);
    if (path.includes('/notes')) return Promise.resolve([]);
    if (path.includes('/conversations')) return Promise.resolve({ data: [mockConversation] });
    if (path.includes('/bookings')) return Promise.resolve([]);
    if (path.includes('/customers/'))
      return Promise.resolve({
        id: 'cust-1',
        name: 'Emma Wilson',
        phone: '+1234',
        tags: [],
      });
    if (path === '/staff') return Promise.resolve([]);
    if (path === '/templates') return Promise.resolve([]);
    if (path === '/locations') return Promise.resolve([]);
    if (path === '/action-cards/count') return Promise.resolve({ count: actionCardCount });
    return Promise.resolve([]);
  });
  mockApi.post.mockResolvedValue({});
}

async function renderAndSelectConversation(actionCardCount = 5) {
  setupMocks(actionCardCount);

  await act(async () => {
    render(<InboxPage />);
  });

  // Wait for conversations to load
  await waitFor(() => {
    expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
  });

  // Select the conversation by clicking on the conversation list item text
  const emmaWilsonTexts = screen.getAllByText('Emma Wilson');
  await act(async () => {
    fireEvent.click(emmaWilsonTexts[0]);
  });

  // Wait for customer data to load (the new outbound button depends on customer state)
  await waitFor(
    () => {
      // Customer panel should show customer info
      expect(screen.getAllByText('Emma Wilson').length).toBeGreaterThanOrEqual(2);
    },
    { timeout: 3000 },
  );
}

describe('Inbox Agentic Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads action card count on mount', async () => {
    setupMocks(3);
    await act(async () => {
      render(<InboxPage />);
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/action-cards/count');
    });
  });

  it('shows action card badge in sidebar when count > 0', async () => {
    await renderAndSelectConversation(3);

    await waitFor(() => {
      expect(screen.getByTestId('inbox-action-card-badge')).toBeInTheDocument();
      expect(screen.getByText('3 pending')).toBeInTheDocument();
    });
  });

  it('hides action card badge when count is 0', async () => {
    await renderAndSelectConversation(0);

    expect(screen.queryByTestId('inbox-action-card-badge')).not.toBeInTheDocument();
  });

  it('opens outbound compose modal from thread header', async () => {
    await renderAndSelectConversation(0);

    const outboundBtn = screen.getByTestId('inbox-new-outbound');
    expect(outboundBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(outboundBtn);
    });

    expect(screen.getByTestId('outbound-compose-modal')).toBeInTheDocument();
    expect(screen.getByText('Compose to Emma Wilson')).toBeInTheDocument();
  });

  it('sends outbound draft via API', async () => {
    await renderAndSelectConversation(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId('inbox-new-outbound'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('outbound-send'));
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/outbound/draft', {
        customerId: 'cust-1',
        content: 'Hello!',
      });
    });
  });

  it('closes outbound compose modal', async () => {
    await renderAndSelectConversation(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId('inbox-new-outbound'));
    });

    expect(screen.getByTestId('outbound-compose-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('outbound-close'));
    });

    expect(screen.queryByTestId('outbound-compose-modal')).not.toBeInTheDocument();
  });

  it('handles action card count API failure gracefully', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/action-cards/count') return Promise.reject(new Error('Not found'));
      if (path.includes('/conversations/counts'))
        return Promise.resolve({
          all: 0,
          unassigned: 0,
          mine: 0,
          overdue: 0,
          waiting: 0,
          snoozed: 0,
          closed: 0,
        });
      if (path.includes('/conversations')) return Promise.resolve({ data: [] });
      return Promise.resolve([]);
    });

    await act(async () => {
      render(<InboxPage />);
    });

    // Should not crash — action card count defaults to 0
    expect(screen.queryByTestId('action-card-badge')).not.toBeInTheDocument();
  });

  it('supports bulk selection of conversations', async () => {
    setupMocks(0);

    await act(async () => {
      render(<InboxPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    });

    // Get conversation checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    // Select the conversation checkbox (second checkbox, first is select-all)
    const conversationCheckbox = checkboxes[1];

    await act(async () => {
      fireEvent.click(conversationCheckbox);
    });

    // Verify floating action bar appears
    await waitFor(() => {
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });
  });

  it('displays bulk action buttons when conversations are selected', async () => {
    setupMocks(0);

    await act(async () => {
      render(<InboxPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    });

    // Select the conversation
    const checkboxes = screen.getAllByRole('checkbox');
    const conversationCheckbox = checkboxes[1];

    await act(async () => {
      fireEvent.click(conversationCheckbox);
    });

    // Verify action buttons appear in floating bar
    await waitFor(() => {
      expect(screen.getByText('Mark as Read')).toBeInTheDocument();
      expect(screen.getByText('Assign to Me')).toBeInTheDocument();
      expect(screen.getByText('Close Selected')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('calls bulk close API when Close Selected is clicked', async () => {
    setupMocks(0);
    mockApi.patch.mockResolvedValue({});

    await act(async () => {
      render(<InboxPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    });

    // Select the conversation
    const checkboxes = screen.getAllByRole('checkbox');
    const conversationCheckbox = checkboxes[1];

    await act(async () => {
      fireEvent.click(conversationCheckbox);
    });

    // Click Close Selected button
    await waitFor(() => {
      const closeBtn = screen.getByText('Close Selected');
      expect(closeBtn).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Close Selected'));
    });

    // Verify API call was made (page now patches each conversation's status individually)
    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/conv-1/status'),
        expect.objectContaining({ status: 'RESOLVED' }),
      );
    });
  });

  it('clears selection when Cancel button clicked in bulk action bar', async () => {
    setupMocks(0);

    await act(async () => {
      render(<InboxPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    });

    // Select the conversation
    const checkboxes = screen.getAllByRole('checkbox');
    const conversationCheckbox = checkboxes[1];

    await act(async () => {
      fireEvent.click(conversationCheckbox);
    });

    // Verify floating bar appears
    await waitFor(() => {
      expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });

    // Click Cancel
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    // Verify floating bar disappears
    await waitFor(() => {
      expect(screen.queryByText(/1 selected/)).not.toBeInTheDocument();
    });
  });
});
