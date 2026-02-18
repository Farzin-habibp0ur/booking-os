import { render, screen } from '@testing-library/react';
import { RecentChangesPanel } from './recent-changes-panel';
import { ActivityEntry } from './activity-feed';

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
    description: 'Booking created',
    createdAt: new Date().toISOString(),
  },
];

describe('RecentChangesPanel', () => {
  it('renders panel with title', () => {
    render(<RecentChangesPanel entries={mockEntries} />);

    expect(screen.getByTestId('recent-changes-panel')).toBeInTheDocument();
    expect(screen.getByText('Recent Changes')).toBeInTheDocument();
  });

  it('uses custom title', () => {
    render(<RecentChangesPanel entries={mockEntries} title="Booking History" />);

    expect(screen.getByText('Booking History')).toBeInTheDocument();
  });

  it('renders activity entries', () => {
    render(<RecentChangesPanel entries={mockEntries} />);

    expect(screen.getByText('Booking created')).toBeInTheDocument();
  });

  it('limits to 10 entries', () => {
    const manyEntries = Array.from({ length: 15 }, (_, i) => ({
      id: `ah${i}`,
      actorType: 'STAFF',
      action: 'BOOKING_CREATED',
      entityType: 'BOOKING',
      entityId: `book${i}`,
      description: `Entry ${i}`,
      createdAt: new Date().toISOString(),
    }));

    render(<RecentChangesPanel entries={manyEntries} />);

    expect(screen.getByText('Entry 0')).toBeInTheDocument();
    expect(screen.getByText('Entry 9')).toBeInTheDocument();
    expect(screen.queryByText('Entry 10')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<RecentChangesPanel entries={[]} loading />);

    expect(screen.getByTestId('activity-feed-loading')).toBeInTheDocument();
  });
});
