import { render, screen, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import AutomationsRedirectPage from './page';

describe('AutomationsRedirectPage', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('redirects to /ai/automations', async () => {
    render(<AutomationsRedirectPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/ai/automations');
    });
  });

  it('shows redirecting message', () => {
    render(<AutomationsRedirectPage />);
    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
  });
});
