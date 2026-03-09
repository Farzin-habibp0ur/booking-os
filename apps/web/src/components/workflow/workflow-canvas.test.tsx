import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowCanvas } from './workflow-canvas';

const defaultProps = {
  nodes: [],
  connections: [],
  selectedNodeId: null,
  selectedConnectionId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  onSelectNode: jest.fn(),
  onSelectConnection: jest.fn(),
  onDeleteNode: jest.fn(),
  onConfigureNode: jest.fn(),
  onAddNode: jest.fn(),
  onAddConnection: jest.fn(),
  onZoom: jest.fn(),
  onPan: jest.fn(),
};

describe('WorkflowCanvas', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders canvas with grid background', () => {
    render(<WorkflowCanvas {...defaultProps} />);
    const canvas = screen.getByTestId('workflow-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas.style.backgroundColor).toBeTruthy();
  });

  it('displays zoom indicator', () => {
    render(<WorkflowCanvas {...defaultProps} zoom={0.75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('handles zoom on ctrl+wheel', () => {
    render(<WorkflowCanvas {...defaultProps} />);
    const canvas = screen.getByTestId('workflow-canvas');
    fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true });
    expect(defaultProps.onZoom).toHaveBeenCalledWith(0.1);
  });

  it('handles zoom out on ctrl+wheel down', () => {
    render(<WorkflowCanvas {...defaultProps} />);
    const canvas = screen.getByTestId('workflow-canvas');
    fireEvent.wheel(canvas, { deltaY: 100, ctrlKey: true });
    expect(defaultProps.onZoom).toHaveBeenCalledWith(-0.1);
  });

  it('accepts drop events and creates nodes', () => {
    render(<WorkflowCanvas {...defaultProps} />);
    const canvas = screen.getByTestId('workflow-canvas');
    const blockData = JSON.stringify({ type: 'TRIGGER', subtype: 'BOOKING_CREATED', label: 'New Booking' });

    // Use dataTransfer mock that supports both get and set
    const dataTransfer = {
      getData: () => blockData,
      setData: jest.fn(),
      dropEffect: 'none',
      effectAllowed: 'none',
    };

    fireEvent.dragOver(canvas, { dataTransfer });
    fireEvent.drop(canvas, {
      dataTransfer,
      clientX: 300,
      clientY: 200,
    });
    expect(defaultProps.onAddNode).toHaveBeenCalled();
  });

  it('renders nodes when provided', () => {
    const nodes = [
      { id: 'n1', type: 'TRIGGER' as const, subtype: 'BOOKING_CREATED', label: 'New Booking', config: {}, x: 100, y: 50 },
    ];
    render(<WorkflowCanvas {...defaultProps} nodes={nodes} />);
    expect(screen.getByTestId('workflow-node-n1')).toBeInTheDocument();
  });

  it('deselects on empty canvas click', () => {
    render(<WorkflowCanvas {...defaultProps} />);
    const canvas = screen.getByTestId('workflow-canvas');
    fireEvent.mouseDown(canvas, { target: canvas });
    expect(defaultProps.onSelectNode).toHaveBeenCalledWith(null);
    expect(defaultProps.onSelectConnection).toHaveBeenCalledWith(null);
  });
});
