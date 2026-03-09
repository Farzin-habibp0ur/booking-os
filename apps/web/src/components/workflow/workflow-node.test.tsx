import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowNode, type WorkflowNodeData } from './workflow-node';

const makeNode = (overrides: Partial<WorkflowNodeData> = {}): WorkflowNodeData => ({
  id: 'test-1',
  type: 'TRIGGER',
  subtype: 'BOOKING_CREATED',
  label: 'New Booking',
  config: {},
  x: 100,
  y: 50,
  ...overrides,
});

const defaultProps = {
  isSelected: false,
  zoom: 1,
  onSelect: jest.fn(),
  onDelete: jest.fn(),
  onConfigure: jest.fn(),
  onConnectionStart: jest.fn(),
  onConnectionEnd: jest.fn(),
};

describe('WorkflowNode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders trigger node with correct styling', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode()} />);
    const el = screen.getByTestId('workflow-node-test-1');
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('data-node-type')).toBe('TRIGGER');
    expect(screen.getByText('New Booking')).toBeInTheDocument();
  });

  it('renders action node type', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode({ type: 'ACTION', subtype: 'SEND_TEMPLATE', label: 'Send Message' })} />);
    expect(screen.getByText('Send Message')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-node-test-1').getAttribute('data-node-type')).toBe('ACTION');
  });

  it('renders condition node type', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode({ type: 'CONDITION', subtype: 'IF_STATUS', label: 'If Status Is' })} />);
    expect(screen.getByText('If Status Is')).toBeInTheDocument();
  });

  it('renders delay node type', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode({ type: 'DELAY', subtype: 'WAIT_HOURS', label: 'Wait Hours' })} />);
    expect(screen.getByText('Wait Hours')).toBeInTheDocument();
  });

  it('shows config summary', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode({ config: { hoursBefore: 24 } })} />);
    expect(screen.getByText('24h before')).toBeInTheDocument();
  });

  it('shows "Click to configure" when no config', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode()} />);
    expect(screen.getByText('Click to configure')).toBeInTheDocument();
  });

  it('calls onDelete when X button clicked', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode()} />);
    fireEvent.click(screen.getByLabelText('Delete node'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('test-1');
  });

  it('calls onConfigure on double-click', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode()} />);
    fireEvent.doubleClick(screen.getByTestId('workflow-node-test-1'));
    expect(defaultProps.onConfigure).toHaveBeenCalledWith('test-1');
  });

  it('calls onSelect on click', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode()} />);
    fireEvent.click(screen.getByTestId('workflow-node-test-1'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith('test-1');
  });

  it('shows selected ring when isSelected', () => {
    const { container } = render(<WorkflowNode {...defaultProps} node={makeNode()} isSelected={true} />);
    const nodeBody = container.querySelector('.ring-2');
    expect(nodeBody).toBeInTheDocument();
  });

  it('has output connection point', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode()} />);
    expect(screen.getByTestId('node-output-test-1')).toBeInTheDocument();
  });

  it('trigger node does not have input connection point', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode()} />);
    expect(screen.queryByTestId('node-input-test-1')).not.toBeInTheDocument();
  });

  it('non-trigger node has input connection point', () => {
    render(<WorkflowNode {...defaultProps} node={makeNode({ type: 'ACTION', subtype: 'ADD_TAG' })} />);
    expect(screen.getByTestId('node-input-test-1')).toBeInTheDocument();
  });
});
