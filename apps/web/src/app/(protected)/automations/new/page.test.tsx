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
    expect(screen.getByText('Booking Created')).toBeInTheDocument();
    expect(screen.getByText('Booking Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Status Changed')).toBeInTheDocument();
    expect(screen.getByText('Booking Cancelled')).toBeInTheDocument();
    expect(screen.getByText('No Response')).toBeInTheDocument();
  });

  it('shows example scenario when trigger is selected', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Booking Created'));

    expect(screen.getByTestId('trigger-example')).toBeInTheDocument();
    expect(screen.getByText(/Hydra Facial/)).toBeInTheDocument();
  });

  it('shows safety bar on trigger step', () => {
    render(<NewAutomationPage />);

    expect(screen.getByTestId('safety-bar')).toBeInTheDocument();
    expect(screen.getByText(/quiet hours/)).toBeInTheDocument();
  });

  it('advances to filter step and shows filter preview', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Booking Created'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByTestId('filter-preview')).toBeInTheDocument();
    expect(screen.getByText(/matches all events/)).toBeInTheDocument();
  });

  it('shows filter preview for BOOKING_UPCOMING with hoursBefore', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Booking Upcoming'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByTestId('filter-preview')).toBeInTheDocument();
    // Default state has no hoursBefore filter set, so shows "matches all"
    expect(screen.getByText(/matches all events/)).toBeInTheDocument();
  });

  it('shows action preview on action step', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Booking Created'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    // Default action is SEND_TEMPLATE
    expect(screen.getByTestId('action-preview')).toBeInTheDocument();
    expect(screen.getByText(/template message/)).toBeInTheDocument();
  });

  it('shows plain-language summary on review step', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Booking Created'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByTestId('plain-language-summary')).toBeInTheDocument();
    expect(screen.getByText(/In plain language/)).toBeInTheDocument();
    // Summary contains the trigger name within the plain language text
    const summary = screen.getByTestId('plain-language-summary');
    expect(summary.textContent).toContain('Booking Created');
  });

  it('navigates back to automations when Back to Automations is clicked', () => {
    render(<NewAutomationPage />);

    fireEvent.click(screen.getByText('Back to Automations'));

    expect(mockPush).toHaveBeenCalledWith('/automations');
  });

  it('creates rule on submit', async () => {
    mockApi.post.mockResolvedValue({});
    render(<NewAutomationPage />);

    // Step 0: Select trigger
    fireEvent.click(screen.getByText('Booking Created'));
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
