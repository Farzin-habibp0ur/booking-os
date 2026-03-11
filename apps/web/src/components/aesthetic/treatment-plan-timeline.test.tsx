import { render, screen, fireEvent } from '@testing-library/react';
import { TreatmentPlanTimeline } from './treatment-plan-timeline';

const mockSessions = [
  {
    id: 's1',
    sequenceOrder: 1,
    status: 'COMPLETED',
    service: { name: 'Botox', price: 350, durationMins: 30 },
    completedAt: '2027-01-20T14:00:00Z',
    notes: 'Went well',
  },
  {
    id: 's2',
    sequenceOrder: 2,
    status: 'SCHEDULED',
    service: { name: 'Filler', price: 500, durationMins: 45 },
    booking: { id: 'b2', status: 'CONFIRMED', startTime: '2027-02-15T10:00:00Z' },
  },
  {
    id: 's3',
    sequenceOrder: 3,
    status: 'PENDING',
    service: { name: 'Touch-up', price: 200, durationMins: 20 },
    scheduledDate: '2027-03-15T10:00:00Z',
  },
];

describe('TreatmentPlanTimeline', () => {
  it('renders all sessions', () => {
    render(<TreatmentPlanTimeline sessions={mockSessions} />);
    expect(screen.getByTestId('treatment-plan-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-session-1')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-session-2')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-session-3')).toBeInTheDocument();
  });

  it('shows service names', () => {
    render(<TreatmentPlanTimeline sessions={mockSessions} />);
    expect(screen.getByText('Botox')).toBeInTheDocument();
    expect(screen.getByText('Filler')).toBeInTheDocument();
    expect(screen.getByText('Touch-up')).toBeInTheDocument();
  });

  it('shows session sequence numbers', () => {
    render(<TreatmentPlanTimeline sessions={mockSessions} />);
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    expect(screen.getByText('Session 3')).toBeInTheDocument();
  });

  it('shows completed date for completed sessions', () => {
    render(<TreatmentPlanTimeline sessions={mockSessions} />);
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  it('shows prices', () => {
    render(<TreatmentPlanTimeline sessions={mockSessions} />);
    expect(screen.getByText('$350')).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
  });

  it('shows notes', () => {
    render(<TreatmentPlanTimeline sessions={mockSessions} />);
    expect(screen.getByText('Went well')).toBeInTheDocument();
  });

  it('shows empty state when no sessions', () => {
    render(<TreatmentPlanTimeline sessions={[]} />);
    expect(screen.getByText('No sessions in this plan.')).toBeInTheDocument();
  });

  it('calls onSessionClick when session clicked', () => {
    const onClick = jest.fn();
    render(<TreatmentPlanTimeline sessions={mockSessions} onSessionClick={onClick} />);
    fireEvent.click(screen.getByTestId('timeline-session-1'));
    expect(onClick).toHaveBeenCalledWith(mockSessions[0]);
  });
});
