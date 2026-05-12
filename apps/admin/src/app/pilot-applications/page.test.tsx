import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mockApi, resetMocks } from '@/__tests__/test-helpers';
import Page from './page';

beforeEach(() => resetMocks());

const baseRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'pa1',
  clinicName: 'Glow Clinic',
  contactName: 'Sarah Owner',
  email: 'sarah@example.com',
  phone: null,
  websiteOrInstagram: null,
  countryTimezone: null,
  monthlyLeadVolume: null,
  currentChannels: ['INSTAGRAM'],
  practiceType: 'MED_SPA',
  biggestFrontDeskPain: 'Missed leads after hours.',
  consent: true,
  status: 'NEW',
  notes: null,
  acceptedBusinessId: null,
  submittedAt: '2026-05-01T00:00:00Z',
  ...overrides,
});

describe('Pilot Applications page', () => {
  it('shows Accept and Provision for MED_SPA NEW applications', async () => {
    mockApi.get.mockResolvedValue({
      items: [baseRow()],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    render(<Page />);

    expect(await screen.findByTestId('accept-pa1')).toBeInTheDocument();
    expect(screen.queryByTestId('waitlist-year-2-pa1')).not.toBeInTheDocument();
  });

  it('shows Year 2 Waitlist for non-MED_SPA NEW applications', async () => {
    mockApi.get.mockResolvedValue({
      items: [baseRow({ id: 'pa2', practiceType: 'DERMATOLOGY' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    render(<Page />);

    expect(await screen.findByTestId('waitlist-year-2-pa2')).toBeInTheDocument();
    expect(screen.queryByTestId('accept-pa2')).not.toBeInTheDocument();
  });

  it('shows Year 2 Waitlist when practiceType is null', async () => {
    mockApi.get.mockResolvedValue({
      items: [baseRow({ id: 'pa3', practiceType: null })],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    render(<Page />);

    expect(await screen.findByTestId('waitlist-year-2-pa3')).toBeInTheDocument();
    expect(screen.queryByTestId('accept-pa3')).not.toBeInTheDocument();
  });

  it('hides triage buttons for ACCEPTED applications', async () => {
    mockApi.get.mockResolvedValue({
      items: [baseRow({ status: 'ACCEPTED', acceptedBusinessId: 'biz1' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    render(<Page />);

    await screen.findByText('Glow Clinic');
    expect(screen.queryByTestId('accept-pa1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('waitlist-year-2-pa1')).not.toBeInTheDocument();
  });

  it('calls accept endpoint and shows provisioned link on success', async () => {
    mockApi.get.mockResolvedValue({
      items: [baseRow()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    mockApi.patch.mockResolvedValueOnce({
      businessId: 'biz1',
      ownerStaffId: 'staff1',
      setupTokenSent: true,
    });

    render(<Page />);

    const button = await screen.findByTestId('accept-pa1');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/admin/pilot-applications/pa1/accept', {});
    });
    const link = await screen.findByTestId('provisioned-link-pa1');
    expect(link).toHaveAttribute('href', '/businesses/biz1');
  });

  it('calls waitlist-year-2 endpoint and refetches', async () => {
    mockApi.get.mockResolvedValue({
      items: [baseRow({ id: 'pa2', practiceType: 'DERMATOLOGY' })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    mockApi.patch.mockResolvedValueOnce({ id: 'pa2', status: 'WAITLIST_YEAR_2' });

    render(<Page />);

    const button = await screen.findByTestId('waitlist-year-2-pa2');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/admin/pilot-applications/pa2/waitlist-year-2',
        {},
      );
    });
  });

  it('renders an error message when accept fails', async () => {
    mockApi.get.mockResolvedValue({
      items: [baseRow()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    mockApi.patch.mockRejectedValueOnce(new Error('Boom'));

    render(<Page />);

    const button = await screen.findByTestId('accept-pa1');
    fireEvent.click(button);

    expect(await screen.findByTestId('error-pa1')).toHaveTextContent('Boom');
  });
});
