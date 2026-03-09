import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowSidebar } from './workflow-sidebar';

describe('WorkflowSidebar', () => {
  it('renders sidebar with all sections', () => {
    render(<WorkflowSidebar />);
    expect(screen.getByTestId('workflow-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Triggers')).toBeInTheDocument();
    expect(screen.getByText('Conditions')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Delays')).toBeInTheDocument();
  });

  it('renders all trigger blocks', () => {
    render(<WorkflowSidebar />);
    expect(screen.getByTestId('block-BOOKING_CREATED')).toBeInTheDocument();
    expect(screen.getByTestId('block-BOOKING_CANCELLED')).toBeInTheDocument();
    expect(screen.getByTestId('block-CUSTOMER_CREATED')).toBeInTheDocument();
    expect(screen.getByTestId('block-MESSAGE_RECEIVED')).toBeInTheDocument();
    expect(screen.getByTestId('block-STATUS_CHANGED')).toBeInTheDocument();
    expect(screen.getByTestId('block-BOOKING_UPCOMING')).toBeInTheDocument();
  });

  it('renders all condition blocks', () => {
    render(<WorkflowSidebar />);
    expect(screen.getByTestId('block-IF_STATUS')).toBeInTheDocument();
    expect(screen.getByTestId('block-IF_TAG')).toBeInTheDocument();
    expect(screen.getByTestId('block-IF_TIME_SINCE')).toBeInTheDocument();
    expect(screen.getByTestId('block-IF_AMOUNT')).toBeInTheDocument();
    expect(screen.getByTestId('block-IF_SERVICE')).toBeInTheDocument();
    expect(screen.getByTestId('block-IF_STAFF')).toBeInTheDocument();
  });

  it('renders all action blocks', () => {
    render(<WorkflowSidebar />);
    expect(screen.getByTestId('block-SEND_TEMPLATE')).toBeInTheDocument();
    expect(screen.getByTestId('block-SEND_EMAIL')).toBeInTheDocument();
    expect(screen.getByTestId('block-CREATE_ACTION_CARD')).toBeInTheDocument();
    expect(screen.getByTestId('block-UPDATE_STATUS')).toBeInTheDocument();
    expect(screen.getByTestId('block-ASSIGN_STAFF')).toBeInTheDocument();
    expect(screen.getByTestId('block-ADD_TAG')).toBeInTheDocument();
    expect(screen.getByTestId('block-SEND_NOTIFICATION')).toBeInTheDocument();
  });

  it('renders all delay blocks', () => {
    render(<WorkflowSidebar />);
    expect(screen.getByTestId('block-WAIT_MINUTES')).toBeInTheDocument();
    expect(screen.getByTestId('block-WAIT_HOURS')).toBeInTheDocument();
    expect(screen.getByTestId('block-WAIT_UNTIL')).toBeInTheDocument();
  });

  it('blocks are draggable', () => {
    render(<WorkflowSidebar />);
    const block = screen.getByTestId('block-BOOKING_CREATED');
    expect(block.getAttribute('draggable')).toBe('true');
  });

  it('sets drag data on drag start', () => {
    render(<WorkflowSidebar />);
    const block = screen.getByTestId('block-BOOKING_CREATED');
    const setData = jest.fn();
    fireEvent.dragStart(block, {
      dataTransfer: { setData, effectAllowed: '' },
    });
    expect(setData).toHaveBeenCalledWith(
      'application/workflow-block',
      expect.stringContaining('BOOKING_CREATED'),
    );
  });
});
