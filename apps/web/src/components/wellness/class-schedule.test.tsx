import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClassSchedule from './class-schedule';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apiFetch } = require('@/lib/api');

describe('ClassSchedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockClasses = [
    {
      id: 'rc-1',
      dayOfWeek: 1,
      startTime: '09:00',
      maxParticipants: 15,
      date: '2026-03-16',
      enrollmentCount: 8,
      spotsRemaining: 7,
      service: { id: 'svc-1', name: 'Morning Yoga', durationMins: 60, price: 25 },
      staff: { id: 'staff-1', name: 'Sarah Chen' },
      resource: null,
      location: { id: 'loc-1', name: 'Studio A' },
    },
    {
      id: 'rc-2',
      dayOfWeek: 3,
      startTime: '14:00',
      maxParticipants: 10,
      date: '2026-03-18',
      enrollmentCount: 10,
      spotsRemaining: 0,
      service: { id: 'svc-2', name: 'Pilates', durationMins: 45, price: 30 },
      staff: { id: 'staff-2', name: 'Mike Liu' },
      resource: null,
      location: null,
    },
  ];

  it('shows loading state', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<ClassSchedule />);
    expect(screen.getByTestId('class-schedule')).toBeInTheDocument();
  });

  it('renders class cards', async () => {
    apiFetch.mockResolvedValue(mockClasses);
    render(<ClassSchedule />);

    await waitFor(() => {
      expect(screen.getByText('Morning Yoga')).toBeInTheDocument();
    });
    expect(screen.getByText('Pilates')).toBeInTheDocument();
  });

  it('shows enrollment info', async () => {
    apiFetch.mockResolvedValue(mockClasses);
    render(<ClassSchedule />);

    await waitFor(() => {
      expect(screen.getByText('8/15')).toBeInTheDocument();
    });
  });

  it('shows staff name', async () => {
    apiFetch.mockResolvedValue(mockClasses);
    render(<ClassSchedule />);

    await waitFor(() => {
      expect(screen.getByText('with Sarah Chen')).toBeInTheDocument();
    });
  });

  it('shows location when available', async () => {
    apiFetch.mockResolvedValue(mockClasses);
    render(<ClassSchedule />);

    await waitFor(() => {
      expect(screen.getByText('Studio A')).toBeInTheDocument();
    });
  });

  it('shows empty state when no classes', async () => {
    apiFetch.mockResolvedValue([]);
    render(<ClassSchedule />);

    await waitFor(() => {
      expect(screen.getByText('No classes scheduled this week')).toBeInTheDocument();
    });
  });

  it('renders Book button with spots remaining', async () => {
    apiFetch.mockResolvedValue(mockClasses);
    const onEnroll = jest.fn();
    render(<ClassSchedule onEnroll={onEnroll} />);

    await waitFor(() => {
      expect(screen.getByText('Book (7 left)')).toBeInTheDocument();
    });
  });

  it('shows Full for classes at capacity', async () => {
    apiFetch.mockResolvedValue(mockClasses);
    render(<ClassSchedule onEnroll={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Full')).toBeInTheDocument();
    });
  });

  it('navigates weeks', async () => {
    apiFetch.mockResolvedValue([]);
    render(<ClassSchedule />);

    await waitFor(() => {
      expect(screen.getByText('No classes scheduled this week')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Next week'));
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
