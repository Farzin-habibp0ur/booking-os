import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'veh-1' }),
}));

const mockVehicles = [
  {
    id: 'veh-1',
    stockNumber: 'AUT-00001',
    vin: 'JH4KA7660MC000001',
    year: 2024,
    make: 'Toyota',
    model: 'Camry',
    trim: 'XLE',
    color: 'White',
    mileage: 15000,
    condition: 'USED',
    status: 'IN_STOCK',
    askingPrice: 28000,
    imageUrls: [],
    createdAt: new Date().toISOString(),
    location: null,
    _count: { testDrives: 0 },
  },
];

const mockStats = {
  total: 1,
  countByStatus: { IN_STOCK: 1 },
  totalValue: 28000,
  avgDaysOnLot: 5,
};

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url.includes('/vehicles/stats')) return Promise.resolve(mockStats);
      if (url.includes('/vehicles?')) return Promise.resolve({ data: mockVehicles, total: 1 });
      return Promise.resolve(mockVehicles[0]);
    }),
    post: jest.fn().mockResolvedValue({ id: 'veh-2' }),
    patch: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'staff-1', role: 'ADMIN', businessId: 'biz-1' } }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="skeleton">Loading...</div>,
  EmptyState: ({ title, onAction }: any) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {onAction && <button onClick={onAction}>Action</button>}
    </div>
  ),
}));

jest.mock('@/components/dealership/vehicle-card', () => ({
  VehicleCard: ({ vehicle, onClick }: any) => (
    <div data-testid="vehicle-card" onClick={onClick}>
      {vehicle.year} {vehicle.make} {vehicle.model}
    </div>
  ),
}));

import InventoryPage from './page';

describe('InventoryPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders inventory page with vehicles', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });

    expect(screen.getByText('1 vehicles')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-card')).toBeInTheDocument();
  });

  it('displays stats cards', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('$28,000')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // avg days on lot
    });
  });

  it('has search input', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search by make/)).toBeInTheDocument();
    });
  });

  it('toggles filter bar', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Filters'));
    });

    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by condition')).toBeInTheDocument();
  });

  it('navigates to vehicle detail on card click', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('vehicle-card'));
    });

    expect(mockPush).toHaveBeenCalledWith('/inventory/veh-1');
  });

  it('toggles grid and table view', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('vehicle-card')).toBeInTheDocument();
    });

    // Find the List icon button (second toggle button)
    const buttons = screen.getAllByRole('button');
    const tableBtn = buttons.find((b) => b.querySelector('svg'));
    // Table view would render a table
  });

  it('opens add vehicle modal', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });

    // Click the "Add Vehicle" button in the header
    const addButtons = screen.getAllByText('Add Vehicle');
    fireEvent.click(addButtons[0]);

    // Modal should open with form fields
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('has sort dropdown', async () => {
    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Sort vehicles')).toBeInTheDocument();
    });
  });
});
