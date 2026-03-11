import React from 'react';
import { render, screen } from '@testing-library/react';
import { MedicalAlertBanner } from './medical-alert-banner';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  AlertTriangle: ({ className, ...props }: any) => (
    <svg data-testid="alert-triangle-icon" className={className} {...props} />
  ),
}));

describe('MedicalAlertBanner', () => {
  it('returns null when flagged is false', () => {
    const { container } = render(
      <MedicalAlertBanner flagged={false} flagReason={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "Medical Alert" when flagged is true', () => {
    render(<MedicalAlertBanner flagged={true} flagReason={null} />);
    expect(screen.getByText('Medical Alert')).toBeInTheDocument();
  });

  it('shows the flag reason', () => {
    render(
      <MedicalAlertBanner
        flagged={true}
        flagReason="Patient has severe allergic reactions"
      />,
    );
    expect(
      screen.getByText('Patient has severe allergic reactions'),
    ).toBeInTheDocument();
  });

  it('shows allergy tags', () => {
    render(
      <MedicalAlertBanner
        flagged={true}
        flagReason={null}
        allergies={['Lidocaine', 'Latex']}
      />,
    );
    expect(screen.getByText('Allergies:')).toBeInTheDocument();
    expect(screen.getByText('Lidocaine')).toBeInTheDocument();
    expect(screen.getByText('Latex')).toBeInTheDocument();
  });

  it('shows contraindication tags', () => {
    render(
      <MedicalAlertBanner
        flagged={true}
        flagReason={null}
        contraindications={['Accutane', 'Retinoids']}
      />,
    );
    expect(screen.getByText('Contraindications:')).toBeInTheDocument();
    expect(screen.getByText('Accutane')).toBeInTheDocument();
    expect(screen.getByText('Retinoids')).toBeInTheDocument();
  });

  it('renders compact mode with only an icon', () => {
    const { container } = render(
      <MedicalAlertBanner
        flagged={true}
        flagReason="Alert reason"
        compact={true}
      />,
    );
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    expect(screen.queryByText('Medical Alert')).not.toBeInTheDocument();
    // Should have title attribute for tooltip
    const span = container.querySelector('span[title]');
    expect(span).toHaveAttribute('title', 'Alert reason');
  });
});
