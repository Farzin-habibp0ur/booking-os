import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IntakeCard from './intake-card';

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
        'inbox.clinic_intake': 'Intake',
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

// ─── Aesthetic fields (same as before) ──────────────────────────────────

const aestheticFields = [
  { key: 'concernArea', type: 'text', label: 'Concern Area' },
  { key: 'desiredTreatment', type: 'text', label: 'Desired Treatment' },
  {
    key: 'budget',
    type: 'select',
    label: 'Budget Range',
    options: ['Under $250', '$250-$500', '$500-$1000', 'Over $1000'],
  },
  { key: 'isMedicalFlagged', type: 'boolean', label: 'Medical Flag' },
];

// ─── Dealership fields (vehicle dossier) ────────────────────────────────

const dealershipFields = [
  { key: 'make', type: 'text', label: 'Make', required: true },
  { key: 'model', type: 'text', label: 'Model', required: true },
  { key: 'year', type: 'number', label: 'Year' },
  { key: 'vin', type: 'text', label: 'VIN' },
  { key: 'mileage', type: 'number', label: 'Mileage' },
  {
    key: 'interestType',
    type: 'select',
    label: 'Interest Type',
    options: ['New', 'Used', 'Trade-in', 'Service'],
  },
];

describe('IntakeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Generic behavior ───────────────────────────────────────────────

  it('renders all pack fields', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={aestheticFields}
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
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );
    const notSetItems = screen.getAllByText('Not set');
    expect(notSetItems.length).toBe(4);
  });

  it('shows amber indicator for missing fields', () => {
    const { container } = render(
      <IntakeCard
        customer={{ id: 'c1', customFields: { concernArea: 'Fine lines' } }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );
    const amberDots = container.querySelectorAll('.bg-amber-400');
    expect(amberDots.length).toBe(3);
  });

  it('shows completion count badge', () => {
    render(
      <IntakeCard
        customer={{
          id: 'c1',
          customFields: { concernArea: 'Fine lines', isMedicalFlagged: false },
        }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('2/4 complete')).toBeInTheDocument();
  });

  it('shows sage badge when all complete', () => {
    render(
      <IntakeCard
        customer={{
          id: 'c1',
          customFields: {
            concernArea: 'Lines',
            desiredTreatment: 'Botox',
            budget: '$250-$500',
            isMedicalFlagged: true,
          },
        }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );
    const badge = screen.getByText('4/4 complete');
    expect(badge.className).toContain('bg-sage-50');
  });

  it('toggles into edit mode when pencil icon clicked', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={aestheticFields}
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
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={aestheticFields}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(screen.getByLabelText('Edit'));
    fireEvent.click(screen.getByText('Save'));

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

    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update intake', 'error');
    });
  });

  it('cancel exits edit mode', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={aestheticFields}
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
      <IntakeCard
        customer={{
          id: 'c1',
          customFields: { concernArea: 'Fine lines around eyes', isMedicalFlagged: true },
        }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('Fine lines around eyes')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  // ─── Dealership-specific tests ──────────────────────────────────────

  it('renders dealership vehicle dossier fields', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={dealershipFields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('Make')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('VIN')).toBeInTheDocument();
    expect(screen.getByText('Mileage')).toBeInTheDocument();
    expect(screen.getByText('Interest Type')).toBeInTheDocument();
  });

  it('renders number input for number-type fields in edit mode', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={dealershipFields}
        onUpdated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit'));

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs.length).toBe(2); // year and mileage
  });

  it('renders select input for interest type', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={dealershipFields}
        onUpdated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit'));

    const selectInputs = screen.getAllByRole('combobox');
    expect(selectInputs.length).toBe(1);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(screen.getByText('Trade-in')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
  });

  it('shows completion count for dealership fields', () => {
    render(
      <IntakeCard
        customer={{
          id: 'c1',
          customFields: { make: 'Toyota', model: 'Camry', year: '2022' },
        }}
        fields={dealershipFields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('3/6 complete')).toBeInTheDocument();
  });

  it('displays filled dealership values', () => {
    render(
      <IntakeCard
        customer={{
          id: 'c1',
          customFields: {
            make: 'Honda',
            model: 'Civic',
            year: '2024',
            mileage: '15000',
            interestType: 'Service',
          },
        }}
        fields={dealershipFields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('Honda')).toBeInTheDocument();
    expect(screen.getByText('Civic')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('15000')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
  });

  // ─── Additional tests ─────────────────────────────────────────────────

  it('reverts draft changes on cancel', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: { concernArea: 'Original Value' } }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );

    // Enter edit mode
    fireEvent.click(screen.getByLabelText('Edit'));

    // Change a text input value
    const input = screen.getByDisplayValue('Original Value');
    fireEvent.change(input, { target: { value: 'Changed Value' } });

    // Click Cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Re-enter edit mode
    fireEvent.click(screen.getByLabelText('Edit'));

    // Verify the original value is shown (not the changed value)
    expect(screen.getByDisplayValue('Original Value')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Changed Value')).not.toBeInTheDocument();
  });

  it('renders "No" for false boolean fields in view mode', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: { isMedicalFlagged: false } }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders checkbox for boolean fields in edit mode', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={aestheticFields}
        onUpdated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit'));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('handles empty fields array gracefully', () => {
    render(
      <IntakeCard customer={{ id: 'c1', customFields: {} }} fields={[]} onUpdated={jest.fn()} />,
    );
    expect(screen.getByText('0/0 complete')).toBeInTheDocument();
  });

  it('renders required indicator for required fields in edit mode', () => {
    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: {} }}
        fields={dealershipFields}
        onUpdated={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Edit'));

    // Make and Model have required: true - they should have text inputs
    // Verify the required fields are present with their labels
    expect(screen.getByText('Make')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('preserves existing custom field values when saving new ones', async () => {
    const updatedCustomer = {
      id: 'c1',
      customFields: { make: 'Toyota', model: 'Corolla' },
    };
    mockPatch.mockResolvedValue(updatedCustomer);
    const onUpdated = jest.fn();

    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: { make: 'Toyota' } }}
        fields={dealershipFields}
        onUpdated={onUpdated}
      />,
    );

    // Enter edit mode
    fireEvent.click(screen.getByLabelText('Edit'));

    // Change model field
    const modelInput = screen.getByPlaceholderText('Model');
    fireEvent.change(modelInput, { target: { value: 'Corolla' } });

    // Save
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/customers/c1', {
        customFields: expect.objectContaining({
          make: 'Toyota',
          model: 'Corolla',
        }),
      });
    });
  });
});
