const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ slug: 'test-clinic' }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PortalBookPage from './page';

const mockServices = [
  {
    id: 'svc-1',
    name: 'Deep Tissue Massage',
    description: 'A relaxing deep tissue massage',
    durationMins: 60,
    price: 120,
    category: 'Massage',
    depositRequired: false,
    depositAmount: null,
  },
  {
    id: 'svc-2',
    name: 'Facial Treatment',
    description: null,
    durationMins: 45,
    price: 85,
    category: 'Skincare',
    depositRequired: true,
    depositAmount: 25,
  },
  {
    id: 'svc-3',
    name: 'Consultation',
    description: 'Initial consultation',
    durationMins: 30,
    price: 50,
    category: 'Massage',
    depositRequired: false,
    depositAmount: null,
  },
];

const mockSlots = [
  {
    time: '2027-01-16T09:00:00Z',
    display: '9:00 AM',
    staffId: 'staff-1',
    staffName: 'Dr. Smith',
    available: true,
  },
  {
    time: '2027-01-16T10:00:00Z',
    display: '10:00 AM',
    staffId: 'staff-1',
    staffName: 'Dr. Smith',
    available: true,
  },
  {
    time: '2027-01-16T11:00:00Z',
    display: '11:00 AM',
    staffId: 'staff-2',
    staffName: 'Jane Doe',
    available: true,
  },
];

describe('PortalBookPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.setItem('portal-token', 'test-token');

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/portal/services')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockServices),
        });
      }
      if (url.includes('/availability')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockSlots),
        });
      }
      if (url.includes('/portal/bookings')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve({ id: 'booking-1' }),
        });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve({}),
      });
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
    render(<PortalBookPage />);
    expect(mockReplace).toHaveBeenCalledWith('/portal/test-clinic');
  });

  // -------------------------------------------------------------------------
  // Step 1: Service selection
  // -------------------------------------------------------------------------

  it('renders the page title and step indicator', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Book an Appointment')).toBeInTheDocument();
    });
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Date & Time')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('shows loading spinner while fetching services', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves
    render(<PortalBookPage />);
    // The Loader2 icon renders an SVG with animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays services grouped by category', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Massage')).toBeInTheDocument();
      expect(screen.getByText('Skincare')).toBeInTheDocument();
    });

    expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    expect(screen.getByText('A relaxing deep tissue massage')).toBeInTheDocument();
    expect(screen.getByText('60 min')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();

    expect(screen.getByText('Facial Treatment')).toBeInTheDocument();
    expect(screen.getByText('$85.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00 deposit')).toBeInTheDocument();

    expect(screen.getByText('Consultation')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Step 2: Date & time selection
  // -------------------------------------------------------------------------

  it('advances to datetime step when a service is clicked', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    // Should now see the selected service summary + date controls
    await waitFor(() => {
      expect(screen.getByText('Change service')).toBeInTheDocument();
      expect(screen.getByText('60 min · $120.00')).toBeInTheDocument();
    });
  });

  it('loads and displays time slots for the selected date', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('11:00 AM')).toBeInTheDocument();
    });

    // Staff names should be visible
    const smithLabels = screen.getAllByText('Dr. Smith');
    expect(smithLabels.length).toBeGreaterThan(0);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows "No available slots" when slots are empty', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/portal/services')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockServices),
        });
      }
      if (url.includes('/availability')) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({}) });
    });

    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(
        screen.getByText('No available slots for this date. Try another day.'),
      ).toBeInTheDocument();
    });
  });

  it('allows navigating back to service selection', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('Change service')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Change service'));

    // Should be back at service list
    await waitFor(() => {
      expect(screen.getByText('Massage')).toBeInTheDocument();
      expect(screen.getByText('Skincare')).toBeInTheDocument();
    });
  });

  it('shows Continue button only after selecting a time slot', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    });

    // Continue button should NOT be visible before selecting a slot
    expect(screen.queryByText('Continue')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('9:00 AM'));

    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Step 3: Confirm & book
  // -------------------------------------------------------------------------

  it('advances to confirm step and shows booking summary', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    // Select service
    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    });

    // Select time slot
    fireEvent.click(screen.getByText('9:00 AM'));

    // Click Continue
    fireEvent.click(screen.getByText('Continue'));

    // Confirm step should show summary
    await waitFor(() => {
      expect(screen.getByText('Booking Summary')).toBeInTheDocument();
    });
    expect(screen.getByText('Change time')).toBeInTheDocument();
    expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
    expect(screen.getByText('60 min')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('shows notes textarea on confirm step', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Booking Summary')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Any special requests or information...');
    expect(textarea).toBeInTheDocument();
  });

  it('submits booking and shows success state', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm Booking'));

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
    });

    // Verify the POST was made with correct data
    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      (call: any[]) => call[1]?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall[1].body);
    expect(body.serviceId).toBe('svc-1');
    expect(body.staffId).toBe('staff-1');
    expect(body.startTime).toBe('2027-01-16T09:00:00Z');
  });

  it('shows success state with Back to Dashboard button', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm Booking'));

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
    });

    const dashboardBtn = screen.getByText('Back to Dashboard');
    fireEvent.click(dashboardBtn);
    expect(mockPush).toHaveBeenCalledWith('/portal/test-clinic/dashboard');
  });

  it('shows error message when booking submission fails', async () => {
    // Override fetch for the booking POST to fail
    const originalFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'POST' && url.includes('/portal/bookings')) {
        return Promise.resolve({
          status: 400,
          ok: false,
          json: () => Promise.resolve({ message: 'Time slot no longer available' }),
        });
      }
      return originalFetch(url, opts);
    });

    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Booking')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm Booking'));

    await waitFor(() => {
      expect(screen.getByText('Time slot no longer available')).toBeInTheDocument();
    });
  });

  it('allows navigating back from confirm to datetime step', async () => {
    render(<PortalBookPage />);

    await waitFor(() => {
      expect(screen.getByText('Deep Tissue Massage')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Deep Tissue Massage'));

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('9:00 AM'));
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Change time')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Change time'));

    // Should be back at date/time selection
    await waitFor(() => {
      expect(screen.getByText('Change service')).toBeInTheDocument();
    });
  });
});
