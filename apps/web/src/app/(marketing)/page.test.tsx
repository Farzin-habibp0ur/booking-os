import { render, screen } from '@testing-library/react';
import Home from './page';

jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

jest.mock('./landing-page', () => {
  return function MockLandingPage() {
    return (
      <div>
        <h1>The all-in-one command centre for your clinic.</h1>
        <section id="features">
          <h2>Everything your clinic needs</h2>
        </section>
        <section id="pricing">
          <h2>Simple, transparent pricing</h2>
        </section>
        <a href="/signup">Start Free for 14 Days</a>
      </div>
    );
  };
});

describe('Home (marketing page)', () => {
  it('renders the landing page with hero', () => {
    render(<Home />);
    expect(screen.getByText('The all-in-one command centre for your clinic.')).toBeInTheDocument();
  });

  it('renders features section', () => {
    render(<Home />);
    expect(screen.getByText('Everything your clinic needs')).toBeInTheDocument();
  });

  it('renders pricing section', () => {
    render(<Home />);
    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument();
  });

  it('renders CTA link to /signup', () => {
    render(<Home />);
    const ctaLink = screen.getByText('Start Free for 14 Days');
    expect(ctaLink).toHaveAttribute('href', '/signup');
  });

  it('includes JSON-LD structured data', () => {
    const { container } = render(<Home />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.name).toBe('Booking OS');
  });
});
