import { render, screen } from '@testing-library/react';
import NewAutomationPage from './page';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('AutomationsNewRedirectPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to /ai/automations/new', () => {
    render(<NewAutomationPage />);
    expect(mockReplace).toHaveBeenCalledWith('/ai/automations/new');
  });

  it('shows redirecting message', () => {
    render(<NewAutomationPage />);
    expect(screen.getByText(/Redirecting/i)).toBeInTheDocument();
  });
});
