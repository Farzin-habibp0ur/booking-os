import { render, screen } from '@testing-library/react';
import { Skeleton, EmptyState } from './skeleton';

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
    render(
      <EmptyState icon={MockIcon} title="Nothing here" description="Add some items" />,
    );
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
