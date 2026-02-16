import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingPortalPage from './page';

const mockSlug = 'glow-clinic';
jest.mock('next/navigation', () => ({
  useParams: () => ({ slug: mockSlug }),
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
  ToastProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/public-api', () => ({
  publicApi: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { publicApi } from '@/lib/public-api';
const mockPublicApi = publicApi as jest.Mocked<typeof publicApi>;

const mockBusiness = { name: 'Glow Clinic', slug: 'glow-clinic', timezone: 'America/New_York' };
const mockServices = [
  {
    id: 'svc1',
    name: 'Botox',
    description: 'Anti-wrinkle',
    durationMins: 30,
    price: 200,
    category: 'Aesthetic',
  },
  {
    id: 'svc2',
    name: 'Facial',
    description: null,
    durationMins: 60,
    price: 0,
    category: 'General',
  },
];

describe('BookingPortalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows business name and services', async () => {
    mockPublicApi.get.mockImplementation((path: string) => {
      if (path.includes('/services')) return Promise.resolve(mockServices);
      return Promise.resolve(mockBusiness);
    });

    render(<BookingPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
      expect(screen.getByText('Botox')).toBeInTheDocument();
      expect(screen.getByText('Facial')).toBeInTheDocument();
    });
  });

  test('shows 404 for invalid slug', async () => {
    mockPublicApi.get.mockRejectedValue(new Error('Business not found'));

    render(<BookingPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Business not found')).toBeInTheDocument();
    });
  });

  test('shows service details (duration and price)', async () => {
    mockPublicApi.get.mockImplementation((path: string) => {
      if (path.includes('/services')) return Promise.resolve(mockServices);
      return Promise.resolve(mockBusiness);
    });

    render(<BookingPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('30 min')).toBeInTheDocument();
      expect(screen.getByText('$200')).toBeInTheDocument();
      expect(screen.getByText('Free')).toBeInTheDocument();
    });
  });

  test('advances to date/time step when service clicked', async () => {
    mockPublicApi.get.mockImplementation((path: string) => {
      if (path.includes('/services')) return Promise.resolve(mockServices);
      return Promise.resolve(mockBusiness);
    });

    render(<BookingPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('Botox')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Botox'));

    await waitFor(() => {
      expect(screen.getByText('Select a date')).toBeInTheDocument();
    });
  });

  test('shows empty state when no services', async () => {
    mockPublicApi.get.mockImplementation((path: string) => {
      if (path.includes('/services')) return Promise.resolve([]);
      return Promise.resolve(mockBusiness);
    });

    render(<BookingPortalPage />);

    await waitFor(() => {
      expect(screen.getByText('No services available at this time.')).toBeInTheDocument();
    });
  });
});
