import { render, screen } from '@testing-library/react';
import Home from './page';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));

jest.mock('./landing-page', () => {
  return function MockLandingPage() {
    return (
      <div>
        <h1>Turn missed clinic messages into booked appointments.</h1>
        <section id="features">
          <h2>Built around the moments clinics lose revenue.</h2>
        </section>
        <section id="pricing">
          <h2>Pricing is confirmed during onboarding.</h2>
        </section>
        <a href="/pilot">Apply for Pilot</a>
      </div>
    );
  };
});

describe('Home (marketing page)', () => {
  it('renders the landing page with hero', () => {
    render(<Home />);
    expect(
      screen.getByText('Turn missed clinic messages into booked appointments.'),
    ).toBeInTheDocument();
  });

  it('renders features section', () => {
    render(<Home />);
    expect(screen.getByText('Built around the moments clinics lose revenue.')).toBeInTheDocument();
  });

  it('renders pricing section', () => {
    render(<Home />);
    expect(screen.getByText('Pricing is confirmed during onboarding.')).toBeInTheDocument();
  });

  it('renders CTA link to /pilot', () => {
    render(<Home />);
    const ctaLink = screen.getByText('Apply for Pilot');
    expect(ctaLink).toHaveAttribute('href', '/pilot');
  });

  it('includes JSON-LD structured data', () => {
    const { container } = render(<Home />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.name).toBe('Business Command Centre');
  });
});
