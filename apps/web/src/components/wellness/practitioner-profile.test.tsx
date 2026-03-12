import { render, screen } from '@testing-library/react';
import PractitionerProfile from './practitioner-profile';

describe('PractitionerProfile', () => {
  const defaultProps = {
    name: 'Sarah Chen',
    specialties: [
      { id: 'svc-1', name: 'Deep Tissue Massage', category: 'Massage' },
      { id: 'svc-2', name: 'Hot Stone Therapy', category: 'Massage' },
    ],
    certifications: [
      {
        id: 'cert-1',
        name: 'RMT',
        issuedBy: 'College of MT',
        expiryDate: '2027-12-31',
        isVerified: true,
      },
      { id: 'cert-2', name: 'Reiki Level 2', issuedBy: 'Reiki Academy', isVerified: false },
    ],
    workingHours: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOff: false },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isOff: false },
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00', isOff: false },
      { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOff: true },
    ],
  };

  it('renders practitioner name', () => {
    render(<PractitionerProfile {...defaultProps} />);
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
  });

  it('shows specialties count', () => {
    render(<PractitionerProfile {...defaultProps} />);
    expect(screen.getByText('2 specialties')).toBeInTheDocument();
  });

  it('displays specialty names', () => {
    render(<PractitionerProfile {...defaultProps} />);
    expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    expect(screen.getByText('Hot Stone Therapy')).toBeInTheDocument();
  });

  it('displays certifications', () => {
    render(<PractitionerProfile {...defaultProps} />);
    const certItems = screen.getAllByTestId('certification-item');
    expect(certItems).toHaveLength(2);
    expect(screen.getByText('RMT')).toBeInTheDocument();
  });

  it('shows verified badge', () => {
    render(<PractitionerProfile {...defaultProps} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders weekly availability grid', () => {
    render(<PractitionerProfile {...defaultProps} />);
    expect(screen.getByTestId('day-Mon')).toBeInTheDocument();
    expect(screen.getByTestId('day-Sun')).toBeInTheDocument();
  });

  it('shows working hours for active days', () => {
    render(<PractitionerProfile {...defaultProps} />);
    const hourTexts = screen.getAllByText('09:00-17:00');
    expect(hourTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows singular specialty text when only one', () => {
    render(<PractitionerProfile {...defaultProps} specialties={[{ id: 'svc-1', name: 'Yoga' }]} />);
    expect(screen.getByText('1 specialty')).toBeInTheDocument();
  });
});
