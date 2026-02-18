const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'aesthetic',
    slug: 'aesthetic',
    labels: { customer: 'Patient', booking: 'Appointment', service: 'Treatment' },
    customerFields: [],
  }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SearchPage from './page';

const mockSearchResults = {
  customers: [{ id: 'c1', name: 'Alice Smith', phone: '+1234567890', email: 'alice@test.com' }],
  bookings: [
    {
      id: 'b1',
      startTime: '2026-03-15T10:00:00Z',
      status: 'CONFIRMED',
      customer: { name: 'Alice Smith' },
      service: { name: 'Botox' },
    },
  ],
  services: [{ id: 's1', name: 'Botox', durationMins: 30, price: 200 }],
  conversations: [],
  totals: { customers: 1, bookings: 1, services: 1, conversations: 0 },
};

describe('SearchPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders search title and input', () => {
    render(<SearchPage />);
    expect(screen.getByTestId('search-title')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('shows prompt when no query entered', () => {
    render(<SearchPage />);
    expect(screen.getByTestId('search-prompt')).toBeInTheDocument();
  });

  it('searches when typing a query', async () => {
    mockApi.get.mockResolvedValue(mockSearchResults);
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Alice' } });

    jest.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('q=Alice'));
    });
  });

  it('shows results grouped by type', async () => {
    mockApi.get.mockResolvedValue(mockSearchResults);
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Alice' } });
    jest.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByTestId('section-customer')).toBeInTheDocument();
      expect(screen.getByTestId('section-booking')).toBeInTheDocument();
      expect(screen.getByTestId('section-service')).toBeInTheDocument();
    });
  });

  it('shows filter chips with counts', async () => {
    mockApi.get.mockResolvedValue(mockSearchResults);
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Alice' } });
    jest.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByTestId('type-filters')).toBeInTheDocument();
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-customer')).toBeInTheDocument();
    });
  });

  it('filters by type when chip clicked', async () => {
    mockApi.get.mockResolvedValue(mockSearchResults);
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Alice' } });
    jest.advanceTimersByTime(350);

    await waitFor(() => screen.getByTestId('filter-customer'));

    mockApi.get.mockClear();
    mockApi.get.mockResolvedValue({
      ...mockSearchResults,
      bookings: [],
      services: [],
      totals: { customers: 1, bookings: 0, services: 0, conversations: 0 },
    });

    fireEvent.click(screen.getByTestId('filter-customer'));
    jest.advanceTimersByTime(350);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('types=customer'));
    });
  });

  it('navigates to customer detail when result clicked', async () => {
    mockApi.get.mockResolvedValue(mockSearchResults);
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Alice' } });
    jest.advanceTimersByTime(350);

    await waitFor(() => screen.getByText('Alice Smith'));

    fireEvent.click(screen.getByText('Alice Smith'));

    expect(mockPush).toHaveBeenCalledWith('/customers/c1');
  });

  it('shows empty state when no results found', async () => {
    mockApi.get.mockResolvedValue({
      customers: [],
      bookings: [],
      services: [],
      conversations: [],
      totals: { customers: 0, bookings: 0, services: 0, conversations: 0 },
    });
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'zzzzz' } });
    jest.advanceTimersByTime(350);

    await waitFor(() => {
      expect(screen.getByTestId('search-empty')).toBeInTheDocument();
    });
  });

  it('loads more results when load more clicked', async () => {
    mockApi.get.mockResolvedValue({
      ...mockSearchResults,
      totals: { customers: 15, bookings: 1, services: 1, conversations: 0 },
    });
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Alice' } });
    jest.advanceTimersByTime(350);

    await waitFor(() => screen.getByTestId('load-more-customer'));

    mockApi.get.mockResolvedValue({
      customers: [{ id: 'c2', name: 'Alice Jones', phone: '+9999', email: null }],
      bookings: [],
      services: [],
      conversations: [],
      totals: { customers: 15, bookings: 0, services: 0, conversations: 0 },
    });

    fireEvent.click(screen.getByTestId('load-more-customer'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('offset=10'));
    });
  });

  it('reads initial query from URL params', async () => {
    mockSearchParams = new URLSearchParams('q=Alice');
    mockApi.get.mockResolvedValue(mockSearchResults);

    render(<SearchPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('q=Alice'));
    });
  });

  it('uses vertical-aware labels', async () => {
    mockApi.get.mockResolvedValue(mockSearchResults);
    render(<SearchPage />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Alice' } });
    jest.advanceTimersByTime(350);

    await waitFor(() => {
      // Pack labels: Patient → Patients in filter chip
      expect(screen.getByTestId('filter-customer')).toHaveTextContent('Patients');
    });
  });
});
