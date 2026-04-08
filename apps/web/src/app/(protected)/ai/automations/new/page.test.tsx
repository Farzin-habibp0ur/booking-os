import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NewAutomationPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span>ArrowLeft</span>,
  ArrowRight: () => <span>ArrowRight</span>,
  Zap: () => <span>Zap</span>,
  Filter: () => <span>Filter</span>,
  Play: () => <span>Play</span>,
  CheckCircle: () => <span>CheckCircle</span>,
  ShieldCheck: () => <span>ShieldCheck</span>,
  Info: () => <span>Info</span>,
}));
jest.mock('@/lib/automation-labels', () => ({
  TRIGGER_CATEGORIES: [
    {
      name: 'Booking Events',
      triggers: ['BOOKING_CREATED', 'BOOKING_UPCOMING', 'STATUS_CHANGED', 'BOOKING_CANCELLED'],
    },
    { name: 'Customer Events', triggers: ['CUSTOMER_CREATED', 'TESTIMONIAL_SUBMITTED'] },
    { name: 'Payment Events', triggers: ['PAYMENT_RECEIVED'] },
    { name: 'Communication', triggers: ['MESSAGE_RECEIVED', 'NO_RESPONSE', 'CAMPAIGN_SENT'] },
    { name: 'Referral Events', triggers: ['REFERRAL_EARNED', 'REFERRAL_REDEEMED'] },
  ],
  TRIGGER_LABELS: {
    BOOKING_CREATED: { label: 'When a booking is created' },
    BOOKING_UPCOMING: { label: 'Before an upcoming booking' },
    STATUS_CHANGED: { label: 'When booking status changes' },
    BOOKING_CANCELLED: { label: 'When a booking is cancelled' },
    CUSTOMER_CREATED: { label: 'When a new customer is added' },
    PAYMENT_RECEIVED: { label: 'When a payment is received' },
    TESTIMONIAL_SUBMITTED: { label: 'When a testimonial is submitted' },
    CAMPAIGN_SENT: { label: 'When a campaign is sent' },
    REFERRAL_EARNED: { label: 'When a referral is earned' },
    REFERRAL_REDEEMED: { label: 'When a referral is redeemed' },
    MESSAGE_RECEIVED: { label: 'When a message is received' },
    NO_RESPONSE: { label: "When customer doesn't respond" },
  },
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

describe('NewAutomationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title', () => {
    render(<NewAutomationPage />);
    expect(screen.getByText('Create Automation Rule')).toBeInTheDocument();
  });

  it('renders step indicators', () => {
    render(<NewAutomationPage />);
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders all trigger options', () => {
    render(<NewAutomationPage />);
    expect(screen.getByText('When a booking is created')).toBeInTheDocument();
    expect(screen.getByText('Before an upcoming booking')).toBeInTheDocument();
    expect(screen.getByText('When booking status changes')).toBeInTheDocument();
    expect(screen.getByText('When a booking is cancelled')).toBeInTheDocument();
    expect(screen.getByText("When customer doesn't respond")).toBeInTheDocument();
    // New triggers should also be present
    expect(screen.getByText('When a new customer is added')).toBeInTheDocument();
    expect(screen.getByText('When a payment is received')).toBeInTheDocument();
  });

  it('shows example box when trigger is selected', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('When a booking is created'));

    expect(screen.getByTestId('trigger-example')).toBeInTheDocument();
  });

  it('shows safety bar on trigger step', () => {
    render(<NewAutomationPage />);

    expect(screen.getByTestId('safety-bar')).toBeInTheDocument();
    expect(screen.getByText(/quiet hours/)).toBeInTheDocument();
  });

  it('advances to filter step and shows filter preview', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('When a booking is created'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByTestId('filter-preview')).toBeInTheDocument();
    expect(screen.getByText(/matches all events/)).toBeInTheDocument();
  });

  it('shows filter preview for BOOKING_UPCOMING with hoursBefore', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Before an upcoming booking'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByTestId('filter-preview')).toBeInTheDocument();
    // Default state has no hoursBefore filter set, so shows "matches all"
    expect(screen.getByText(/matches all events/)).toBeInTheDocument();
  });

  it('shows action preview on action step', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('When a booking is created'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    // Default action is SEND_TEMPLATE
    expect(screen.getByTestId('action-preview')).toBeInTheDocument();
    expect(screen.getByText(/template message/)).toBeInTheDocument();
  });

  it('shows plain-language summary on review step', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('When a booking is created'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByTestId('plain-language-summary')).toBeInTheDocument();
    expect(screen.getByText(/In plain language/)).toBeInTheDocument();
    // Summary contains the trigger name within the plain language text
    const summary = screen.getByTestId('plain-language-summary');
    expect(summary.textContent).toContain('When a booking is created');
  });

  it('navigates back to automations when Back to Automations is clicked', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Back to Automations'));

    expect(mockPush).toHaveBeenCalledWith('/ai/automations');
  });

  it('creates rule on submit', async () => {
    mockApi.post.mockResolvedValue({});
    render(<NewAutomationPage />);

    // Step 0: Select trigger
    fireEvent.click(screen.getByText('When a booking is created'));
    fireEvent.click(screen.getByText('Next'));
    // Step 1: Filters (skip)
    fireEvent.click(screen.getByText('Next'));
    // Step 2: Actions (skip — default SEND_TEMPLATE)
    fireEvent.click(screen.getByText('Next'));
    // Step 3: Name
    fireEvent.change(screen.getByPlaceholderText(/Send confirmation/), {
      target: { value: 'My Rule' },
    });
    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/automations/rules',
        expect.objectContaining({
          name: 'My Rule',
          trigger: 'BOOKING_CREATED',
        }),
      );
    });
  });
});
