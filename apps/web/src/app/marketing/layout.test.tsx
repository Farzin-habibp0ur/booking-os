const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/marketing',
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

let mockRole = 'SUPER_ADMIN';
jest.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: any) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({
    user: { sub: 'staff1', businessId: 'biz1', role: mockRole },
    loading: false,
  }),
}));
jest.mock('@/components/shell', () => ({
  Shell: ({ children }: any) => <div data-testid="shell">{children}</div>,
}));
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { render, screen } from '@testing-library/react';
import MarketingLayout from './layout';

describe('MarketingLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'SUPER_ADMIN';
  });

  it('renders children for SUPER_ADMIN users', () => {
    render(
      <MarketingLayout>
        <div data-testid="child-content">hello</div>
      </MarketingLayout>,
    );
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('redirects non-SUPER_ADMIN users to /ai', () => {
    mockRole = 'ADMIN';
    render(
      <MarketingLayout>
        <div data-testid="child-content">hello</div>
      </MarketingLayout>,
    );
    expect(mockPush).toHaveBeenCalledWith('/ai');
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('does not render children for AGENT role', () => {
    mockRole = 'AGENT';
    render(
      <MarketingLayout>
        <span>secret content</span>
      </MarketingLayout>,
    );
    expect(mockPush).toHaveBeenCalledWith('/ai');
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });
});
