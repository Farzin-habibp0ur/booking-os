import { render, screen } from '@testing-library/react';
import { SelfServeError, detectVariant } from './self-serve-error';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('SelfServeError', () => {
  it('renders title and message', () => {
    render(<SelfServeError title="Unable to Reschedule" message="Token has expired" />);

    expect(screen.getByTestId('error-title')).toHaveTextContent('Unable to Reschedule');
    expect(screen.getByTestId('error-message')).toHaveTextContent('Token has expired');
  });

  it('renders business name when provided', () => {
    render(<SelfServeError title="Error" message="Invalid link" businessName="Glow Clinic" />);

    expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
  });

  it('renders Book Again link when slug provided', () => {
    render(<SelfServeError title="Error" message="Expired" businessSlug="glow-clinic" />);

    const link = screen.getByTestId('book-again-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/book/glow-clinic');
    expect(link).toHaveTextContent('Book Again');
  });

  it('does not render Book Again link when no slug', () => {
    render(<SelfServeError title="Error" message="Expired" />);

    expect(screen.queryByTestId('book-again-link')).not.toBeInTheDocument();
  });

  it('shows expired help text for expired variant', () => {
    render(<SelfServeError title="Error" message="Token has expired" businessName="Glow Clinic" />);

    expect(screen.getByText(/request a new one/)).toBeInTheDocument();
  });

  it('shows used help text for already-used variant', () => {
    render(<SelfServeError title="Error" message="Token has already been used" />);

    expect(screen.getByText(/cannot be reused/)).toBeInTheDocument();
  });

  it('shows policy help text for policy variant', () => {
    render(<SelfServeError title="Error" message="Cannot be rescheduled within 24 hours" />);

    expect(screen.getByText(/restricted by the business policy/)).toBeInTheDocument();
  });

  it('shows generic help text for invalid variant', () => {
    render(<SelfServeError title="Error" message="Invalid token" />);

    expect(screen.getByText(/directly for assistance/)).toBeInTheDocument();
  });

  it('allows explicit variant override', () => {
    render(<SelfServeError title="Error" message="Something happened" variant="expired" />);

    expect(screen.getByText(/request a new one/)).toBeInTheDocument();
  });

  it('renders error container with correct testid', () => {
    render(<SelfServeError title="Error" message="test" />);

    expect(screen.getByTestId('self-serve-error')).toBeInTheDocument();
  });
});

describe('detectVariant', () => {
  it('detects expired messages', () => {
    expect(detectVariant('Token has expired')).toBe('expired');
    expect(detectVariant('This offer has expired')).toBe('expired');
  });

  it('detects already-used messages', () => {
    expect(detectVariant('Token has already been used')).toBe('used');
  });

  it('detects invalid messages', () => {
    expect(detectVariant('Invalid token')).toBe('invalid');
    expect(detectVariant('Booking not found')).toBe('invalid');
  });

  it('detects policy messages', () => {
    expect(detectVariant('This booking cannot be rescheduled')).toBe('policy');
    expect(detectVariant('Rescheduling within 24 hours is not allowed')).toBe('policy');
  });

  it('returns generic for unknown messages', () => {
    expect(detectVariant('Something went wrong')).toBe('generic');
  });
});
