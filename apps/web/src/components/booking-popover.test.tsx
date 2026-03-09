jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/design-tokens', () => ({
  ELEVATION: { dropdown: '' },
  BOOKING_STATUS_STYLES: {
    CONFIRMED: { bg: 'bg-sage-50', text: 'text-sage-900', dot: 'dot-sage', label: 'Confirmed' },
    IN_PROGRESS: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      dot: 'dot-amber',
      label: 'In Progress',
    },
    PENDING: {
      bg: 'bg-lavender-50',
      text: 'text-lavender-900',
      dot: 'dot-lavender',
      label: 'Pending',
    },
    CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'dot-red', label: 'Cancelled' },
  },
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingPopover } from './booking-popover';

const mockAnchorRect = {
  top: 100,
  left: 100,
  bottom: 150,
  right: 200,
  width: 100,
  height: 50,
  x: 100,
  y: 100,
  toJSON: () => {},
} as DOMRect;

const mockBooking = {
  id: '1',
  status: 'CONFIRMED',
  customer: { name: 'Jane Doe', phone: '555-1234' },
  service: { name: 'Facial' },
  startTime: '2027-01-15T10:00:00Z',
  endTime: '2027-01-15T11:00:00Z',
  deposit: 50,
};

describe('BookingPopover', () => {
  it('renders customer name and service', () => {
    render(
      <BookingPopover booking={mockBooking} anchorRect={mockAnchorRect} onClose={jest.fn()} />,
    );
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Facial')).toBeInTheDocument();
  });

  it('renders phone number when available', () => {
    render(
      <BookingPopover booking={mockBooking} anchorRect={mockAnchorRect} onClose={jest.fn()} />,
    );
    expect(screen.getByText('555-1234')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(
      <BookingPopover booking={mockBooking} anchorRect={mockAnchorRect} onClose={jest.fn()} />,
    );
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('shows Start button for CONFIRMED bookings', () => {
    render(
      <BookingPopover
        booking={mockBooking}
        anchorRect={mockAnchorRect}
        onClose={jest.fn()}
        onStart={jest.fn()}
      />,
    );
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('shows Complete button for IN_PROGRESS bookings', () => {
    const inProgressBooking = { ...mockBooking, status: 'IN_PROGRESS' };
    render(
      <BookingPopover
        booking={inProgressBooking}
        anchorRect={mockAnchorRect}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    );
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('calls onClose on Escape key', () => {
    const onClose = jest.fn();
    render(<BookingPopover booking={mockBooking} anchorRect={mockAnchorRect} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on click outside', () => {
    const onClose = jest.fn();
    render(<BookingPopover booking={mockBooking} anchorRect={mockAnchorRect} onClose={onClose} />);
    fireEvent.mouseDown(document);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onStart when Start clicked', () => {
    const onStart = jest.fn();
    render(
      <BookingPopover
        booking={mockBooking}
        anchorRect={mockAnchorRect}
        onClose={jest.fn()}
        onStart={onStart}
      />,
    );
    fireEvent.click(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalledWith(mockBooking);
  });

  it('calls onComplete when Complete clicked', () => {
    const onComplete = jest.fn();
    const inProgressBooking = { ...mockBooking, status: 'IN_PROGRESS' };
    render(
      <BookingPopover
        booking={inProgressBooking}
        anchorRect={mockAnchorRect}
        onClose={jest.fn()}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByText('Complete'));
    expect(onComplete).toHaveBeenCalledWith(inProgressBooking);
  });

  it('calls onViewDetails when Details clicked', () => {
    const onViewDetails = jest.fn();
    render(
      <BookingPopover
        booking={mockBooking}
        anchorRect={mockAnchorRect}
        onClose={jest.fn()}
        onViewDetails={onViewDetails}
      />,
    );
    fireEvent.click(screen.getByText('Details'));
    expect(onViewDetails).toHaveBeenCalledWith(mockBooking);
  });

  it('returns null when no booking', () => {
    const { container } = render(
      <BookingPopover booking={null} anchorRect={mockAnchorRect} onClose={jest.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
