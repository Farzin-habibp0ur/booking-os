import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  Calendar: (props: any) => <div data-testid="calendar-icon" {...props} />,
  MessageSquare: (props: any) => <div data-testid="message-icon" {...props} />,
  DollarSign: (props: any) => <div data-testid="dollar-icon" {...props} />,
  Users: (props: any) => <div data-testid="users-icon" {...props} />,
  Clock: (props: any) => <div data-testid="clock-icon" {...props} />,
  CheckCircle2: (props: any) => <div data-testid="check-icon" {...props} />,
  TrendingUp: (props: any) => <span data-testid="trending-up" {...props} />,
  TrendingDown: (props: any) => <span data-testid="trending-down" {...props} />,
}));

import { KpiStrip } from './kpi-strip';

const baseMetrics = {
  totalBookingsThisWeek: 12,
  totalBookingsLastWeek: 8,
  revenueThisMonth: 1500,
  avgResponseTimeMins: 5,
  openConversationCount: 3,
  totalCustomers: 100,
  noShowRate: 8,
};

describe('KpiStrip', () => {
  it('renders admin KPIs: revenue, bookings, customers', () => {
    render(<KpiStrip mode="admin" metrics={baseMetrics} />);

    expect(screen.getByTestId('kpi-strip')).toBeInTheDocument();
    expect(screen.getByText('dashboard.kpi_revenue')).toBeInTheDocument();
    expect(screen.getByText('dashboard.kpi_bookings_week')).toBeInTheDocument();
    expect(screen.getByText('dashboard.kpi_customers')).toBeInTheDocument();
  });

  it('renders agent KPIs: response time, unassigned, today bookings', () => {
    render(
      <KpiStrip mode="agent" metrics={baseMetrics} myBookingsToday={[{ id: '1' }, { id: '2' }]} />,
    );

    expect(screen.getByText('dashboard.kpi_response_time')).toBeInTheDocument();
    expect(screen.getByText('dashboard.kpi_unassigned')).toBeInTheDocument();
    expect(screen.getByText('dashboard.kpi_today_bookings')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // myBookingsToday count
  });

  it('renders provider KPIs: my schedule, completed, no-show rate', () => {
    render(
      <KpiStrip
        mode="provider"
        metrics={baseMetrics}
        myBookingsToday={[{ id: '1' }]}
        completedTodayByStaff={3}
      />,
    );

    expect(screen.getByText('dashboard.kpi_my_schedule')).toBeInTheDocument();
    expect(screen.getByText('dashboard.kpi_completed_today')).toBeInTheDocument();
    expect(screen.getByText('dashboard.kpi_no_show_rate')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // completedTodayByStaff
  });

  it('shows trending up icon for admin when bookings increased', () => {
    render(
      <KpiStrip
        mode="admin"
        metrics={{ ...baseMetrics, totalBookingsThisWeek: 12, totalBookingsLastWeek: 8 }}
      />,
    );

    expect(screen.getAllByTestId('trending-up').length).toBeGreaterThan(0);
  });

  it('shows trending down icon for admin when bookings decreased', () => {
    render(
      <KpiStrip
        mode="admin"
        metrics={{ ...baseMetrics, totalBookingsThisWeek: 4, totalBookingsLastWeek: 8 }}
      />,
    );

    expect(screen.getByTestId('trending-down')).toBeInTheDocument();
  });

  it('defaults to empty arrays when optional props not provided', () => {
    render(<KpiStrip mode="agent" metrics={baseMetrics} />);

    // Should render 0 for today bookings when myBookingsToday not provided
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('navigates to reports when admin revenue KPI is clicked', () => {
    render(<KpiStrip mode="admin" metrics={baseMetrics} />);

    const cards = screen.getAllByTestId('kpi-card');
    fireEvent.click(cards[0]); // Revenue card

    expect(mockPush).toHaveBeenCalledWith('/reports');
  });

  it('navigates to bookings when admin bookings KPI is clicked', () => {
    render(<KpiStrip mode="admin" metrics={baseMetrics} />);

    const cards = screen.getAllByTestId('kpi-card');
    fireEvent.click(cards[1]); // Bookings card

    expect(mockPush).toHaveBeenCalledWith('/bookings');
  });

  it('navigates to customers when admin customers KPI is clicked', () => {
    render(<KpiStrip mode="admin" metrics={baseMetrics} />);

    const cards = screen.getAllByTestId('kpi-card');
    fireEvent.click(cards[2]); // Customers card

    expect(mockPush).toHaveBeenCalledWith('/customers');
  });

  it('shows action subtitle for unassigned conversations in agent mode', () => {
    render(<KpiStrip mode="agent" metrics={{ ...baseMetrics, openConversationCount: 5 }} />);

    expect(screen.getByTestId('kpi-action-subtitle')).toBeInTheDocument();
    expect(screen.getByText(/5 dashboard.kpi_pending/)).toBeInTheDocument();
  });

  it('shows action subtitle for new customers in admin mode', () => {
    render(<KpiStrip mode="admin" metrics={{ ...baseMetrics, newCustomersThisWeek: 3 }} />);

    expect(screen.getByText(/3 dashboard.kpi_new_this_week/)).toBeInTheDocument();
  });
});
