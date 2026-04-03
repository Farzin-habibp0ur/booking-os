jest.mock('./components/ai-value-kpis', () => ({
  AIValueKPIs: () => <div data-testid="mock-ai-value-kpis" />,
}));
jest.mock('./components/agent-dashboard', () => ({
  AgentDashboard: () => <div data-testid="mock-agent-dashboard" />,
}));
jest.mock('./components/ai-guardrails', () => ({
  AIGuardrails: () => <div data-testid="mock-ai-guardrails" />,
}));
jest.mock('./components/pending-drafts-card', () => ({
  PendingDraftsCard: () => <div data-testid="mock-pending-drafts-card" />,
}));
jest.mock('./components/ai-activity-feed', () => ({
  AIActivityFeed: () => <div data-testid="mock-ai-activity-feed" />,
}));

import { render, screen } from '@testing-library/react';
import AIOverviewPage from './page';

describe('AIOverviewPage', () => {
  it('renders ai-overview container', () => {
    render(<AIOverviewPage />);
    expect(screen.getByTestId('ai-overview')).toBeInTheDocument();
  });

  it('renders AIValueKPIs component', () => {
    render(<AIOverviewPage />);
    expect(screen.getByTestId('mock-ai-value-kpis')).toBeInTheDocument();
  });

  it('renders AIGuardrails component', () => {
    render(<AIOverviewPage />);
    expect(screen.getByTestId('mock-ai-guardrails')).toBeInTheDocument();
  });

  it('renders PendingDraftsCard component', () => {
    render(<AIOverviewPage />);
    expect(screen.getByTestId('mock-pending-drafts-card')).toBeInTheDocument();
  });

  it('renders AgentDashboard component', () => {
    render(<AIOverviewPage />);
    expect(screen.getByTestId('mock-agent-dashboard')).toBeInTheDocument();
  });

  it('renders AIActivityFeed component', () => {
    render(<AIOverviewPage />);
    expect(screen.getByTestId('mock-ai-activity-feed')).toBeInTheDocument();
  });
});
