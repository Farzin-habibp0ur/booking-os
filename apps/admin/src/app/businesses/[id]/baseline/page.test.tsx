import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApi.get(...args),
    post: (...args: unknown[]) => mockApi.post(...args),
    put: (...args: unknown[]) => mockApi.put(...args),
    patch: (...args: unknown[]) => mockApi.patch(...args),
    delete: (...args: unknown[]) => mockApi.delete(...args),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/businesses/biz1/baseline',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'biz1' }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import Page from './page';

beforeEach(() => {
  mockApi.get.mockReset().mockResolvedValue({});
  mockApi.patch.mockReset().mockResolvedValue({});
});

describe('Business baseline page', () => {
  it('renders form with current baseline values pre-filled', async () => {
    mockApi.get.mockResolvedValueOnce({
      monthlyBookings: 80,
      monthlyRevenue: 24500,
      capturedAt: '2026-05-01T12:00:00Z',
      source: 'concierge_call',
    });

    render(<Page />);

    const bookingsInput = (await screen.findByTestId(
      'baseline-monthly-bookings',
    )) as HTMLInputElement;
    expect(bookingsInput.value).toBe('80');
    const revenueInput = screen.getByTestId('baseline-monthly-revenue') as HTMLInputElement;
    expect(revenueInput.value).toBe('24500');
  });

  it('submits PATCH with parsed values', async () => {
    mockApi.get.mockResolvedValueOnce({
      monthlyBookings: null,
      monthlyRevenue: null,
      capturedAt: null,
      source: null,
    });
    mockApi.patch.mockResolvedValueOnce({
      monthlyBookings: 100,
      monthlyRevenue: 30000,
      capturedAt: new Date().toISOString(),
      source: 'concierge_call',
    });

    render(<Page />);

    const bookingsInput = await screen.findByTestId('baseline-monthly-bookings');
    fireEvent.change(bookingsInput, { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('baseline-monthly-revenue'), {
      target: { value: '30000' },
    });

    fireEvent.click(screen.getByTestId('baseline-submit'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/admin/businesses/biz1/baseline',
        expect.objectContaining({
          monthlyBookings: 100,
          monthlyRevenue: 30000,
        }),
      );
    });
    expect(await screen.findByTestId('baseline-success')).toBeInTheDocument();
  });
});
