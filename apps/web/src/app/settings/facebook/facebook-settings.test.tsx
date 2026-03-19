import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacebookSettingsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/settings/facebook',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'facebook.title': 'Facebook Messenger',
        'facebook.description':
          'Connect Facebook Pages for Messenger conversations',
        'facebook.page_connection': 'Page Connection',
        'facebook.page_id': 'Facebook Page ID',
        'facebook.page_access_token': 'Page Access Token',
        'facebook.test_connection': 'Test Connection',
        'facebook.connection_success': 'Successfully connected to page',
        'facebook.connection_failed': 'Failed to connect — check credentials',
        'facebook.save': 'Save',
        'facebook.saved': 'Facebook settings saved',
        'facebook.save_failed': 'Failed to save Facebook settings',
        'facebook.location_config': 'Per-Location Pages',
        'facebook.location_page_id': 'Page ID',
        'facebook.location_access_token': 'Access Token',
        'facebook.location_enabled': 'Enabled',
        'facebook.location_saved': 'Location Facebook config saved',
        'facebook.location_save_failed': 'Failed to save location config',
        'facebook.ice_breakers': 'Ice Breakers',
        'facebook.ice_breakers_hint':
          'Suggested conversation starters shown when someone opens Messenger',
        'facebook.ice_breaker_question': 'Question',
        'facebook.ice_breaker_payload': 'Action',
        'facebook.add_ice_breaker': 'Add Ice Breaker',
        'facebook.ice_breakers_saved': 'Ice breakers saved',
        'facebook.ice_breakers_save_failed': 'Failed to save ice breakers',
        'facebook.max_ice_breakers': 'Maximum 4 ice breakers',
        'facebook.messaging_window_title': 'Messaging Windows',
        'facebook.messaging_window_info':
          'Facebook Messenger has a 24-hour messaging window.',
        'facebook.setup_step1':
          'Go to Meta Business Suite and get your Page Access Token',
        'facebook.setup_step2':
          "Copy your Page ID from the Page's About section",
        'facebook.setup_step3': 'Enter the credentials below',
        'facebook.no_locations':
          'No locations found. Create a location first.',
      };
      return translations[key] || key;
    },
  }),
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

function setupDefaultMocks(
  locations: any[] = [
    { id: 'loc1', name: 'Main Location', facebookConfig: null },
  ],
) {
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/business')
      return Promise.resolve({ channelSettings: {} });
    if (url === '/locations') return Promise.resolve(locations);
    return Promise.resolve({});
  });
}

describe('FacebookSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page title and description', async () => {
    setupDefaultMocks();

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Facebook Messenger')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        'Connect Facebook Pages for Messenger conversations',
      ),
    ).toBeInTheDocument();
  });

  it('shows Page Connection section with setup guidance', async () => {
    setupDefaultMocks();

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId('page-connection-section'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Page Connection')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Go to Meta Business Suite and get your Page Access Token',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('page-id-input')).toBeInTheDocument();
    expect(screen.getByTestId('page-access-token-input')).toBeInTheDocument();
  });

  it('shows Per-Location config section', async () => {
    setupDefaultMocks();

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId('location-config-section'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Per-Location Pages')).toBeInTheDocument();
    expect(screen.getByText('Main Location')).toBeInTheDocument();
  });

  it('shows Ice Breakers section', async () => {
    setupDefaultMocks();

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId('ice-breakers-section'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Ice Breakers')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Suggested conversation starters shown when someone opens Messenger',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('add-ice-breaker-button'),
    ).toBeInTheDocument();
  });

  it('shows messaging window info card', async () => {
    setupDefaultMocks();

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId('messaging-window-card'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Messaging Windows')).toBeInTheDocument();
    expect(
      screen.getByText(/Facebook Messenger has a 24-hour messaging window/),
    ).toBeInTheDocument();
  });

  it('test connection button triggers API call', async () => {
    setupDefaultMocks();
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/business')
        return Promise.resolve({ channelSettings: {} });
      if (url === '/locations') return Promise.resolve([]);
      if (url.startsWith('/messaging/facebook/page-info'))
        return Promise.resolve({ id: '123', name: 'Test Page' });
      return Promise.resolve({});
    });
    const user = userEvent.setup();

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-id-input')).toBeInTheDocument();
    });

    // Enter page ID and access token
    await user.type(screen.getByTestId('page-id-input'), '123456');
    await user.type(
      screen.getByTestId('page-access-token-input'),
      'token-abc',
    );

    // Click test connection
    await user.click(screen.getByTestId('test-connection-button'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/messaging/facebook/page-info'),
      );
    });
  });

  it('handles empty locations', async () => {
    setupDefaultMocks([]);

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('no-locations')).toBeInTheDocument();
    });
    expect(
      screen.getByText('No locations found. Create a location first.'),
    ).toBeInTheDocument();
  });

  it('can add and remove ice breakers', async () => {
    setupDefaultMocks();
    const user = userEvent.setup();

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId('add-ice-breaker-button'),
      ).toBeInTheDocument();
    });

    // Add first ice breaker
    await user.click(screen.getByTestId('add-ice-breaker-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('ice-breaker-question-0'),
      ).toBeInTheDocument();
    });

    // Add second ice breaker
    await user.click(screen.getByTestId('add-ice-breaker-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('ice-breaker-question-1'),
      ).toBeInTheDocument();
    });

    // Remove first ice breaker
    await user.click(screen.getByTestId('remove-ice-breaker-0'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('ice-breaker-question-1'),
      ).not.toBeInTheDocument();
    });
    // The remaining one is now at index 0
    expect(
      screen.getByTestId('ice-breaker-question-0'),
    ).toBeInTheDocument();
  });

  it('limits ice breakers to 4 maximum', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url === '/business')
        return Promise.resolve({
          channelSettings: {
            facebook: {
              pageId: '123',
              pageAccessToken: 'tok',
              iceBreakers: [
                { question: 'Q1', payload: 'P1' },
                { question: 'Q2', payload: 'P2' },
                { question: 'Q3', payload: 'P3' },
                { question: 'Q4', payload: 'P4' },
              ],
            },
          },
        });
      if (url === '/locations') return Promise.resolve([]);
      return Promise.resolve({});
    });

    render(<FacebookSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId('ice-breaker-question-3'),
      ).toBeInTheDocument();
    });

    // Button should be disabled at max
    const addBtn = screen.getByTestId('add-ice-breaker-button');
    expect(addBtn).toBeDisabled();
    expect(
      screen.getByText('Maximum 4 ice breakers'),
    ).toBeInTheDocument();
  });
});
