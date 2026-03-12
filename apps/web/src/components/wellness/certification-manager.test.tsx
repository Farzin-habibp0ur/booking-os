import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CertificationManager from './certification-manager';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apiFetch } = require('@/lib/api');

describe('CertificationManager', () => {
  const defaultProps = {
    staffId: 'staff-1',
    staffName: 'Sarah Chen',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCerts = [
    {
      id: 'cert-1',
      name: 'RMT',
      issuedBy: 'College of MT',
      issuedDate: '2023-06-01',
      expiryDate: '2027-06-01',
      documentUrl: null,
      isVerified: true,
    },
    {
      id: 'cert-2',
      name: 'Yoga 200hr',
      issuedBy: null,
      issuedDate: null,
      expiryDate: null,
      documentUrl: null,
      isVerified: false,
    },
  ];

  it('renders manager with staff name', async () => {
    apiFetch.mockResolvedValue(mockCerts);
    render(<CertificationManager {...defaultProps} />);
    expect(screen.getByText(/Sarah Chen/)).toBeInTheDocument();
  });

  it('loads and displays certifications', async () => {
    apiFetch.mockResolvedValue(mockCerts);
    render(<CertificationManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('RMT')).toBeInTheDocument();
      expect(screen.getByText('Yoga 200hr')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    apiFetch.mockResolvedValue([]);
    render(<CertificationManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No certifications yet')).toBeInTheDocument();
    });
  });

  it('opens add form on click', async () => {
    apiFetch.mockResolvedValue([]);
    render(<CertificationManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No certifications yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByTestId('cert-form')).toBeInTheDocument();
  });

  it('shows verified badge', async () => {
    apiFetch.mockResolvedValue(mockCerts);
    render(<CertificationManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  it('shows issuer name', async () => {
    apiFetch.mockResolvedValue(mockCerts);
    render(<CertificationManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('College of MT')).toBeInTheDocument();
    });
  });
});
