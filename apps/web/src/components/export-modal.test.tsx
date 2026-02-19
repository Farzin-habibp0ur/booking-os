import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportModal from './export-modal';

const mockGetText = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    getText: (...args: any[]) => mockGetText(...args),
  },
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const defaultFields = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
];

describe('ExportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetText.mockResolvedValue('id,name,email\r\nc1,Jane,jane@test.com\r\n');
  });

  it('does not render when isOpen is false', () => {
    render(
      <ExportModal
        isOpen={false}
        onClose={jest.fn()}
        entity="customers"
        allFields={defaultFields}
      />,
    );
    expect(screen.queryByText('Export Customers')).not.toBeInTheDocument();
  });

  it('renders title and field checkboxes when open', () => {
    render(
      <ExportModal
        isOpen={true}
        onClose={jest.fn()}
        entity="customers"
        allFields={defaultFields}
      />,
    );
    expect(screen.getByText('Export Customers')).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders bookings title for bookings entity', () => {
    render(
      <ExportModal isOpen={true} onClose={jest.fn()} entity="bookings" allFields={defaultFields} />,
    );
    expect(screen.getByText('Export Bookings')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <ExportModal isOpen={true} onClose={onClose} entity="customers" allFields={defaultFields} />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles field selection', () => {
    render(
      <ExportModal
        isOpen={true}
        onClose={jest.fn()}
        entity="customers"
        allFields={defaultFields}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // All should be checked initially
    expect(checkboxes[0]).toBeChecked();
    // Uncheck first
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('exports CSV and triggers download on click', async () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const mockUrl = 'blob:test';
    global.URL.createObjectURL = jest.fn(() => mockUrl);
    global.URL.revokeObjectURL = jest.fn();

    const onClose = jest.fn();
    render(
      <ExportModal isOpen={true} onClose={onClose} entity="customers" allFields={defaultFields} />,
    );

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(mockGetText).toHaveBeenCalledWith('/customers/export');
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('passes date range and field params to API', async () => {
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(
      <ExportModal
        isOpen={true}
        onClose={jest.fn()}
        entity="customers"
        allFields={defaultFields}
      />,
    );

    // Set date range
    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-01-31' } });

    // Uncheck one field
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[2]); // uncheck 'email'

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(mockGetText).toHaveBeenCalledWith(expect.stringContaining('dateFrom=2026-01-01'));
      expect(mockGetText).toHaveBeenCalledWith(expect.stringContaining('dateTo=2026-01-31'));
      expect(mockGetText).toHaveBeenCalledWith(expect.stringContaining('fields=id%2Cname'));
    });
  });

  it('has select all / deselect all toggle', () => {
    render(
      <ExportModal
        isOpen={true}
        onClose={jest.fn()}
        entity="customers"
        allFields={defaultFields}
      />,
    );
    // Click "Deselect All"
    fireEvent.click(screen.getByText('Deselect All'));
    const checkboxes = screen.getAllByRole('checkbox');
    // At least one should remain checked (minimum 1)
    const checkedCount = checkboxes.filter((cb) => (cb as HTMLInputElement).checked).length;
    expect(checkedCount).toBe(1);

    // Click "Select All"
    fireEvent.click(screen.getByText('Select All'));
    const allChecked = checkboxes.every((cb) => (cb as HTMLInputElement).checked);
    expect(allChecked).toBe(true);
  });
});
