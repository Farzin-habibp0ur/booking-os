jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('lucide-react', () => ({
  Sparkles: (p: any) => <span data-testid="icon-sparkles" {...p} />,
  CheckCircle: (p: any) => <span data-testid="icon-check" {...p} />,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, val: string) => {
      store[key] = val;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AISetupWizard } from './ai-setup-wizard';
import { api } from '@/lib/api';

const mockApi = api as jest.Mocked<typeof api>;

describe('AISetupWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders the wizard with data-testid', () => {
    render(<AISetupWizard />);
    expect(screen.getByTestId('ai-setup-wizard')).toBeInTheDocument();
  });

  it('shows step 1 content on initial render', () => {
    render(<AISetupWizard />);
    expect(screen.getByRole('heading', { name: 'Enable AI' })).toBeInTheDocument();
  });

  it('navigates to next step when Next is clicked', () => {
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByRole('heading', { name: 'Set your voice' })).toBeInTheDocument();
  });

  it('navigates back when Back is clicked', () => {
    render(<AISetupWizard />);
    fireEvent.click(screen.getByTestId('next-button'));
    expect(screen.getByRole('heading', { name: 'Set your voice' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('back-button'));
    expect(screen.getByRole('heading', { name: 'Enable AI' })).toBeInTheDocument();
  });

  it('skip button sets localStorage and calls onComplete', () => {
    const onComplete = jest.fn();
    render(<AISetupWizard onComplete={onComplete} />);
    fireEvent.click(screen.getByTestId('skip-button'));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('bookingos:ai-setup-dismissed', 'true');
    expect(onComplete).toHaveBeenCalled();
  });

  it('calls PATCH /ai/settings with correct data on completion', async () => {
    mockApi.patch.mockResolvedValue({});
    const onComplete = jest.fn();
    render(<AISetupWizard onComplete={onComplete} />);

    // Navigate to step 2 (personality)
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.change(screen.getByTestId('personality-input'), {
      target: { value: 'friendly and professional' },
    });

    // Navigate to step 3 (channels)
    fireEvent.click(screen.getByTestId('next-button'));

    // Complete
    fireEvent.click(screen.getByTestId('complete-button'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/ai/settings',
        expect.objectContaining({ enabled: true }),
      );
    });
  });

  it('sets localStorage on completion', async () => {
    mockApi.patch.mockResolvedValue({});
    render(<AISetupWizard />);

    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('complete-button'));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('bookingos:ai-setup-dismissed', 'true');
    });
  });

  it('shows success state after completion', async () => {
    mockApi.patch.mockResolvedValue({});
    render(<AISetupWizard />);

    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('next-button'));
    fireEvent.click(screen.getByTestId('complete-button'));

    await waitFor(() => {
      expect(screen.getByText('AI is ready!')).toBeInTheDocument();
    });
  });
});
