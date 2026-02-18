const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'cust-1' }),
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
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
const mockToast = jest.fn();
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      if (params) return `${key}::${JSON.stringify(params)}`;
      return key;
    },
  }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
  VerticalPackProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
  TableRowSkeleton: ({ cols }: any) => (
    <tr data-testid="table-skeleton">
      {Array.from({ length: cols || 5 }).map((_, i) => (
        <td key={i} />
      ))}
    </tr>
  ),
  EmptyState: ({ title, description, action }: any) => (
    <div data-testid="empty-state">
      <span data-testid="empty-state-title">{title}</span>
      <span data-testid="empty-state-description">{description}</span>
      {action && (
        <button data-testid="empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  ),
}));

jest.mock('@/components/saved-views', () => ({
  ViewPicker: (props: any) => <div data-testid="view-picker" />,
  SaveViewModal: () => null,
}));

jest.mock('@/components/bulk-action-bar', () => {
  return function MockBulkActionBar({
    count,
    onClear,
    actions,
  }: {
    count: number;
    onClear: () => void;
    actions: Array<{ label: string; onClick: () => void }>;
  }) {
    if (count === 0) return null;
    return (
      <div data-testid="bulk-action-bar">
        <span data-testid="bulk-count">{count} selected</span>
        {actions.map((a) => (
          <button key={a.label} data-testid={`bulk-${a.label}`} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
        <button data-testid="bulk-clear" onClick={onClear}>
          Clear
        </button>
      </div>
    );
  };
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomersPage from './page';

// --- helpers ---
const MOCK_CUSTOMERS = [
  {
    id: 'c1',
    name: 'Emma Stone',
    phone: '+1234567890',
    email: 'emma@test.com',
    tags: ['VIP', 'Regular'],
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'c2',
    name: 'John Smith',
    phone: '+0987654321',
    email: null,
    tags: [],
    createdAt: '2026-02-01T08:30:00Z',
  },
  {
    id: 'c3',
    name: 'Alice Johnson',
    phone: '+1112223333',
    email: 'alice@example.com',
    tags: ['New'],
    createdAt: '2026-02-10T14:00:00Z',
  },
];

function setupApiWithCustomers(data = MOCK_CUSTOMERS) {
  mockApi.get.mockImplementation(() => Promise.resolve({ data, total: data.length }));
}

function setupApiEmpty() {
  mockApi.get.mockImplementation(() => Promise.resolve({ data: [], total: 0 }));
}

function setupApiNeverResolve() {
  mockApi.get.mockImplementation(() => new Promise(() => {}));
}

function setupApiReject() {
  mockApi.get.mockImplementation(() => Promise.reject(new Error('Network error')));
}

describe('CustomersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================
  // LOADING STATE
  // =============================
  describe('loading state', () => {
    it('shows skeleton rows while loading', () => {
      setupApiNeverResolve();
      render(<CustomersPage />);

      const skeletons = screen.getAllByTestId('table-skeleton');
      expect(skeletons.length).toBe(5);
    });

    it('hides skeleton rows after data loads', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.queryAllByTestId('table-skeleton')).toHaveLength(0);
      });
    });
  });

  // =============================
  // DATA DISPLAY
  // =============================
  describe('customer list display', () => {
    it('renders page title and total count', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText(/customers\.title/)).toBeInTheDocument();
      });
      expect(screen.getByText(/customers\.total_count/)).toBeInTheDocument();
    });

    it('displays all customers in the table', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    it('shows customer phone numbers', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('+1234567890')).toBeInTheDocument();
      });
      expect(screen.getByText('+0987654321')).toBeInTheDocument();
      expect(screen.getByText('+1112223333')).toBeInTheDocument();
    });

    it('shows customer emails or dash for null email', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('emma@test.com')).toBeInTheDocument();
      });
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      // null email renders as em-dash
      const dashes = screen.getAllByText('\u2014');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('renders customer tags as badges', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('VIP')).toBeInTheDocument();
      });
      expect(screen.getByText('Regular')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('renders createdAt dates', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });
      // Date is formatted via toLocaleDateString – verify at least one date is present
      const dateCell = screen.getByText(new Date('2026-01-15T10:00:00Z').toLocaleDateString());
      expect(dateCell).toBeInTheDocument();
    });

    it('shows table column headers', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('common.name')).toBeInTheDocument();
      });
      expect(screen.getByText('common.phone')).toBeInTheDocument();
      expect(screen.getByText('common.email')).toBeInTheDocument();
      expect(screen.getByText('common.tags')).toBeInTheDocument();
      expect(screen.getByText('common.date')).toBeInTheDocument();
    });
  });

  // =============================
  // EMPTY STATE
  // =============================
  describe('empty state', () => {
    it('shows empty state when no customers and no search', async () => {
      setupApiEmpty();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      // The description should be the "add first" message (no search query)
      expect(screen.getByTestId('empty-state-description')).toHaveTextContent(
        'customers.add_first',
      );
    });

    it('shows add button in empty state when not searching', async () => {
      setupApiEmpty();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-action')).toBeInTheDocument();
      });
    });

    it('clicking empty state action opens customer form', async () => {
      const user = userEvent.setup();
      setupApiEmpty();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-action')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('empty-state-action'));

      await waitFor(() => {
        expect(screen.getByText(/customers\.add_title/)).toBeInTheDocument();
      });
    });

    it('shows "no search results" description when search is active and no results', async () => {
      const user = userEvent.setup();
      // First load returns data so we can type in search
      let callCount = 0;
      mockApi.get.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ data: [], total: 0 });
        return Promise.resolve({ data: [], total: 0 });
      });

      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      // Type a search term
      const searchInput = screen.getByPlaceholderText('customers.search_placeholder');
      await user.type(searchInput, 'nonexistent');

      // Submit the search form
      const searchButton = screen.getByText('common.search');
      await user.click(searchButton);

      await waitFor(() => {
        const desc = screen.getByTestId('empty-state-description');
        expect(desc.textContent).toContain('customers.no_search_results');
      });
    });

    it('does NOT show empty state action when search is active', async () => {
      const user = userEvent.setup();
      setupApiEmpty();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('customers.search_placeholder');
      await user.type(searchInput, 'xyz');

      const searchButton = screen.getByText('common.search');
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
      });
    });
  });

  // =============================
  // ERROR STATE
  // =============================
  describe('error state', () => {
    it('handles API error gracefully (no crash)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      setupApiReject();
      render(<CustomersPage />);

      await waitFor(() => {
        // After error, loading should be false and empty state should show
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =============================
  // SEARCH FUNCTIONALITY
  // =============================
  describe('search', () => {
    it('has a search input with placeholder', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('customers.search_placeholder')).toBeInTheDocument();
      });
    });

    it('has a search button', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('common.search')).toBeInTheDocument();
      });
    });

    it('triggers search on form submit', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('customers.search_placeholder');
      await user.type(searchInput, 'Emma');

      const searchButton = screen.getByText('common.search');
      await user.click(searchButton);

      // The API should be called again with the search term
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/customers?search=Emma&pageSize=50');
      });
    });

    it('clears results and reloads when search input is cleared', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('customers.search_placeholder');
      await user.type(searchInput, 'test');

      // Clear the input completely
      await user.clear(searchInput);

      // Should call load('') when input is emptied
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/customers?search=&pageSize=50');
      });
    });
  });

  // =============================
  // NAVIGATION
  // =============================
  describe('row navigation', () => {
    it('navigates to customer detail on name click', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Emma Stone'));

      expect(mockPush).toHaveBeenCalledWith('/customers/c1');
    });

    it('navigates to customer detail on email click', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('emma@test.com')).toBeInTheDocument();
      });

      await user.click(screen.getByText('emma@test.com'));

      expect(mockPush).toHaveBeenCalledWith('/customers/c1');
    });

    it('navigates to customer detail on phone click', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('+0987654321')).toBeInTheDocument();
      });

      await user.click(screen.getByText('+0987654321'));

      expect(mockPush).toHaveBeenCalledWith('/customers/c2');
    });
  });

  // =============================
  // SELECTION & BULK ACTIONS
  // =============================
  describe('selection', () => {
    it('renders individual row checkboxes', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      // 3 row checkboxes + 1 "select all" checkbox = 4 total
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4);
    });

    it('toggles individual selection', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      // Checkboxes: [selectAll, c1, c2, c3]
      const checkboxes = screen.getAllByRole('checkbox');
      const firstRowCheckbox = checkboxes[1];

      await user.click(firstRowCheckbox);

      // BulkActionBar should appear with count 1
      await waitFor(() => {
        expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
      });
      expect(screen.getByTestId('bulk-count')).toHaveTextContent('1 selected');
    });

    it('toggles selection off when clicking again', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const firstRowCheckbox = checkboxes[1];

      // Select then deselect
      await user.click(firstRowCheckbox);
      await waitFor(() => {
        expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
      });

      await user.click(firstRowCheckbox);
      await waitFor(() => {
        expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
      });
    });

    it('selects all customers via header checkbox', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const selectAllCheckbox = checkboxes[0];

      await user.click(selectAllCheckbox);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-count')).toHaveTextContent('3 selected');
      });
    });

    it('deselects all when header checkbox clicked again', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const selectAllCheckbox = checkboxes[0];

      // Select all
      await user.click(selectAllCheckbox);
      await waitFor(() => {
        expect(screen.getByTestId('bulk-count')).toHaveTextContent('3 selected');
      });

      // Deselect all
      await user.click(selectAllCheckbox);
      await waitFor(() => {
        expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
      });
    });

    it('clears selection via bulk action bar clear button', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('bulk-clear'));

      await waitFor(() => {
        expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
      });
    });

    it('multiple individual selections accumulate', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');

      await user.click(checkboxes[1]); // select c1
      await user.click(checkboxes[2]); // select c2

      await waitFor(() => {
        expect(screen.getByTestId('bulk-count')).toHaveTextContent('2 selected');
      });
    });

    it('row checkbox click does NOT navigate', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Should NOT have navigated
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // =============================
  // BULK TAG MODAL
  // =============================
  describe('bulk tag modal', () => {
    async function selectOneAndOpenTagModal(user: ReturnType<typeof userEvent.setup>) {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
      });
    }

    it('opens "Add Tag" modal when clicking Add Tag action', async () => {
      const user = userEvent.setup();
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        // The modal h3 and the bulk bar button both say "Add Tag"
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
        // Verify the h3 in the modal
        const headings = screen.getAllByText('Add Tag');
        expect(headings.length).toBeGreaterThanOrEqual(2); // bulk bar button + modal heading
      });
    });

    it('opens "Remove Tag" modal when clicking Remove Tag action', async () => {
      const user = userEvent.setup();
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Remove Tag'));

      await waitFor(() => {
        // Both bulk bar button and modal heading show "Remove Tag"
        const removeTexts = screen.getAllByText('Remove Tag');
        expect(removeTexts.length).toBeGreaterThanOrEqual(2);
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });
    });

    it('Add button is disabled when tag input is empty', async () => {
      const user = userEvent.setup();
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      // The submit button should be "Add" and disabled
      const addButton = screen.getByRole('button', { name: 'Add' });
      expect(addButton).toBeDisabled();
    });

    it('Add button becomes enabled when tag input has text', async () => {
      const user = userEvent.setup();
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Enter tag name'), 'Premium');

      const addButton = screen.getByRole('button', { name: 'Add' });
      expect(addButton).not.toBeDisabled();
    });

    it('submits bulk tag action and reloads data', async () => {
      const user = userEvent.setup();
      mockApi.patch.mockResolvedValue({});
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Enter tag name'), 'Premium');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith('/customers/bulk', {
          ids: ['c1'],
          action: 'tag',
          payload: { tag: 'Premium' },
        });
      });

      // After bulk tag, the modal should close and data reloads
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Enter tag name')).not.toBeInTheDocument();
      });
    });

    it('submits bulk untag action correctly', async () => {
      const user = userEvent.setup();
      mockApi.patch.mockResolvedValue({});
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Remove Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Enter tag name'), 'VIP');
      // Submit button should say "Remove"
      await user.click(screen.getByRole('button', { name: 'Remove' }));

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith('/customers/bulk', {
          ids: ['c1'],
          action: 'untag',
          payload: { tag: 'VIP' },
        });
      });
    });

    it('closes bulk tag modal on Cancel', async () => {
      const user = userEvent.setup();
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Enter tag name')).not.toBeInTheDocument();
      });
    });

    it('does nothing when handleBulkTag is called with empty input', async () => {
      const user = userEvent.setup();
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      // Tag input is empty, click Add (should be disabled, but also handleBulkTag guards)
      const addButton = screen.getByRole('button', { name: 'Add' });
      expect(addButton).toBeDisabled();

      // Patch should not have been called
      expect(mockApi.patch).not.toHaveBeenCalled();
    });

    it('submits bulk tag via Enter key', async () => {
      const user = userEvent.setup();
      mockApi.patch.mockResolvedValue({});
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      const tagInput = screen.getByPlaceholderText('Enter tag name');
      await user.type(tagInput, 'Gold');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith('/customers/bulk', {
          ids: ['c1'],
          action: 'tag',
          payload: { tag: 'Gold' },
        });
      });
    });

    it('clears selection after successful bulk tag', async () => {
      const user = userEvent.setup();
      mockApi.patch.mockResolvedValue({});
      await selectOneAndOpenTagModal(user);

      await user.click(screen.getByTestId('bulk-Add Tag'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Enter tag name'), 'Test');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      // After bulk action, selection should be cleared (bar disappears)
      await waitFor(() => {
        expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
      });
    });
  });

  // =============================
  // ADD CUSTOMER FORM
  // =============================
  describe('customer form', () => {
    it('opens customer form when clicking add button', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      // Click the "Add Customer" button in the page header
      const buttons = screen.getAllByText(/customers\.add_button/);
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText(/customers\.add_title/)).toBeInTheDocument();
      });
    });

    it('shows name, phone, and email inputs in the form', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText(/customers\.add_button/);
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('customers.name_placeholder')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('customers.phone_placeholder')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('customers.email_placeholder')).toBeInTheDocument();
      });
    });

    it('submits customer form and calls api.post', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ id: 'new-1' });
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText(/customers\.add_button/);
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('customers.name_placeholder')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('customers.name_placeholder'), 'New Customer');
      await user.type(screen.getByPlaceholderText('customers.phone_placeholder'), '+9999999');
      await user.type(screen.getByPlaceholderText('customers.email_placeholder'), 'new@test.com');

      await user.click(screen.getByText('common.create'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/customers', {
          name: 'New Customer',
          phone: '+9999999',
          email: 'new@test.com',
        });
      });
    });

    it('submits customer form without email (sends undefined)', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ id: 'new-2' });
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText(/customers\.add_button/);
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('customers.name_placeholder')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('customers.name_placeholder'), 'No Email');
      await user.type(screen.getByPlaceholderText('customers.phone_placeholder'), '+1111111');

      await user.click(screen.getByText('common.create'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/customers', {
          name: 'No Email',
          phone: '+1111111',
          email: undefined,
        });
      });
    });

    it('closes customer form when clicking cancel', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const buttons = screen.getAllByText(/customers\.add_button/);
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText(/customers\.add_title/)).toBeInTheDocument();
      });

      await user.click(screen.getByText('common.cancel'));

      await waitFor(() => {
        expect(screen.queryByText(/customers\.add_title/)).not.toBeInTheDocument();
      });
    });

    it('closes form and reloads after successful creation', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ id: 'new-1' });
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const initialGetCalls = mockApi.get.mock.calls.length;

      const buttons = screen.getAllByText(/customers\.add_button/);
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('customers.name_placeholder')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('customers.name_placeholder'), 'Test');
      await user.type(screen.getByPlaceholderText('customers.phone_placeholder'), '+5555');

      await user.click(screen.getByText('common.create'));

      await waitFor(() => {
        // Form should be closed
        expect(screen.queryByText(/customers\.add_title/)).not.toBeInTheDocument();
      });

      // Data should have been reloaded
      expect(mockApi.get.mock.calls.length).toBeGreaterThan(initialGetCalls);
    });
  });

  // =============================
  // IMPORT MODAL
  // =============================
  describe('import modal', () => {
    it('opens import modal when clicking import button', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      // The import button text is "import.import_button" (top-level page button)
      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.modal_title')).toBeInTheDocument();
      });
    });

    it('shows CSV and conversation import sections', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.csv_title')).toBeInTheDocument();
        expect(screen.getByText('import.conversations_title')).toBeInTheDocument();
      });
    });

    it('shows include messages checkbox', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.include_messages')).toBeInTheDocument();
      });

      // The include messages checkbox should be checked by default
      const checkboxes = screen.getAllByRole('checkbox');
      const includeMessagesCheckbox = checkboxes.find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('import.include_messages');
      });
      expect(includeMessagesCheckbox).toBeChecked();
    });

    it('toggles include messages checkbox', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.include_messages')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const includeMessagesCheckbox = checkboxes.find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('import.include_messages');
      });
      expect(includeMessagesCheckbox).toBeChecked();

      await user.click(includeMessagesCheckbox!);
      expect(includeMessagesCheckbox).not.toBeChecked();
    });

    it('imports from conversations and shows result', async () => {
      const user = userEvent.setup();
      mockApi.post.mockResolvedValue({ created: 5, updated: 3 });
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.generate_profiles')).toBeInTheDocument();
      });

      await user.click(screen.getByText('import.generate_profiles'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/customers/import-from-conversations', {
          includeMessages: true,
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/import\.conversations_result/)).toBeInTheDocument();
      });

      expect(mockToast).toHaveBeenCalled();
    });

    it('shows error toast when conversation import fails', async () => {
      const user = userEvent.setup();
      mockApi.post.mockRejectedValue(new Error('Server error'));
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.generate_profiles')).toBeInTheDocument();
      });

      await user.click(screen.getByText('import.generate_profiles'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('import.conversations_failed', 'error');
      });
    });

    it('closes import modal via close button at bottom', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.modal_title')).toBeInTheDocument();
      });

      // Close via the bottom "Close" button
      await user.click(screen.getByText('common.close'));

      await waitFor(() => {
        expect(screen.queryByText('import.modal_title')).not.toBeInTheDocument();
      });
    });

    it('closes import modal via X button', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.modal_title')).toBeInTheDocument();
      });

      // X button is a button with text-slate-400 hover:text-slate-600 class.
      // Find the header and click the X button inside it
      const header = screen.getByText('import.modal_title').closest('div')!;
      const xButton = within(header).getByRole('button');
      await user.click(xButton);

      await waitFor(() => {
        expect(screen.queryByText('import.modal_title')).not.toBeInTheDocument();
      });
    });

    it('shows CSV drop zone text', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.csv_drop_zone')).toBeInTheDocument();
      });
    });

    it('handles CSV file selection and shows preview', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.csv_drop_zone')).toBeInTheDocument();
      });

      // Create a mock CSV file
      const csvContent =
        'name,phone,email,tags\nJane Doe,+555,jane@test.com,VIP\nBob,+444,bob@test.com,New';
      const file = new File([csvContent], 'customers.csv', { type: 'text/csv' });

      // Find the hidden file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      await user.upload(fileInput, file);

      // Preview should show parsed rows
      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });
    });

    it('shows import button after CSV file selection', async () => {
      const user = userEvent.setup();
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.csv_drop_zone')).toBeInTheDocument();
      });

      const csvContent = 'name,phone,email,tags\nJane,+555,jane@t.com,VIP';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      // After file selection, the import button inside the CSV section should appear
      await waitFor(() => {
        // There should be multiple import buttons now (page header + modal CSV section)
        const allImportButtons = screen.getAllByText(/import\.import_button/);
        expect(allImportButtons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('uploads CSV and shows result on success', async () => {
      const user = userEvent.setup();
      mockApi.upload.mockResolvedValue({ created: 10, skipped: 2, errors: 0 });
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.csv_drop_zone')).toBeInTheDocument();
      });

      const csvContent = 'name,phone,email,tags\nJane,+555,jane@t.com,VIP';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        // The import button inside the CSV section
        const allImportButtons = screen.getAllByText(/import\.import_button/);
        expect(allImportButtons.length).toBeGreaterThanOrEqual(2);
      });

      // Click the CSV import button (the one inside the modal, which is the last one)
      const allImportButtons = screen.getAllByText(/import\.import_button/);
      // The last import.import_button should be in the CSV import section of the modal
      await user.click(allImportButtons[allImportButtons.length - 1]);

      await waitFor(() => {
        expect(mockApi.upload).toHaveBeenCalledWith('/customers/import-csv', expect.any(FormData));
      });

      await waitFor(() => {
        expect(screen.getByText(/import\.csv_result/)).toBeInTheDocument();
      });

      expect(mockToast).toHaveBeenCalled();
    });

    it('shows error toast when CSV upload fails', async () => {
      const user = userEvent.setup();
      mockApi.upload.mockRejectedValue(new Error('Upload failed'));
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Emma Stone')).toBeInTheDocument();
      });

      const importButtons = screen.getAllByText(/import\.import_button/);
      await user.click(importButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('import.csv_drop_zone')).toBeInTheDocument();
      });

      const csvContent = 'name,phone,email,tags\nJane,+555,jane@t.com,VIP';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      await waitFor(() => {
        const allImportButtons = screen.getAllByText(/import\.import_button/);
        expect(allImportButtons.length).toBeGreaterThanOrEqual(2);
      });

      const allImportButtons = screen.getAllByText(/import\.import_button/);
      await user.click(allImportButtons[allImportButtons.length - 1]);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('import.csv_failed', 'error');
      });
    });
  });

  // =============================
  // BUTTONS / UI ELEMENTS
  // =============================
  describe('action buttons', () => {
    it('has add customer button', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getAllByText(/customers\.add_button/).length).toBeGreaterThan(0);
      });
    });

    it('has import button', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getAllByText(/import\.import_button/).length).toBeGreaterThan(0);
      });
    });
  });

  // =============================
  // API CALL ON MOUNT
  // =============================
  describe('initial load', () => {
    it('calls api.get on mount with default params', async () => {
      setupApiWithCustomers();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/customers?search=&pageSize=50');
      });
    });

    it('uses total from API response for count display', async () => {
      mockApi.get.mockResolvedValue({ data: MOCK_CUSTOMERS, total: 42 });
      render(<CustomersPage />);

      await waitFor(() => {
        const countText = screen.getByText(/customers\.total_count/);
        expect(countText.textContent).toContain('42');
      });
    });

    it('falls back to data.length when total is missing', async () => {
      mockApi.get.mockResolvedValue({ data: MOCK_CUSTOMERS });
      render(<CustomersPage />);

      await waitFor(() => {
        const countText = screen.getByText(/customers\.total_count/);
        expect(countText.textContent).toContain('3');
      });
    });
  });
});
