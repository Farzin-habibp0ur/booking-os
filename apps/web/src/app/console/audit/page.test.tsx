const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/console/audit',
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
  const icons = ['Shield', 'Search', 'ChevronLeft', 'ChevronRight'];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />;
  });
  return mocks;
});

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsoleAuditPage from './page';

const mockActionTypes = ['BUSINESS_LIST', 'BUSINESS_LOOKUP', 'VIEW_AS_START'];

const mockAuditLogs = {
  items: [
    {
      id: '1',
      actorId: 'a1',
      actorEmail: 'admin@businesscommandcentre.com',
      action: 'BUSINESS_LOOKUP',
      targetType: 'BUSINESS',
      targetId: 'biz1',
      reason: null,
      metadata: {},
      createdAt: new Date().toISOString(),
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
};

describe('ConsoleAuditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/action-types')) return Promise.resolve(mockActionTypes);
      return Promise.resolve(mockAuditLogs);
    });
  });

  it('renders loading state', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<ConsoleAuditPage />);

    expect(screen.getByText('Security & Audit')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders audit log entries after loading', async () => {
    render(<ConsoleAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@businesscommandcentre.com')).toBeInTheDocument();
    });

    // "Business lookup" appears in both the dropdown option and the table action badge
    expect(screen.getAllByText('Business lookup').length).toBeGreaterThanOrEqual(1);
  });

  it('renders search input and filter dropdown', async () => {
    render(<ConsoleAuditPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by actor, action, or target...')).toBeInTheDocument();
    });

    // Action filter dropdown with options
    const select = screen.getByDisplayValue('All Actions');
    expect(select).toBeInTheDocument();

    // Action types should be loaded into the dropdown
    await waitFor(() => {
      expect(screen.getByText('Business list')).toBeInTheDocument();
    });
    expect(screen.getByText('Business lookup')).toBeInTheDocument();
    expect(screen.getByText('View as start')).toBeInTheDocument();
  });

  it('renders pagination info', async () => {
    render(<ConsoleAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('1 total entries')).toBeInTheDocument();
    });

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('renders table headers', async () => {
    render(<ConsoleAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Time')).toBeInTheDocument();
    });

    expect(screen.getByText('Actor')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
  });

  it('renders empty state when no logs', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/action-types')) return Promise.resolve(mockActionTypes);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
    });

    render(<ConsoleAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    });
  });

  it('displays target type and truncated ID', async () => {
    render(<ConsoleAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('BUSINESS:')).toBeInTheDocument();
    });
  });
});
