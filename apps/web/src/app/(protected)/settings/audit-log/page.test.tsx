import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AuditLogPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('lucide-react', () => {
  const stub = (name: string) => {
    const C = (props: any) => <svg data-testid={`icon-${name}`} {...props} />;
    C.displayName = name;
    return C;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => stub(prop),
    },
  );
});
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    getText: jest.fn(),
  },
}));
jest.mock('@/components/action-history', () => ({
  DiffViewer: ({ before, after }: any) => (
    <div data-testid="diff-viewer">{JSON.stringify({ before, after })}</div>
  ),
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockItems = [
  {
    id: 'ah1',
    actorType: 'STAFF',
    actorId: 's1',
    actorName: 'Sarah',
    action: 'BOOKING_CREATED',
    entityType: 'BOOKING',
    entityId: 'b1',
    description: 'Created booking for John',
    diff: null,
    metadata: null,
    createdAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'ah2',
    actorType: 'AI',
    actorId: 'ai1',
    actorName: 'Claude',
    action: 'SETTING_CHANGED',
    entityType: 'SETTING',
    entityId: 'set1',
    description: 'Changed opening hours',
    diff: { before: { hours: '9-5' }, after: { hours: '8-6' } },
    metadata: null,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ah3',
    actorType: 'SYSTEM',
    actorId: 'sys1',
    actorName: null,
    action: 'BOOKING_CANCELLED',
    entityType: 'BOOKING',
    entityId: 'b2',
    description: 'Auto-cancelled no-show',
    diff: null,
    metadata: { reason: 'no_show' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockResponse = {
  items: mockItems,
  total: 3,
  page: 1,
  pageSize: 20,
};

describe('AuditLogPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockResponse);
    mockApi.getText.mockResolvedValue('id,action,createdAt\nah1,BOOKING_CREATED,2026-01-01');
  });

  test('renders the audit log page title', async () => {
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });
  });

  test('fetches action history on mount', async () => {
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('/action-history?'));
    });
  });

  test('shows action history items in a table', async () => {
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByText('Created booking for John')).toBeInTheDocument();
      expect(screen.getByText('Changed opening hours')).toBeInTheDocument();
      expect(screen.getByText('Auto-cancelled no-show')).toBeInTheDocument();
    });
  });

  test('shows actor names and type badges', async () => {
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByText('Sarah')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('STAFF')).toBeInTheDocument();
      expect(screen.getAllByText('AI').length).toBeGreaterThanOrEqual(1);
    });
  });

  test('filter dropdowns exist', async () => {
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByTestId('filter-entity-type')).toBeInTheDocument();
      expect(screen.getByTestId('filter-action')).toBeInTheDocument();
      expect(screen.getByTestId('filter-actor-type')).toBeInTheDocument();
    });
  });

  test('changing entity type filter triggers API refetch', async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByTestId('filter-entity-type'));

    fireEvent.change(screen.getByTestId('filter-entity-type'), {
      target: { value: 'BOOKING' },
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('entityType=BOOKING'));
    });
  });

  test('changing action filter triggers API refetch', async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByTestId('filter-action'));

    fireEvent.change(screen.getByTestId('filter-action'), {
      target: { value: 'BOOKING_CREATED' },
    });

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('action=BOOKING_CREATED'));
    });
  });

  test('pagination buttons exist', async () => {
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByTestId('pagination-prev')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
      expect(screen.getByTestId('pagination-info')).toBeInTheDocument();
    });
  });

  test('pagination next button fetches next page', async () => {
    mockApi.get.mockResolvedValue({
      items: mockItems,
      total: 40,
      page: 1,
      pageSize: 20,
    });
    render(<AuditLogPage />);
    await waitFor(() => screen.getByTestId('pagination-next'));

    fireEvent.click(screen.getByTestId('pagination-next'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('page=2'));
    });
  });

  test('pagination previous button is disabled on first page', async () => {
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByTestId('pagination-prev')).toBeDisabled();
    });
  });

  test('expandable row shows diff viewer when diff exists', async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText('Changed opening hours'));

    // Click the row with diff (ah2)
    fireEvent.click(screen.getByText('Changed opening hours'));

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-expanded-ah2')).toBeInTheDocument();
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });
  });

  test('expandable row shows metadata when no diff but metadata exists', async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText('Auto-cancelled no-show'));

    fireEvent.click(screen.getByText('Auto-cancelled no-show'));

    await waitFor(() => {
      expect(screen.getByTestId('audit-row-expanded-ah3')).toBeInTheDocument();
      expect(screen.getByText('Metadata')).toBeInTheDocument();
    });
  });

  test('shows empty state when no items', async () => {
    mockApi.get.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    render(<AuditLogPage />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No activity found')).toBeInTheDocument();
    });
  });

  test('export button triggers CSV download', async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByTestId('export-csv-btn'));

    // Mock createElement for the download
    const createElementSpy = jest.spyOn(document, 'createElement');
    const mockAnchor = { href: '', download: '', click: jest.fn() } as any;
    createElementSpy.mockReturnValueOnce(mockAnchor);
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    fireEvent.click(screen.getByTestId('export-csv-btn'));

    await waitFor(() => {
      expect(mockApi.getText).toHaveBeenCalledWith(
        expect.stringContaining('/action-history/export'),
      );
    });

    createElementSpy.mockRestore();
  });

  test('search input filters by description client-side', async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText('Created booking for John'));

    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'opening hours' },
    });

    expect(screen.queryByText('Created booking for John')).not.toBeInTheDocument();
    expect(screen.getByText('Changed opening hours')).toBeInTheDocument();
  });

  test('actor type filter filters client-side', async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText('Sarah'));

    fireEvent.change(screen.getByTestId('filter-actor-type'), {
      target: { value: 'AI' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Sarah')).not.toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
    });
  });
});
