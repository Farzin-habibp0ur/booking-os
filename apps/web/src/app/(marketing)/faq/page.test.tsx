import { render, screen, fireEvent } from '@testing-library/react';
import FaqPage from './page';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

describe('FaqPage', () => {
  it('renders the FAQ heading', () => {
    render(<FaqPage />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
  });

  it('renders category headers', () => {
    render(<FaqPage />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders FAQ questions', () => {
    render(<FaqPage />);
    expect(screen.getByText('What is Booking OS?')).toBeInTheDocument();
    expect(screen.getByText('How much does Booking OS cost?')).toBeInTheDocument();
    expect(screen.getByText('Is my data secure?')).toBeInTheDocument();
  });

  it('expands FAQ answer on click', () => {
    render(<FaqPage />);
    const question = screen.getByText('What is Booking OS?');
    const button = question.closest('button')!;

    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('includes JSON-LD FAQPage schema', () => {
    const { container } = render(<FaqPage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity.length).toBeGreaterThan(0);
    expect(data.mainEntity[0]['@type']).toBe('Question');
  });
});
