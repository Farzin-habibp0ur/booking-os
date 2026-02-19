import { render, screen } from '@testing-library/react';
import { DeliveryStatus } from './delivery-status';

describe('DeliveryStatus', () => {
  it('renders single check for SENT', () => {
    render(<DeliveryStatus status="SENT" />);
    expect(screen.getByTestId('delivery-sent')).toBeInTheDocument();
  });

  it('renders double check for DELIVERED', () => {
    render(<DeliveryStatus status="DELIVERED" />);
    expect(screen.getByTestId('delivery-delivered')).toBeInTheDocument();
  });

  it('renders blue double check for READ', () => {
    render(<DeliveryStatus status="READ" />);
    expect(screen.getByTestId('delivery-read')).toBeInTheDocument();
  });

  it('renders error icon for FAILED', () => {
    render(<DeliveryStatus status="FAILED" />);
    expect(screen.getByTestId('delivery-failed')).toBeInTheDocument();
  });

  it('renders nothing for unknown status', () => {
    const { container } = render(<DeliveryStatus status="UNKNOWN" />);
    expect(container.firstChild).toBeNull();
  });
});
