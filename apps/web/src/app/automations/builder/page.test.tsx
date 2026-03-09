import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkflowBuilderPage, { serializeWorkflow } from './page';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

describe('WorkflowBuilderPage', () => {
  it('renders canvas and sidebar', () => {
    render(<WorkflowBuilderPage />);
    expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-sidebar')).toBeInTheDocument();
  });

  it('renders toolbar with name input, Save, and Test buttons', () => {
    render(<WorkflowBuilderPage />);
    expect(screen.getByTestId('workflow-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-save')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('shows error when saving with no trigger', async () => {
    render(<WorkflowBuilderPage />);
    fireEvent.click(screen.getByTestId('workflow-save'));
    await waitFor(() => {
      expect(screen.getByTestId('workflow-error')).toHaveTextContent('exactly 1 trigger');
    });
  });

  it('shows error when saving with no name', async () => {
    // We can't easily add nodes through the UI in this test,
    // so we test the serialization function directly
    const result = serializeWorkflow({
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'BOOKING_CREATED',
          label: 'New Booking',
          config: {},
          x: 0,
          y: 0,
        },
        {
          id: '2',
          type: 'ACTION',
          subtype: 'ADD_TAG',
          label: 'Add Tag',
          config: { tag: 'vip' },
          x: 0,
          y: 100,
        },
      ],
      connections: [],
      selectedNodeId: null,
      selectedConnectionId: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
      name: '',
      isSaving: false,
      isTesting: false,
      error: null,
      toast: null,
    });
    expect(result.error).toBe('Please enter a workflow name');
  });

  it('shows error when saving with no action', () => {
    const result = serializeWorkflow({
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'BOOKING_CREATED',
          label: 'New Booking',
          config: {},
          x: 0,
          y: 0,
        },
      ],
      connections: [],
      selectedNodeId: null,
      selectedConnectionId: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
      name: 'Test',
      isSaving: false,
      isTesting: false,
      error: null,
      toast: null,
    });
    expect(result.error).toBe('Workflow must have at least 1 action');
  });
});

describe('serializeWorkflow', () => {
  const baseState = {
    connections: [],
    selectedNodeId: null,
    selectedConnectionId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    isSaving: false,
    isTesting: false,
    error: null,
    toast: null,
  };

  it('serializes trigger + action to valid AutomationRule JSON', () => {
    const result = serializeWorkflow({
      ...baseState,
      name: 'My Workflow',
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'BOOKING_CREATED',
          label: 'New Booking',
          config: {},
          x: 0,
          y: 0,
        },
        {
          id: '2',
          type: 'ACTION',
          subtype: 'ADD_TAG',
          label: 'Add Tag',
          config: { tag: 'vip' },
          x: 0,
          y: 100,
        },
      ],
    });
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      name: 'My Workflow',
      trigger: 'BOOKING_CREATED',
      filters: {},
      actions: [{ type: 'ADD_TAG', value: 'vip' }],
      quietStart: '21:00',
      quietEnd: '09:00',
      maxPerCustomerPerDay: 3,
    });
  });

  it('serializes trigger + condition + action correctly', () => {
    const result = serializeWorkflow({
      ...baseState,
      name: 'Status Workflow',
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'STATUS_CHANGED',
          label: 'Status Changed',
          config: { newStatus: 'COMPLETED' },
          x: 0,
          y: 0,
        },
        {
          id: '2',
          type: 'CONDITION',
          subtype: 'IF_AMOUNT',
          label: 'If Amount',
          config: { amount: 100 },
          x: 0,
          y: 100,
        },
        {
          id: '3',
          type: 'ACTION',
          subtype: 'SEND_TEMPLATE',
          label: 'Send',
          config: { category: 'FOLLOW_UP', channel: 'EMAIL' },
          x: 0,
          y: 200,
        },
      ],
    });
    expect(result.error).toBeUndefined();
    expect(result.data!.trigger).toBe('STATUS_CHANGED');
    expect(result.data!.filters).toEqual({ newStatus: 'COMPLETED', minAmount: 100 });
    expect(result.data!.actions).toEqual([
      { type: 'SEND_TEMPLATE', category: 'FOLLOW_UP', params: { channel: 'EMAIL' } },
    ]);
  });

  it('serializes delay nodes as delayHours on actions', () => {
    const result = serializeWorkflow({
      ...baseState,
      name: 'Delay Workflow',
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'BOOKING_CREATED',
          label: 'New Booking',
          config: {},
          x: 0,
          y: 0,
        },
        {
          id: '2',
          type: 'DELAY',
          subtype: 'WAIT_HOURS',
          label: 'Wait 2h',
          config: { duration: 2, unit: 'hours' },
          x: 0,
          y: 100,
        },
        {
          id: '3',
          type: 'ACTION',
          subtype: 'SEND_TEMPLATE',
          label: 'Send',
          config: { category: 'REMINDER' },
          x: 0,
          y: 200,
        },
      ],
    });
    expect(result.error).toBeUndefined();
    expect(result.data!.actions[0].delayHours).toBe(2);
  });

  it('serializes minute delays correctly', () => {
    const result = serializeWorkflow({
      ...baseState,
      name: 'Minute Delay',
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'BOOKING_CREATED',
          label: 'Trigger',
          config: {},
          x: 0,
          y: 0,
        },
        {
          id: '2',
          type: 'DELAY',
          subtype: 'WAIT_MINUTES',
          label: 'Wait',
          config: { duration: 30, unit: 'minutes' },
          x: 0,
          y: 100,
        },
        {
          id: '3',
          type: 'ACTION',
          subtype: 'UPDATE_STATUS',
          label: 'Update',
          config: { status: 'CONFIRMED' },
          x: 0,
          y: 200,
        },
      ],
    });
    expect(result.data!.actions[0].delayHours).toBe(0.5);
    expect(result.data!.actions[0].value).toBe('CONFIRMED');
  });

  it('rejects multiple triggers', () => {
    const result = serializeWorkflow({
      ...baseState,
      name: 'Bad',
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'BOOKING_CREATED',
          label: 'T1',
          config: {},
          x: 0,
          y: 0,
        },
        {
          id: '2',
          type: 'TRIGGER',
          subtype: 'STATUS_CHANGED',
          label: 'T2',
          config: {},
          x: 200,
          y: 0,
        },
        {
          id: '3',
          type: 'ACTION',
          subtype: 'ADD_TAG',
          label: 'Tag',
          config: { tag: 'x' },
          x: 0,
          y: 100,
        },
      ],
    });
    expect(result.error).toBe('Workflow must have exactly 1 trigger');
  });

  it('maps BOOKING_UPCOMING trigger with hoursBefore filter', () => {
    const result = serializeWorkflow({
      ...baseState,
      name: 'Upcoming',
      nodes: [
        {
          id: '1',
          type: 'TRIGGER',
          subtype: 'BOOKING_UPCOMING',
          label: 'Time-Based',
          config: { hoursBefore: 24 },
          x: 0,
          y: 0,
        },
        {
          id: '2',
          type: 'ACTION',
          subtype: 'SEND_TEMPLATE',
          label: 'Send',
          config: { category: 'REMINDER' },
          x: 0,
          y: 100,
        },
      ],
    });
    expect(result.data!.trigger).toBe('BOOKING_UPCOMING');
    expect(result.data!.filters).toEqual({ hoursBefore: 24 });
  });
});
