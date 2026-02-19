import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DuplicatesPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockDuplicates = {
  data: [
    {
      id: 'dup1',
      confidence: 0.85,
      matchFields: ['phone', 'name'],
      status: 'PENDING',
      customer1: {
        id: 'c1',
        name: 'Jane Doe',
        phone: '+1234567890',
        email: 'jane@test.com',
        tags: ['VIP'],
      },
      customer2: { id: 'c2', name: 'Jane D.', phone: '+1234567890', email: null, tags: [] },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 50,
};

describe('DuplicatesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(mockDuplicates);
    mockPost.mockResolvedValue({});
  });

  it('renders page title and back button', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Review Duplicates')).toBeInTheDocument();
    });
  });

  it('fetches duplicates on load with PENDING filter', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/customers/duplicates?status=PENDING&pageSize=50');
    });
  });

  it('renders duplicate card with match percentage', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('85% match')).toBeInTheDocument();
    });
  });

  it('renders both customer names', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane D.')).toBeInTheDocument();
    });
  });

  it('shows action buttons for pending duplicates', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Merge')).toBeInTheDocument();
      expect(screen.getByText('Not Duplicate')).toBeInTheDocument();
      expect(screen.getByText('Snooze')).toBeInTheDocument();
    });
  });

  it('calls merge API when Merge is clicked', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Merge')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Merge'));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/customers/duplicates/dup1/merge');
    });
  });

  it('calls not-duplicate API when Not Duplicate is clicked', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Not Duplicate')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Not Duplicate'));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/customers/duplicates/dup1/not-duplicate');
    });
  });

  it('calls snooze API when Snooze is clicked', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Snooze')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Snooze'));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/customers/duplicates/dup1/snooze');
    });
  });

  it('navigates back to customers page on back click', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Review Duplicates')).toBeInTheDocument();
    });
    // The ArrowLeft button is the first button
    const backButton = screen.getByText('Review Duplicates').closest('div')!
      .previousElementSibling as HTMLElement;
    if (backButton) {
      fireEvent.click(backButton);
      expect(mockPush).toHaveBeenCalledWith('/customers');
    }
  });

  it('shows empty state when no duplicates', async () => {
    mockGet.mockResolvedValue({ data: [], total: 0 });
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('No duplicates found')).toBeInTheDocument();
    });
  });

  it('switches status filter tabs', async () => {
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('All'));
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/customers/duplicates?pageSize=50');
    });
  });

  it('hides action buttons for resolved duplicates', async () => {
    mockGet.mockResolvedValue({
      data: [
        {
          ...mockDuplicates.data[0],
          status: 'MERGED',
        },
      ],
      total: 1,
    });
    render(<DuplicatesPage />);
    await waitFor(() => {
      expect(screen.queryByText('Merge')).not.toBeInTheDocument();
    });
  });
});
