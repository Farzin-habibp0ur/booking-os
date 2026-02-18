import { render, screen } from '@testing-library/react';
import { ActivityFeed, ActivityEntry } from './activity-feed';

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

const mockEntries: ActivityEntry[] = [
  {
    id: 'ah1',
    actorType: 'STAFF',
    actorName: 'Sarah',
    action: 'BOOKING_CREATED',
    entityType: 'BOOKING',
    entityId: 'book1',
    description: 'Booking created for Emma — Botox',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'ah2',
    actorType: 'AI',
    actorName: 'AI Assistant',
    action: 'CARD_APPROVED',
    entityType: 'ACTION_CARD',
    entityId: 'card1',
    description: 'Action card approved',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ah3',
    actorType: 'SYSTEM',
    action: 'BOOKING_CANCELLED',
    entityType: 'BOOKING',
    entityId: 'book2',
    description: 'Booking cancelled',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

describe('ActivityFeed', () => {
  it('renders entries', () => {
    render(<ActivityFeed entries={mockEntries} />);

    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    expect(screen.getByTestId('activity-ah1')).toBeInTheDocument();
    expect(screen.getByTestId('activity-ah2')).toBeInTheDocument();
    expect(screen.getByTestId('activity-ah3')).toBeInTheDocument();
  });

  it('shows description text', () => {
    render(<ActivityFeed entries={mockEntries} />);

    expect(screen.getByText('Booking created for Emma — Botox')).toBeInTheDocument();
    expect(screen.getByText('Booking cancelled')).toBeInTheDocument();
  });

  it('shows actor name', () => {
    render(<ActivityFeed entries={mockEntries} />);

    expect(screen.getByText('Sarah')).toBeInTheDocument();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('shows actor type when no name provided', () => {
    render(<ActivityFeed entries={mockEntries} />);

    expect(screen.getByText('SYSTEM')).toBeInTheDocument();
  });

  it('shows time ago', () => {
    render(<ActivityFeed entries={mockEntries} />);

    expect(screen.getByText('5m ago')).toBeInTheDocument();
    expect(screen.getByText('1h ago')).toBeInTheDocument();
    expect(screen.getByText('1d ago')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<ActivityFeed entries={[]} />);

    expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(<ActivityFeed entries={[]} loading />);

    expect(screen.getByTestId('activity-feed-loading')).toBeInTheDocument();
  });

  it('falls back to action name when no description', () => {
    const entries: ActivityEntry[] = [
      {
        id: 'ah4',
        actorType: 'STAFF',
        action: 'SETTING_CHANGED',
        entityType: 'SETTING',
        entityId: 's1',
        createdAt: new Date().toISOString(),
      },
    ];

    render(<ActivityFeed entries={entries} />);

    expect(screen.getByText('SETTING_CHANGED')).toBeInTheDocument();
  });
});
