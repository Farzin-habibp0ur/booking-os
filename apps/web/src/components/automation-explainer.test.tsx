import { render, screen, fireEvent } from '@testing-library/react';
import { AutomationExplainer } from './automation-explainer';

jest.mock('lucide-react', () => ({
  Zap: (props: any) => <svg data-testid="zap-icon" {...props} />,
  Bot: (props: any) => <svg data-testid="bot-icon" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="chevron-down" {...props} />,
  ChevronUp: (props: any) => <svg data-testid="chevron-up" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

const STORAGE_KEY = 'bookingos:automation-explainer-dismissed';

describe('AutomationExplainer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the banner when not dismissed', () => {
    render(<AutomationExplainer />);
    expect(
      screen.getByText('Two systems work together to automate your clinic'),
    ).toBeInTheDocument();
  });

  it('does not render when previously dismissed via localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { container } = render(<AutomationExplainer />);
    expect(container.firstChild).toBeNull();
  });

  it('expands to show details when expand button is clicked', () => {
    render(<AutomationExplainer />);
    expect(screen.queryByText('Playbooks & Rules')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand'));
    expect(screen.getByText('Playbooks & Rules')).toBeInTheDocument();
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
  });

  it('collapses when collapse button is clicked', () => {
    render(<AutomationExplainer />);
    fireEvent.click(screen.getByLabelText('Expand'));
    expect(screen.getByText('Playbooks & Rules')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Collapse'));
    expect(screen.queryByText('Playbooks & Rules')).not.toBeInTheDocument();
  });

  it('dismisses and saves to localStorage when dismiss button is clicked', () => {
    const { container } = render(<AutomationExplainer />);
    expect(
      screen.getByText('Two systems work together to automate your clinic'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(container.firstChild).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });
});
