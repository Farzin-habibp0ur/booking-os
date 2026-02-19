import { render, screen, fireEvent } from '@testing-library/react';
import { WaitlistMatchCard } from './waitlist-match-card';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockSlots = [
  { time: '2026-02-20T10:00:00.000Z', display: '10:00', staffName: 'Sarah', staffId: 's1' },
  { time: '2026-02-21T14:00:00.000Z', display: '14:00', staffName: 'Emily', staffId: 's2' },
];

describe('WaitlistMatchCard', () => {
  it('renders card with customer name and service', () => {
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane Doe"
        serviceName="Facial Treatment"
        slots={mockSlots}
      />,
    );

    expect(screen.getByTestId('waitlist-match-card-card1')).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Facial Treatment/)).toBeInTheDocument();
  });

  it('displays lightning bolt icon', () => {
    render(
      <WaitlistMatchCard id="card1" customerName="Jane" serviceName="Facial" slots={mockSlots} />,
    );

    expect(screen.getByTestId('waitlist-icon')).toBeInTheDocument();
  });

  it('renders slot list', () => {
    render(
      <WaitlistMatchCard id="card1" customerName="Jane" serviceName="Facial" slots={mockSlots} />,
    );

    expect(screen.getByTestId('slot-list')).toBeInTheDocument();
    expect(screen.getByTestId('slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('slot-1')).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText('Sarah')).toBeInTheDocument();
  });

  it('shows preferred staff when provided', () => {
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane"
        serviceName="Facial"
        slots={mockSlots}
        preferredStaff="Emily"
      />,
    );

    expect(screen.getByText(/Preferred: Emily/)).toBeInTheDocument();
  });

  it('does not show preferred staff text when null', () => {
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane"
        serviceName="Facial"
        slots={mockSlots}
        preferredStaff={null}
      />,
    );

    expect(screen.queryByText(/Preferred:/)).not.toBeInTheDocument();
  });

  it('renders offer buttons when pending and callback provided', () => {
    const onOfferSlot = jest.fn();
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane"
        serviceName="Facial"
        slots={mockSlots}
        onOfferSlot={onOfferSlot}
      />,
    );

    expect(screen.getByTestId('offer-slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('offer-slot-1')).toBeInTheDocument();
  });

  it('calls onOfferSlot with card id and slot data', () => {
    const onOfferSlot = jest.fn();
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane"
        serviceName="Facial"
        slots={mockSlots}
        onOfferSlot={onOfferSlot}
      />,
    );

    fireEvent.click(screen.getByTestId('offer-slot-0'));

    expect(onOfferSlot).toHaveBeenCalledWith('card1', mockSlots[0]);
  });

  it('renders dismiss button when pending and callback provided', () => {
    const onDismiss = jest.fn();
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane"
        serviceName="Facial"
        slots={mockSlots}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByTestId('dismiss-card1')).toBeInTheDocument();
  });

  it('calls onDismiss with card id', () => {
    const onDismiss = jest.fn();
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane"
        serviceName="Facial"
        slots={mockSlots}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByTestId('dismiss-card1'));

    expect(onDismiss).toHaveBeenCalledWith('card1');
  });

  it('hides action buttons when status is not PENDING', () => {
    render(
      <WaitlistMatchCard
        id="card1"
        customerName="Jane"
        serviceName="Facial"
        slots={mockSlots}
        status="APPROVED"
        onOfferSlot={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('offer-slot-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dismiss-card1')).not.toBeInTheDocument();
  });

  it('renders with empty slots array', () => {
    render(<WaitlistMatchCard id="card1" customerName="Jane" serviceName="Facial" slots={[]} />);

    expect(screen.queryByTestId('slot-list')).not.toBeInTheDocument();
  });
});
