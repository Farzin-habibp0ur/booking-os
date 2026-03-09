const mockInitPostHog = jest.fn();
const mockIdentifyUser = jest.fn();
const mockResetUser = jest.fn();
const mockIsEnabled = jest.fn().mockReturnValue(true);

jest.mock('@/lib/posthog', () => ({
  initPostHog: (...args: any[]) => mockInitPostHog(...args),
  identifyUser: (...args: any[]) => mockIdentifyUser(...args),
  resetUser: (...args: any[]) => mockResetUser(...args),
  isEnabled: (...args: any[]) => mockIsEnabled(...args),
}));

const mockUser = {
  id: 'u1',
  name: 'Sarah',
  email: 'sarah@test.com',
  role: 'ADMIN',
  businessId: 'b1',
  business: { id: 'b1', name: 'Test Clinic', slug: 'test', verticalPack: 'AESTHETIC' },
};

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

import { render, screen } from '@testing-library/react';
import { PostHogIdentityProvider } from './posthog-provider';

describe('PostHogIdentityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsEnabled.mockReturnValue(true);
  });

  it('renders children', () => {
    render(
      <PostHogIdentityProvider>
        <div data-testid="child">Hello</div>
      </PostHogIdentityProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('calls initPostHog on mount', () => {
    render(
      <PostHogIdentityProvider>
        <div>Test</div>
      </PostHogIdentityProvider>,
    );
    expect(mockInitPostHog).toHaveBeenCalled();
  });

  it('calls identifyUser when user session is available', () => {
    render(
      <PostHogIdentityProvider>
        <div>Test</div>
      </PostHogIdentityProvider>,
    );
    expect(mockIdentifyUser).toHaveBeenCalledWith('u1', {
      email: 'sarah@test.com',
      name: 'Sarah',
      businessId: 'b1',
      businessName: 'Test Clinic',
      role: 'ADMIN',
      verticalPack: 'AESTHETIC',
    });
  });

  it('does not call identifyUser when not enabled', () => {
    mockIsEnabled.mockReturnValue(false);
    render(
      <PostHogIdentityProvider>
        <div>Test</div>
      </PostHogIdentityProvider>,
    );
    expect(mockIdentifyUser).not.toHaveBeenCalled();
  });
});
