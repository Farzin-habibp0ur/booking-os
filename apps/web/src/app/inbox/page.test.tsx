const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  useParams: () => ({}),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'staff1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, _params?: any) => key }),
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
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;
jest.mock('@/components/booking-form-modal', () => ({
  __esModule: true,
  default: ({ isOpen }: any) => (isOpen ? <div data-testid="booking-form-modal" /> : null),
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

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InboxPage from './page';

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

const mockConversations = [
  {
    id: 'conv-1',
    customerId: 'cust-1',
    customer: { id: 'cust-1', name: 'Emma Wilson', phone: '+1234' },
    status: 'OPEN',
    lastMessageAt: '2026-01-15T10:00:00Z',
    tags: [],
    messages: [{ content: 'Hello there' }],
    metadata: {},
  },
  {
    id: 'conv-2',
    customerId: 'cust-2',
    customer: { id: 'cust-2', name: 'Bob Smith', phone: '+5678' },
    status: 'OPEN',
    lastMessageAt: '2026-01-14T10:00:00Z',
    tags: [],
    messages: [{ content: 'Need help' }],
    metadata: {},
  },
];

function setupMocks() {
  mockApi.get.mockImplementation((path: string) => {
    if (path.startsWith('/conversations?')) return Promise.resolve({ data: mockConversations });
    if (path === '/conversations/counts')
      return Promise.resolve({
        all: 2,
        unassigned: 0,
        mine: 0,
        overdue: 0,
        waiting: 0,
        snoozed: 0,
        closed: 0,
      });
    if (path === '/conversations/conv-1/messages')
      return Promise.resolve([
        {
          id: 'm1',
          direction: 'INBOUND',
          content: 'Hello there',
          createdAt: '2026-01-15T10:00:00Z',
        },
      ]);
    if (path === '/conversations/conv-1/notes') return Promise.resolve([]);
    if (path === '/customers/cust-1')
      return Promise.resolve({
        id: 'cust-1',
        name: 'Emma Wilson',
        phone: '+1234',
        email: 'emma@test.com',
        tags: [],
      });
    if (path === '/customers/cust-1/bookings') return Promise.resolve([]);
    if (path === '/staff') return Promise.resolve([]);
    if (path === '/templates') return Promise.resolve([]);
    if (path === '/locations') return Promise.resolve([]);
    return Promise.resolve([]);
  });
}

describe('InboxPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset search params
    mockSearchParams.delete('conversationId');
  });

  it('renders conversation list', async () => {
    setupMocks();
    render(<InboxPage />);
    await waitFor(() => {
      expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });
  });

  it('selects conversation on click', async () => {
    setupMocks();
    render(<InboxPage />);
    await waitFor(() => screen.getByText('Emma Wilson'));

    fireEvent.click(screen.getByText('Emma Wilson'));

    await waitFor(() => {
      expect(screen.getByText('Hello there')).toBeInTheDocument();
    });
  });

  it('auto-selects conversation from URL param', async () => {
    mockSearchParams.set('conversationId', 'conv-1');
    setupMocks();
    render(<InboxPage />);

    await waitFor(() => {
      // The message thread should be visible with conversation selected
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/conv-1/messages'),
      );
    });
  });

  it('shows customer name link to customer detail page', async () => {
    setupMocks();
    render(<InboxPage />);
    await waitFor(() => screen.getByText('Emma Wilson'));

    // Click to select a conversation first
    fireEvent.click(screen.getByText('Emma Wilson'));

    await waitFor(() => {
      const customerLink = screen.getByTestId('customer-name-link');
      expect(customerLink).toBeInTheDocument();
    });
  });

  it('navigates to customer detail when customer name clicked in sidebar', async () => {
    setupMocks();
    render(<InboxPage />);
    await waitFor(() => screen.getByText('Emma Wilson'));

    fireEvent.click(screen.getByText('Emma Wilson'));

    await waitFor(() => screen.getByTestId('customer-name-link'));

    fireEvent.click(screen.getByTestId('customer-name-link'));

    expect(mockPush).toHaveBeenCalledWith('/customers/cust-1');
  });

  it('shows empty state when no conversations', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/conversations?')) return Promise.resolve({ data: [] });
      if (path === '/conversations/counts')
        return Promise.resolve({
          all: 0,
          unassigned: 0,
          mine: 0,
          overdue: 0,
          waiting: 0,
          snoozed: 0,
          closed: 0,
        });
      if (path === '/staff') return Promise.resolve([]);
      if (path === '/templates') return Promise.resolve([]);
      if (path === '/locations') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<InboxPage />);

    await waitFor(() => {
      expect(screen.getByText('inbox.no_conversations')).toBeInTheDocument();
    });
  });

  it('shows select conversation prompt when none selected', async () => {
    setupMocks();
    render(<InboxPage />);
    await waitFor(() => {
      expect(screen.getByText('inbox.select_conversation')).toBeInTheDocument();
    });
  });
});
