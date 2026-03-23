import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PlaybookCard } from './playbook-card';

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

jest.mock('lucide-react', () => ({
  ChevronDown: (props: any) => <svg data-testid="chevron-down" {...props} />,
  ChevronUp: (props: any) => <svg data-testid="chevron-up" {...props} />,
  ToggleLeft: () => <span>ToggleLeft</span>,
  ToggleRight: () => <span>ToggleRight</span>,
  Clock: () => <span>ClockIcon</span>,
  Users: () => <span>UsersIcon</span>,
  MessageSquare: () => <span>MsgIcon</span>,
  ShieldCheck: () => <span>ShieldIcon</span>,
  Zap: () => <span>ZapIcon</span>,
}));

const basePlaybook = {
  id: 'playbook-no-show-prevention',
  name: 'No-Show Prevention',
  description: 'Send deposit reminder 2h before and confirmation 24h before appointment',
  playbook: 'no-show-prevention',
  isActive: true,
  installed: true,
  trigger: 'BOOKING_UPCOMING',
  filters: { hoursBefore: 24 },
  actions: [{ type: 'SEND_TEMPLATE', category: 'BOOKING_CONFIRMATION' }],
};

const mockOnToggle = jest.fn();

describe('PlaybookCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue({ sent: 0, skipped: 0, failed: 0, total: 0, lastRun: null });
  });

  it('renders playbook name and description', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    expect(screen.getByText('No-Show Prevention')).toBeInTheDocument();
    expect(screen.getByText(/Send deposit reminder/)).toBeInTheDocument();
  });

  it('shows Active badge when isActive is true', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Off badge and Enable button when inactive', () => {
    render(
      <PlaybookCard playbook={{ ...basePlaybook, isActive: false }} onToggle={mockOnToggle} />,
    );

    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('Enable')).toBeInTheDocument();
  });

  it('calls onToggle when toggle button is clicked', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    fireEvent.click(screen.getByText('Disable'));

    expect(mockOnToggle).toHaveBeenCalledWith('no-show-prevention');
  });

  it('expands details when Details button is clicked', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    expect(screen.queryByTestId('playbook-details')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('expand-button'));

    expect(screen.getByTestId('playbook-details')).toBeInTheDocument();
    expect(screen.getByText('What it does')).toBeInTheDocument();
    expect(screen.getByText('When it runs')).toBeInTheDocument();
    expect(screen.getByText('Who it affects')).toBeInTheDocument();
  });

  it('shows sample message in expanded details', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    fireEvent.click(screen.getByTestId('expand-button'));

    expect(screen.getByText('Sample message')).toBeInTheDocument();
    expect(screen.getByText(/Reply YES to confirm/)).toBeInTheDocument();
  });

  it('shows safety controls in expanded details', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    fireEvent.click(screen.getByTestId('expand-button'));

    expect(screen.getByText('Safety controls')).toBeInTheDocument();
    expect(screen.getByText('Max 3/customer/day')).toBeInTheDocument();
    expect(screen.getByText('Global cap: 10/day')).toBeInTheDocument();
  });

  it('shows examples in expanded details', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    fireEvent.click(screen.getByTestId('expand-button'));

    expect(screen.getByText('Examples')).toBeInTheDocument();
    expect(screen.getByText(/reminder sent today/)).toBeInTheDocument();
  });

  it('collapses details when Less is clicked', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    fireEvent.click(screen.getByTestId('expand-button'));
    expect(screen.getByTestId('playbook-details')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('expand-button'));
    expect(screen.queryByTestId('playbook-details')).not.toBeInTheDocument();
  });

  it('fetches and displays stats when installed', async () => {
    mockApi.get.mockResolvedValue({
      sent: 42,
      skipped: 5,
      failed: 1,
      total: 48,
      lastRun: '2026-02-19T10:00:00Z',
    });

    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    await waitFor(() => {
      expect(screen.getByTestId('playbook-stats')).toBeInTheDocument();
      expect(screen.getByText('42 sent')).toBeInTheDocument();
      expect(screen.getByText('5 skipped')).toBeInTheDocument();
      expect(screen.getByText('1 failed')).toBeInTheDocument();
    });
  });

  it('does not fetch stats when not installed', () => {
    render(
      <PlaybookCard playbook={{ ...basePlaybook, installed: false }} onToggle={mockOnToggle} />,
    );

    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('does not show stats row when total is zero', async () => {
    mockApi.get.mockResolvedValue({
      sent: 0,
      skipped: 0,
      failed: 0,
      total: 0,
      lastRun: null,
    });

    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('playbook-stats')).not.toBeInTheDocument();
  });

  it('renders correct testid per playbook', () => {
    render(<PlaybookCard playbook={basePlaybook} onToggle={mockOnToggle} />);

    expect(screen.getByTestId('playbook-card-no-show-prevention')).toBeInTheDocument();
  });
});
