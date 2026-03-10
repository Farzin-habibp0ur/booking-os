import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  EmptyState,
  CardSkeleton,
  TableRowSkeleton,
  PageSkeleton,
  DetailSkeleton,
  FormSkeleton,
  ListSkeleton,
  InboxSkeleton,
  CalendarSkeleton,
} from './skeleton';

describe('Skeleton', () => {
  it('renders a div with animation class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('animate-pulse');
  });

  it('merges custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-4');
  });
});

describe('EmptyState', () => {
  const MockIcon = ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="icon" className={className} width={size} height={size} />
  );

  it('renders title and description', () => {
    render(<EmptyState icon={MockIcon} title="Nothing here" description="Add some items" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add some items')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        icon={MockIcon}
        title="Empty"
        description="No data"
        action={{ label: 'Add item', onClick }}
      />,
    );
    const button = screen.getByText('Add item');
    expect(button).toBeInTheDocument();
    button.click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe('Skeleton compositions', () => {
  it('CardSkeleton renders with animate-pulse children', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3);
  });

  it('TableRowSkeleton renders correct number of columns', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRowSkeleton cols={4} />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll('td').length).toBe(4);
  });

  it('PageSkeleton renders header, cards, and content area', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(8);
  });

  it('DetailSkeleton renders avatar and field rows', () => {
    const { container } = render(<DetailSkeleton />);
    const roundedFull = container.querySelectorAll('.rounded-full');
    expect(roundedFull.length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(10);
  });

  it('FormSkeleton renders configurable number of rows', () => {
    const { container } = render(<FormSkeleton rows={3} />);
    const inputs = container.querySelectorAll('.rounded-xl');
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it('ListSkeleton renders rows with avatars', () => {
    const { container } = render(<ListSkeleton rows={4} />);
    expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThanOrEqual(4);
  });

  it('InboxSkeleton renders conversation list and message area', () => {
    const { container } = render(<InboxSkeleton />);
    expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThanOrEqual(5);
    expect(container.querySelectorAll('.rounded-2xl').length).toBeGreaterThanOrEqual(1);
  });

  it('CalendarSkeleton renders time grid with header', () => {
    const { container } = render(<CalendarSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(10);
  });
});
