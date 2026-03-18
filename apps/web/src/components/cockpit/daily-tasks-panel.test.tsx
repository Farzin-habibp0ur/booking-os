import { render, screen, fireEvent } from '@testing-library/react';
import { DailyTasksPanel, CockpitTask } from './daily-tasks-panel';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockTask: CockpitTask = {
  id: 'ct-1',
  title: 'Unblock PROJ-234: Sarah needs API credentials from DevOps',
  description: 'PROJ-234 has been stuck for 3 days.',
  priority: 'URGENT_TODAY',
  category: 'STALLED_WORK',
  actionItems: [
    {
      label: 'Message Sarah about PROJ-234 status',
      entityType: 'JIRA_ISSUE',
      entityId: 'PROJ-234',
      entityLabel: 'API credentials setup',
    },
    {
      label: 'Ping DevOps team in Slack',
      entityType: 'SLACK_THREAD',
    },
    {
      label: 'Update the ticket with timeline',
    },
  ],
  linkedEntities: [
    { type: 'JIRA_ISSUE', id: 'PROJ-234', label: 'API credentials', status: 'In Progress' },
    { type: 'PERSON', id: 'staff-sarah', label: 'Sarah' },
  ],
  evidenceRefs: ['PROJ-234 last updated 3 days ago'],
  qualityFlag: 'SPECIFIC',
};

const vagueTask: CockpitTask = {
  id: 'ct-2',
  title: 'Review pending items',
  description: 'There are items to review.',
  priority: 'HYGIENE',
  category: 'GENERAL',
  actionItems: [{ label: 'Check things' }],
  linkedEntities: [],
  qualityFlag: 'VAGUE',
};

describe('DailyTasksPanel', () => {
  it('renders loading state', () => {
    render(<DailyTasksPanel tasks={[]} loading={true} />);
    expect(screen.getByTestId('cockpit-tasks-loading')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    render(<DailyTasksPanel tasks={[]} />);
    expect(screen.getByTestId('cockpit-tasks-empty')).toBeInTheDocument();
    expect(screen.getByText('All clear for today')).toBeInTheDocument();
  });

  it('renders task title and description', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);
    expect(screen.getByText(/PROJ-234: Sarah needs API credentials/)).toBeInTheDocument();
    expect(screen.getByText(/stuck for 3 days/)).toBeInTheDocument();
  });

  it('renders action items', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);
    const actionItems = screen.getAllByTestId('action-item');
    // Shows first 2 by default (collapsed)
    expect(actionItems.length).toBe(2);
    expect(screen.getByText(/Message Sarah about PROJ-234/)).toBeInTheDocument();
  });

  it('renders linked entity chips', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);
    const entities = screen.getAllByTestId('linked-entity');
    expect(entities.length).toBe(2);
    expect(screen.getByText('API credentials')).toBeInTheDocument();
    expect(screen.getByText('Sarah')).toBeInTheDocument();
  });

  it('shows Jira key as monospace code', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);
    const jiraCode = screen.getByText('PROJ-234');
    expect(jiraCode.tagName.toLowerCase()).toBe('code');
  });

  it('shows entity status on chips', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);
    expect(screen.getByText(/In Progress/)).toBeInTheDocument();
  });

  it('expands to show all action items', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);

    // Click expand
    fireEvent.click(screen.getByTestId('cockpit-expand-ct-1'));

    // Now should show all 3 items
    const actionItems = screen.getAllByTestId('action-item');
    expect(actionItems.length).toBe(3);
  });

  it('shows evidence when expanded', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);

    fireEvent.click(screen.getByTestId('cockpit-expand-ct-1'));

    expect(screen.getByText(/PROJ-234 last updated 3 days ago/)).toBeInTheDocument();
  });

  it('groups tasks by priority', () => {
    const tasks: CockpitTask[] = [mockTask, { ...mockTask, id: 'ct-3', priority: 'OPPORTUNITY' }];
    render(<DailyTasksPanel tasks={tasks} />);

    expect(screen.getByText(/Urgent Today/)).toBeInTheDocument();
    expect(screen.getByText(/Opportunities/)).toBeInTheDocument();
  });

  it('shows vague quality flag badge', () => {
    render(<DailyTasksPanel tasks={[vagueTask]} />);
    expect(screen.getByText('Low specificity')).toBeInTheDocument();
  });

  it('calls onViewDetail when detail button clicked', () => {
    const onViewDetail = jest.fn();
    render(<DailyTasksPanel tasks={[mockTask]} onViewDetail={onViewDetail} />);

    // Expand first
    fireEvent.click(screen.getByTestId('cockpit-expand-ct-1'));

    // Click detail button
    fireEvent.click(screen.getByTestId('cockpit-detail-ct-1'));

    expect(onViewDetail).toHaveBeenCalledWith(mockTask);
  });

  it('shows "+N more" when action items are truncated', () => {
    render(<DailyTasksPanel tasks={[mockTask]} />);
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });
});
