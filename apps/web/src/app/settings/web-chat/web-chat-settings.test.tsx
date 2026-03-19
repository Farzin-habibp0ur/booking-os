import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WebChatSettingsPage from './page';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, ...props }: any) {
    return <a {...props}>{children}</a>;
  };
});

// Mock i18n
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock cn utility
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock API client
const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
    put: (...args: any[]) => mockPut(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

// Mock clipboard
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

const defaultConfig = {
  primaryColor: '#71907C',
  title: 'Chat with us',
  subtitle: 'We typically reply within minutes',
  placeholder: 'Type a message...',
  position: 'bottom-right',
  preChatFields: ['name', 'email'],
  offlineMessage: 'We are currently offline. Leave us a message!',
  showOfflineForm: true,
};

const mockLocations = [
  { id: 'loc1', name: 'Main Office', webChatConfig: { enabled: true, greeting: 'Hello!' } },
  { id: 'loc2', name: 'Branch Office', webChatConfig: null },
];

describe('WebChatSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url === '/messaging/web-chat/config') return Promise.resolve(defaultConfig);
      if (url === '/business') return Promise.resolve({ id: 'biz123' });
      if (url === '/locations') return Promise.resolve(mockLocations);
      return Promise.resolve({});
    });
    mockPut.mockResolvedValue({ ok: true });
    mockPatch.mockResolvedValue({ ok: true });
  });

  it('renders page title and description', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    expect(screen.getByText('webChat.title')).toBeInTheDocument();
    expect(screen.getByText('webChat.description')).toBeInTheDocument();
  });

  it('shows appearance section with color picker', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    expect(screen.getByText('webChat.appearance')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('color-input')).toHaveValue('#71907C');
    expect(screen.getByTestId('color-swatch')).toBeInTheDocument();
  });

  it('shows pre-chat form toggles', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    expect(screen.getByText('webChat.prechat_form')).toBeInTheDocument();
    expect(screen.getByText('webChat.prechat_name')).toBeInTheDocument();
    expect(screen.getByText('webChat.prechat_email')).toBeInTheDocument();
    expect(screen.getByText('webChat.prechat_phone')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-email')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-phone')).toBeInTheDocument();
  });

  it('shows embed snippet with copy button', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    expect(screen.getByText('webChat.embed_snippet')).toBeInTheDocument();
    expect(screen.getByTestId('copy-snippet-button')).toBeInTheDocument();
    expect(screen.getByTestId('embed-code')).toBeInTheDocument();
    // Snippet should contain the business ID
    expect(screen.getByTestId('embed-code').textContent).toContain('biz123');
  });

  it('shows how-it-works info card', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    expect(screen.getByTestId('how-it-works-card')).toBeInTheDocument();
    expect(screen.getByText('webChat.how_it_works')).toBeInTheDocument();
    expect(screen.getByText('webChat.step1')).toBeInTheDocument();
    expect(screen.getByText('webChat.step5')).toBeInTheDocument();
  });

  it('shows location config', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    expect(screen.getByText('webChat.location_config')).toBeInTheDocument();
    expect(screen.getByText('Main Office')).toBeInTheDocument();
    expect(screen.getByText('Branch Office')).toBeInTheDocument();
  });

  it('copy button copies to clipboard', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    const copyBtn = screen.getByTestId('copy-snippet-button');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
    const clipboardText = mockClipboard.writeText.mock.calls[0][0];
    expect(clipboardText).toContain('BookingOSChat.init');
    expect(clipboardText).toContain('biz123');
  });

  it('save triggers API call', async () => {
    await act(async () => {
      render(<WebChatSettingsPage />);
    });

    const saveBtn = screen.getByTestId('save-appearance-button');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/messaging/web-chat/config', expect.objectContaining({
        primaryColor: '#71907C',
        title: 'Chat with us',
        position: 'bottom-right',
      }));
    });
  });
});
