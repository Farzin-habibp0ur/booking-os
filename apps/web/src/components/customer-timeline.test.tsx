const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CustomerTimeline from './customer-timeline';

const mockEvents = [
  {
    id: 'booking-b1',
    type: 'booking',
    timestamp: '2026-02-01T10:00:00Z',
    title: 'Botox — COMPLETED',
    description: 'with Dr. Chen',
    metadata: { bookingId: 'b1' },
    isSystemEvent: false,
    deepLink: '/bookings/b1',
  },
  {
    id: 'conversation-c1',
    type: 'conversation',
    timestamp: '2026-01-30T10:00:00Z',
    title: 'Conversation — OPEN',
    description: 'Hello there',
    metadata: { conversationId: 'c1' },
    isSystemEvent: false,
    deepLink: '/inbox?conversationId=c1',
  },
  {
    id: 'note-n1',
    type: 'note',
    timestamp: '2026-01-28T10:00:00Z',
    title: 'Note added',
    description: 'Prefers mornings',
    metadata: { noteId: 'n1' },
    isSystemEvent: false,
    deepLink: null,
  },
  {
    id: 'waitlist-w1',
    type: 'waitlist',
    timestamp: '2026-01-25T10:00:00Z',
    title: 'Waitlist — ACTIVE',
    description: 'Filler',
    metadata: {},
    isSystemEvent: true,
    deepLink: null,
  },
  {
    id: 'campaign-cs1',
    type: 'campaign',
    timestamp: '2026-01-20T10:00:00Z',
    title: 'Campaign: Summer Sale',
    description: 'Status: SENT',
    metadata: {},
    isSystemEvent: true,
    deepLink: '/campaigns',
  },
];

function setupMocks(events = mockEvents, hasMore = false) {
  mockApi.get.mockResolvedValue({
    events,
    total: events.length,
    hasMore,
  });
}

describe('CustomerTimeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<CustomerTimeline customerId="cust-1" />);
    expect(screen.getByTestId('timeline-loading')).toBeInTheDocument();
  });

  it('renders timeline events after loading', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('customer-timeline')).toBeInTheDocument();
      expect(screen.getAllByTestId('timeline-event').length).toBe(5);
    });
  });

  it('shows event titles and descriptions', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      expect(screen.getByText('Botox — COMPLETED')).toBeInTheDocument();
      expect(screen.getByText('with Dr. Chen')).toBeInTheDocument();
      expect(screen.getByText('Conversation — OPEN')).toBeInTheDocument();
      expect(screen.getByText('Note added')).toBeInTheDocument();
    });
  });

  it('shows empty state when no events', async () => {
    setupMocks([]);
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('timeline-empty')).toBeInTheDocument();
    });
  });

  it('shows filter chips for all event types', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-booking')).toBeInTheDocument();
      expect(screen.getByTestId('filter-conversation')).toBeInTheDocument();
      expect(screen.getByTestId('filter-note')).toBeInTheDocument();
      expect(screen.getByTestId('filter-waitlist')).toBeInTheDocument();
      expect(screen.getByTestId('filter-quote')).toBeInTheDocument();
      expect(screen.getByTestId('filter-campaign')).toBeInTheDocument();
    });
  });

  it('filters events when type chip clicked', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => screen.getByTestId('filter-booking'));

    fireEvent.click(screen.getByTestId('filter-booking'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('types=booking'));
    });
  });

  it('resets filter when All chip clicked', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => screen.getByTestId('filter-booking'));

    fireEvent.click(screen.getByTestId('filter-booking'));
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId('filter-all'));
    await waitFor(() => {
      const lastCall = mockApi.get.mock.calls[mockApi.get.mock.calls.length - 1][0] as string;
      expect(lastCall).not.toContain('types=');
    });
  });

  it('navigates when clicking an event with deepLink', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => screen.getByText('Botox — COMPLETED'));

    fireEvent.click(screen.getByText('Botox — COMPLETED'));

    expect(mockPush).toHaveBeenCalledWith('/bookings/b1');
  });

  it('navigates to inbox with conversationId for conversation events', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => screen.getByText('Conversation — OPEN'));

    fireEvent.click(screen.getByText('Conversation — OPEN'));

    expect(mockPush).toHaveBeenCalledWith('/inbox?conversationId=c1');
  });

  it('does not navigate for events without deepLink', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => screen.getByText('Note added'));

    fireEvent.click(screen.getByText('Note added'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows system event badges', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      const systemBadges = screen.getAllByText('System');
      expect(systemBadges.length).toBe(2); // waitlist + campaign
    });
  });

  it('toggles system events visibility', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => screen.getByTestId('system-toggle'));

    fireEvent.click(screen.getByTestId('system-toggle'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('showSystem=false'));
    });
  });

  it('shows load more button when hasMore', async () => {
    setupMocks(mockEvents, true);
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('load-more-btn')).toBeInTheDocument();
    });
  });

  it('does not show load more when all events loaded', async () => {
    setupMocks(mockEvents, false);
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      expect(screen.queryByTestId('load-more-btn')).not.toBeInTheDocument();
    });
  });

  it('loads more events when load more clicked', async () => {
    setupMocks(mockEvents, true);
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => screen.getByTestId('load-more-btn'));

    fireEvent.click(screen.getByTestId('load-more-btn'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('offset=20'));
    });
  });

  it('shows count badges on filter chips for types with events', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      // booking has 1 event, conversation has 1, note has 1, waitlist has 1, campaign has 1
      const bookingFilter = screen.getByTestId('filter-booking');
      expect(bookingFilter.textContent).toContain('1');
      const conversationFilter = screen.getByTestId('filter-conversation');
      expect(conversationFilter.textContent).toContain('1');
    });
  });

  it('does not show count badge for types with zero events', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-1" />);
    await waitFor(() => {
      const quoteFilter = screen.getByTestId('filter-quote');
      // quote filter should only have the label text, no count badge
      expect(quoteFilter.textContent).toBe('Quotes');
    });
  });

  it('passes customerId to API call', async () => {
    setupMocks();
    render(<CustomerTimeline customerId="cust-42" />);
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cust-42/timeline'),
      );
    });
  });
});
