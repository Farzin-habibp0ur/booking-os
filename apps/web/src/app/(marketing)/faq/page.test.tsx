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
    expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();
  });

  it('renders category headers', () => {
    render(<FaqPage />);
    expect(screen.getByText('Pilot')).toBeInTheDocument();
    expect(screen.getByText('AI Front Desk')).toBeInTheDocument();
    expect(screen.getByText('Trust')).toBeInTheDocument();
  });

  it('renders FAQ questions', () => {
    render(<FaqPage />);
    expect(screen.getByText('What is Business Command Centre?')).toBeInTheDocument();
    expect(screen.getByText('How is pricing handled?')).toBeInTheDocument();
    expect(screen.getByText('Is this medical software?')).toBeInTheDocument();
  });

  it('expands FAQ answer on click', () => {
    render(<FaqPage />);
    const question = screen.getByText('What is Business Command Centre?');
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
