import { render, screen, fireEvent } from '@testing-library/react';
import { VehicleCard } from './vehicle-card';

const mockVehicle = {
  id: 'veh-1',
  stockNumber: 'AUT-00001',
  vin: 'JH4KA7660MC000001',
  year: 2024,
  make: 'Toyota',
  model: 'Camry',
  trim: 'XLE',
  color: 'White',
  mileage: 15000,
  condition: 'USED',
  status: 'IN_STOCK',
  askingPrice: 28000,
  imageUrls: [],
  createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  location: { name: 'Main Lot' },
  _count: { testDrives: 3 },
};

describe('VehicleCard', () => {
  it('renders vehicle info', () => {
    render(<VehicleCard vehicle={mockVehicle} />);

    expect(screen.getByText(/2024 Toyota Camry/)).toBeInTheDocument();
    expect(screen.getByText('AUT-00001')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('$28,000')).toBeInTheDocument();
    expect(screen.getByText(/15,000 mi/)).toBeInTheDocument();
    expect(screen.getByText('Main Lot')).toBeInTheDocument();
  });

  it('renders trim', () => {
    render(<VehicleCard vehicle={mockVehicle} />);
    expect(screen.getByText('XLE')).toBeInTheDocument();
  });

  it('shows condition badge', () => {
    render(<VehicleCard vehicle={mockVehicle} />);
    expect(screen.getByText('USED')).toBeInTheDocument();
  });

  it('shows CPO for certified pre-owned', () => {
    render(<VehicleCard vehicle={{ ...mockVehicle, condition: 'CERTIFIED_PRE_OWNED' }} />);
    expect(screen.getByText('CPO')).toBeInTheDocument();
  });

  it('handles click', () => {
    const onClick = jest.fn();
    render(<VehicleCard vehicle={mockVehicle} onClick={onClick} />);
    fireEvent.click(screen.getByText(/2024 Toyota Camry/).closest('div')!);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders without optional fields', () => {
    const minimal = {
      ...mockVehicle,
      trim: null,
      color: null,
      mileage: null,
      askingPrice: null,
      location: null,
    };
    render(<VehicleCard vehicle={minimal} />);
    expect(screen.getByText(/2024 Toyota Camry/)).toBeInTheDocument();
    expect(screen.queryByText(/mi$/)).not.toBeInTheDocument();
  });

  it('shows days on lot', () => {
    render(<VehicleCard vehicle={mockVehicle} />);
    expect(screen.getByText(/\d+d on lot/)).toBeInTheDocument();
  });
});
