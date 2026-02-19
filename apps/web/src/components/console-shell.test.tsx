const mockPush = jest.fn();
const mockPathname = jest.fn().mockReturnValue('/console');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));
jest.mock('next/link', () => {
  const Link = ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  return Link;
});
let mockUser: any = {
  id: 'admin1',
  name: 'Platform Admin',
  email: 'admin@bookingos.com',
  role: 'SUPER_ADMIN',
  businessId: 'platform-biz',
};
let mockLoading = false;
const mockLogout = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    logout: mockLogout,
  }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('lucide-react', () => {
  const icons = [
    'LayoutDashboard', 'Building2', 'CreditCard', 'Package', 'Bot',
    'MessageSquare', 'LifeBuoy', 'Shield', 'Activity', 'Settings',
    'LogOut', 'Menu', 'X',
  ];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = (props: any) => <div data-testid={`icon-${name}`} {...props} />;
  });
  return mocks;
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleShell } from './console-shell';

describe('ConsoleShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'admin1',
      name: 'Platform Admin',
      email: 'admin@bookingos.com',
      role: 'SUPER_ADMIN',
      businessId: 'platform-biz',
    };
    mockLoading = false;
  });

  it('renders all 10 nav items', () => {
    render(<ConsoleShell><div>Content</div></ConsoleShell>);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Businesses')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Packs & Skills')).toBeInTheDocument();
    expect(screen.getByText('AI & Agents')).toBeInTheDocument();
    expect(screen.getByText('Messaging Ops')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Security & Audit')).toBeInTheDocument();
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders Platform Console header', () => {
    render(<ConsoleShell><div>Content</div></ConsoleShell>);

    expect(screen.getAllByText('Platform Console')).toHaveLength(2); // mobile + sidebar
    expect(screen.getByText('admin@bookingos.com')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<ConsoleShell><div>Test Content</div></ConsoleShell>);

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('redirects non-SUPER_ADMIN to dashboard', () => {
    mockUser = { ...mockUser, role: 'ADMIN' };

    render(<ConsoleShell><div>Content</div></ConsoleShell>);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('shows loading spinner when loading', () => {
    mockLoading = true;

    const { container } = render(<ConsoleShell><div>Content</div></ConsoleShell>);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('calls logout on logout button click', async () => {
    const user = userEvent.setup();

    render(<ConsoleShell><div>Content</div></ConsoleShell>);

    await user.click(screen.getByText('Logout'));

    expect(mockLogout).toHaveBeenCalled();
  });

  it('highlights active nav item', () => {
    mockPathname.mockReturnValue('/console/businesses');

    render(<ConsoleShell><div>Content</div></ConsoleShell>);

    const businessLink = screen.getByText('Businesses').closest('a');
    expect(businessLink?.getAttribute('aria-current')).toBe('page');
  });
});
