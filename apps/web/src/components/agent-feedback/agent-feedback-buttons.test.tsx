jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  ThumbsUp: () => <span data-testid="thumbs-up" />,
  ThumbsDown: () => <span data-testid="thumbs-down" />,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentFeedbackButtons } from './agent-feedback-buttons';

describe('AgentFeedbackButtons', () => {
  const onSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => jest.clearAllMocks());

  it('renders helpful and not helpful buttons', () => {
    render(<AgentFeedbackButtons actionCardId="c1" onSubmit={onSubmit} />);
    expect(screen.getByTestId('helpful-btn')).toBeInTheDocument();
    expect(screen.getByTestId('not-helpful-btn')).toBeInTheDocument();
    expect(screen.getByText('Was this helpful?')).toBeInTheDocument();
  });

  it('calls onSubmit with HELPFUL on click', async () => {
    render(<AgentFeedbackButtons actionCardId="c1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('helpful-btn'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('c1', 'HELPFUL');
    });
  });

  it('calls onSubmit with NOT_HELPFUL and shows comment box', async () => {
    render(<AgentFeedbackButtons actionCardId="c1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('not-helpful-btn'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('c1', 'NOT_HELPFUL');
    });
    expect(screen.getByTestId('comment-section')).toBeInTheDocument();
  });

  it('submits comment on send', async () => {
    render(<AgentFeedbackButtons actionCardId="c1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('not-helpful-btn'));

    await waitFor(() => screen.getByTestId('comment-input'));
    fireEvent.change(screen.getByTestId('comment-input'), {
      target: { value: 'Not relevant' },
    });
    fireEvent.click(screen.getByTestId('submit-comment'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('c1', 'NOT_HELPFUL', 'Not relevant');
    });
  });

  it('disables buttons after rating', async () => {
    render(<AgentFeedbackButtons actionCardId="c1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('helpful-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('helpful-btn')).toBeDisabled();
      expect(screen.getByTestId('not-helpful-btn')).toBeDisabled();
    });
  });

  it('shows existing rating as pre-selected', () => {
    render(
      <AgentFeedbackButtons actionCardId="c1" existingRating="HELPFUL" onSubmit={onSubmit} />,
    );
    expect(screen.getByTestId('helpful-btn')).toBeDisabled();
  });

  it('renders compact mode', () => {
    render(<AgentFeedbackButtons actionCardId="c1" onSubmit={onSubmit} compact />);
    expect(screen.getByTestId('feedback-buttons')).toBeInTheDocument();
    expect(screen.queryByText('Was this helpful?')).not.toBeInTheDocument();
  });

  it('does not submit empty comment', async () => {
    render(<AgentFeedbackButtons actionCardId="c1" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('not-helpful-btn'));

    await waitFor(() => screen.getByTestId('submit-comment'));
    // Comment input is empty
    fireEvent.click(screen.getByTestId('submit-comment'));

    // Should only have been called once (for the NOT_HELPFUL rating), not for comment
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
