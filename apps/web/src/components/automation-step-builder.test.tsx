import { render, screen, fireEvent } from '@testing-library/react';
import { AutomationStepBuilder, type AutomationStepData } from './automation-step-builder';

const makeStep = (overrides: Partial<AutomationStepData> = {}): AutomationStepData => ({
  id: 'step-1',
  order: 0,
  type: 'ACTION',
  config: { actionType: 'SEND_MESSAGE' },
  ...overrides,
});

describe('AutomationStepBuilder', () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders empty state when no steps', () => {
    render(<AutomationStepBuilder steps={[]} onChange={onChange} />);
    expect(screen.getByTestId('step-builder-empty')).toBeInTheDocument();
    expect(screen.getByText('No steps yet. Add your first step.')).toBeInTheDocument();
  });

  it('renders step cards for each step', () => {
    const steps = [
      makeStep({ id: 's1', order: 0 }),
      makeStep({ id: 's2', order: 1, type: 'DELAY', config: { delayMinutes: 30 } }),
    ];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);

    expect(screen.getByTestId('step-card-s1')).toBeInTheDocument();
    expect(screen.getByTestId('step-card-s2')).toBeInTheDocument();
  });

  it('shows delay badge for DELAY type steps', () => {
    const steps = [makeStep({ id: 's1', order: 0, type: 'DELAY', config: { delayMinutes: 60 } })];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);
    expect(screen.getByTestId('delay-badge')).toHaveTextContent('60m delay');
  });

  it('opens add step menu when clicking add button', () => {
    render(<AutomationStepBuilder steps={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('add-step-button-empty'));
    expect(screen.getByTestId('add-step-menu')).toBeInTheDocument();
    expect(screen.getByTestId('add-step-option-send-message')).toBeInTheDocument();
    expect(screen.getByTestId('add-step-option-wait')).toBeInTheDocument();
    expect(screen.getByTestId('add-step-option-condition')).toBeInTheDocument();
  });

  it('adds a step when selecting from menu', () => {
    render(<AutomationStepBuilder steps={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('add-step-button-empty'));
    fireEvent.click(screen.getByTestId('add-step-option-send-message'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'ACTION', config: { actionType: 'SEND_MESSAGE' }, order: 0 }),
    ]);
  });

  it('removes a step when clicking remove button', () => {
    const steps = [
      makeStep({ id: 's1', order: 0 }),
      makeStep({ id: 's2', order: 1, type: 'DELAY', config: { delayMinutes: 10 } }),
    ];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('remove-step-s1'));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 's2', order: 0 })]);
  });

  it('expands step config when clicking step card', () => {
    const steps = [makeStep({ id: 's1', order: 0 })];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);

    // Click to expand
    fireEvent.click(screen.getByText('Send Message'));
    expect(screen.getByTestId('step-config-s1')).toBeInTheDocument();
    expect(screen.getByTestId('step-message-template')).toBeInTheDocument();
  });

  it('updates step config for DELAY type', () => {
    const steps = [makeStep({ id: 's1', order: 0, type: 'DELAY', config: { delayMinutes: 30 } })];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);

    // Expand
    fireEvent.click(screen.getByText('Wait 30m'));
    const input = screen.getByTestId('step-delay-input');
    fireEvent.change(input, { target: { value: '60' } });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ config: { delayMinutes: 60 } }),
    ]);
  });

  it('shows branch config fields for BRANCH type', () => {
    const steps = [
      makeStep({
        id: 's1',
        order: 0,
        type: 'BRANCH',
        config: { field: 'status', operator: 'is', value: 'CONFIRMED' },
      }),
    ];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);

    fireEvent.click(screen.getByText('If status is CONFIRMED'));
    expect(screen.getByTestId('step-branch-field')).toBeInTheDocument();
    expect(screen.getByTestId('step-branch-operator')).toBeInTheDocument();
    expect(screen.getByTestId('step-branch-value')).toBeInTheDocument();
  });

  it('inserts step between existing steps', () => {
    const steps = [
      makeStep({ id: 's1', order: 0 }),
      makeStep({ id: 's2', order: 1, type: 'DELAY', config: { delayMinutes: 10 } }),
    ];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);

    // Click the add button between step 0 and step 1
    fireEvent.click(screen.getByTestId('add-step-button-1'));
    fireEvent.click(screen.getByTestId('add-step-option-add-tag'));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's1', order: 0 }),
      expect.objectContaining({ type: 'ACTION', config: { actionType: 'ADD_TAG' }, order: 1 }),
      expect.objectContaining({ id: 's2', order: 2 }),
    ]);
  });

  it('shows correct label for each step type', () => {
    const steps = [
      makeStep({
        id: 's1',
        order: 0,
        config: { actionType: 'SEND_MESSAGE', template: 'Hello there!' },
      }),
      makeStep({ id: 's2', order: 1, type: 'DELAY', config: { delayMinutes: 120 } }),
      makeStep({
        id: 's3',
        order: 2,
        config: { actionType: 'UPDATE_STATUS', newStatus: 'COMPLETED' },
      }),
      makeStep({ id: 's4', order: 3, config: { actionType: 'ADD_TAG', tag: 'VIP' } }),
    ];
    render(<AutomationStepBuilder steps={steps} onChange={onChange} />);

    expect(screen.getByText('Send: Hello there!')).toBeInTheDocument();
    expect(screen.getByText('Wait 2h')).toBeInTheDocument();
    expect(screen.getByText('Set status: COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('Add tag: VIP')).toBeInTheDocument();
  });
});
