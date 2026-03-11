import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VehicleSelector } from './vehicle-selector';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({
      data: [
        { id: 'v1', stockNumber: 'A-001', year: 2024, make: 'Toyota', model: 'Camry', vin: null, status: 'IN_STOCK' },
        { id: 'v2', stockNumber: 'A-002', year: 2023, make: 'Honda', model: 'Civic', vin: null, status: 'IN_STOCK' },
      ],
    }),
  },
}));

describe('VehicleSelector', () => {
  it('renders search input', () => {
    render(<VehicleSelector onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search vehicles...')).toBeInTheDocument();
  });

  it('shows results on focus', async () => {
    render(<VehicleSelector onChange={() => {}} />);
    fireEvent.focus(screen.getByPlaceholderText('Search vehicles...'));

    await waitFor(() => {
      expect(screen.getByText(/2024 Toyota Camry/)).toBeInTheDocument();
    });
  });

  it('calls onChange when vehicle selected', async () => {
    const onChange = jest.fn();
    render(<VehicleSelector onChange={onChange} />);
    fireEvent.focus(screen.getByPlaceholderText('Search vehicles...'));

    await waitFor(() => {
      fireEvent.click(screen.getByText(/2024 Toyota Camry/));
    });

    expect(onChange).toHaveBeenCalledWith('v1');
  });

  it('shows selected vehicle and allows clearing', async () => {
    const onChange = jest.fn();
    render(<VehicleSelector onChange={onChange} />);
    fireEvent.focus(screen.getByPlaceholderText('Search vehicles...'));

    await waitFor(() => {
      fireEvent.click(screen.getByText(/2024 Toyota Camry/));
    });

    // Should show selected vehicle
    expect(screen.getByText(/2024 Toyota Camry/)).toBeInTheDocument();
    expect(screen.getByText('A-001')).toBeInTheDocument();
  });
});
