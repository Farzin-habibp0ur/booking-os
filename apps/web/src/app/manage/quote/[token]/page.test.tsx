import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import QuoteApprovalPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ token: 'test-token-123' }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/components/self-serve-error', () => ({
  SelfServeError: (props: any) => (
    <div data-testid="self-serve-error">
      <span>{props.title}</span>
      <span>{props.message}</span>
    </div>
  ),
}));

const mockPublicApi = {
  get: jest.fn(),
  post: jest.fn(),
};
jest.mock('@/lib/public-api', () => ({
  publicApi: {
    get: (...args: any[]) => mockPublicApi.get(...args),
    post: (...args: any[]) => mockPublicApi.post(...args),
  },
}));

const mockQuoteData = {
  quote: {
    id: 'q1',
    description: 'Replace front brake pads and rotors.\nIncludes labor and parts.',
    totalAmount: 450,
    pdfUrl: null,
    status: 'PENDING',
    createdAt: '2026-02-17T12:00:00Z',
  },
  booking: {
    id: 'b1',
    service: { id: 's1', name: 'Brake Service', durationMins: 90 },
    staff: { id: 'st1', name: 'Mike M.' },
    customer: { name: 'John Smith' },
  },
  business: { id: 'biz1', name: 'Metro Auto Group' },
};

describe('QuoteApprovalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading ────────────────────────────────────────────────────────

  test('shows loading state initially', () => {
    mockPublicApi.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<QuoteApprovalPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ─── Error states ───────────────────────────────────────────────────

  test('shows error when token is invalid', async () => {
    mockPublicApi.get.mockRejectedValue(new Error('Token has expired'));
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Unable to Load Quote')).toBeInTheDocument();
      expect(screen.getByText('Token has expired')).toBeInTheDocument();
    });
  });

  test('shows generic error message when no error text', async () => {
    mockPublicApi.get.mockRejectedValue(new Error(''));
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Unable to Load Quote')).toBeInTheDocument();
    });
  });

  // ─── Review state ───────────────────────────────────────────────────

  test('renders quote details after loading', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Service Quote')).toBeInTheDocument();
      expect(screen.getByText('Metro Auto Group')).toBeInTheDocument();
    });
  });

  test('shows customer greeting', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText(/Hi John Smith/)).toBeInTheDocument();
    });
  });

  test('displays quote description', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText(/Replace front brake pads/)).toBeInTheDocument();
    });
  });

  test('displays total amount formatted as currency', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('$450.00')).toBeInTheDocument();
    });
  });

  test('displays service name', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Brake Service')).toBeInTheDocument();
    });
  });

  test('displays staff name', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Mike M.')).toBeInTheDocument();
    });
  });

  test('shows approve button', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Approve Quote')).toBeInTheDocument();
    });
  });

  test('shows authorization text', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText(/By approving, you authorize/)).toBeInTheDocument();
    });
  });

  // ─── PDF link ───────────────────────────────────────────────────────

  test('shows PDF download link when pdfUrl is present', async () => {
    mockPublicApi.get.mockResolvedValue({
      ...mockQuoteData,
      quote: { ...mockQuoteData.quote, pdfUrl: 'https://example.com/quote.pdf' },
    });
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      const link = screen.getByText('Download PDF');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://example.com/quote.pdf');
    });
  });

  test('does not show PDF link when pdfUrl is null', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Approve Quote')).toBeInTheDocument();
    });
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();
  });

  // ─── Approval flow ─────────────────────────────────────────────────

  test('calls approve API when button is clicked', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    mockPublicApi.post.mockResolvedValue({});
    render(<QuoteApprovalPage />);
    await waitFor(() => screen.getByText('Approve Quote'));

    fireEvent.click(screen.getByText('Approve Quote'));

    await waitFor(() => {
      expect(mockPublicApi.post).toHaveBeenCalledWith(
        '/self-serve/approve-quote/test-token-123',
        {},
      );
    });
  });

  test('shows submitting state while approving', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    mockPublicApi.post.mockReturnValue(new Promise(() => {})); // never resolves
    render(<QuoteApprovalPage />);
    await waitFor(() => screen.getByText('Approve Quote'));

    fireEvent.click(screen.getByText('Approve Quote'));

    await waitFor(() => {
      expect(screen.getByText('Approving...')).toBeInTheDocument();
    });
  });

  test('shows success state after approval', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    mockPublicApi.post.mockResolvedValue({});
    render(<QuoteApprovalPage />);
    await waitFor(() => screen.getByText('Approve Quote'));

    fireEvent.click(screen.getByText('Approve Quote'));

    await waitFor(() => {
      expect(screen.getByText('Quote Approved')).toBeInTheDocument();
      expect(screen.getByText(/Brake Service/)).toBeInTheDocument();
      expect(screen.getByText(/\$450\.00/)).toBeInTheDocument();
    });
  });

  test('shows "What happens next" on success', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    mockPublicApi.post.mockResolvedValue({});
    render(<QuoteApprovalPage />);
    await waitFor(() => screen.getByText('Approve Quote'));

    fireEvent.click(screen.getByText('Approve Quote'));

    await waitFor(() => {
      expect(screen.getByTestId('what-happens-next')).toBeInTheDocument();
      expect(screen.getByText(/service provider has been notified/)).toBeInTheDocument();
    });
  });

  test('shows error when approval fails', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    mockPublicApi.post.mockRejectedValue(new Error('Token has already been used'));
    render(<QuoteApprovalPage />);
    await waitFor(() => screen.getByText('Approve Quote'));

    fireEvent.click(screen.getByText('Approve Quote'));

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Quote')).toBeInTheDocument();
      expect(screen.getByText('Token has already been used')).toBeInTheDocument();
    });
  });

  // ─── Token validation ──────────────────────────────────────────────

  test('calls validation API with correct token', async () => {
    mockPublicApi.get.mockResolvedValue(mockQuoteData);
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(mockPublicApi.get).toHaveBeenCalledWith('/self-serve/validate/quote/test-token-123');
    });
  });

  // ─── No staff ──────────────────────────────────────────────────────

  test('renders without staff when staff is null', async () => {
    mockPublicApi.get.mockResolvedValue({
      ...mockQuoteData,
      booking: { ...mockQuoteData.booking, staff: null },
    });
    render(<QuoteApprovalPage />);
    await waitFor(() => {
      expect(screen.getByText('Brake Service')).toBeInTheDocument();
    });
    expect(screen.queryByText('Mike M.')).not.toBeInTheDocument();
  });
});
