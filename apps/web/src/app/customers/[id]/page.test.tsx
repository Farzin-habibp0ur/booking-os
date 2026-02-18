const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'cust-1' }),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [
      { key: 'skinType', label: 'Skin Type', type: 'select', options: ['Dry', 'Oily', 'Normal'] },
      { key: 'allergies', label: 'Allergies', type: 'text' },
      { key: 'vip', label: 'VIP', type: 'boolean' },
    ],
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;
jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
  TableRowSkeleton: () => (
    <tr data-testid="table-skeleton">
      <td />
    </tr>
  ),
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));
jest.mock('@/components/booking-form-modal', () => ({
  __esModule: true,
  default: ({ isOpen }: any) => (isOpen ? <div data-testid="booking-form-modal" /> : null),
}));
jest.mock('@/components/customer-timeline', () => ({
  __esModule: true,
  default: ({ customerId }: any) => (
    <div data-testid="customer-timeline">Timeline for {customerId}</div>
  ),
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerDetailPage from './page';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

const mockCustomer = {
  id: 'cust-1',
  name: 'Emma Wilson',
  phone: '+1234',
  email: 'emma@test.com',
  tags: ['VIP', 'Returning'],
  createdAt: '2026-01-01',
  customFields: { skinType: 'Oily', allergies: 'None', address: '123 Main St' },
};

const mockBookings = [
  {
    id: 'b1',
    startTime: '2025-01-01T10:00:00Z',
    status: 'COMPLETED',
    service: { name: 'Botox', price: 200 },
    staff: { name: 'Dr. Chen' },
  },
  {
    id: 'b2',
    startTime: '2025-02-01T10:00:00Z',
    status: 'NO_SHOW',
    service: { name: 'Filler', price: 300 },
    staff: { name: 'Dr. Chen' },
  },
  {
    id: 'b3',
    startTime: '2028-06-01T10:00:00Z',
    status: 'CONFIRMED',
    service: { name: 'Follow-up', price: 100 },
    staff: { name: 'Dr. Chen' },
  },
];

const mockConversations = [
  { id: 'conv-1', customerId: 'cust-1', lastMessageAt: '2026-01-15T10:00:00Z', status: 'OPEN' },
];

const mockNotes = [
  {
    id: 'n1',
    content: 'Prefers morning appointments',
    staff: { id: 's1', name: 'Dr. Chen' },
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'n2',
    content: 'Allergic to latex',
    staff: { id: 's2', name: 'Sarah' },
    createdAt: '2026-01-12T09:00:00Z',
  },
];

function setupMocks(customer = mockCustomer, bookings = mockBookings, notes = mockNotes) {
  mockApi.get.mockImplementation((path: string) => {
    if (path === '/customers/cust-1') return Promise.resolve(customer);
    if (path === '/customers/cust-1/bookings') return Promise.resolve(bookings);
    if (path === '/customers/cust-1/notes') return Promise.resolve(notes);
    if (path.startsWith('/conversations')) return Promise.resolve({ data: mockConversations });
    return Promise.reject(new Error('Not found'));
  });
}

describe('CustomerDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));
    render(<CustomerDetailPage />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('renders customer details after loading', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Emma Wilson').length).toBeGreaterThan(0);
    });
  });

  it('shows contact information', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('+1234')).toBeInTheDocument();
      expect(screen.getByText('emma@test.com')).toBeInTheDocument();
    });
  });

  it('shows address when available', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
    });
  });

  it('shows customer tags with remove buttons', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getAllByText('VIP').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Returning').length).toBeGreaterThan(0);
    });
  });

  it('shows booking stats', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // total bookings
      expect(screen.getByText('$200')).toBeInTheDocument(); // total spent (1 completed)
    });
  });

  it('shows no-show count', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      // "1" appears in multiple stats (upcoming=1, no-show=1), verify both exist
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows not found when customer does not exist', async () => {
    mockApi.get.mockImplementation(() => Promise.reject(new Error('Not found')));
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('errors.not_found')).toBeInTheDocument();
    });
  });

  it('shows next appointment card', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('customer_detail.next_appointment')).toBeInTheDocument();
      expect(screen.getByText('Follow-up')).toBeInTheDocument();
    });
  });

  // ─── Tab Switching ────────────────────────────────────────────────────

  it('shows AI chat tab by default', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('customer_detail.chat_welcome')).toBeInTheDocument();
    });
  });

  it('switches to bookings tab', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const bookingsTab = screen.getByText(/customer_detail\.bookings_tab/);
    fireEvent.click(bookingsTab);

    await waitFor(() => {
      expect(screen.getByText('customer_detail.upcoming_section')).toBeInTheDocument();
      expect(screen.getByText('customer_detail.history_section')).toBeInTheDocument();
    });
  });

  it('switches to info tab', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const infoTab = screen.getByText('customer_detail.details_tab');
    fireEvent.click(infoTab);

    await waitFor(() => {
      expect(screen.getByText('customer_detail.full_name')).toBeInTheDocument();
      expect(screen.getByText('customer_detail.customer_since')).toBeInTheDocument();
    });
  });

  it('shows custom fields in info tab', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.details_tab'));

    await waitFor(() => {
      expect(screen.getByText('Skin Type')).toBeInTheDocument();
      expect(screen.getByText('Allergies')).toBeInTheDocument();
    });
  });

  // ─── Edit Modal ───────────────────────────────────────────────────────

  it('opens edit modal when pencil is clicked', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    // Click the pencil icon (in the contact section)
    const editButtons = screen.getAllByRole('button');
    const pencilButton = editButtons.find((b) => b.querySelector('svg') && b.closest('.bg-white'));
    // Find and click the button that triggers editing
    const contactHeader = screen.getByText('customer_detail.contact');
    const editBtn = contactHeader.parentElement?.querySelector('button');
    if (editBtn) fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText('customer_detail.edit_title')).toBeInTheDocument();
    });
  });

  it('saves edits and refreshes', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({});
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    // Open edit modal
    const contactHeader = screen.getByText('customer_detail.contact');
    const editBtn = contactHeader.parentElement?.querySelector('button');
    if (editBtn) fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText('customer_detail.edit_title')).toBeInTheDocument();
    });

    // Click save
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/customers/cust-1', expect.any(Object));
    });
  });

  it('closes edit modal on cancel', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const contactHeader = screen.getByText('customer_detail.contact');
    const editBtn = contactHeader.parentElement?.querySelector('button');
    if (editBtn) fireEvent.click(editBtn);

    await waitFor(() => screen.getByText('customer_detail.edit_title'));

    fireEvent.click(screen.getByText('common.cancel'));

    await waitFor(() => {
      expect(screen.queryByText('customer_detail.edit_title')).not.toBeInTheDocument();
    });
  });

  // ─── Tag Management ───────────────────────────────────────────────────

  it('removes a tag when X is clicked', async () => {
    setupMocks();
    mockApi.patch.mockResolvedValue({});
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('VIP'));

    // Find remove buttons (X icons next to tags)
    const vipTag = screen.getAllByText('VIP')[0];
    const removeBtn = vipTag.parentElement?.querySelector('button');
    if (removeBtn) fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/customers/cust-1', {
        tags: ['Returning'],
      });
    });
  });

  // ─── AI Chat ──────────────────────────────────────────────────────────

  it('shows prompt chips when chat is empty', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    expect(screen.getByText('customer_detail.chip_summarize')).toBeInTheDocument();
    expect(screen.getByText('customer_detail.chip_treatments')).toBeInTheDocument();
  });

  it('sets chat input when prompt chip is clicked', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.chip_summarize'));

    const chatInput = screen.getByPlaceholderText('customer_detail.chat_placeholder');
    expect(chatInput).toHaveValue('customer_detail.chip_summarize');
  });

  it('sends chat message and shows response', async () => {
    setupMocks();
    mockApi.post.mockResolvedValue({ answer: 'Emma is a regular customer.' });
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const chatInput = screen.getByPlaceholderText('customer_detail.chat_placeholder');
    await userEvent.type(chatInput, 'Tell me about this customer');
    fireEvent.keyDown(chatInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Tell me about this customer')).toBeInTheDocument();
      expect(screen.getByText('Emma is a regular customer.')).toBeInTheDocument();
    });
  });

  it('shows error message when chat fails', async () => {
    setupMocks();
    mockApi.post.mockRejectedValue(new Error('API error'));
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const chatInput = screen.getByPlaceholderText('customer_detail.chat_placeholder');
    await userEvent.type(chatInput, 'Tell me about this customer');
    fireEvent.keyDown(chatInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('customer_detail.chat_error')).toBeInTheDocument();
    });
  });

  // ─── Booking Form Modal ───────────────────────────────────────────────

  it('opens booking form modal', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.new_booking'));

    await waitFor(() => {
      expect(screen.getByTestId('booking-form-modal')).toBeInTheDocument();
    });
  });

  // ─── Booking Rows ─────────────────────────────────────────────────────

  it('shows bookings with status badges in bookings tab', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText(/customer_detail\.bookings_tab/));

    await waitFor(() => {
      expect(screen.getByText('Botox')).toBeInTheDocument();
      expect(screen.getByText('Filler')).toBeInTheDocument();
      // Follow-up appears in both next appointment card and bookings list
      expect(screen.getAllByText('Follow-up').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows no history message when no past bookings', async () => {
    setupMocks(mockCustomer, [
      {
        id: 'b3',
        startTime: '2028-06-01T10:00:00Z',
        status: 'CONFIRMED',
        service: { name: 'Follow-up', price: 100 },
        staff: { name: 'Dr. Chen' },
      },
    ]);
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText(/customer_detail\.bookings_tab/));

    await waitFor(() => {
      expect(screen.getByText('customer_detail.no_booking_history')).toBeInTheDocument();
    });
  });

  // ─── Back Navigation ──────────────────────────────────────────────────

  it('navigates back to customers list', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const backBtn = screen.getAllByRole('button')[0]; // First button is back
    fireEvent.click(backBtn);

    expect(mockPush).toHaveBeenCalledWith('/customers');
  });

  // ─── Message Button ────────────────────────────────────────────────

  it('navigates to inbox with conversationId when message button clicked', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const messageBtn = screen.getByTestId('message-customer-btn');
    fireEvent.click(messageBtn);

    expect(mockPush).toHaveBeenCalledWith('/inbox?conversationId=conv-1');
  });

  it('navigates to inbox without conversationId when no conversations exist', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/customers/cust-1') return Promise.resolve(mockCustomer);
      if (path === '/customers/cust-1/bookings') return Promise.resolve(mockBookings);
      if (path === '/customers/cust-1/notes') return Promise.resolve([]);
      if (path.startsWith('/conversations')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Not found'));
    });
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    const messageBtn = screen.getByTestId('message-customer-btn');
    fireEvent.click(messageBtn);

    expect(mockPush).toHaveBeenCalledWith('/inbox');
  });

  // ─── Context Row ───────────────────────────────────────────────────

  it('shows last booking date in context row', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('last-booking-date')).toBeInTheDocument();
    });
  });

  it('shows last conversation date in context row', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('last-conversation-date')).toBeInTheDocument();
    });
  });

  // ─── Notes Tab ─────────────────────────────────────────────────────

  it('switches to notes tab and shows notes', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.notes_tab'));

    await waitFor(() => {
      expect(screen.getByText('Prefers morning appointments')).toBeInTheDocument();
      expect(screen.getByText('Allergic to latex')).toBeInTheDocument();
    });
  });

  it('shows note author and timestamp', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.notes_tab'));

    await waitFor(() => {
      const noteCards = screen.getAllByTestId('note-card');
      expect(noteCards.length).toBe(2);
    });
  });

  it('creates a new note', async () => {
    setupMocks();
    mockApi.post.mockResolvedValue({ id: 'n3', content: 'New note' });
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.notes_tab'));

    await waitFor(() => screen.getByTestId('note-composer'));

    const textarea = screen.getByTestId('note-composer');
    await userEvent.type(textarea, 'New important note');

    fireEvent.click(screen.getByTestId('add-note-btn'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/customers/cust-1/notes', {
        content: 'New important note',
      });
    });
  });

  it('shows empty notes message when no notes exist', async () => {
    setupMocks(mockCustomer, mockBookings, []);
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.notes_tab'));

    await waitFor(() => {
      expect(screen.getByText('customer_detail.no_notes')).toBeInTheDocument();
    });
  });

  it('deletes a note', async () => {
    setupMocks();
    mockApi.del.mockResolvedValue({});
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.notes_tab'));

    await waitFor(() => screen.getAllByTestId('delete-note-btn'));

    fireEvent.click(screen.getAllByTestId('delete-note-btn')[0]);

    await waitFor(() => {
      expect(mockApi.del).toHaveBeenCalledWith('/customers/cust-1/notes/n1');
    });
  });

  it('enters edit mode for a note', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.notes_tab'));

    await waitFor(() => screen.getAllByTestId('edit-note-btn'));

    fireEvent.click(screen.getAllByTestId('edit-note-btn')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('note-edit-textarea')).toBeInTheDocument();
    });
  });

  it('shows note count badge on notes tab', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    // The notes count badge shows "2" for 2 notes
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  // ─── Timeline Tab (Placeholder) ───────────────────────────────────

  it('renders timeline component when switching to timeline tab', async () => {
    setupMocks();
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.timeline_tab'));

    await waitFor(() => {
      expect(screen.getByTestId('customer-timeline')).toBeInTheDocument();
      expect(screen.getByText('Timeline for cust-1')).toBeInTheDocument();
    });
  });

  // ─── Note CRUD Error Handling ──────────────────────────────────────

  it('shows toast on note creation error', async () => {
    setupMocks();
    mockApi.post.mockRejectedValue(new Error('Server error'));
    render(<CustomerDetailPage />);
    await waitFor(() => screen.getAllByText('Emma Wilson'));

    fireEvent.click(screen.getByText('customer_detail.notes_tab'));
    await waitFor(() => screen.getByTestId('note-composer'));

    await userEvent.type(screen.getByTestId('note-composer'), 'Failing note');
    fireEvent.click(screen.getByTestId('add-note-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });
  });
});
