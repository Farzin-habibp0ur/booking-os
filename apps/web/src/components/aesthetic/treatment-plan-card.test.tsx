import { render, screen, fireEvent } from '@testing-library/react';
import { TreatmentPlanCard } from './treatment-plan-card';

const mockPlan = {
  id: 'plan-1',
  status: 'PROPOSED',
  diagnosis: 'Fine lines around eyes',
  totalEstimate: 700,
  currency: 'USD',
  createdAt: '2027-01-15T12:00:00Z',
  proposedAt: '2027-01-16T12:00:00Z',
  sessions: [
    {
      id: 's1',
      sequenceOrder: 1,
      status: 'PENDING',
      service: { name: 'Botox', price: 350 },
    },
    {
      id: 's2',
      sequenceOrder: 2,
      status: 'COMPLETED',
      service: { name: 'Filler', price: 350 },
    },
  ],
  customer: { name: 'Jane Doe' },
  createdBy: { name: 'Dr. Smith' },
};

describe('TreatmentPlanCard', () => {
  it('renders plan card with status badge', () => {
    render(<TreatmentPlanCard plan={mockPlan} />);
    expect(screen.getByTestId('treatment-plan-card')).toBeInTheDocument();
    expect(screen.getByText('Proposed')).toBeInTheDocument();
  });

  it('shows session progress', () => {
    render(<TreatmentPlanCard plan={mockPlan} />);
    expect(screen.getByText('1 of 2 complete')).toBeInTheDocument();
  });

  it('shows total estimate', () => {
    render(<TreatmentPlanCard plan={mockPlan} />);
    expect(screen.getByText('$700.00')).toBeInTheDocument();
  });

  it('shows customer name', () => {
    render(<TreatmentPlanCard plan={mockPlan} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows diagnosis', () => {
    render(<TreatmentPlanCard plan={mockPlan} />);
    expect(screen.getByText('Fine lines around eyes')).toBeInTheDocument();
  });

  it('shows accept/decline in portal mode for PROPOSED status', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    render(
      <TreatmentPlanCard
        plan={mockPlan}
        isPortal
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );
    expect(screen.getByText('Accept Plan')).toBeInTheDocument();
    expect(screen.getByText('Decline')).toBeInTheDocument();
  });

  it('calls onAccept when accept clicked', () => {
    const onAccept = jest.fn();
    render(<TreatmentPlanCard plan={mockPlan} isPortal onAccept={onAccept} />);
    fireEvent.click(screen.getByText('Accept Plan'));
    expect(onAccept).toHaveBeenCalled();
  });

  it('does not show portal actions for non-PROPOSED status', () => {
    render(
      <TreatmentPlanCard
        plan={{ ...mockPlan, status: 'ACCEPTED' }}
        isPortal
        onAccept={jest.fn()}
      />,
    );
    expect(screen.queryByText('Accept Plan')).not.toBeInTheDocument();
  });

  it('calls onClick when card clicked', () => {
    const onClick = jest.fn();
    render(<TreatmentPlanCard plan={mockPlan} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('treatment-plan-card'));
    expect(onClick).toHaveBeenCalled();
  });
});
