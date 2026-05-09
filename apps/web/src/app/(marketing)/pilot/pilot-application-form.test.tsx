import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PilotApplicationForm from './pilot-application-form';

describe('PilotApplicationForm', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accepted: true }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('renders the year-2 waitlist banner', () => {
    render(<PilotApplicationForm />);
    expect(screen.getByText(/piloting with medical spas only/i)).toBeInTheDocument();
    expect(screen.getByText(/Year 2 access/i)).toBeInTheDocument();
  });

  it('renders all seven practice type radio options', () => {
    render(<PilotApplicationForm />);
    expect(screen.getByLabelText('Medical spa')).toBeInTheDocument();
    expect(screen.getByLabelText('Dermatology')).toBeInTheDocument();
    expect(screen.getByLabelText('Plastic surgery')).toBeInTheDocument();
    expect(screen.getByLabelText('Hair restoration')).toBeInTheDocument();
    expect(screen.getByLabelText('IV / wellness')).toBeInTheDocument();
    expect(screen.getByLabelText('Cosmetic dentistry')).toBeInTheDocument();
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  it('marks practiceType as required', () => {
    render(<PilotApplicationForm />);
    const medSpa = screen.getByLabelText('Medical spa') as HTMLInputElement;
    expect(medSpa.required).toBe(true);
    expect(medSpa.type).toBe('radio');
    expect(medSpa.name).toBe('practiceType');
  });

  it('submits practiceType in the POST body', async () => {
    render(<PilotApplicationForm />);

    fireEvent.change(screen.getByLabelText('Clinic name'), {
      target: { value: 'Glow Clinic' },
    });
    fireEvent.change(screen.getByLabelText('Owner/contact name'), {
      target: { value: 'Sarah Owner' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'sarah@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Biggest front desk pain'), {
      target: { value: 'Instagram leads missed after hours.' },
    });
    fireEvent.click(screen.getByLabelText('Medical spa'));
    fireEvent.click(screen.getByLabelText(/agree to be contacted/i));

    fireEvent.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const fetchMock = global.fetch as jest.Mock;
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.practiceType).toBe('MED_SPA');
    expect(body.clinicName).toBe('Glow Clinic');
    expect(body.email).toBe('sarah@example.com');
  });
});
