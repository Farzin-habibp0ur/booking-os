import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrandingPage from './page';

const mockToast = jest.fn();

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/settings/branding',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    patchFormData: jest.fn(),
  },
}));

import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const defaultBranding = {
  logoUrl: null,
  brandPrimaryColor: '#FF5500',
  brandTagline: 'Test tagline',
  brandFaviconUrl: null,
};

const defaultBusiness = { name: 'Test Salon' };

function setupApiMocks(branding = defaultBranding, business = defaultBusiness) {
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/business/branding') return Promise.resolve(branding);
    if (url === '/business') return Promise.resolve(business);
    return Promise.resolve({});
  });
}

describe('BrandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    // Never resolve the API calls so component stays in loading state
    mockApi.get.mockReturnValue(new Promise(() => {}));

    render(<BrandingPage />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Branding')).not.toBeInTheDocument();
  });

  it('renders branding page with loaded data', async () => {
    setupApiMocks();

    render(<BrandingPage />);

    await waitFor(() => {
      expect(screen.getByText('Branding')).toBeInTheDocument();
    });

    expect(screen.getByTestId('color-input')).toHaveValue('#FF5500');
    expect(screen.getByTestId('tagline-input')).toHaveValue('Test tagline');
    expect(screen.getByText('Save Branding')).toBeInTheDocument();
  });

  it('renders logo dropzone', async () => {
    setupApiMocks();

    render(<BrandingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('logo-dropzone')).toBeInTheDocument();
    });

    expect(screen.getByText('Click to upload logo')).toBeInTheDocument();
    expect(screen.getByText('PNG, JPG, or SVG (max 2MB)')).toBeInTheDocument();
  });

  it('updates color via text input', async () => {
    setupApiMocks();
    const user = userEvent.setup();

    render(<BrandingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('color-input')).toBeInTheDocument();
    });

    const colorInput = screen.getByTestId('color-input');
    // The input validates hex format on each keystroke via regex /^#[0-9A-Fa-f]{0,6}$/
    // Use fireEvent to set value directly since user.clear + type doesn't match the regex mid-edit
    fireEvent.change(colorInput, { target: { value: '#00AA33' } });

    expect(colorInput).toHaveValue('#00AA33');
  });

  it('updates tagline with character counter', async () => {
    setupApiMocks();
    const user = userEvent.setup();

    render(<BrandingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tagline-input')).toBeInTheDocument();
    });

    const taglineInput = screen.getByTestId('tagline-input');
    await user.clear(taglineInput);
    await user.type(taglineInput, 'New tagline');

    expect(taglineInput).toHaveValue('New tagline');
  });

  it('shows tagline character count', async () => {
    setupApiMocks();

    render(<BrandingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('tagline-input')).toBeInTheDocument();
    });

    // "Test tagline" = 12 chars
    expect(screen.getByText('12/120')).toBeInTheDocument();
  });

  it('calls save with form data', async () => {
    setupApiMocks();
    mockApi.patchFormData.mockResolvedValue({});
    const user = userEvent.setup();

    render(<BrandingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('save-branding')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('save-branding'));

    await waitFor(() => {
      expect(mockApi.patchFormData).toHaveBeenCalledTimes(1);
    });

    const [url, formData] = mockApi.patchFormData.mock.calls[0];
    expect(url).toBe('/business/branding');
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('brandPrimaryColor')).toBe('#FF5500');
    expect(formData.get('brandTagline')).toBe('Test tagline');
    expect(mockToast).toHaveBeenCalledWith('Branding updated. Your portal now shows your brand.');
  });

  it('shows live preview panel', async () => {
    setupApiMocks();

    render(<BrandingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('brand-preview')).toBeInTheDocument();
    });

    expect(screen.getByText('Portal Preview')).toBeInTheDocument();
    expect(screen.getByText('Test Salon')).toBeInTheDocument();
    expect(screen.getByText('Test tagline')).toBeInTheDocument();
    expect(screen.getByText('Book Now')).toBeInTheDocument();
  });
});
