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

  it('preserves existing custom field values when saving new ones', async () => {
    const updatedCustomer = {
      id: 'c1',
      customFields: { concernArea: 'Fine lines', desiredTreatment: 'Botox' },
    };
    mockPatch.mockResolvedValue(updatedCustomer);
    const onUpdated = jest.fn();

    render(
      <IntakeCard
        customer={{ id: 'c1', customFields: { concernArea: 'Fine lines' } }}
        fields={aestheticFields}
        onUpdated={onUpdated}
      />,
    );

    // Enter edit mode
    fireEvent.click(screen.getByLabelText('Edit'));

    // Change desired treatment field
    const treatmentInput = screen.getByPlaceholderText('Desired Treatment');
    fireEvent.change(treatmentInput, { target: { value: 'Botox' } });

    // Save
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/customers/c1', {
        customFields: expect.objectContaining({
          concernArea: 'Fine lines',
          desiredTreatment: 'Botox',
        }),
      });
    });
  });
});
