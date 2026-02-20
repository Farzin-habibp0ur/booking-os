const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/console/health',
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
  const icons = ['CheckCircle2', 'AlertTriangle', 'XCircle', 'RefreshCw'];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />;
  });
  return mocks;
});

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConsoleHealthPage from './page';

const mockHealthData = {
  status: 'healthy' as const,
  checks: [
    { name: 'Database', status: 'healthy' as const, message: 'Response time: 5ms', latencyMs: 5 },
    { name: 'Business Activity', status: 'healthy' as const, message: '7/9 businesses active' },
  ],
  businessHealth: { green: 7, yellow: 1, red: 1, total: 9 },
  checkedAt: new Date().toISOString(),
};

describe('ConsoleHealthPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockResolvedValue(mockHealthData);
  });

  it('renders loading state', () => {
    mockApi.get.mockImplementation(() => new Promise(() => {}));

    render(<ConsoleHealthPage />);

    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders healthy status banner', async () => {
    render(<ConsoleHealthPage />);

    await waitFor(() => {
      expect(screen.getByText('System is Healthy')).toBeInTheDocument();
    });

    expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
  });

  it('renders service checks', async () => {
    render(<ConsoleHealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Service Checks')).toBeInTheDocument();
    });

    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Response time: 5ms')).toBeInTheDocument();
    expect(screen.getByText('Latency: 5ms')).toBeInTheDocument();

    expect(screen.getByText('Business Activity')).toBeInTheDocument();
    expect(screen.getByText('7/9 businesses active')).toBeInTheDocument();
  });

  it('renders business health distribution', async () => {
    render(<ConsoleHealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Business Health Distribution')).toBeInTheDocument();
    });

    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument(); // green
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    // Both yellow and red are 1, so "1" appears twice
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('9 total businesses')).toBeInTheDocument();
  });

  it('has refresh button', async () => {
    render(<ConsoleHealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh').closest('button');
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).not.toBeDisabled();
  });

  it('calls API again when refresh is clicked', async () => {
    const user = userEvent.setup();

    render(<ConsoleHealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    // Initial call
    expect(mockApi.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await user.click(screen.getByText('Refresh'));
    });

    // Should have called again
    expect(mockApi.get).toHaveBeenCalledTimes(2);
    expect(mockApi.get).toHaveBeenCalledWith('/admin/health');
  });

  it('renders error state when API fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Server error'));

    await act(async () => {
      render(<ConsoleHealthPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load health data.')).toBeInTheDocument();
    });
  });

  it('renders degraded status banner when status is degraded', async () => {
    mockApi.get.mockResolvedValue({
      ...mockHealthData,
      status: 'degraded',
    });

    render(<ConsoleHealthPage />);

    await waitFor(() => {
      expect(screen.getByText('System is Degraded')).toBeInTheDocument();
    });
  });
});
