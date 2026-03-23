import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ServiceBoardPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'dealership',
    labels: { customer: 'Client', booking: 'Appointment', service: 'Service' },
    customerFields: [],
  }),
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      name: 'Admin',
      role: 'ADMIN',
      businessId: 'b1',
      business: { packConfig: { kanbanEnabled: true } },
    },
    loading: false,
  }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockBookings = [
  {
    id: 'b1',
    kanbanStatus: 'CHECKED_IN',
    startTime: '2026-02-17T09:00:00Z',
    endTime: '2026-02-17T10:00:00Z',
    notes: null,
    status: 'CONFIRMED',
    customer: {
      id: 'c1',
      name: 'John Smith',
      phone: '+1234567890',
      customFields: { make: 'Toyota', model: 'Camry', year: '2022', vin: '1ABC23DEF456' },
    },
    service: { id: 's1', name: 'Oil Change', durationMins: 30 },
    staff: { id: 'st1', name: 'Mike M.' },
  },
  {
    id: 'b2',
    kanbanStatus: 'IN_PROGRESS',
    startTime: '2026-02-17T10:00:00Z',
    endTime: '2026-02-17T11:30:00Z',
    notes: null,
    status: 'IN_PROGRESS',
    customer: {
      id: 'c2',
      name: 'Jane Doe',
      phone: '+1234567891',
      customFields: { make: 'Honda', model: 'Civic', year: '2024' },
    },
    service: { id: 's2', name: 'Brake Service', durationMins: 90 },
    staff: { id: 'st2', name: 'Alex T.' },
  },
  {
    id: 'b3',
    kanbanStatus: 'READY_FOR_PICKUP',
    startTime: '2026-02-17T08:00:00Z',
    endTime: '2026-02-17T09:00:00Z',
    notes: null,
    status: 'CONFIRMED',
    customer: {
      id: 'c3',
      name: 'Bob Wilson',
      phone: '+1234567892',
      customFields: {},
    },
    service: { id: 's3', name: 'Diagnostic Check', durationMins: 45 },
    staff: null,
  },
];

const mockStaff = [
  { id: 'st1', name: 'Mike M.' },
  { id: 'st2', name: 'Alex T.' },
];

describe('ServiceBoardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Rendering ────────────────────────────────────────────────────────

  test('renders the service board with title', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('Service Board')).toBeInTheDocument();
    });
  });

  test('renders all 5 kanban columns', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve([]);
      if (path === '/staff') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('Checked In')).toBeInTheDocument();
      expect(screen.getByText('Diagnosing')).toBeInTheDocument();
      expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Ready for Pickup')).toBeInTheDocument();
    });
  });

  test('shows booking count in header', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('3 active jobs on the board')).toBeInTheDocument();
    });
  });

  // ─── Booking Cards ────────────────────────────────────────────────────

  test('displays booking cards with customer name', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });
  });

  test('displays vehicle info on cards', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('2022 Toyota Camry')).toBeInTheDocument();
      expect(screen.getByText('2024 Honda Civic')).toBeInTheDocument();
    });
  });

  test('displays VIN on cards', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('VIN: 1ABC23DEF456')).toBeInTheDocument();
    });
  });

  test('displays service name on cards', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('Oil Change')).toBeInTheDocument();
      expect(screen.getByText('Brake Service')).toBeInTheDocument();
      expect(screen.getByText('Diagnostic Check')).toBeInTheDocument();
    });
  });

  test('displays staff name on cards', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      // Staff names appear in both cards and filter dropdown, so use getAllByText
      expect(screen.getAllByText('Mike M.').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Alex T.').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Staff Filter ─────────────────────────────────────────────────────

  test('shows staff filter dropdown', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve([]);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('All Staff')).toBeInTheDocument();
    });
  });

  test('filters by staff when selected', async () => {
    jest.useRealTimers();
    const getCalls: string[] = [];
    mockApi.get.mockImplementation((path: string) => {
      getCalls.push(path);
      if (path.startsWith('/bookings/kanban')) return Promise.resolve([]);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => screen.getByText('All Staff'));

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'st1' } });

    await waitFor(() => {
      expect(getCalls.some((c) => c.includes('staffId=st1'))).toBe(true);
    });
  });

  // ─── Refresh ──────────────────────────────────────────────────────────

  test('has refresh button', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve([]);
      if (path === '/staff') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  test('calls API on refresh click', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve([]);
      if (path === '/staff') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => screen.getByText('Refresh'));

    mockApi.get.mockClear();
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('/bookings/kanban'));
    });
  });

  // ─── Drag and Drop ────────────────────────────────────────────────────

  test('updates kanban status on card drop', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    mockApi.patch.mockResolvedValue({});
    render(<ServiceBoardPage />);
    await waitFor(() => screen.getByText('John Smith'));

    // Simulate drag-start on the card
    const card = screen.getByText('John Smith').closest('[draggable]')!;
    fireEvent.dragStart(card);

    // Simulate drop on IN_PROGRESS column
    const inProgressCol = screen.getByText('In Progress').closest('div[class*="flex-1"]')!;
    fireEvent.dragOver(inProgressCol);
    fireEvent.drop(inProgressCol);

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/bookings/b1/kanban-status', {
        kanbanStatus: 'IN_PROGRESS',
      });
    });
  });

  // ─── Empty columns ───────────────────────────────────────────────────

  test('shows "No jobs" in empty columns', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve([]);
      if (path === '/staff') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);
    await waitFor(() => {
      const noJobs = screen.getAllByText('No jobs');
      expect(noJobs.length).toBe(5); // All 5 columns empty
    });
  });

  // ─── Column counts ───────────────────────────────────────────────────

  test('shows correct card counts per column', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path.startsWith('/bookings/kanban')) return Promise.resolve(mockBookings);
      if (path === '/staff') return Promise.resolve(mockStaff);
      return Promise.resolve([]);
    });
    render(<ServiceBoardPage />);

    await waitFor(() => {
      // CHECKED_IN has 1, IN_PROGRESS has 1, READY_FOR_PICKUP has 1
      // The counts are shown as text nodes next to column headers
      const countElements = screen.getAllByText('1');
      expect(countElements.length).toBeGreaterThanOrEqual(3);
    });
  });
});
