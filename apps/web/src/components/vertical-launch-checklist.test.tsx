jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  CheckCircle2: ({ className }: any) => <span data-testid="check-icon" className={className} />,
  Circle: () => <span data-testid="circle-icon" />,
  ArrowRight: () => <span data-testid="arrow-icon" />,
}));

import { render, screen } from '@testing-library/react';
import { VerticalLaunchChecklist } from './vertical-launch-checklist';

const allItems = [
  { key: 'business_name', done: true, fixUrl: '/settings' },
  { key: 'staff_added', done: true, fixUrl: '/staff' },
  { key: 'services_created', done: false, fixUrl: '/services' },
  { key: 'agents_configured', done: false, fixUrl: '/settings/agents' },
];

describe('VerticalLaunchChecklist', () => {
  it('renders checklist with progress', () => {
    render(<VerticalLaunchChecklist items={allItems} allComplete={false} />);
    expect(screen.getByText('Launch Checklist')).toBeInTheDocument();
    expect(screen.getByText('2/4 complete')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    render(<VerticalLaunchChecklist items={allItems} allComplete={false} />);
    const bar = screen.getByTestId('progress-bar');
    expect(bar.style.width).toBe('50%');
  });

  it('shows completed items with strikethrough', () => {
    render(<VerticalLaunchChecklist items={allItems} allComplete={false} />);
    expect(screen.getByText('Set business name')).toBeInTheDocument();
    expect(screen.getByText('Set business name').className).toContain('line-through');
  });

  it('shows incomplete items with descriptions', () => {
    render(<VerticalLaunchChecklist items={allItems} allComplete={false} />);
    expect(screen.getByText('Create services')).toBeInTheDocument();
    expect(screen.getByText(/Set up your service menu/)).toBeInTheDocument();
  });

  it('shows fix link for incomplete items', () => {
    render(<VerticalLaunchChecklist items={allItems} allComplete={false} />);
    expect(screen.getByTestId('fix-services_created')).toBeInTheDocument();
    expect(screen.getByTestId('fix-agents_configured')).toBeInTheDocument();
  });

  it('does not show fix link for complete items', () => {
    render(<VerticalLaunchChecklist items={allItems} allComplete={false} />);
    expect(screen.queryByTestId('fix-business_name')).not.toBeInTheDocument();
  });

  it('shows all-complete success message', () => {
    render(
      <VerticalLaunchChecklist
        items={allItems.map((i) => ({ ...i, done: true }))}
        allComplete={true}
      />,
    );
    expect(screen.getByText(/All set! Your business is ready/)).toBeInTheDocument();
    expect(screen.queryByText('Launch Checklist')).not.toBeInTheDocument();
  });

  it('shows agents_configured item', () => {
    render(<VerticalLaunchChecklist items={allItems} allComplete={false} />);
    expect(screen.getByText('Configure AI agents')).toBeInTheDocument();
    expect(screen.getByText(/Enable at least one AI agent skill/)).toBeInTheDocument();
  });

  it('handles unknown item keys gracefully', () => {
    render(
      <VerticalLaunchChecklist
        items={[{ key: 'unknown_key', done: false, fixUrl: '/foo' }]}
        allComplete={false}
      />,
    );
    expect(screen.getByText('unknown_key')).toBeInTheDocument();
  });
});
