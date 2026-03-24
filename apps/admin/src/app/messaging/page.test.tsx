import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('Messaging Ops', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    // Messaging page makes 3 parallel calls to /admin/messaging-console/*
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/failures')) {
        return Promise.resolve({ topReasons: [], impactedTenants: [] });
      }
      if (url.includes('/webhook-health')) {
        return Promise.resolve({
          isHealthy: true,
          recentInbound24h: 10,
          recentOutbound24h: 8,
          failedOutbound24h: 0,
        });
      }
      // dashboard
      return Promise.resolve({
        messagesSent: 100,
        messagesDelivered: 95,
        messagesFailed: 5,
        deliveryRate: 0.95,
        remindersSent: 20,
        remindersFailed: 1,
        reminderSuccessRate: 0.95,
        activeConversations: 12,
      });
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('Messaging Ops')).toBeInTheDocument();
    });
  });
});
