import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { role: 'ADMIN' } }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  Plus: (props: any) => <div data-testid="plus-icon" {...props} />,
  Pin: (props: any) => <div data-testid="pin-icon" {...props} />,
  LayoutDashboard: (props: any) => <div data-testid="dashboard-icon" {...props} />,
  Share2: (props: any) => <div data-testid="share-icon" {...props} />,
  Trash2: (props: any) => <div data-testid="trash-icon" {...props} />,
  MoreHorizontal: (props: any) => <div data-testid="more-icon" {...props} />,
  X: (props: any) => <div data-testid="x-icon" {...props} />,
}));

import { api } from '@/lib/api';
import { ViewPicker } from './view-picker';

const mockViews = [
  { id: 'v1', name: 'Active Only', filters: { status: 'ACTIVE' }, isPinned: false, isDashboard: false, isShared: false },
  { id: 'v2', name: 'Shared View', filters: { status: 'PENDING' }, isPinned: true, isDashboard: false, isShared: true },
];

const defaultProps = {
  page: 'bookings',
  currentFilters: {},
  activeViewId: null as string | null,
  onApplyView: jest.fn(),
  onClearView: jest.fn(),
};

describe('ViewPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state with save button when no views', async () => {
    (api.get as jest.Mock).mockResolvedValue([]);

    render(<ViewPicker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('view-picker')).toBeInTheDocument();
    });

    expect(screen.getByText('saved_views.save_current')).toBeInTheDocument();
    expect(screen.queryByText('common.all')).not.toBeInTheDocument();
  });

  it('renders "All" pill and view pills when views exist', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);

    render(<ViewPicker {...defaultProps} />);

    expect(await screen.findByText('Active Only')).toBeInTheDocument();
    expect(screen.getByText('Shared View')).toBeInTheDocument();
    expect(screen.getByText('common.all')).toBeInTheDocument();
  });

  it('calls onApplyView when a view pill is clicked', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);
    const onApplyView = jest.fn();
    const user = userEvent.setup();

    render(<ViewPicker {...defaultProps} onApplyView={onApplyView} />);

    const viewPill = await screen.findByText('Active Only');
    await user.click(viewPill);

    expect(onApplyView).toHaveBeenCalledWith({ status: 'ACTIVE' }, 'v1');
  });

  it('calls onClearView when "All" pill is clicked', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);
    const onClearView = jest.fn();
    const user = userEvent.setup();

    render(<ViewPicker {...defaultProps} activeViewId="v1" onClearView={onClearView} />);

    const allPill = await screen.findByText('common.all');
    await user.click(allPill);

    expect(onClearView).toHaveBeenCalled();
  });

  it('shows unsaved-changes indicator when filters differ from active view', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);

    render(
      <ViewPicker
        {...defaultProps}
        activeViewId="v1"
        currentFilters={{ status: 'DIFFERENT' }}
      />,
    );

    await screen.findByText('Active Only');

    const indicator = document.querySelector('[title="Unsaved changes"]');
    expect(indicator).toBeInTheDocument();
  });

  it('shows share icon for shared views', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);

    render(<ViewPicker {...defaultProps} />);

    await screen.findByText('Shared View');

    // The Shared View pill should contain a Share2 icon
    const shareIcons = screen.getAllByTestId('share-icon');
    expect(shareIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens dropdown menu on more button click', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);
    const user = userEvent.setup();

    render(<ViewPicker {...defaultProps} />);

    await screen.findByText('Active Only');

    // Click the first more button (there is one per view)
    const moreButtons = screen.getAllByTestId('more-icon');
    await user.click(moreButtons[0]);

    // The dropdown should display pin/dashboard/delete options
    expect(screen.getByText('saved_views.pin')).toBeInTheDocument();
    expect(screen.getByText('saved_views.add_dashboard')).toBeInTheDocument();
    expect(screen.getByText('saved_views.delete')).toBeInTheDocument();
  });

  it('handles pin toggle', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);
    (api.patch as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup();

    render(<ViewPicker {...defaultProps} />);

    await screen.findByText('Active Only');

    // Open dropdown for the first view
    const moreButtons = screen.getAllByTestId('more-icon');
    await user.click(moreButtons[0]);

    // Click pin
    await user.click(screen.getByText('saved_views.pin'));

    expect(api.patch).toHaveBeenCalledWith('/saved-views/v1', { isPinned: true });
  });

  it('handles delete and calls api.del', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);
    (api.del as jest.Mock).mockResolvedValue({});
    const user = userEvent.setup();

    render(<ViewPicker {...defaultProps} />);

    await screen.findByText('Active Only');

    // Open dropdown for first view
    const moreButtons = screen.getAllByTestId('more-icon');
    await user.click(moreButtons[0]);

    // Click delete
    await user.click(screen.getByText('saved_views.delete'));

    expect(api.del).toHaveBeenCalledWith('/saved-views/v1');
  });

  it('opens save modal when save button clicked', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockViews);
    const user = userEvent.setup();

    render(<ViewPicker {...defaultProps} />);

    await screen.findByText('Active Only');

    await user.click(screen.getByText('saved_views.save_current'));

    expect(screen.getByTestId('save-view-modal')).toBeInTheDocument();
  });
});
