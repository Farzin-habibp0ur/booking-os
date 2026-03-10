import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportModal from './export-modal';

// Mock toast
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock api
jest.mock('@/lib/api', () => ({
  api: {
    getText: jest.fn().mockResolvedValue('id,name\n1,Test\n'),
  },
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
}));

const defaultFields = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
];

describe('ExportModal', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <ExportModal
        isOpen={false}
        onClose={jest.fn()}
        entity="customers"
        allFields={defaultFields}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when open', () => {
    render(
      <ExportModal
        isOpen={true}
        onClose={jest.fn()}
        entity="customers"
        allFields={defaultFields}
      />,
    );
    expect(screen.getByText('Export Customers')).toBeInTheDocument();
  });

  it('displays correct title for bookings entity', () => {
    render(
      <ExportModal isOpen={true} onClose={jest.fn()} entity="bookings" allFields={defaultFields} />,
    );
    expect(screen.getByText('Export Bookings')).toBeInTheDocument();
  });

  it('displays correct title for staff entity', () => {
    render(
      <ExportModal isOpen={true} onClose={jest.fn()} entity="staff" allFields={defaultFields} />,
    );
    expect(screen.getByText('Export Staff')).toBeInTheDocument();
  });

  it('renders all field checkboxes', () => {
    render(
      <ExportModal isOpen={true} onClose={jest.fn()} entity="staff" allFields={defaultFields} />,
    );
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('toggles field selection', async () => {
    const user = userEvent.setup();
    render(
      <ExportModal isOpen={true} onClose={jest.fn()} entity="staff" allFields={defaultFields} />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();

    await user.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <ExportModal isOpen={true} onClose={onClose} entity="staff" allFields={defaultFields} />,
    );

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
