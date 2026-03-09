import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WellnessIntakeCard from './wellness-intake-card';

// Mock dependencies
jest.mock('@/lib/api', () => ({
  api: {
    patch: jest.fn().mockResolvedValue({ id: 'c1', customFields: { healthGoals: 'Flexibility' } }),
  },
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('WellnessIntakeCard', () => {
  const baseCustomer = {
    id: 'c1',
    customFields: {
      healthGoals: 'Reduce back pain',
      fitnessLevel: 'Intermediate',
      injuries: 'Lower back strain',
      medications: '',
      allergies: 'Lavender',
      preferredModality: 'Massage',
      membershipType: 'Monthly',
    },
  };

  const emptyCustomer = { id: 'c2', customFields: {} };

  it('renders wellness intake card', () => {
    render(<WellnessIntakeCard customer={baseCustomer} onUpdated={jest.fn()} />);
    expect(screen.getByTestId('wellness-intake-card')).toBeInTheDocument();
    expect(screen.getByText('Wellness Intake')).toBeInTheDocument();
  });

  it('shows completion count', () => {
    render(<WellnessIntakeCard customer={baseCustomer} onUpdated={jest.fn()} />);
    // 6 of 7 filled (medications is empty string)
    expect(screen.getByText('6/7')).toBeInTheDocument();
  });

  it('shows full completion for fully filled customer', () => {
    const fullCustomer = {
      id: 'c1',
      customFields: {
        ...baseCustomer.customFields,
        medications: 'Ibuprofen',
      },
    };
    render(<WellnessIntakeCard customer={fullCustomer} onUpdated={jest.fn()} />);
    expect(screen.getByText('7/7')).toBeInTheDocument();
  });

  it('shows 0/7 for empty customer', () => {
    render(<WellnessIntakeCard customer={emptyCustomer} onUpdated={jest.fn()} />);
    expect(screen.getByText('0/7')).toBeInTheDocument();
  });

  it('displays field values', () => {
    render(<WellnessIntakeCard customer={baseCustomer} onUpdated={jest.fn()} />);
    expect(screen.getByText('Reduce back pain')).toBeInTheDocument();
    expect(screen.getByText('Intermediate')).toBeInTheDocument();
    expect(screen.getByText('Massage')).toBeInTheDocument();
  });

  it('shows "Not set" for empty fields', () => {
    render(<WellnessIntakeCard customer={emptyCustomer} onUpdated={jest.fn()} />);
    const notSetElements = screen.getAllByText('Not set');
    expect(notSetElements.length).toBe(7);
  });

  it('shows alert icon when injuries/medications/allergies present', () => {
    render(<WellnessIntakeCard customer={baseCustomer} onUpdated={jest.fn()} />);
    // Has injuries and allergies
    const alertIcon = screen.getByTitle('Has medical notes');
    expect(alertIcon).toBeInTheDocument();
  });

  it('does not show alert icon when no medical notes', () => {
    const noAlerts = {
      id: 'c3',
      customFields: { healthGoals: 'Flex', fitnessLevel: 'Beginner' },
    };
    render(<WellnessIntakeCard customer={noAlerts} onUpdated={jest.fn()} />);
    expect(screen.queryByTitle('Has medical notes')).not.toBeInTheDocument();
  });

  it('enters edit mode when pencil clicked', () => {
    render(<WellnessIntakeCard customer={baseCustomer} onUpdated={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Edit intake'));
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows input fields in edit mode', () => {
    render(<WellnessIntakeCard customer={emptyCustomer} onUpdated={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Edit intake'));
    // Text inputs for text fields
    expect(screen.getByPlaceholderText('Health Goals')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Injuries / Conditions')).toBeInTheDocument();
    // Select dropdowns for select fields
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('Yoga')).toBeInTheDocument();
  });

  it('cancels editing', () => {
    render(<WellnessIntakeCard customer={baseCustomer} onUpdated={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Edit intake'));
    expect(screen.getByText('Save')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('saves intake form', async () => {
    const { api } = require('@/lib/api');
    const onUpdated = jest.fn();
    render(<WellnessIntakeCard customer={emptyCustomer} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByLabelText('Edit intake'));
    fireEvent.change(screen.getByPlaceholderText('Health Goals'), {
      target: { value: 'Flexibility' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/customers/c2', {
        customFields: expect.objectContaining({ healthGoals: 'Flexibility' }),
      });
    });
  });

  it('renders all 7 field labels', () => {
    render(<WellnessIntakeCard customer={emptyCustomer} onUpdated={jest.fn()} />);
    expect(screen.getByText('Health Goals')).toBeInTheDocument();
    expect(screen.getByText('Fitness Level')).toBeInTheDocument();
    expect(screen.getByText('Injuries / Conditions')).toBeInTheDocument();
    expect(screen.getByText('Medications')).toBeInTheDocument();
    expect(screen.getByText('Allergies')).toBeInTheDocument();
    expect(screen.getByText('Preferred Modality')).toBeInTheDocument();
    expect(screen.getByText('Membership')).toBeInTheDocument();
  });
});
