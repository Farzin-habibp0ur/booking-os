jest.mock('next/navigation', () => ({
  usePathname: () => '/ai',
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: any) => <div>{children}</div>,
  useAuth: () => ({ user: { sub: 'staff1', businessId: 'biz1', role: 'ADMIN' }, loading: false }),
}));
jest.mock('@/components/shell', () => ({
  Shell: ({ children }: any) => <div data-testid="shell">{children}</div>,
}));
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { render, screen } from '@testing-library/react';
import AILayout from './layout';

describe('AILayout', () => {
  it('renders AI Command Center header', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    expect(screen.getByText('AI Command Center')).toBeInTheDocument();
  });

  it('renders 4 tab links', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    expect(screen.getByTestId('ai-tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('ai-tab-agents')).toBeInTheDocument();
    expect(screen.getByTestId('ai-tab-actions')).toBeInTheDocument();
    expect(screen.getByTestId('ai-tab-performance')).toBeInTheDocument();
  });

  it('tabs link to correct paths', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    expect(screen.getByTestId('ai-tab-overview')).toHaveAttribute('href', '/ai');
    expect(screen.getByTestId('ai-tab-agents')).toHaveAttribute('href', '/ai/agents');
    expect(screen.getByTestId('ai-tab-actions')).toHaveAttribute('href', '/ai/actions');
    expect(screen.getByTestId('ai-tab-performance')).toHaveAttribute('href', '/ai/performance');
  });

  it('highlights active tab based on pathname', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    const overviewTab = screen.getByTestId('ai-tab-overview');
    // pathname is '/ai' so overview tab should have active classes
    expect(overviewTab.className).toContain('border-sage-600');
  });

  it('renders children', () => {
    render(
      <AILayout>
        <div data-testid="child-content">hello</div>
      </AILayout>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders tab bar container', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    expect(screen.getByTestId('ai-tab-bar')).toBeInTheDocument();
  });
});
