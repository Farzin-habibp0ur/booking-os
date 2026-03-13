jest.mock('@/lib/cn', () => ({ cn: (...args) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  Play: () => <span data-testid="play-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  XCircle: () => <span data-testid="x-circle-icon" />,
  Zap: () => <span data-testid="zap-icon" />,
  TrendingUp: () => <span data-testid="trending-icon" />,
  FileText: () => <span data-testid="file-icon" />,
  Send: () => <span data-testid="send-icon" />,
  BarChart3: () => <span data-testid="chart-icon" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { AgentStatusCard } from './agent-status-card';

const baseProps = {
  agentType: 'MKT_BLOG_WRITER',
  name: 'Blog Writer',
  description: 'SEO blog posts',
  category: 'content' as const,
  isEnabled: true,
  runIntervalMinutes: 60,
  performanceScore: 85,
  onToggle: jest.fn(),
  onRunNow: jest.fn(),
};

describe('AgentStatusCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders with data-testid', () => {
    render(<AgentStatusCard {...baseProps} />);
    expect(screen.getByTestId('agent-status-card')).toBeInTheDocument();
  });

  it('shows agent name', () => {
    render(<AgentStatusCard {...baseProps} />);
    expect(screen.getByText('Blog Writer')).toBeInTheDocument();
  });

  it('shows category badge', () => {
    render(<AgentStatusCard {...baseProps} />);
    expect(screen.getByTestId('category-badge')).toHaveTextContent('Content');
  });

  it('shows performance score with sage color for >=80', () => {
    render(<AgentStatusCard {...baseProps} performanceScore={85} />);
    const score = screen.getByTestId('performance-score');
    expect(score).toHaveTextContent('85%');
    expect(score.className).toContain('text-sage-600');
  });

  it('shows performance score with amber color for 50-79', () => {
    render(<AgentStatusCard {...baseProps} performanceScore={65} />);
    const score = screen.getByTestId('performance-score');
    expect(score.className).toContain('text-amber-600');
  });

  it('shows performance score with red color for <50', () => {
    render(<AgentStatusCard {...baseProps} performanceScore={30} />);
    const score = screen.getByTestId('performance-score');
    expect(score.className).toContain('text-red-500');
  });

  it('calls onToggle when toggle clicked', () => {
    render(<AgentStatusCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(baseProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onRunNow when Run Now clicked', () => {
    render(<AgentStatusCard {...baseProps} />);
    fireEvent.click(screen.getByTestId('run-now-btn'));
    expect(baseProps.onRunNow).toHaveBeenCalledTimes(1);
  });

  it('disables Run Now when agent is disabled', () => {
    render(<AgentStatusCard {...baseProps} isEnabled={false} />);
    expect(screen.getByTestId('run-now-btn')).toBeDisabled();
  });

  it('shows Running... when triggering', () => {
    render(<AgentStatusCard {...baseProps} isTriggering />);
    expect(screen.getByText('Running...')).toBeInTheDocument();
  });

  it('shows latest run status', () => {
    render(<AgentStatusCard {...baseProps} latestRun={{ status: 'COMPLETED', cardsCreated: 5 }} />);
    expect(screen.getByTestId('last-run-status')).toHaveTextContent('5 created');
  });

  it('shows FAILED run status', () => {
    render(<AgentStatusCard {...baseProps} latestRun={{ status: 'FAILED', cardsCreated: 0 }} />);
    expect(screen.getByTestId('last-run-status')).toHaveTextContent('FAILED');
  });

  it('shows toggle as sage when enabled', () => {
    render(<AgentStatusCard {...baseProps} isEnabled={true} />);
    const toggle = screen.getByTestId('toggle-btn');
    expect(toggle.className).toContain('bg-sage-500');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('shows toggle as slate when disabled', () => {
    render(<AgentStatusCard {...baseProps} isEnabled={false} />);
    const toggle = screen.getByTestId('toggle-btn');
    expect(toggle.className).toContain('bg-slate-200');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onClick when card clicked', () => {
    const onClick = jest.fn();
    render(<AgentStatusCard {...baseProps} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('agent-status-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stops propagation on toggle click', () => {
    const onClick = jest.fn();
    render(<AgentStatusCard {...baseProps} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(onClick).not.toHaveBeenCalled();
    expect(baseProps.onToggle).toHaveBeenCalled();
  });
});
