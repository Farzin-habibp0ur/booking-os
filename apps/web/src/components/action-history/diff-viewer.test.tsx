import { render, screen } from '@testing-library/react';
import { DiffViewer } from './diff-viewer';

describe('DiffViewer', () => {
  it('renders changed fields with before and after', () => {
    render(<DiffViewer before={{ status: 'PENDING' }} after={{ status: 'CONFIRMED' }} />);

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('diff-before-status')).toHaveTextContent('PENDING');
    expect(screen.getByTestId('diff-after-status')).toHaveTextContent('CONFIRMED');
  });

  it('shows added fields', () => {
    render(<DiffViewer after={{ staffId: 'staff1' }} />);

    expect(screen.getByTestId('diff-after-staffId')).toHaveTextContent('staff1');
  });

  it('shows removed fields with strikethrough', () => {
    render(<DiffViewer before={{ notes: 'Old note' }} after={{}} />);

    expect(screen.getByTestId('diff-before-notes')).toHaveTextContent('Old note');
  });

  it('returns null when no data', () => {
    const { container } = render(<DiffViewer />);

    expect(container.firstChild).toBeNull();
  });

  it('handles object values as JSON', () => {
    render(<DiffViewer before={{ config: { a: 1 } }} after={{ config: { a: 2 } }} />);

    expect(screen.getByTestId('diff-before-config')).toHaveTextContent('{"a":1}');
    expect(screen.getByTestId('diff-after-config')).toHaveTextContent('{"a":2}');
  });

  it('does not show arrow for unchanged fields', () => {
    render(
      <DiffViewer
        before={{ status: 'CONFIRMED', name: 'Same' }}
        after={{ status: 'CONFIRMED', name: 'Same' }}
      />,
    );

    expect(screen.queryByTestId('diff-after-status')).not.toBeInTheDocument();
  });
});
