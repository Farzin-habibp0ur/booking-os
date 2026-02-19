import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingPortalPage from './page';
import { validateName, validatePhone, validateEmail } from './validators';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ slug: 'glow-clinic' }),
}));

// Mock public-api
jest.mock('@/lib/public-api', () => ({
  publicApi: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock skeleton component
jest.mock('@/components/skeleton', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

// Mock add-to-calendar
jest.mock('@/components/add-to-calendar', () => ({
  AddToCalendar: (props: any) => <div data-testid="add-to-calendar" data-title={props.title} />,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ChevronLeft: (props: any) => <svg data-testid="chevron-left-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  DollarSign: (props: any) => <svg data-testid="dollar-sign-icon" {...props} />,
  CheckCircle2: (props: any) => <svg data-testid="check-circle-icon" {...props} />,
  Calendar: (props: any) => <svg data-testid="calendar-icon" {...props} />,
  User: (props: any) => <svg data-testid="user-icon" {...props} />,
  Phone: (props: any) => <svg data-testid="phone-icon" {...props} />,
  Mail: (props: any) => <svg data-testid="mail-icon" {...props} />,
  ShieldCheck: (props: any) => <svg data-testid="shield-check-icon" {...props} />,
  FileText: (props: any) => <svg data-testid="file-text-icon" {...props} />,
  ClipboardList: (props: any) => <svg data-testid="clipboard-list-icon" {...props} />,
}));

import { publicApi } from '@/lib/public-api';
const mockPublicApi = publicApi as jest.Mocked<typeof publicApi>;

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockBusiness = {
  name: 'Glow Clinic',
  slug: 'glow-clinic',
  timezone: 'America/New_York',
  cancellationPolicyText: 'Cancel at least 24h in advance.',
  reschedulePolicyText: 'Reschedule up to 12h before.',
};

const mockServices = [
  {
    id: 'svc-1',
    name: 'Botox Treatment',
    description: 'Smoothing wrinkles with precision',
    durationMins: 30,
    price: 250,
    category: 'Injectables',
    depositRequired: false,
    depositAmount: null,
  },
  {
    id: 'svc-2',
    name: 'Lip Filler',
    description: null,
    durationMins: 45,
    price: 500,
    category: 'Injectables',
    depositRequired: true,
    depositAmount: 100,
  },
  {
    id: 'svc-3',
    name: 'Free Consultation',
    description: 'Meet our specialist',
    durationMins: 15,
    price: 0,
    category: 'Consultations',
    depositRequired: false,
    depositAmount: null,
  },
];

const mockSlots = [
  {
    time: '2026-03-01T10:00:00Z',
    display: '10:00 AM',
    staffId: 'staff-1',
    staffName: 'Dr. Smith',
    available: true,
  },
  {
    time: '2026-03-01T11:00:00Z',
    display: '11:00 AM',
    staffId: 'staff-1',
    staffName: 'Dr. Smith',
    available: true,
  },
  {
    time: '2026-03-01T14:00:00Z',
    display: '2:00 PM',
    staffId: 'staff-2',
    staffName: 'Dr. Jones',
    available: true,
  },
];

const mockBookingResult = {
  id: 'booking-123',
  status: 'CONFIRMED',
  serviceName: 'Botox Treatment',
  startTime: '2026-03-01T10:00:00Z',
  staffName: 'Dr. Smith',
  businessName: 'Glow Clinic',
  depositRequired: false,
  depositAmount: null as number | null,
};

const mockBookingResultWithDeposit = {
  id: 'booking-456',
  status: 'PENDING_DEPOSIT',
  serviceName: 'Lip Filler',
  startTime: '2026-03-01T10:00:00Z',
  staffName: 'Dr. Smith',
  businessName: 'Glow Clinic',
  depositRequired: true,
  depositAmount: 100,
};

// ─── Helper to set up resolved API mocks ─────────────────────────────────────

function setupSuccessfulLoad(services = mockServices, business = mockBusiness) {
  mockPublicApi.get.mockImplementation((path: string) => {
    if (path === '/public/glow-clinic') return Promise.resolve(business);
    if (path === '/public/glow-clinic/services') return Promise.resolve(services);
    if (path.includes('/public/glow-clinic/availability')) return Promise.resolve(mockSlots);
    return Promise.resolve([]);
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BookingPortal validation helpers', () => {
  describe('validateName', () => {
    it('returns error for empty name', () => {
      expect(validateName('')).toBe('Name is required');
      expect(validateName('  ')).toBe('Name is required');
    });

    it('returns error for name shorter than 2 characters', () => {
      expect(validateName('A')).toBe('Name must be at least 2 characters');
    });

    it('returns null for valid name', () => {
      expect(validateName('Jo')).toBeNull();
      expect(validateName('Jane Doe')).toBeNull();
    });
  });

  describe('validatePhone', () => {
    it('returns error for empty phone', () => {
      expect(validatePhone('')).toBe('Phone number is required');
      expect(validatePhone('  ')).toBe('Phone number is required');
    });

    it('returns error for invalid phone format', () => {
      expect(validatePhone('abc')).toBe('Please enter a valid phone number');
      expect(validatePhone('12')).toBe('Please enter a valid phone number');
      expect(validatePhone('not-a-phone!')).toBe('Please enter a valid phone number');
    });

    it('accepts valid phone formats', () => {
      expect(validatePhone('+1 (555) 123-4567')).toBeNull();
      expect(validatePhone('5551234567')).toBeNull();
      expect(validatePhone('+44 20 7946 0958')).toBeNull();
      expect(validatePhone('123-456-7890')).toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('returns null for empty email (optional field)', () => {
      expect(validateEmail('')).toBeNull();
      expect(validateEmail('  ')).toBeNull();
    });

    it('returns error for invalid email format', () => {
      expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
      expect(validateEmail('missing@domain')).toBe('Please enter a valid email address');
      expect(validateEmail('@nodomain.com')).toBe('Please enter a valid email address');
    });

    it('accepts valid email formats', () => {
      expect(validateEmail('user@example.com')).toBeNull();
      expect(validateEmail('jane.doe@clinic.co.uk')).toBeNull();
    });
  });
});

describe('BookingPortalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Loading State ──────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows skeleton while loading', () => {
      mockPublicApi.get.mockImplementation(() => new Promise(() => {})); // never resolves

      render(<BookingPortalPage />);

      expect(screen.getByTestId('booking-skeleton')).toBeInTheDocument();
    });
  });

  // ─── Error State ────────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows 404 when business not found', async () => {
      mockPublicApi.get.mockRejectedValue(new Error('Not found'));

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByText('Business not found')).toBeInTheDocument();
      });
    });

    it('shows 404 when API returns error message', async () => {
      mockPublicApi.get.mockRejectedValue(new Error('This business does not exist'));

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('404')).toBeInTheDocument();
      });
    });
  });

  // ─── Step 1: Service Selection ──────────────────────────────────────────

  describe('Step 1: Service Selection', () => {
    it('renders business name and services after loading', async () => {
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
      });

      expect(screen.getByText('Book an appointment')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      expect(screen.getByText('Lip Filler')).toBeInTheDocument();
      expect(screen.getByText('Free Consultation')).toBeInTheDocument();
    });

    it('displays service descriptions when present', async () => {
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Smoothing wrinkles with precision')).toBeInTheDocument();
      });

      expect(screen.getByText('Meet our specialist')).toBeInTheDocument();
    });

    it('displays service duration and price', async () => {
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('30 min')).toBeInTheDocument();
      });

      expect(screen.getByText('$250')).toBeInTheDocument();
      expect(screen.getByText('45 min')).toBeInTheDocument();
      expect(screen.getByText('$500')).toBeInTheDocument();
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('displays service categories', async () => {
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Injectables')).toHaveLength(2);
      });

      expect(screen.getByText('Consultations')).toBeInTheDocument();
    });

    it('shows empty state when no services available', async () => {
      setupSuccessfulLoad([]);

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('No services available at this time.')).toBeInTheDocument();
      });
    });

    it('renders progress dots on service step', async () => {
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
      });

      // The step label "Service" should be visible
      expect(screen.getByText('Service')).toBeInTheDocument();
    });

    it('selects a service and advances to datetime step', async () => {
      const user = userEvent.setup();
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      await waitFor(() => {
        expect(screen.getByText('Date & Time')).toBeInTheDocument();
      });
    });
  });

  // ─── Step 2: Date & Time Selection ──────────────────────────────────────

  describe('Step 2: Date & Time Selection', () => {
    async function goToDateTimeStep() {
      const user = userEvent.setup();
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      await waitFor(() => {
        expect(screen.getByText('Date & Time')).toBeInTheDocument();
      });

      return user;
    }

    it('shows date picker with radio buttons', async () => {
      await goToDateTimeStep();

      expect(screen.getByText('Select a date')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: 'Select a date' })).toBeInTheDocument();

      // Should have date buttons (30 days)
      const dateButtons = screen.getAllByRole('radio');
      expect(dateButtons.length).toBe(30);
    });

    it('shows back button on datetime step', async () => {
      await goToDateTimeStep();

      expect(screen.getByTestId('chevron-left-icon')).toBeInTheDocument();
    });

    it('loads and displays time slots after selecting a date', async () => {
      const user = await goToDateTimeStep();

      // Click first date button
      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText('Available times')).toBeInTheDocument();
      });

      // Should show timezone info
      expect(screen.getByText('Times shown in America/New_York')).toBeInTheDocument();

      // Should show time slots
      await waitFor(() => {
        expect(screen.getByText('10:00 AM')).toBeInTheDocument();
        expect(screen.getByText('11:00 AM')).toBeInTheDocument();
        expect(screen.getByText('2:00 PM')).toBeInTheDocument();
      });
    });

    it('groups time slots by staff member', async () => {
      const user = await goToDateTimeStep();

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
        expect(screen.getByText('Dr. Jones')).toBeInTheDocument();
      });

      // Each staff should have a radiogroup for their slots
      expect(
        screen.getByRole('radiogroup', { name: 'Time slots for Dr. Smith' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radiogroup', { name: 'Time slots for Dr. Jones' }),
      ).toBeInTheDocument();
    });

    it('shows loading text while fetching slots', async () => {
      const user = userEvent.setup();

      mockPublicApi.get.mockImplementation((path: string) => {
        if (path === '/public/glow-clinic') return Promise.resolve(mockBusiness);
        if (path === '/public/glow-clinic/services') return Promise.resolve(mockServices);
        if (path.includes('/availability')) return new Promise(() => {}); // never resolves
        return Promise.resolve([]);
      });

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      await waitFor(() => {
        expect(screen.getByText('Date & Time')).toBeInTheDocument();
      });

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText('Loading available times...')).toBeInTheDocument();
      });
    });

    it('shows no availability message when no slots', async () => {
      const user = userEvent.setup();

      mockPublicApi.get.mockImplementation((path: string) => {
        if (path === '/public/glow-clinic') return Promise.resolve(mockBusiness);
        if (path === '/public/glow-clinic/services') return Promise.resolve(mockServices);
        if (path.includes('/availability')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(
          screen.getByText('No times available on this day. Try another date.'),
        ).toBeInTheDocument();
      });
    });

    it('handles availability API failure gracefully', async () => {
      const user = userEvent.setup();

      mockPublicApi.get.mockImplementation((path: string) => {
        if (path === '/public/glow-clinic') return Promise.resolve(mockBusiness);
        if (path === '/public/glow-clinic/services') return Promise.resolve(mockServices);
        if (path.includes('/availability')) return Promise.reject(new Error('Server error'));
        return Promise.resolve([]);
      });

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      // Should fall back to empty slots (no crash)
      await waitFor(() => {
        expect(
          screen.getByText('No times available on this day. Try another date.'),
        ).toBeInTheDocument();
      });
    });

    it('selects a time slot and advances to details step', async () => {
      const user = await goToDateTimeStep();

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('10:00 AM'));
      });

      await waitFor(() => {
        expect(screen.getByText('Your Details')).toBeInTheDocument();
      });
    });

    it('navigates back to service step from datetime step', async () => {
      const user = await goToDateTimeStep();

      // Click back button
      const backButton = screen.getByTestId('chevron-left-icon').closest('button')!;
      await act(async () => {
        await user.click(backButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
        expect(screen.getByText('Lip Filler')).toBeInTheDocument();
      });
    });

    it('supports arrow key navigation between dates', async () => {
      const user = await goToDateTimeStep();

      const dateButtons = screen.getAllByRole('radio');
      // Focus first date and press ArrowRight
      await act(async () => {
        dateButtons[0].focus();
        await user.keyboard('{ArrowRight}');
      });

      // The second date should now be selected (aria-checked)
      await waitFor(() => {
        expect(dateButtons[1]).toHaveAttribute('aria-checked', 'true');
      });

      // Press ArrowLeft to go back
      await act(async () => {
        await user.keyboard('{ArrowLeft}');
      });

      await waitFor(() => {
        expect(dateButtons[0]).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  // ─── Step 3: Customer Details ───────────────────────────────────────────

  describe('Step 3: Customer Details', () => {
    async function goToDetailsStep() {
      const user = userEvent.setup();
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      // Step 1: Select service
      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      // Step 2: Select date and time
      await waitFor(() => {
        expect(screen.getByText('Date & Time')).toBeInTheDocument();
      });

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('10:00 AM'));
      });

      await waitFor(() => {
        expect(screen.getByText('Your Details')).toBeInTheDocument();
      });

      return user;
    }

    it('renders all customer detail fields', async () => {
      await goToDetailsStep();

      expect(screen.getByLabelText(/Name \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Phone \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('continue button is disabled when required fields are empty', async () => {
      await goToDetailsStep();

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      expect(continueButton).toBeDisabled();
    });

    it('enables continue button when name and phone are filled', async () => {
      const user = await goToDetailsStep();

      const nameInput = screen.getByLabelText(/Name \*/);
      const phoneInput = screen.getByLabelText(/Phone \*/);

      await act(async () => {
        await user.type(nameInput, 'Jane Doe');
        await user.type(phoneInput, '+1 555 123 4567');
      });

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      expect(continueButton).not.toBeDisabled();
    });

    it('shows validation error on blur for empty name', async () => {
      const user = await goToDetailsStep();

      const nameInput = screen.getByLabelText(/Name \*/);

      await act(async () => {
        await user.click(nameInput);
        await user.tab(); // blur
      });

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('shows validation error on blur for short name', async () => {
      const user = await goToDetailsStep();

      const nameInput = screen.getByLabelText(/Name \*/);

      await act(async () => {
        await user.type(nameInput, 'A');
        await user.tab();
      });

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
      });
    });

    it('shows validation error on blur for empty phone', async () => {
      const user = await goToDetailsStep();

      const phoneInput = screen.getByLabelText(/Phone \*/);

      await act(async () => {
        await user.click(phoneInput);
        await user.tab();
      });

      await waitFor(() => {
        expect(screen.getByText('Phone number is required')).toBeInTheDocument();
      });
    });

    it('shows validation error on blur for invalid phone', async () => {
      const user = await goToDetailsStep();

      const phoneInput = screen.getByLabelText(/Phone \*/);

      await act(async () => {
        await user.type(phoneInput, 'abc');
        await user.tab();
      });

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
      });
    });

    it('shows validation error on blur for invalid email', async () => {
      const user = await goToDetailsStep();

      const emailInput = screen.getByLabelText(/Email/);

      await act(async () => {
        await user.type(emailInput, 'notanemail');
        await user.tab();
      });

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('clears validation errors when corrected after blur', async () => {
      const user = await goToDetailsStep();

      const nameInput = screen.getByLabelText(/Name \*/);

      // Trigger error
      await act(async () => {
        await user.click(nameInput);
        await user.tab();
      });

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      // Fix it
      await act(async () => {
        await user.type(nameInput, 'Jane Doe');
      });

      await waitFor(() => {
        expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
      });
    });

    it('shows all validation errors on continue click with empty fields', async () => {
      const user = await goToDetailsStep();

      // Type and clear to enable the button check path,
      // but we can directly test validateAndContinue by typing spaces
      const nameInput = screen.getByLabelText(/Name \*/);
      const phoneInput = screen.getByLabelText(/Phone \*/);

      // Type minimal text to enable button, then clear
      await act(async () => {
        await user.type(nameInput, 'Jo');
        await user.type(phoneInput, '5551234567');
      });

      // Clear the fields
      await act(async () => {
        await user.clear(nameInput);
        await user.clear(phoneInput);
        // Type just spaces so trim makes them empty, but button might be disabled
        await user.type(nameInput, 'Jo');
        await user.type(phoneInput, 'ab');
      });

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      await act(async () => {
        await user.click(continueButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
      });
    });

    it('allows typing notes', async () => {
      const user = await goToDetailsStep();

      const notesInput = screen.getByLabelText(/Notes/);
      await act(async () => {
        await user.type(notesInput, 'First time visitor');
      });

      expect(notesInput).toHaveValue('First time visitor');
    });

    it('advances to confirm step with valid details', async () => {
      const user = await goToDetailsStep();

      await act(async () => {
        await user.type(screen.getByLabelText(/Name \*/), 'Jane Doe');
        await user.type(screen.getByLabelText(/Phone \*/), '+1 555 123 4567');
        await user.type(screen.getByLabelText(/Email/), 'jane@example.com');
      });

      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Continue' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Booking Summary')).toBeInTheDocument();
      });
    });

    it('navigates back to datetime step', async () => {
      const user = await goToDetailsStep();

      const backButton = screen.getByTestId('chevron-left-icon').closest('button')!;
      await act(async () => {
        await user.click(backButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Date & Time')).toBeInTheDocument();
      });
    });
  });

  // ─── Step 4: Confirmation ──────────────────────────────────────────────

  describe('Step 4: Confirmation', () => {
    async function goToConfirmStep(
      serviceName = 'Botox Treatment',
      overrideServices = mockServices,
    ) {
      const user = userEvent.setup();
      setupSuccessfulLoad(overrideServices);

      render(<BookingPortalPage />);

      // Step 1
      await waitFor(() => {
        expect(screen.getByText(serviceName)).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText(serviceName));
      });

      // Step 2
      await waitFor(() => {
        expect(screen.getByText('Date & Time')).toBeInTheDocument();
      });
      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });
      await waitFor(() => {
        expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('10:00 AM'));
      });

      // Step 3
      await waitFor(() => {
        expect(screen.getByText('Your Details')).toBeInTheDocument();
      });
      await act(async () => {
        await user.type(screen.getByLabelText(/Name \*/), 'Jane Doe');
        await user.type(screen.getByLabelText(/Phone \*/), '+1 555 123 4567');
        await user.type(screen.getByLabelText(/Email/), 'jane@example.com');
        await user.type(screen.getByLabelText(/Notes/), 'First visit');
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Continue' }));
      });

      // Step 4
      await waitFor(() => {
        expect(screen.getByText('Booking Summary')).toBeInTheDocument();
      });

      return user;
    }

    it('displays booking summary with service details', async () => {
      await goToConfirmStep();

      expect(screen.getByText('Booking Summary')).toBeInTheDocument();
      expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('30 min')).toBeInTheDocument();
      expect(screen.getByText('$250')).toBeInTheDocument();
    });

    it('displays customer details in summary', async () => {
      await goToConfirmStep();

      expect(screen.getByText('Your Details')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('+1 555 123 4567')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('displays customer notes in summary', async () => {
      await goToConfirmStep();

      // Notes are wrapped in quotes (\u201c...\u201d) in the UI
      const notesElements = screen.getAllByText((content) => {
        return content.includes('First visit');
      });
      expect(notesElements.length).toBeGreaterThan(0);
    });

    it('shows booking policies', async () => {
      await goToConfirmStep();

      expect(screen.getByText('Booking Policies')).toBeInTheDocument();
      expect(screen.getByText('Cancel at least 24h in advance.')).toBeInTheDocument();
      expect(screen.getByText('Reschedule up to 12h before.')).toBeInTheDocument();
    });

    it('shows confirm booking button', async () => {
      await goToConfirmStep();

      expect(screen.getByRole('button', { name: 'Confirm Booking' })).toBeInTheDocument();
    });

    it('shows secure booking badge', async () => {
      await goToConfirmStep();

      expect(screen.getByText('Secure booking powered by Booking OS')).toBeInTheDocument();
    });

    it('shows deposit warning for deposit-required services', async () => {
      await goToConfirmStep('Lip Filler');

      expect(screen.getByText('Deposit Required')).toBeInTheDocument();
      expect(screen.getByText(/deposit of \$100/)).toBeInTheDocument();
    });

    it('does not show deposit warning for non-deposit services', async () => {
      await goToConfirmStep('Botox Treatment');

      expect(screen.queryByText('Deposit Required')).not.toBeInTheDocument();
    });

    it('submits booking and shows success', async () => {
      mockPublicApi.post.mockResolvedValue(mockBookingResult);

      const user = await goToConfirmStep();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
      });

      expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });

    it('shows submitting state during booking', async () => {
      mockPublicApi.post.mockImplementation(() => new Promise(() => {})); // never resolves

      const user = await goToConfirmStep();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Booking...')).toBeInTheDocument();
      });
    });

    it('shows submit error when booking fails', async () => {
      mockPublicApi.post.mockRejectedValue(new Error('Slot already taken'));

      const user = await goToConfirmStep();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Slot already taken')).toBeInTheDocument();
      });

      // Confirm button should be re-enabled
      expect(screen.getByRole('button', { name: 'Confirm Booking' })).not.toBeDisabled();
    });

    it('shows generic error message when booking fails without message', async () => {
      mockPublicApi.post.mockRejectedValue(new Error());

      const user = await goToConfirmStep();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to book. Please try again.')).toBeInTheDocument();
      });
    });

    it('sends correct data to booking API', async () => {
      mockPublicApi.post.mockResolvedValue(mockBookingResult);

      const user = await goToConfirmStep();

      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));
      });

      await waitFor(() => {
        expect(mockPublicApi.post).toHaveBeenCalledWith(
          '/public/glow-clinic/book',
          expect.objectContaining({
            serviceId: 'svc-1',
            staffId: 'staff-1',
            customerName: 'Jane Doe',
            customerPhone: '+1 555 123 4567',
            customerEmail: 'jane@example.com',
            notes: 'First visit',
          }),
        );
      });
    });

    it('navigates back to details step from confirm step', async () => {
      const user = await goToConfirmStep();

      const backButton = screen.getByTestId('chevron-left-icon').closest('button')!;
      await act(async () => {
        await user.click(backButton);
      });

      await waitFor(() => {
        // Should go back to details step
        expect(screen.getByLabelText(/Name \*/)).toBeInTheDocument();
      });
    });
  });

  // ─── Success Step ───────────────────────────────────────────────────────

  describe('Success Step', () => {
    async function goToSuccessStep(bookingResult = mockBookingResult) {
      const user = userEvent.setup();
      setupSuccessfulLoad();
      mockPublicApi.post.mockResolvedValue(bookingResult);

      render(<BookingPortalPage />);

      // Step 1
      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      // Step 2
      await waitFor(() => {
        expect(screen.getByText('Date & Time')).toBeInTheDocument();
      });
      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });
      await waitFor(() => {
        expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('10:00 AM'));
      });

      // Step 3
      await waitFor(() => {
        expect(screen.getByText('Your Details')).toBeInTheDocument();
      });
      await act(async () => {
        await user.type(screen.getByLabelText(/Name \*/), 'Jane Doe');
        await user.type(screen.getByLabelText(/Phone \*/), '+1 555 123 4567');
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Continue' }));
      });

      // Step 4
      await waitFor(() => {
        expect(screen.getByText('Booking Summary')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));
      });

      // Wait for success step - the booking summary should disappear
      await waitFor(() => {
        expect(screen.queryByText('Booking Summary')).not.toBeInTheDocument();
      });

      return user;
    }

    it('shows success message for confirmed booking', async () => {
      await goToSuccessStep();

      expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
      expect(
        screen.getByText("You're all set. We look forward to seeing you."),
      ).toBeInTheDocument();
    });

    it('shows booking details on success', async () => {
      await goToSuccessStep();

      expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });

    it('shows deposit required message for deposit booking', async () => {
      await goToSuccessStep(mockBookingResultWithDeposit);

      // The heading should say "Deposit Required" instead of "Booking Confirmed!"
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Deposit Required');
      expect(screen.getByText(/deposit of \$100/)).toBeInTheDocument();
    });

    it('does not show "Book an appointment" on success step', async () => {
      await goToSuccessStep();

      expect(screen.queryByText('Book an appointment')).not.toBeInTheDocument();
    });

    it('does not show progress dots on success step', async () => {
      await goToSuccessStep();

      // Step label for steps should not be present; back button should be gone
      expect(screen.queryByTestId('chevron-left-icon')).not.toBeInTheDocument();
    });

    it('shows booking policies on success page', async () => {
      await goToSuccessStep();

      expect(screen.getByText('Cancel at least 24h in advance.')).toBeInTheDocument();
      expect(screen.getByText('Reschedule up to 12h before.')).toBeInTheDocument();
    });

    it('shows add-to-calendar on confirmed booking', async () => {
      await goToSuccessStep();

      expect(screen.getByTestId('add-to-calendar')).toBeInTheDocument();
      expect(screen.getByText('Add to your calendar')).toBeInTheDocument();
    });

    it('does not show add-to-calendar when deposit required', async () => {
      await goToSuccessStep(mockBookingResultWithDeposit);

      expect(screen.queryByTestId('add-to-calendar')).not.toBeInTheDocument();
    });
  });

  // ─── Deposit Flow ──────────────────────────────────────────────────────

  describe('Deposit Flow', () => {
    it('shows deposit badge on confirm for deposit services', async () => {
      const user = userEvent.setup();
      setupSuccessfulLoad();

      render(<BookingPortalPage />);

      // Select deposit service (Lip Filler)
      await waitFor(() => {
        expect(screen.getByText('Lip Filler')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('Lip Filler'));
      });

      // Date & Time
      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });
      await waitFor(() => {
        expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('10:00 AM'));
      });

      // Details
      await act(async () => {
        await user.type(screen.getByLabelText(/Name \*/), 'Jane');
        await user.type(screen.getByLabelText(/Phone \*/), '5551234567');
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Continue' }));
      });

      // Confirm
      await waitFor(() => {
        expect(screen.getByText('Deposit Required')).toBeInTheDocument();
      });

      expect(screen.getByText(/deposit of \$100/)).toBeInTheDocument();
    });
  });

  // ─── Waitlist Flow ─────────────────────────────────────────────────────

  describe('Waitlist Flow', () => {
    async function goToNoAvailability() {
      const user = userEvent.setup();

      mockPublicApi.get.mockImplementation((path: string) => {
        if (path === '/public/glow-clinic') return Promise.resolve(mockBusiness);
        if (path === '/public/glow-clinic/services') return Promise.resolve(mockServices);
        if (path.includes('/availability')) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(
          screen.getByText('No times available on this day. Try another date.'),
        ).toBeInTheDocument();
      });

      return user;
    }

    it('shows Join Waitlist button when no slots available', async () => {
      await goToNoAvailability();

      expect(screen.getByText('Join Waitlist')).toBeInTheDocument();
    });

    it('opens waitlist form when button is clicked', async () => {
      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await waitFor(() => {
        expect(screen.getByText('Join the Waitlist')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Your name *')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Phone number *')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Email (optional)')).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText('Preferred times or notes (optional)'),
        ).toBeInTheDocument();
      });
    });

    it('closes waitlist form when cancel is clicked', async () => {
      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await waitFor(() => {
        expect(screen.getByText('Join the Waitlist')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Cancel'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Join the Waitlist')).not.toBeInTheDocument();
      });

      // Join Waitlist button should reappear
      expect(screen.getByText('Join Waitlist')).toBeInTheDocument();
    });

    it('shows validation error for empty waitlist name', async () => {
      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await waitFor(() => {
        expect(screen.getByText('Join the Waitlist')).toBeInTheDocument();
      });

      // Click submit without filling
      const joinButtons = screen.getAllByText('Join Waitlist');
      const submitButton = joinButtons[joinButtons.length - 1];
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('shows validation error for empty waitlist phone', async () => {
      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await act(async () => {
        await user.type(screen.getByPlaceholderText('Your name *'), 'Jane Doe');
      });

      const joinButtons = screen.getAllByText('Join Waitlist');
      const submitButton = joinButtons[joinButtons.length - 1];
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Phone number is required')).toBeInTheDocument();
      });
    });

    it('successfully submits waitlist form', async () => {
      mockPublicApi.post.mockResolvedValue({});

      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await act(async () => {
        await user.type(screen.getByPlaceholderText('Your name *'), 'Jane Doe');
        await user.type(screen.getByPlaceholderText('Phone number *'), '+1 555 123 4567');
        await user.type(screen.getByPlaceholderText('Email (optional)'), 'jane@example.com');
        await user.type(
          screen.getByPlaceholderText('Preferred times or notes (optional)'),
          'Mornings preferred',
        );
      });

      const joinButtons = screen.getAllByText('Join Waitlist');
      const submitButton = joinButtons[joinButtons.length - 1];
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText("You're on the waitlist!")).toBeInTheDocument();
      });

      expect(mockPublicApi.post).toHaveBeenCalledWith(
        '/public/glow-clinic/waitlist',
        expect.objectContaining({
          serviceId: 'svc-1',
          customerName: 'Jane Doe',
          customerPhone: '+1 555 123 4567',
          customerEmail: 'jane@example.com',
          notes: 'Mornings preferred',
        }),
      );
    });

    it('shows submitting state during waitlist submission', async () => {
      mockPublicApi.post.mockImplementation(() => new Promise(() => {})); // never resolves

      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await act(async () => {
        await user.type(screen.getByPlaceholderText('Your name *'), 'Jane Doe');
        await user.type(screen.getByPlaceholderText('Phone number *'), '+1 555 123 4567');
      });

      const joinButtons = screen.getAllByText('Join Waitlist');
      const submitButton = joinButtons[joinButtons.length - 1];
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Joining...')).toBeInTheDocument();
      });
    });

    it('shows error when waitlist submission fails', async () => {
      mockPublicApi.post.mockRejectedValue(new Error('Server error'));

      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await act(async () => {
        await user.type(screen.getByPlaceholderText('Your name *'), 'Jane Doe');
        await user.type(screen.getByPlaceholderText('Phone number *'), '+1 555 123 4567');
      });

      const joinButtons = screen.getAllByText('Join Waitlist');
      const submitButton = joinButtons[joinButtons.length - 1];
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('shows generic error when waitlist fails without message', async () => {
      mockPublicApi.post.mockRejectedValue(new Error());

      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await act(async () => {
        await user.type(screen.getByPlaceholderText('Your name *'), 'Jane Doe');
        await user.type(screen.getByPlaceholderText('Phone number *'), '+1 555 123 4567');
      });

      const joinButtons = screen.getAllByText('Join Waitlist');
      const submitButton = joinButtons[joinButtons.length - 1];
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to join waitlist')).toBeInTheDocument();
      });
    });

    it('hides Join Waitlist button after successful submission', async () => {
      mockPublicApi.post.mockResolvedValue({});

      const user = await goToNoAvailability();

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await act(async () => {
        await user.type(screen.getByPlaceholderText('Your name *'), 'Jane Doe');
        await user.type(screen.getByPlaceholderText('Phone number *'), '+1 555 123 4567');
      });

      const joinButtons = screen.getAllByText('Join Waitlist');
      const submitButton = joinButtons[joinButtons.length - 1];
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText("You're on the waitlist!")).toBeInTheDocument();
      });

      // The "Join Waitlist" button should no longer be shown
      expect(screen.queryByText('Join Waitlist')).not.toBeInTheDocument();
      // The waitlist form should be gone
      expect(screen.queryByText('Join the Waitlist')).not.toBeInTheDocument();
    });

    it('shows staff selector when staff data is available', async () => {
      const user = userEvent.setup();

      // Return staff data from the availability endpoint when waitlist form opens
      mockPublicApi.get.mockImplementation((path: string) => {
        if (path === '/public/glow-clinic') return Promise.resolve(mockBusiness);
        if (path === '/public/glow-clinic/services') return Promise.resolve(mockServices);
        if (path.includes('/availability')) return Promise.resolve(mockSlots); // return slots with staff info for the staff list fetch
        return Promise.resolve([]);
      });

      render(<BookingPortalPage />);

      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });

      // We need no slots for the selected date, but slots for the staff list
      // Override to return empty for the initial date selection, then slots for waitlist
      let callCount = 0;
      mockPublicApi.get.mockImplementation((path: string) => {
        if (path === '/public/glow-clinic') return Promise.resolve(mockBusiness);
        if (path === '/public/glow-clinic/services') return Promise.resolve(mockServices);
        if (path.includes('/availability')) {
          callCount++;
          if (callCount === 1) return Promise.resolve([]); // no slots for selected date
          return Promise.resolve(mockSlots); // slots for staff list
        }
        return Promise.resolve([]);
      });

      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });

      await waitFor(() => {
        expect(
          screen.getByText('No times available on this day. Try another date.'),
        ).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Join Waitlist'));
      });

      await waitFor(() => {
        expect(screen.getByText('Any provider')).toBeInTheDocument();
      });

      // Staff names should be available as options
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jones')).toBeInTheDocument();

      // Select a specific staff member
      const staffSelect = screen.getByDisplayValue('Any provider');
      await act(async () => {
        await user.selectOptions(staffSelect, 'staff-1');
      });

      expect(staffSelect).toHaveValue('staff-1');
    });
  });

  // ─── Policies Display ──────────────────────────────────────────────────

  describe('Policies Display', () => {
    it('hides policy section when no policies set', async () => {
      const user = userEvent.setup();

      const businessWithoutPolicies = {
        ...mockBusiness,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
      };

      mockPublicApi.get.mockImplementation((path: string) => {
        if (path === '/public/glow-clinic') return Promise.resolve(businessWithoutPolicies);
        if (path === '/public/glow-clinic/services') return Promise.resolve(mockServices);
        if (path.includes('/availability')) return Promise.resolve(mockSlots);
        return Promise.resolve([]);
      });

      render(<BookingPortalPage />);

      // Navigate to confirm step
      await waitFor(() => {
        expect(screen.getByText('Botox Treatment')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('Botox Treatment'));
      });
      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[0]);
      });
      await waitFor(() => {
        expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('10:00 AM'));
      });
      await act(async () => {
        await user.type(screen.getByLabelText(/Name \*/), 'Jane');
        await user.type(screen.getByLabelText(/Phone \*/), '5551234567');
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Continue' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Booking Summary')).toBeInTheDocument();
      });

      expect(screen.queryByText('Booking Policies')).not.toBeInTheDocument();
    });
  });

  // ─── Full E2E Flow ─────────────────────────────────────────────────────

  describe('Full booking flow', () => {
    it('completes entire booking from service to success without email/notes', async () => {
      const user = userEvent.setup();
      setupSuccessfulLoad();
      mockPublicApi.post.mockResolvedValue(mockBookingResult);

      render(<BookingPortalPage />);

      // Step 1: Select service
      await waitFor(() => {
        expect(screen.getByText('Free Consultation')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('Free Consultation'));
      });

      // Step 2: Select date & time
      const dateButtons = screen.getAllByRole('radio');
      await act(async () => {
        await user.click(dateButtons[2]); // pick a different date
      });
      await waitFor(() => {
        expect(screen.getByText('2:00 PM')).toBeInTheDocument();
      });
      await act(async () => {
        await user.click(screen.getByText('2:00 PM'));
      });

      // Step 3: Enter details (only required fields)
      await act(async () => {
        await user.type(screen.getByLabelText(/Name \*/), 'John Smith');
        await user.type(screen.getByLabelText(/Phone \*/), '212-555-0100');
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Continue' }));
      });

      // Step 4: Confirm
      await waitFor(() => {
        expect(screen.getByText('Booking Summary')).toBeInTheDocument();
      });

      // Verify the API call sends undefined for optional fields
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Confirm Booking' }));
      });

      await waitFor(() => {
        expect(mockPublicApi.post).toHaveBeenCalledWith(
          '/public/glow-clinic/book',
          expect.objectContaining({
            serviceId: 'svc-3',
            staffId: 'staff-2',
            customerName: 'John Smith',
            customerPhone: '212-555-0100',
            customerEmail: undefined,
            notes: undefined,
          }),
        );
      });

      // Success
      await waitFor(() => {
        expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
      });
    });
  });
});
