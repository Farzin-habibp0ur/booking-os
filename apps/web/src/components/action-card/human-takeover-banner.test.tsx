import { render, screen, fireEvent } from '@testing-library/react';
import { HumanTakeoverBanner } from './human-takeover-banner';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('HumanTakeoverBanner', () => {
  it('renders banner with conversation id', () => {
    render(<HumanTakeoverBanner conversationId="conv-1" />);

    expect(screen.getByTestId('takeover-banner-conv-1')).toBeInTheDocument();
  });

  it('displays human takeover text', () => {
    render(<HumanTakeoverBanner conversationId="conv-1" />);

    expect(screen.getByText('Human Takeover Active')).toBeInTheDocument();
    expect(screen.getByText(/AI responses are paused/)).toBeInTheDocument();
  });

  it('displays reason when provided', () => {
    render(
      <HumanTakeoverBanner
        conversationId="conv-1"
        reason="Customer requested human agent"
      />,
    );

    expect(screen.getByText(/Customer requested human agent/)).toBeInTheDocument();
  });

  it('renders resolve button when callback provided', () => {
    const onResolve = jest.fn();
    render(
      <HumanTakeoverBanner conversationId="conv-1" onResolve={onResolve} />,
    );

    expect(screen.getByTestId('takeover-resolve-conv-1')).toBeInTheDocument();
    expect(screen.getByText('Resume AI')).toBeInTheDocument();
  });

  it('calls onResolve with conversationId', () => {
    const onResolve = jest.fn();
    render(
      <HumanTakeoverBanner conversationId="conv-1" onResolve={onResolve} />,
    );

    fireEvent.click(screen.getByTestId('takeover-resolve-conv-1'));

    expect(onResolve).toHaveBeenCalledWith('conv-1');
  });

  it('does not render resolve button when no callback', () => {
    render(<HumanTakeoverBanner conversationId="conv-1" />);

    expect(screen.queryByTestId('takeover-resolve-conv-1')).not.toBeInTheDocument();
  });

  it('renders warning icon', () => {
    render(<HumanTakeoverBanner conversationId="conv-1" />);

    expect(screen.getByTestId('takeover-icon')).toBeInTheDocument();
  });
});
