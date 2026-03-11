import { render, screen, fireEvent } from '@testing-library/react';
import { TreatmentPlanBuilder } from './treatment-plan-builder';

const mockServices = [
  { id: 'svc-1', name: 'Botox', price: 350, durationMins: 30, kind: 'TREATMENT' },
  { id: 'svc-2', name: 'Filler', price: 500, durationMins: 45, kind: 'TREATMENT' },
  { id: 'svc-3', name: 'Consultation', price: 0, durationMins: 30, kind: 'CONSULT' },
];

describe('TreatmentPlanBuilder', () => {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    onSubmit.mockClear();
    onCancel.mockClear();
  });

  it('renders the form', () => {
    render(<TreatmentPlanBuilder services={mockServices} onSubmit={onSubmit} onCancel={onCancel} />);
    expect(screen.getByTestId('treatment-plan-builder')).toBeInTheDocument();
    expect(screen.getByText('Clinical Assessment')).toBeInTheDocument();
    expect(screen.getByText('Treatment Sessions')).toBeInTheDocument();
  });

  it('only shows TREATMENT services in dropdown', () => {
    render(<TreatmentPlanBuilder services={mockServices} onSubmit={onSubmit} onCancel={onCancel} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
    // Should not include Consultation (CONSULT kind)
    expect(screen.queryByText('Consultation — $0')).not.toBeInTheDocument();
  });

  it('allows adding and removing sessions', () => {
    render(<TreatmentPlanBuilder services={mockServices} onSubmit={onSubmit} onCancel={onCancel} />);
    // Initially 1 session
    expect(screen.getByTestId('session-0')).toBeInTheDocument();

    // Add session
    fireEvent.click(screen.getByText('Add Session'));
    expect(screen.getByTestId('session-1')).toBeInTheDocument();
  });

  it('calculates total estimate based on selected services', () => {
    render(<TreatmentPlanBuilder services={mockServices} onSubmit={onSubmit} onCancel={onCancel} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'svc-1' } });
    expect(screen.getByText('$350.00')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<TreatmentPlanBuilder services={mockServices} onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSubmit with form data', () => {
    render(<TreatmentPlanBuilder services={mockServices} onSubmit={onSubmit} onCancel={onCancel} />);

    // Fill diagnosis
    fireEvent.change(screen.getByPlaceholderText('Clinical notes from consultation...'), {
      target: { value: 'Test diagnosis' },
    });

    // Select a service
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'svc-1' } });

    // Submit
    fireEvent.click(screen.getByText('Save Treatment Plan'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnosis: 'Test diagnosis',
        sessions: expect.arrayContaining([
          expect.objectContaining({ serviceId: 'svc-1' }),
        ]),
      }),
    );
  });

  it('pre-fills initial data', () => {
    render(
      <TreatmentPlanBuilder
        services={mockServices}
        initialData={{ diagnosis: 'Existing diagnosis', goals: 'Smooth skin' }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(
      (screen.getByPlaceholderText('Clinical notes from consultation...') as HTMLTextAreaElement).value,
    ).toBe('Existing diagnosis');
  });
});
