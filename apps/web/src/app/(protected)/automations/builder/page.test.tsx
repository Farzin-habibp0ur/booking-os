import { render, screen } from '@testing-library/react';
import AutomationsBuilderRedirectPage from './page';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('AutomationsBuilderRedirectPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirects to /ai/automations/builder', () => {
    render(<AutomationsBuilderRedirectPage />);
    expect(mockReplace).toHaveBeenCalledWith('/ai/automations/builder');
  });

  it('shows redirecting message', () => {
    render(<AutomationsBuilderRedirectPage />);
    expect(screen.getByText(/Redirecting/i)).toBeInTheDocument();
  });
});
