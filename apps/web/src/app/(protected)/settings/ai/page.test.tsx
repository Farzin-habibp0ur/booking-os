import { render, screen, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import AISettingsRedirectPage from './page';

describe('AISettingsRedirectPage', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('redirects to /ai/settings', async () => {
    render(<AISettingsRedirectPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/ai/settings');
    });
  });

  it('shows redirecting message', () => {
    render(<AISettingsRedirectPage />);
    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
  });
});
