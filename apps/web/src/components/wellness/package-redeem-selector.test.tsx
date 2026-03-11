import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PackageRedeemSelector from './package-redeem-selector';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

const { apiFetch } = require('@/lib/api');

describe('PackageRedeemSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows nothing while loading', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <PackageRedeemSelector customerId="cust-1" serviceId="svc-1" onSelect={jest.fn()} />,
    );
    // Loading state renders nothing
    expect(container.querySelector('[data-testid="package-redeem-selector"]')).not.toBeInTheDocument();
  });

  it('shows nothing when no active packages', async () => {
    apiFetch.mockResolvedValue([]);
    const { container } = render(
      <PackageRedeemSelector customerId="cust-1" serviceId="svc-1" onSelect={jest.fn()} />,
    );
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled();
    });
    expect(container.querySelector('[data-testid="package-redeem-selector"]')).not.toBeInTheDocument();
  });

  it('shows active packages', async () => {
    apiFetch.mockResolvedValue([
      {
        id: 'pur-1',
        totalSessions: 10,
        usedSessions: 3,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        package: { id: 'pkg-1', name: 'Massage 10-Pack', serviceId: null, service: null },
      },
    ]);

    render(
      <PackageRedeemSelector customerId="cust-1" serviceId="svc-1" onSelect={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Massage 10-Pack')).toBeInTheDocument();
    });
    expect(screen.getByText(/7 of 10 sessions remaining/)).toBeInTheDocument();
  });

  it('calls onSelect when package chosen', async () => {
    const onSelect = jest.fn();
    apiFetch.mockResolvedValue([
      {
        id: 'pur-1',
        totalSessions: 10,
        usedSessions: 3,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        package: { id: 'pkg-1', name: 'Massage 10-Pack', serviceId: null, service: null },
      },
    ]);

    render(
      <PackageRedeemSelector customerId="cust-1" serviceId="svc-1" onSelect={onSelect} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Massage 10-Pack')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Massage 10-Pack'));
    expect(onSelect).toHaveBeenCalledWith('pur-1');
  });

  it('calls onSelect(null) when pay full price clicked', async () => {
    const onSelect = jest.fn();
    apiFetch.mockResolvedValue([
      {
        id: 'pur-1',
        totalSessions: 10,
        usedSessions: 3,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        package: { id: 'pkg-1', name: 'Massage 10-Pack', serviceId: null, service: null },
      },
    ]);

    render(
      <PackageRedeemSelector customerId="cust-1" serviceId="svc-1" onSelect={onSelect} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Pay full price instead')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pay full price instead'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('fetches with serviceId filter', async () => {
    apiFetch.mockResolvedValue([]);
    render(
      <PackageRedeemSelector customerId="cust-1" serviceId="svc-1" onSelect={jest.fn()} />,
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/packages/customer/cust-1/active?serviceId=svc-1');
    });
  });
});
