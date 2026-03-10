import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Mail: ({ size, className }: any) => (
    <div data-testid="mail-icon" data-size={size} className={className} />
  ),
  Loader2: ({ size, className }: any) => (
    <div data-testid="loader-icon" data-size={size} className={className} />
  ),
  ArrowRight: ({ size }: any) => <div data-testid="arrow-icon" data-size={size} />,
}));

import PortalPage from './page';

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('PortalPage', () => {
  it('renders the portal landing page with heading and inputs', () => {
    render(<PortalPage />);

    expect(screen.getByText('Client Portal')).toBeInTheDocument();
    expect(screen.getByText('View and manage your appointments')).toBeInTheDocument();
    expect(screen.getByTestId('portal-code-input')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('send-link-btn')).toBeInTheDocument();
  });

  it('disables submit button when fields are empty', () => {
    render(<PortalPage />);

    const btn = screen.getByTestId('send-link-btn');
    expect(btn).toBeDisabled();
  });

  it('enables submit button when both fields are filled', () => {
    render(<PortalPage />);

    fireEvent.change(screen.getByTestId('portal-code-input'), {
      target: { value: 'glow-clinic' },
    });
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });

    expect(screen.getByTestId('send-link-btn')).not.toBeDisabled();
  });

  it('sends magic link request and shows confirmation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Magic link sent' }),
    });

    render(<PortalPage />);

    fireEvent.change(screen.getByTestId('portal-code-input'), {
      target: { value: 'glow-clinic' },
    });
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByTestId('send-link-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('sent-confirmation')).toBeInTheDocument();
    });

    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/portal/auth/magic-link'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ slug: 'glow-clinic', email: 'test@example.com' }),
      }),
    );
  });

  it('shows error message on failed request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Customer not found' }),
    });

    render(<PortalPage />);

    fireEvent.change(screen.getByTestId('portal-code-input'), {
      target: { value: 'bad-slug' },
    });
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'nobody@example.com' },
    });
    fireEvent.click(screen.getByTestId('send-link-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.getByText('Customer not found')).toBeInTheDocument();
  });

  it('shows error message on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<PortalPage />);

    fireEvent.change(screen.getByTestId('portal-code-input'), {
      target: { value: 'glow-clinic' },
    });
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByTestId('send-link-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('allows trying again after confirmation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Sent' }),
    });

    render(<PortalPage />);

    fireEvent.change(screen.getByTestId('portal-code-input'), {
      target: { value: 'glow-clinic' },
    });
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByTestId('send-link-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('sent-confirmation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('try-again-btn'));

    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect((screen.getByTestId('email-input') as HTMLInputElement).value).toBe('');
  });

  it('normalizes portal code to lowercase', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Sent' }),
    });

    render(<PortalPage />);

    fireEvent.change(screen.getByTestId('portal-code-input'), {
      target: { value: ' Glow-Clinic ' },
    });
    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByTestId('send-link-btn'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.slug).toBe('glow-clinic');
  });

  it('shows the Booking OS branding footer', () => {
    render(<PortalPage />);
    expect(screen.getByText('Booking OS')).toBeInTheDocument();
  });
});
