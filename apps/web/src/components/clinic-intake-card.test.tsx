import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClinicIntakeCard from './clinic-intake-card';

// Mock dependencies
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === 'inbox.intake_complete' && vars) return `${vars.filled}/${vars.total} complete`;
      const map: Record<string, string> = {
        'inbox.clinic_intake': 'Clinic Intake',
        'inbox.intake_not_set': 'Not set',
        'inbox.intake_edit': 'Edit',
        'inbox.intake_save': 'Save',
        'inbox.intake_cancel': 'Cancel',
        'inbox.intake_saved': 'Intake updated',
        'inbox.intake_save_failed': 'Failed to update intake',
        'common.yes': 'Yes',
        'common.no': 'No',
      };
      return map[key] || key;
    },
  }),
}));

const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

const fields = [
  { key: 'concernArea', type: 'text', label: 'Concern Area' },
  { key: 'desiredTreatment', type: 'text', label: 'Desired Treatment' },
  { key: 'budget', type: 'select', label: 'Budget Range', options: ['Under $250', '$250-$500', '$500-$1000', 'Over $1000'] },
  { key: 'isMedicalFlagged', type: 'boolean', label: 'Medical Flag' },
];

describe('ClinicIntakeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all pack fields', () => {
    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('Concern Area')).toBeInTheDocument();
    expect(screen.getByText('Desired Treatment')).toBeInTheDocument();
    expect(screen.getByText('Budget Range')).toBeInTheDocument();
    expect(screen.getByText('Medical Flag')).toBeInTheDocument();
  });

  it('shows "Not set" for empty fields', () => {
    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );
    const notSetItems = screen.getAllByText('Not set');
    // 3 text fields + 1 boolean (boolean false would be "No" but undefined is "Not set")
    // Actually budget select is also empty, so 4 fields empty
    expect(notSetItems.length).toBe(4);
  });

  it('shows amber indicator for missing fields', () => {
    const { container } = render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: { concernArea: 'Fine lines' } }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );
    const amberDots = container.querySelectorAll('.bg-amber-400');
    expect(amberDots.length).toBe(3); // 3 missing fields
  });

  it('shows completion count badge', () => {
    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: { concernArea: 'Fine lines', isMedicalFlagged: false } }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('2/4 complete')).toBeInTheDocument();
  });

  it('shows sage badge when all complete', () => {
    render(
      <ClinicIntakeCard
        customer={{
          id: 'c1',
          customFields: {
            concernArea: 'Lines',
            desiredTreatment: 'Botox',
            budget: '$250-$500',
            isMedicalFlagged: true,
          },
        }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );
    const badge = screen.getByText('4/4 complete');
    expect(badge.className).toContain('bg-sage-50');
  });

  it('toggles into edit mode when pencil icon clicked', () => {
    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );
    const editButton = screen.getByLabelText('Edit');
    fireEvent.click(editButton);
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('save calls API and triggers onUpdated callback', async () => {
    const updatedCustomer = { id: 'c1', customFields: { concernArea: 'Wrinkles' } };
    mockPatch.mockResolvedValue(updatedCustomer);
    const onUpdated = jest.fn();

    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={fields}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByLabelText('Edit'));
    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/customers/c1', {
        customFields: expect.any(Object),
      });
      expect(onUpdated).toHaveBeenCalledWith(updatedCustomer);
      expect(mockToast).toHaveBeenCalledWith('Intake updated', 'success');
    });
  });

  it('shows error toast when save fails', async () => {
    mockPatch.mockRejectedValue(new Error('fail'));
    const onUpdated = jest.fn();

    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={fields}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByLabelText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update intake', 'error');
      expect(onUpdated).not.toHaveBeenCalled();
    });
  });

  it('cancel exits edit mode', () => {
    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Edit'));
    expect(screen.getByText('Save')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('renders filled values in view mode', () => {
    render(
      <ClinicIntakeCard
        customer={{ id: 'c1', customFields: { concernArea: 'Fine lines around eyes', isMedicalFlagged: true } }}
        fields={fields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('Fine lines around eyes')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });
});
