jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import SequencesPage from './page';

beforeEach(() => resetMocks());

describe('SequencesPage', () => {
  it('renders loading state initially', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    render(<SequencesPage />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders page content after data loads', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          byType: {},
          byStatus: {},
          totalEnrolled: 0,
        });
      }
      return Promise.resolve([]);
    });

    render(<SequencesPage />);

    await waitFor(() => {
      expect(screen.getByText('Email Sequences')).toBeInTheDocument();
    });
  });
});
