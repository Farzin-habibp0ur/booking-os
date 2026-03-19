import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

// Mock cn
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock API — use var for hoisting compatibility with jest.mock
var mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
};

jest.mock('@/lib/api', () => ({
  api: mockApi,
}));

import EmailChannelSettingsPage from './page';

describe('EmailChannelSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/business') {
        return Promise.resolve({
          channelSettings: {
            email: {
              provider: 'resend',
              apiKey: 'test-key',
              fromAddress: 'support@example.com',
              fromName: 'Test Clinic',
              replyToAddress: '',
              signature: '',
            },
          },
        });
      }
      if (url === '/locations') {
        return Promise.resolve([
          {
            id: 'loc1',
            name: 'Main Location',
            emailConfig: {
              inboundAddress: 'inbox@example.com',
              enabled: true,
            },
          },
          {
            id: 'loc2',
            name: 'Branch Office',
            emailConfig: null,
          },
        ]);
      }
      return Promise.resolve({});
    });
  });

  it('renders page title and description', async () => {
    render(<EmailChannelSettingsPage />);

    expect(screen.getByText('emailChannel.title')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.description')).toBeInTheDocument();
  });

  it('renders all sections', async () => {
    render(<EmailChannelSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('provider-config-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('location-config-section')).toBeInTheDocument();
    expect(screen.getByTestId('dns-config-section')).toBeInTheDocument();
    expect(screen.getByTestId('signature-section')).toBeInTheDocument();
    expect(screen.getByTestId('test-send-section')).toBeInTheDocument();
  });

  it('shows provider dropdown with Resend and SendGrid options', async () => {
    render(<EmailChannelSettingsPage />);

    await waitFor(() => {
      const select = screen.getByTestId('provider-select') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
    });

    const select = screen.getByTestId('provider-select') as HTMLSelectElement;
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('emailChannel.provider_resend');
    expect(options[1]).toHaveTextContent('emailChannel.provider_sendgrid');
  });

  it('shows DNS config info card with steps', async () => {
    render(<EmailChannelSettingsPage />);

    expect(screen.getByText('emailChannel.dns_config')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.dns_step1')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.dns_step2')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.dns_step3')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.dns_step4')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.dns_spf')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.dns_dkim')).toBeInTheDocument();
    expect(screen.getByText('emailChannel.dns_dmarc')).toBeInTheDocument();
  });

  it('shows location list with email config', async () => {
    render(<EmailChannelSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Location')).toBeInTheDocument();
    });

    expect(screen.getByText('Branch Office')).toBeInTheDocument();
  });

  it('shows no locations message when empty', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/business') return Promise.resolve({ channelSettings: {} });
      if (url === '/locations') return Promise.resolve([]);
      return Promise.resolve({});
    });

    render(<EmailChannelSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('no-locations')).toBeInTheDocument();
    });

    expect(screen.getByText('emailChannel.no_locations')).toBeInTheDocument();
  });

  it('renders test send form with required fields', async () => {
    render(<EmailChannelSettingsPage />);

    expect(screen.getByTestId('test-to-input')).toBeInTheDocument();
    expect(screen.getByTestId('test-subject-input')).toBeInTheDocument();
    expect(screen.getByTestId('test-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('test-send-button')).toBeInTheDocument();
  });

  it('save triggers API call with provider settings', async () => {
    mockApi.patch.mockResolvedValue({});

    render(<EmailChannelSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('save-provider-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('save-provider-button'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/business',
        expect.objectContaining({
          channelSettings: expect.objectContaining({
            email: expect.objectContaining({
              provider: 'resend',
            }),
          }),
        }),
      );
    });
  });

  it('renders signature editor with preview toggle', async () => {
    render(<EmailChannelSettingsPage />);

    expect(screen.getByTestId('signature-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('signature-preview-button')).toBeInTheDocument();

    // Preview is hidden by default
    expect(screen.queryByTestId('signature-preview')).not.toBeInTheDocument();

    // Type a signature
    fireEvent.change(screen.getByTestId('signature-textarea'), {
      target: { value: '<p>Best regards</p>' },
    });

    // Click preview
    fireEvent.click(screen.getByTestId('signature-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('signature-preview')).toBeInTheDocument();
    });
  });
});
