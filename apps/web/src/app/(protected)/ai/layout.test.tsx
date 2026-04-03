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
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ count: 0 }),
  },
}));

import { render, screen, waitFor } from '@testing-library/react';
import AILayout from './layout';
import { api } from '@/lib/api';

describe('AILayout', () => {
  beforeEach(() => {
    (api.get as jest.Mock).mockResolvedValue({ count: 0 });
  });

  it('renders AI Hub header', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    expect(screen.getByText('AI Hub')).toBeInTheDocument();
  });

  it('renders 5 tab links', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    expect(screen.getByTestId('ai-tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('ai-tab-agents')).toBeInTheDocument();
    expect(screen.getByTestId('ai-tab-actions')).toBeInTheDocument();
    expect(screen.getByTestId('ai-tab-automations')).toBeInTheDocument();
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
    expect(screen.getByTestId('ai-tab-automations')).toHaveAttribute('href', '/ai/automations');
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

  it('renders settings gear icon link', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    const settingsLink = screen.getByTestId('ai-settings-link');
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute('href', '/ai/settings');
  });

  it('renders Automations tab with correct href', () => {
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    expect(screen.getByTestId('ai-tab-automations')).toHaveAttribute('href', '/ai/automations');
  });

  it('shows badge on Actions tab when count > 0', async () => {
    (api.get as jest.Mock).mockResolvedValue({ count: 3 });
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('does not show badge on Actions tab when count is 0', async () => {
    (api.get as jest.Mock).mockResolvedValue({ count: 0 });
    render(
      <AILayout>
        <div>child</div>
      </AILayout>,
    );
    await waitFor(() => {
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });
});
