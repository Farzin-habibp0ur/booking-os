const mockPush = jest.fn();
const mockPost = jest.fn().mockResolvedValue({});
let mockUser: any = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/lib/api', () => ({
  api: { post: (...args: any[]) => mockPost(...args) },
}));
jest.mock('lucide-react', () => ({
  Eye: (props: any) => <div data-testid="icon-eye" {...props} />,
  X: (props: any) => <div data-testid="icon-x" {...props} />,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewAsBanner } from './view-as-banner';

// Mock sessionStorage
const sessionStorageMock: Record<string, string> = {};
beforeAll(() => {
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn((key: string) => sessionStorageMock[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        sessionStorageMock[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete sessionStorageMock[key];
      }),
    },
    writable: true,
  });
});

// Mock window.location
const originalLocation = window.location;
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, href: '' },
    writable: true,
  });
});
afterAll(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
  });
});

describe('ViewAsBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Object.keys(sessionStorageMock).forEach((key) => delete sessionStorageMock[key]);
    window.location.href = '';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when user is not in view-as mode', () => {
    mockUser = { id: 'admin1', role: 'SUPER_ADMIN' };

    const { container } = render(<ViewAsBanner />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when user is null', () => {
    mockUser = null;

    const { container } = render(<ViewAsBanner />);

    expect(container.innerHTML).toBe('');
  });

  it('renders banner when user is in view-as mode', () => {
    mockUser = {
      id: 'admin1',
      role: 'ADMIN',
      viewAs: true,
      business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
    };

    render(<ViewAsBanner />);

    expect(screen.getByTestId('view-as-banner')).toBeInTheDocument();
    expect(screen.getByText('Glow Clinic')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });

  it('displays "Viewing as" text with business name', () => {
    mockUser = {
      id: 'admin1',
      role: 'ADMIN',
      viewAs: true,
      business: { id: 'biz1', name: 'Zen Spa', slug: 'zen-spa' },
    };

    render(<ViewAsBanner />);

    expect(screen.getByText('Zen Spa')).toBeInTheDocument();
    expect(screen.getByText(/Viewing as/)).toBeInTheDocument();
  });

  it('calls API to end view-as session on exit click', async () => {
    mockUser = {
      id: 'admin1',
      role: 'ADMIN',
      viewAs: true,
      business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ViewAsBanner />);

    await user.click(screen.getByTestId('view-as-exit'));

    expect(mockPost).toHaveBeenCalledWith('/admin/view-as/end');
  });

  it('redirects to console return path after exit', async () => {
    mockUser = {
      id: 'admin1',
      role: 'ADMIN',
      viewAs: true,
      business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
    };
    sessionStorageMock['_console_return_path'] = '/console/businesses/biz1';

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ViewAsBanner />);

    await user.click(screen.getByTestId('view-as-exit'));

    expect(window.location.href).toBe('/console/businesses/biz1');
  });

  it('redirects to /console by default when no return path stored', async () => {
    mockUser = {
      id: 'admin1',
      role: 'ADMIN',
      viewAs: true,
      business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ViewAsBanner />);

    await user.click(screen.getByTestId('view-as-exit'));

    expect(window.location.href).toBe('/console');
  });

  it('has the view-as-banner test id', () => {
    mockUser = {
      id: 'admin1',
      role: 'ADMIN',
      viewAs: true,
      business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
    };

    render(<ViewAsBanner />);

    expect(screen.getByTestId('view-as-banner')).toBeInTheDocument();
  });
});
