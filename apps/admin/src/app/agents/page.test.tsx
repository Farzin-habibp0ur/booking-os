import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

describe('AI Agents', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    // Agents page makes 4 parallel calls to /admin/agents-console/*
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/funnel')) {
        return Promise.resolve({ total: 0, pending: 0, approved: 0, rejected: 0, expired: 0 });
      }
      if (url.includes('/failures')) {
        return Promise.resolve([]);
      }
      if (url.includes('/abnormal-tenants')) {
        return Promise.resolve([]);
      }
      // performance
      return Promise.resolve({
        byAgentType: [],
        totalRuns: 0,
        successRate: 0,
        cardsCreated: 0,
      });
    });

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/No agent runs recorded yet/i)).toBeInTheDocument();
    });
  });
});
