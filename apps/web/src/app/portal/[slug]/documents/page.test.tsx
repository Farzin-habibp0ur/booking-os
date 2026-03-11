const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ slug: 'test-clinic' }),
}));

jest.mock('@/components/skeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortalDocumentsPage from './page';

const mockDocumentsData = {
  intake: {
    submittedAt: '2026-02-15T10:00:00Z',
    fullName: 'Jane Patient',
    dateOfBirth: '1990-05-20',
    emergencyContactName: 'John Patient',
    emergencyContactPhone: '555-0199',
    medicalConditions: 'Asthma',
    medications: 'Albuterol',
  },
  bookingNotes: [
    {
      id: 'note-1',
      date: '2026-03-01T14:00:00Z',
      service: 'Deep Tissue Massage',
      staff: 'Dr. Smith',
      notes: 'Patient responded well to treatment. Recommend follow-up in 2 weeks.',
    },
    {
      id: 'note-2',
      date: '2026-02-15T10:00:00Z',
      service: 'Consultation',
      staff: null,
      notes: 'Initial assessment completed.',
    },
  ],
};

describe('PortalDocumentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.setItem('portal-token', 'test-token');

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(mockDocumentsData),
    });
  });

  afterEach(() => {
    sessionStorage.removeItem('portal-token');
  });

  // -------------------------------------------------------------------------
  // Auth redirect
  // -------------------------------------------------------------------------

  it('redirects to portal login when no token in sessionStorage', () => {
    sessionStorage.removeItem('portal-token');
    render(<PortalDocumentsPage />);
    expect(mockReplace).toHaveBeenCalledWith('/portal/test-clinic');
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows skeleton while loading', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
    render(<PortalDocumentsPage />);
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Page title and headings
  // -------------------------------------------------------------------------

  it('renders the page title and section headings', async () => {
    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('My Documents')).toBeInTheDocument();
    });
    expect(screen.getByText('Intake Form')).toBeInTheDocument();
    expect(screen.getByText('Visit Notes')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Intake form data display
  // -------------------------------------------------------------------------

  it('displays intake form data when present', async () => {
    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Jane Patient')).toBeInTheDocument();
    });

    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Date of Birth')).toBeInTheDocument();
    expect(screen.getByText('1990-05-20')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact')).toBeInTheDocument();
    expect(screen.getByText('John Patient · 555-0199')).toBeInTheDocument();
    expect(screen.getByText('Medical Conditions')).toBeInTheDocument();
    expect(screen.getByText('Asthma')).toBeInTheDocument();
    expect(screen.getByText('Current Medications')).toBeInTheDocument();
    expect(screen.getByText('Albuterol')).toBeInTheDocument();
  });

  it('displays intake form submission date', async () => {
    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Jane Patient')).toBeInTheDocument();
    });

    // The date is formatted with toLocaleDateString
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Empty intake state
  // -------------------------------------------------------------------------

  it('shows empty intake state with CTA button when no intake data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          intake: null,
          bookingNotes: [],
        }),
    });

    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No intake form on file')).toBeInTheDocument();
    });

    const ctaButton = screen.getByText('Complete Intake Form');
    expect(ctaButton).toBeInTheDocument();

    fireEvent.click(ctaButton);
    expect(mockPush).toHaveBeenCalledWith('/portal/test-clinic/intake');
  });

  // -------------------------------------------------------------------------
  // Booking notes display
  // -------------------------------------------------------------------------

  it('displays booking notes with service and staff info', async () => {
    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(
      screen.getByText('Patient responded well to treatment. Recommend follow-up in 2 weeks.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Consultation')).toBeInTheDocument();
    expect(screen.getByText('Initial assessment completed.')).toBeInTheDocument();
  });

  it('renders notes without staff name when staff is null', async () => {
    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Consultation')).toBeInTheDocument();
    });

    // note-2 has staff: null, so "Dr. Smith" appears only once (from note-1)
    const staffLabels = screen.getAllByText('Dr. Smith');
    expect(staffLabels).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Empty notes state
  // -------------------------------------------------------------------------

  it('shows empty notes state when no booking notes exist', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          intake: mockDocumentsData.intake,
          bookingNotes: [],
        }),
    });

    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No visit notes yet')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Notes from completed appointments will appear here'),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Both sections empty
  // -------------------------------------------------------------------------

  it('shows both empty states when no intake and no notes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          intake: null,
          bookingNotes: [],
        }),
    });

    render(<PortalDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No intake form on file')).toBeInTheDocument();
      expect(screen.getByText('No visit notes yet')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Fetch error handling
  // -------------------------------------------------------------------------

  it('handles fetch error gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: () => Promise.reject(new Error('Server Error')),
    });

    render(<PortalDocumentsPage />);

    // Should finish loading even on error (the catch block handles it)
    await waitFor(() => {
      expect(screen.queryByTestId('page-skeleton')).not.toBeInTheDocument();
    });
  });
});
