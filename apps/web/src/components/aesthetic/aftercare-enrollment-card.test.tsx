import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AftercareEnrollmentCard } from './aftercare-enrollment-card';

const mockEnrollment = {
  id: 'enroll-1',
  status: 'ACTIVE',
  enrolledAt: '2026-03-10T10:00:00Z',
  protocol: {
    name: 'General Aesthetic Aftercare',
    steps: [
      {
        id: 'step-1',
        sequenceOrder: 1,
        delayHours: 0,
        channel: 'WHATSAPP',
        subject: 'Aftercare Instructions',
        body: 'Hello',
      },
      {
        id: 'step-2',
        sequenceOrder: 2,
        delayHours: 24,
        channel: 'WHATSAPP',
        subject: '24-Hour Check-in',
        body: 'Check-in',
      },
      {
        id: 'step-3',
        sequenceOrder: 3,
        delayHours: 72,
        channel: 'WHATSAPP',
        subject: '3-Day Follow-up',
        body: 'Follow-up',
      },
    ],
  },
  booking: {
    startTime: '2026-03-10T09:00:00Z',
    service: { name: 'Botox' },
  },
  messages: [
    {
      id: 'msg-1',
      stepId: 'step-1',
      scheduledFor: '2026-03-10T10:00:00Z',
      sentAt: '2026-03-10T10:01:00Z',
      status: 'SENT',
    },
    {
      id: 'msg-2',
      stepId: 'step-2',
      scheduledFor: '2026-03-11T10:00:00Z',
      sentAt: null,
      status: 'SCHEDULED',
    },
    {
      id: 'msg-3',
      stepId: 'step-3',
      scheduledFor: '2026-03-13T10:00:00Z',
      sentAt: null,
      status: 'SCHEDULED',
    },
  ],
};

describe('AftercareEnrollmentCard', () => {
  it('renders enrollment card with protocol name', () => {
    render(<AftercareEnrollmentCard enrollment={mockEnrollment} />);
    expect(screen.getByText('General Aesthetic Aftercare')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    render(<AftercareEnrollmentCard enrollment={mockEnrollment} />);
    expect(screen.getByText('1 of 3 messages sent')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('shows message timeline', () => {
    render(<AftercareEnrollmentCard enrollment={mockEnrollment} />);
    expect(screen.getByTestId('aftercare-message-0')).toBeInTheDocument();
    expect(screen.getByTestId('aftercare-message-1')).toBeInTheDocument();
    expect(screen.getByTestId('aftercare-message-2')).toBeInTheDocument();
  });

  it('hides timeline in compact mode', () => {
    render(<AftercareEnrollmentCard enrollment={mockEnrollment} compact />);
    expect(screen.queryByTestId('aftercare-message-0')).not.toBeInTheDocument();
  });

  it('shows cancel button when active and onCancel provided', () => {
    const onCancel = jest.fn();
    render(<AftercareEnrollmentCard enrollment={mockEnrollment} onCancel={onCancel} />);

    const cancelBtn = screen.getByText('Cancel Aftercare');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledWith('enroll-1');
  });

  it('hides cancel button for completed enrollments', () => {
    const completed = { ...mockEnrollment, status: 'COMPLETED' };
    render(<AftercareEnrollmentCard enrollment={completed} onCancel={jest.fn()} />);
    expect(screen.queryByText('Cancel Aftercare')).not.toBeInTheDocument();
  });

  it('displays booking service and date', () => {
    render(<AftercareEnrollmentCard enrollment={mockEnrollment} />);
    expect(screen.getByText(/Botox/)).toBeInTheDocument();
  });
});
