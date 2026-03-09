import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TestimonialsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('lucide-react', () => {
  const stub = (name: string) => {
    const C = (props: any) => <svg data-testid={`icon-${name}`} {...props} />;
    C.displayName = name;
    return C;
  };
  return new Proxy({}, { get: (_t, prop: string) => stub(prop) });
});
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
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/design-tokens', () => ({
  ELEVATION: { card: 'shadow-soft rounded-2xl' },
}));
jest.mock('@/components/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  EmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
}));
jest.mock('@/components/testimonial-card', () => ({
  TestimonialCard: ({ testimonial, showActions }: any) => (
    <div data-testid={`testimonial-card-${testimonial.id}`}>
      <span>{testimonial.name}</span>
      <span>{testimonial.content}</span>
      {showActions && <span data-testid="actions-visible">actions</span>}
    </div>
  ),
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), del: jest.fn() },
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockTestimonials = [
  {
    id: 't1',
    name: 'Alice',
    content: 'Great service!',
    rating: 5,
    status: 'APPROVED',
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 't2',
    name: 'Bob',
    content: 'Amazing!',
    rating: 4,
    status: 'PENDING',
    createdAt: '2026-01-16T10:00:00Z',
  },
];

describe('TestimonialsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url.startsWith('/testimonials')) {
        return Promise.resolve({ data: mockTestimonials, total: 2 });
      }
      if (url.startsWith('/customers')) {
        return Promise.resolve({
          data: [
            { id: 'c1', name: 'Carol', email: 'carol@test.com', phone: '+1234' },
          ],
        });
      }
      return Promise.resolve({});
    });
  });

  it('renders page title', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => {
      expect(screen.getByText('Testimonials')).toBeInTheDocument();
    });
  });

  it('renders status tabs', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-all')).toBeInTheDocument();
      expect(screen.getByTestId('tab-pending')).toBeInTheDocument();
      expect(screen.getByTestId('tab-approved')).toBeInTheDocument();
      expect(screen.getByTestId('tab-featured')).toBeInTheDocument();
      expect(screen.getByTestId('tab-rejected')).toBeInTheDocument();
    });
  });

  it('renders testimonial cards', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('testimonial-card-t1')).toBeInTheDocument();
      expect(screen.getByTestId('testimonial-card-t2')).toBeInTheDocument();
    });
  });

  it('filters by status tab', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => screen.getByTestId('tab-approved'));

    fireEvent.click(screen.getByTestId('tab-approved'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/testimonials?status=APPROVED');
    });
  });

  it('shows All tab clears filter', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => screen.getByTestId('tab-all'));

    fireEvent.click(screen.getByTestId('tab-approved'));
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/testimonials?status=APPROVED');
    });

    fireEvent.click(screen.getByTestId('tab-all'));
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/testimonials');
    });
  });

  it('shows empty state when no testimonials', async () => {
    mockApi.get.mockResolvedValue({ data: [], total: 0 });
    render(<TestimonialsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('shows Request Testimonial button', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('btn-request-testimonial')).toBeInTheDocument();
    });
  });

  it('opens request modal on button click', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => screen.getByTestId('btn-request-testimonial'));

    fireEvent.click(screen.getByTestId('btn-request-testimonial'));

    await waitFor(() => {
      expect(screen.getByTestId('request-modal')).toBeInTheDocument();
      expect(screen.getByTestId('customer-search')).toBeInTheDocument();
    });
  });

  it('shows customer list in request modal', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => screen.getByTestId('btn-request-testimonial'));

    fireEvent.click(screen.getByTestId('btn-request-testimonial'));

    await waitFor(() => {
      expect(screen.getByTestId('customer-option-c1')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
    });
  });

  it('shows email preview when customer is selected', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => screen.getByTestId('btn-request-testimonial'));

    fireEvent.click(screen.getByTestId('btn-request-testimonial'));
    await waitFor(() => screen.getByTestId('customer-option-c1'));

    fireEvent.click(screen.getByTestId('customer-option-c1'));

    expect(screen.getByTestId('email-preview')).toBeInTheDocument();
  });

  it('shows actions on testimonial cards', async () => {
    render(<TestimonialsPage />);
    await waitFor(() => {
      const actionsElements = screen.getAllByTestId('actions-visible');
      expect(actionsElements.length).toBeGreaterThan(0);
    });
  });
});
