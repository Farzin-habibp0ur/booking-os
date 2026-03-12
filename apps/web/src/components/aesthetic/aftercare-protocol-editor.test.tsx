import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AftercareProtocolEditor } from './aftercare-protocol-editor';

describe('AftercareProtocolEditor', () => {
  const defaultProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders protocol editor form', () => {
    render(<AftercareProtocolEditor {...defaultProps} />);
    expect(screen.getByText('Protocol Name')).toBeInTheDocument();
    expect(screen.getByText('Steps (1)')).toBeInTheDocument();
    expect(screen.getByText('Create Protocol')).toBeInTheDocument();
  });

  it('renders with existing protocol data', () => {
    const protocol = {
      id: 'p1',
      name: 'Test Protocol',
      isDefault: true,
      steps: [
        {
          sequenceOrder: 1,
          delayHours: 0,
          channel: 'WHATSAPP',
          subject: 'Immediate',
          body: 'Hello',
          isActive: true,
        },
        {
          sequenceOrder: 2,
          delayHours: 24,
          channel: 'EMAIL',
          subject: '24h',
          body: 'Check-in',
          isActive: true,
        },
      ],
    };

    render(<AftercareProtocolEditor {...defaultProps} protocol={protocol} />);
    expect(screen.getByDisplayValue('Test Protocol')).toBeInTheDocument();
    expect(screen.getByText('Steps (2)')).toBeInTheDocument();
    expect(screen.getByText('Update Protocol')).toBeInTheDocument();
  });

  it('adds a new step', () => {
    render(<AftercareProtocolEditor {...defaultProps} />);
    expect(screen.getByText('Steps (1)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add Step'));
    expect(screen.getByText('Steps (2)')).toBeInTheDocument();
  });

  it('removes a step', () => {
    const protocol = {
      name: 'Test',
      isDefault: false,
      steps: [
        {
          sequenceOrder: 1,
          delayHours: 0,
          channel: 'WHATSAPP',
          subject: '',
          body: 'A',
          isActive: true,
        },
        {
          sequenceOrder: 2,
          delayHours: 24,
          channel: 'WHATSAPP',
          subject: '',
          body: 'B',
          isActive: true,
        },
      ],
    };

    render(<AftercareProtocolEditor {...defaultProps} protocol={protocol} />);
    expect(screen.getByText('Steps (2)')).toBeInTheDocument();

    const deleteButtons = screen
      .getAllByRole('button')
      .filter(
        (btn) => btn.querySelector('svg.lucide-trash-2') || btn.querySelector('.lucide-trash2'),
      );
    // Click any trash button
    const trashBtns = screen.getByTestId('aftercare-step-0').querySelectorAll('button');
    const trash = Array.from(trashBtns).find((b) => b.querySelector('svg'));
    if (trash) fireEvent.click(trash);
    // Should now have 1 step
    expect(screen.getByText('Steps (1)')).toBeInTheDocument();
  });

  it('shows template variables', () => {
    render(<AftercareProtocolEditor {...defaultProps} />);
    expect(screen.getByText('{{customerName}}')).toBeInTheDocument();
    expect(screen.getByText('{{serviceName}}')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<AftercareProtocolEditor {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows services dropdown when services provided', () => {
    const services = [
      { id: 'svc-1', name: 'Botox' },
      { id: 'svc-2', name: 'Filler' },
    ];
    render(<AftercareProtocolEditor {...defaultProps} services={services} />);
    expect(screen.getByText('Botox')).toBeInTheDocument();
    expect(screen.getByText('Filler')).toBeInTheDocument();
  });

  it('shows saving state', () => {
    render(<AftercareProtocolEditor {...defaultProps} saving={true} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});
