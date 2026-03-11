import React from 'react';
import { render, screen } from '@testing-library/react';
import { AftercarePortalView } from './aftercare-portal-view';

const mockEnrollments = [
  {
    id: 'enroll-1',
    status: 'ACTIVE',
    enrolledAt: '2026-03-10T10:00:00Z',
    protocol: {
      name: 'General Aesthetic Aftercare',
      steps: [
        { id: 'step-1', sequenceOrder: 1, delayHours: 0, subject: 'Aftercare Instructions', body: 'Hello' },
        { id: 'step-2', sequenceOrder: 2, delayHours: 24, subject: '24-Hour Check-in', body: 'Check-in' },
      ],
    },
    booking: {
      startTime: '2026-03-10T09:00:00Z',
      service: { name: 'Botox' },
    },
    messages: [
      { id: 'msg-1', stepId: 'step-1', scheduledFor: '2026-03-10T10:00:00Z', sentAt: '2026-03-10T10:01:00Z', status: 'SENT' },
      { id: 'msg-2', stepId: 'step-2', scheduledFor: '2026-03-11T10:00:00Z', sentAt: null, status: 'SCHEDULED' },
    ],
  },
];

describe('AftercarePortalView', () => {
  it('renders aftercare enrollments', () => {
    render(<AftercarePortalView enrollments={mockEnrollments} />);
    expect(screen.getByTestId('aftercare-portal-view')).toBeInTheDocument();
    expect(screen.getByText('General Aesthetic Aftercare')).toBeInTheDocument();
  });

  it('shows progress info', () => {
    render(<AftercarePortalView enrollments={mockEnrollments} />);
    expect(screen.getByText('1 of 2 messages sent')).toBeInTheDocument();
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('shows step timeline with sent and scheduled', () => {
    render(<AftercarePortalView enrollments={mockEnrollments} />);
    expect(screen.getByText('Aftercare Instructions')).toBeInTheDocument();
    expect(screen.getByText('24-Hour Check-in')).toBeInTheDocument();
  });

  it('marks next step', () => {
    render(<AftercarePortalView enrollments={mockEnrollments} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('renders nothing for empty enrollments', () => {
    const { container } = render(<AftercarePortalView enrollments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows service name and booking date', () => {
    render(<AftercarePortalView enrollments={mockEnrollments} />);
    expect(screen.getByText(/Botox/)).toBeInTheDocument();
    expect(screen.getByText(/March 10, 2026/)).toBeInTheDocument();
  });

  it('shows Active badge', () => {
    render(<AftercarePortalView enrollments={mockEnrollments} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
