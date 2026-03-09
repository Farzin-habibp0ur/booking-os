import { render, screen } from '@testing-library/react';

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

jest.mock('@/lib/blog', () => ({
  getAllPosts: () => [
    {
      slug: 'test-post-1',
      title: 'Test Post One',
      description: 'Description for post one',
      date: '2026-03-01',
      category: 'Industry Insights',
      author: 'Booking OS Team',
      readTime: '5 min read',
    },
    {
      slug: 'test-post-2',
      title: 'Test Post Two',
      description: 'Description for post two',
      date: '2026-02-15',
      category: 'Technical',
      author: 'Booking OS Team',
      readTime: '8 min read',
    },
  ],
}));

import BlogPage from './page';

describe('BlogPage', () => {
  it('renders the blog heading', () => {
    render(<BlogPage />);
    expect(screen.getByText('Insights & Resources')).toBeInTheDocument();
  });

  it('renders post cards', () => {
    render(<BlogPage />);
    expect(screen.getByText('Test Post One')).toBeInTheDocument();
    expect(screen.getByText('Test Post Two')).toBeInTheDocument();
  });

  it('renders category badges', () => {
    render(<BlogPage />);
    expect(screen.getByText('Industry Insights')).toBeInTheDocument();
    expect(screen.getByText('Technical')).toBeInTheDocument();
  });

  it('renders post descriptions', () => {
    render(<BlogPage />);
    expect(screen.getByText('Description for post one')).toBeInTheDocument();
    expect(screen.getByText('Description for post two')).toBeInTheDocument();
  });

  it('links to individual blog posts', () => {
    render(<BlogPage />);
    const link = screen.getByText('Test Post One').closest('a');
    expect(link).toHaveAttribute('href', '/blog/test-post-1');
  });
});
