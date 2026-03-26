import { render } from '@testing-library/react';
import ReferralSettingsRedirect from './page';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('ReferralSettingsRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to /marketing/referrals', () => {
    render(<ReferralSettingsRedirect />);
    expect(mockReplace).toHaveBeenCalledWith('/marketing/referrals');
  });

  it('renders nothing', () => {
    const { container } = render(<ReferralSettingsRedirect />);
    expect(container.innerHTML).toBe('');
  });
});
