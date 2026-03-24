import { render, screen } from '@testing-library/react';
import { resetMocks } from '@/__tests__/test-helpers';
import MarketingPage from './page';

beforeEach(() => resetMocks());

describe('MarketingPage', () => {
  it('renders page content immediately (static page)', () => {
    render(<MarketingPage />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('renders all section links', () => {
    render(<MarketingPage />);
    expect(screen.getByText('Content Queue')).toBeInTheDocument();
    expect(screen.getByText('Marketing Agents')).toBeInTheDocument();
    expect(screen.getByText('Email Sequences')).toBeInTheDocument();
    expect(screen.getByText('Rejection Analytics')).toBeInTheDocument();
  });
});
