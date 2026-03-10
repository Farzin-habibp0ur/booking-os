jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => ({
  ArrowUpDown: (p: any) => <span data-testid="arrow-updown" {...p} />,
  ArrowDown: (p: any) => <span data-testid="arrow-down" {...p} />,
  ArrowUp: (p: any) => <span data-testid="arrow-up" {...p} />,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { SortableHeader } from './sortable-header';

describe('SortableHeader', () => {
  const onSort = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  test('renders unsorted state with ArrowUpDown icon', () => {
    render(
      <SortableHeader
        label="Name"
        column="name"
        currentSort={null}
        currentOrder="desc"
        onSort={onSort}
      />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByTestId('arrow-updown')).toBeInTheDocument();
  });

  test('renders desc sort with ArrowDown icon', () => {
    render(
      <SortableHeader
        label="Name"
        column="name"
        currentSort="name"
        currentOrder="desc"
        onSort={onSort}
      />,
    );
    expect(screen.getByTestId('arrow-down')).toBeInTheDocument();
  });

  test('renders asc sort with ArrowUp icon', () => {
    render(
      <SortableHeader
        label="Name"
        column="name"
        currentSort="name"
        currentOrder="asc"
        onSort={onSort}
      />,
    );
    expect(screen.getByTestId('arrow-up')).toBeInTheDocument();
  });

  test('calls onSort with column when clicked', () => {
    render(
      <SortableHeader
        label="Name"
        column="name"
        currentSort={null}
        currentOrder="desc"
        onSort={onSort}
      />,
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  test('shows unsorted icon for non-active column', () => {
    render(
      <SortableHeader
        label="Email"
        column="email"
        currentSort="name"
        currentOrder="desc"
        onSort={onSort}
      />,
    );
    expect(screen.getByTestId('arrow-updown')).toBeInTheDocument();
  });
});
