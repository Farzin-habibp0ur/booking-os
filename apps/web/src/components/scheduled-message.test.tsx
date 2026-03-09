import { render, screen, fireEvent } from '@testing-library/react';
import ScheduledMessage from './scheduled-message';

describe('ScheduledMessage', () => {
  const onSchedule = jest.fn();
  const onClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders schedule button when no scheduled time', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    expect(screen.getByTestId('schedule-toggle')).toHaveTextContent('Schedule');
  });

  it('shows "Scheduled" when scheduledAt is set', () => {
    render(
      <ScheduledMessage
        onSchedule={onSchedule}
        onClear={onClear}
        scheduledAt={new Date('2027-01-15T09:00:00')}
      />,
    );

    expect(screen.getByTestId('schedule-toggle')).toHaveTextContent('Scheduled');
    expect(screen.getByTestId('schedule-badge')).toBeInTheDocument();
  });

  it('opens popover on toggle click', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    fireEvent.click(screen.getByTestId('schedule-toggle'));
    expect(screen.getByTestId('schedule-popover')).toBeInTheDocument();
    expect(screen.getByText('Schedule Message')).toBeInTheDocument();
  });

  it('renders 5 quick presets', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    fireEvent.click(screen.getByTestId('schedule-toggle'));
    expect(screen.getByTestId('preset-in-1-hour')).toBeInTheDocument();
    expect(screen.getByTestId('preset-in-3-hours')).toBeInTheDocument();
    expect(screen.getByTestId('preset-tomorrow-9-am')).toBeInTheDocument();
    expect(screen.getByTestId('preset-tomorrow-12-pm')).toBeInTheDocument();
    expect(screen.getByTestId('preset-monday-9-am')).toBeInTheDocument();
  });

  it('calls onSchedule when a preset is clicked', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    fireEvent.click(screen.getByTestId('schedule-toggle'));
    fireEvent.click(screen.getByTestId('preset-in-1-hour'));

    expect(onSchedule).toHaveBeenCalledWith(expect.any(Date));
  });

  it('calls onClear when clear button is clicked', () => {
    render(
      <ScheduledMessage
        onSchedule={onSchedule}
        onClear={onClear}
        scheduledAt={new Date('2027-01-15T09:00:00')}
      />,
    );

    fireEvent.click(screen.getByLabelText('Clear scheduled time'));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows date and time inputs in popover', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    fireEvent.click(screen.getByTestId('schedule-toggle'));
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('disables Schedule button when no date selected', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    fireEvent.click(screen.getByTestId('schedule-toggle'));
    const buttons = screen.getAllByRole('button');
    const scheduleBtn = buttons.find(
      (b) => b.textContent === 'Schedule' && b !== screen.getByTestId('schedule-toggle'),
    );
    expect(scheduleBtn).toBeDisabled();
  });

  it('closes popover on Cancel click', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    fireEvent.click(screen.getByTestId('schedule-toggle'));
    expect(screen.getByTestId('schedule-popover')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('schedule-popover')).not.toBeInTheDocument();
  });

  it('shows time picker with 15-minute intervals', () => {
    render(<ScheduledMessage onSchedule={onSchedule} onClear={onClear} scheduledAt={null} />);

    fireEvent.click(screen.getByTestId('schedule-toggle'));
    const timeSelect = screen.getByRole('combobox') as HTMLSelectElement;
    // 24 hours * 4 = 96 options
    expect(timeSelect.options.length).toBe(96);
  });
});
