import { render, screen, fireEvent } from '@testing-library/react';
import { TestimonialCard, type Testimonial } from './testimonial-card';

jest.mock('lucide-react', () => {
  const stub = (name: string) => {
    const C = (props: any) => <svg data-testid={`icon-${name}`} {...props} />;
    C.displayName = name;
    return C;
  };
  return new Proxy({}, { get: (_t, prop: string) => stub(prop) });
});

const baseTestimonial: Testimonial = {
  id: 't1',
  name: 'Alice Smith',
  role: 'CEO',
  company: 'Acme Corp',
  content: 'This was an excellent experience and I would highly recommend it to everyone!',
  rating: 5,
  status: 'APPROVED',
  avatarUrl: null,
  createdAt: '2026-01-15T10:00:00Z',
};

describe('TestimonialCard', () => {
  it('renders name and content', () => {
    render(<TestimonialCard testimonial={baseTestimonial} />);

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByTestId('testimonial-content')).toHaveTextContent(
      'This was an excellent experience',
    );
  });

  it('renders role and company', () => {
    render(<TestimonialCard testimonial={baseTestimonial} />);

    expect(screen.getByText('CEO at Acme Corp')).toBeInTheDocument();
  });

  it('renders star rating', () => {
    render(<TestimonialCard testimonial={baseTestimonial} />);

    expect(screen.getByTestId('testimonial-rating')).toBeInTheDocument();
  });

  it('truncates long content', () => {
    const long = { ...baseTestimonial, content: 'A'.repeat(200) };
    render(<TestimonialCard testimonial={long} />);

    expect(screen.getByTestId('testimonial-content').textContent).toContain('...');
  });

  it('shows action buttons when showActions=true', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    const onFeature = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    // APPROVED status — should NOT show approve button but show reject, feature, edit, delete
    render(
      <TestimonialCard
        testimonial={baseTestimonial}
        onApprove={onApprove}
        onReject={onReject}
        onFeature={onFeature}
        onEdit={onEdit}
        onDelete={onDelete}
        showActions
      />,
    );

    expect(screen.queryByTestId('btn-approve')).not.toBeInTheDocument(); // Already approved
    expect(screen.getByTestId('btn-reject')).toBeInTheDocument();
    expect(screen.getByTestId('btn-feature')).toBeInTheDocument();
    expect(screen.getByTestId('btn-edit')).toBeInTheDocument();
    expect(screen.getByTestId('btn-delete')).toBeInTheDocument();
  });

  it('hides action buttons when showActions=false', () => {
    render(
      <TestimonialCard testimonial={baseTestimonial} onApprove={jest.fn()} showActions={false} />,
    );

    expect(screen.queryByTestId('btn-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-reject')).not.toBeInTheDocument();
  });

  it('shows approve button for PENDING status', () => {
    const pending = { ...baseTestimonial, status: 'PENDING' };
    render(<TestimonialCard testimonial={pending} onApprove={jest.fn()} showActions />);

    expect(screen.getByTestId('btn-approve')).toBeInTheDocument();
  });

  it('calls onApprove when approve button is clicked', () => {
    const onApprove = jest.fn();
    const pending = { ...baseTestimonial, status: 'PENDING' };
    render(<TestimonialCard testimonial={pending} onApprove={onApprove} showActions />);

    fireEvent.click(screen.getByTestId('btn-approve'));
    expect(onApprove).toHaveBeenCalledWith('t1');
  });

  it('calls onReject when reject button is clicked', () => {
    const onReject = jest.fn();
    render(<TestimonialCard testimonial={baseTestimonial} onReject={onReject} showActions />);

    fireEvent.click(screen.getByTestId('btn-reject'));
    expect(onReject).toHaveBeenCalledWith('t1');
  });

  it('shows featured styling for FEATURED status', () => {
    const featured = { ...baseTestimonial, status: 'FEATURED' };
    render(<TestimonialCard testimonial={featured} showActions />);

    const card = screen.getByTestId('testimonial-card-t1');
    expect(card.className).toContain('border-lavender-200');
  });

  it('does not render rating when null', () => {
    const noRating = { ...baseTestimonial, rating: null };
    render(<TestimonialCard testimonial={noRating} />);

    expect(screen.queryByTestId('testimonial-rating')).not.toBeInTheDocument();
  });
});
