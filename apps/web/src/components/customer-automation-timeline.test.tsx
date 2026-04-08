import { render, screen, waitFor } from '@testing-library/react';
import { CustomerAutomationTimeline } from './customer-automation-timeline';

jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

jest.mock('@/lib/automation-labels', () => ({
  getActionLabel: (a: string) => a,
}));

jest.mock('lucide-react', () => ({
  Zap: (props: any) => <svg data-testid="zap-icon" {...props} />,
  Bot: (props: any) => <svg data-testid="bot-icon" {...props} />,
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockEvents = [
  {
    id: 'e1',
    source: 'rule',
    title: 'No-Show Prevention',
    action: 'SEND_TEMPLATE',
    outcome: 'SENT',
    trigger: 'BOOKING_UPCOMING',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'e2',
    source: 'agent',
    title: 'Retention Check',
    action: 'CARD_CREATED',
    outcome: 'SENT',
    trigger: 'RETENTION',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

describe('CustomerAutomationTimeline', () => {
  it('renders timeline events', async () => {
    mockApi.get.mockResolvedValue(mockEvents);
    render(<CustomerAutomationTimeline customerId="c1" />);

    await waitFor(() => {
      expect(screen.getByTestId('automation-timeline')).toBeInTheDocument();
      expect(screen.getByText('No-Show Prevention')).toBeInTheDocument();
      expect(screen.getByText('Retention Check')).toBeInTheDocument();
    });
  });

  it('renders empty state when no events', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<CustomerAutomationTimeline customerId="c1" />);

    await waitFor(() => {
      expect(screen.getByTestId('timeline-empty')).toBeInTheDocument();
    });
  });

  it('shows correct icons for rule vs agent events', async () => {
    mockApi.get.mockResolvedValue(mockEvents);
    render(<CustomerAutomationTimeline customerId="c1" />);

    await waitFor(() => {
      const zapIcons = screen.getAllByTestId('zap-icon');
      const botIcons = screen.getAllByTestId('bot-icon');
      expect(zapIcons.length).toBeGreaterThan(0);
      expect(botIcons.length).toBeGreaterThan(0);
    });
  });

  it('calls API with correct customer ID', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<CustomerAutomationTimeline customerId="cust-123" />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/automations/customer/cust-123/timeline');
    });
  });
});
