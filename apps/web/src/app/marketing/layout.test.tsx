jest.mock('next/navigation', () => ({
  usePathname: () => '/marketing',
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: any) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({ user: { sub: 'staff1', businessId: 'biz1', role: 'ADMIN' }, loading: false }),
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
  it('wraps children with AuthProvider and Shell', () => {
    render(
      <MarketingLayout>
        <div data-testid="child-content">hello</div>
      </MarketingLayout>,
    );
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders children inside Shell', () => {
    render(
      <MarketingLayout>
        <span>test content</span>
      </MarketingLayout>,
    );
    const shell = screen.getByTestId('shell');
    expect(shell).toHaveTextContent('test content');
  });
});
