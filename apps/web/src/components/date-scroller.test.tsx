import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateScroller } from './date-scroller';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

beforeAll(() => {
  Element.prototype.scrollTo = jest.fn();
});

describe('DateScroller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-01-15T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders 15 day buttons', () => {
    const onDateSelect = jest.fn();
    render(
      <DateScroller currentDate={new Date('2027-01-15T12:00:00')} onDateSelect={onDateSelect} />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(15);
  });

  it('highlights today with sage-600', () => {
    const onDateSelect = jest.fn();
    render(
      <DateScroller currentDate={new Date('2027-01-15T12:00:00')} onDateSelect={onDateSelect} />,
    );

    // Today is Jan 15 — find the button containing "15" as a date number
    const buttons = screen.getAllByRole('button');
    const todayButton = buttons.find((btn) => btn.className.includes('bg-sage-600'));
    expect(todayButton).toBeTruthy();
    expect(todayButton!.className).toContain('text-white');
  });

  it('highlights selected date with ring', () => {
    const onDateSelect = jest.fn();
    // Select Jan 17 (not today)
    render(
      <DateScroller currentDate={new Date('2027-01-17T12:00:00')} onDateSelect={onDateSelect} />,
    );

    const buttons = screen.getAllByRole('button');
    const selectedButton = buttons.find((btn) => btn.className.includes('ring-sage-600'));
    expect(selectedButton).toBeTruthy();
    expect(selectedButton!.className).toContain('bg-sage-50');
  });

  it('calls onDateSelect when a date is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onDateSelect = jest.fn();
    render(
      <DateScroller currentDate={new Date('2027-01-15T12:00:00')} onDateSelect={onDateSelect} />,
    );

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    expect(onDateSelect).toHaveBeenCalledTimes(1);
    expect(onDateSelect).toHaveBeenCalledWith(expect.any(Date));
  });

  it('shows day abbreviations', () => {
    const onDateSelect = jest.fn();
    render(
      <DateScroller currentDate={new Date('2027-01-15T12:00:00')} onDateSelect={onDateSelect} />,
    );

    // Jan 15, 2027 is a Friday. Range is -7 to +7, so Jan 8 (Fri) through Jan 22 (Fri)
    expect(screen.getAllByText('Fri').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sat').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sun').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tue').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Wed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Thu').length).toBeGreaterThanOrEqual(1);
  });

  it('shows date numbers', () => {
    const onDateSelect = jest.fn();
    render(
      <DateScroller currentDate={new Date('2027-01-15T12:00:00')} onDateSelect={onDateSelect} />,
    );

    // Center is Jan 15, range -7..+7 → dates 8..22
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
  });
});
