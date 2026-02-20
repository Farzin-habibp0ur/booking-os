const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/console/support',
}));
jest.mock('next/link', () => {
  const Link = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  return Link;
});
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'admin1', role: 'SUPER_ADMIN', email: 'admin@businesscommandcentre.com' },
    loading: false,
  }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('lucide-react', () => {
  const icons = ['LifeBuoy', 'Search', 'Plus', 'ChevronLeft', 'ChevronRight', 'X', 'MessageSquare'];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />;
  });
  return mocks;
});

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsoleSupportPage from './page';

const mockSupportCases = {
  items: [
    {
      id: 'c1',
      businessId: 'biz1',
      businessName: 'Glow Clinic',
      subject: 'Login issue',
      description: 'Cannot login',
      status: 'open',
      priority: 'high',
      category: 'technical',
      resolution: null,
      resolvedAt: null,
      closedAt: null,
      createdById: 'admin1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { notes: 2 },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

describe('ConsoleSupportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockSupportCases);
  });

  it('renders loading state', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<ConsoleSupportPage />);

    expect(screen.getByText('Support Cases')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders support cases after loading', async () => {
    render(<ConsoleSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Login issue')).toBeInTheDocument();
    });

    expect(screen.getByText('1 total cases')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('renders case subject and business name', async () => {
    render(<ConsoleSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Login issue')).toBeInTheDocument();
    });

    expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('renders New Case button', async () => {
    render(<ConsoleSupportPage />);

    expect(screen.getByText('New Case')).toBeInTheDocument();

    const button = screen.getByText('New Case').closest('button');
    expect(button).toBeInTheDocument();
  });

  it('renders filter dropdowns (status, priority)', async () => {
    render(<ConsoleSupportPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search cases...')).toBeInTheDocument();
    });

    // Status filter
    const statusSelect = screen.getByDisplayValue('All Status');
    expect(statusSelect).toBeInTheDocument();

    // Priority filter
    const prioritySelect = screen.getByDisplayValue('All Priority');
    expect(prioritySelect).toBeInTheDocument();
  });

  it('renders table headers', async () => {
    render(<ConsoleSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('shows note count for case', async () => {
    render(<ConsoleSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('renders empty state when no cases', async () => {
    mockApi.get.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    render(<ConsoleSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('No support cases found')).toBeInTheDocument();
    });
  });

  it('opens create modal when New Case button is clicked', async () => {
    const user = userEvent.setup();

    // Mock businesses endpoint for the create modal
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/admin/businesses')) {
        return Promise.resolve({ items: [{ id: 'biz1', name: 'Glow Clinic' }] });
      }
      return Promise.resolve(mockSupportCases);
    });

    render(<ConsoleSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('New Case')).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText('New Case'));
    });

    await waitFor(() => {
      expect(screen.getByText('New Support Case')).toBeInTheDocument();
    });
  });
});
