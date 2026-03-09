import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeatureDiscovery } from './feature-discovery';

jest.mock('lucide-react', () => ({
  Lightbulb: () => <span data-testid="lightbulb-icon" />,
  X: () => <span data-testid="x-icon" />,
}));

describe('FeatureDiscovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders when not yet seen', () => {
    render(<FeatureDiscovery id="test-tip" title="Test Title" description="Test description" />);
    expect(screen.getByTestId('feature-discovery')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('does not render when already seen in localStorage', () => {
    localStorage.setItem('feature-discovery-test-tip', '1');

    const { container } = render(
      <FeatureDiscovery id="test-tip" title="Test Title" description="Test description" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('dismisses and saves to localStorage', async () => {
    render(<FeatureDiscovery id="test-tip" title="Test Title" description="Test description" />);
    expect(screen.getByTestId('feature-discovery')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('feature-discovery-dismiss'));

    expect(screen.queryByTestId('feature-discovery')).not.toBeInTheDocument();
    expect(localStorage.getItem('feature-discovery-test-tip')).toBe('1');
  });

  it('shows lightbulb icon', () => {
    render(<FeatureDiscovery id="test-tip" title="Test" description="Desc" />);
    expect(screen.getByTestId('lightbulb-icon')).toBeInTheDocument();
  });

  it('uses sage styling', () => {
    render(<FeatureDiscovery id="test-tip" title="Test" description="Desc" />);
    const el = screen.getByTestId('feature-discovery');
    expect(el.className).toContain('sage');
  });
});
