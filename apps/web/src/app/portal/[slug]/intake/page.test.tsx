const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ slug: 'glow-clinic' }),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortalIntakePage from './page';

const mockProfile = {
  id: 'cust-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+15550001234',
  preferences: {},
  memberSince: '2025-01-01',
  totalBookings: 5,
  totalSpent: 250,
};

const mockProfileWithIntake = {
  ...mockProfile,
  preferences: {
    intakeComplete: true,
    intakeFullName: 'Jane Doe',
    intakeDateOfBirth: '1990-05-15',
    intakeEmergencyContactName: 'John Doe',
    intakeEmergencyContactPhone: '+15550009999',
    intakeMedicalConditions: 'None',
    intakeCurrentMedications: 'Vitamin D',
    intakeConsentGiven: true,
    intakeSignatureName: 'Jane Doe',
  },
};

let fetchCalls: any[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  fetchCalls = [];
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn((key: string) => (key === 'portal-token' ? 'test-token' : null)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockFetch(getResponse: any, patchResponse?: any) {
  global.fetch = jest.fn((...args: any[]) => {
    fetchCalls.push(args);
    const opts = args[1] || {};
    if (opts.method === 'PATCH' && patchResponse) {
      return Promise.resolve(patchResponse);
    }
    // All GET requests return the same response
    return Promise.resolve(getResponse);
  }) as any;
}

function jsonResponse(data: any, opts?: { ok?: boolean; status?: number }) {
  return {
    ok: opts?.ok !== false,
    status: opts?.status || 200,
    json: async () => data,
  };
}

describe('PortalIntakePage', () => {
  it('redirects to login if no token', () => {
    (window.sessionStorage.getItem as jest.Mock).mockReturnValue(null);
    mockFetch(jsonResponse(mockProfile));
    render(<PortalIntakePage />);
    expect(mockReplace).toHaveBeenCalledWith('/portal/glow-clinic');
  });

  it('renders the intake form with all fields', async () => {
    mockFetch(jsonResponse(mockProfile));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-form')).toBeInTheDocument();
    });

    expect(screen.getByTestId('intake-fullName')).toBeInTheDocument();
    expect(screen.getByTestId('intake-dateOfBirth')).toBeInTheDocument();
    expect(screen.getByTestId('intake-emergencyContactName')).toBeInTheDocument();
    expect(screen.getByTestId('intake-emergencyContactPhone')).toBeInTheDocument();
    expect(screen.getByTestId('intake-medicalConditions')).toBeInTheDocument();
    expect(screen.getByTestId('intake-currentMedications')).toBeInTheDocument();
    expect(screen.getByTestId('intake-consentGiven')).toBeInTheDocument();
    expect(screen.getByTestId('intake-signatureName')).toBeInTheDocument();
    expect(screen.getByTestId('submit-intake-btn')).toBeInTheDocument();
  });

  it('pre-fills name from profile', async () => {
    mockFetch(jsonResponse(mockProfile));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-fullName')).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('intake-fullName') as HTMLInputElement;
    expect(nameInput.value).toBe('Jane Doe');
  });

  it('shows consent toggle', async () => {
    mockFetch(jsonResponse(mockProfile));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-consentGiven')).toBeInTheDocument();
    });

    const consentBtn = screen.getByTestId('intake-consentGiven');
    expect(consentBtn).toBeInTheDocument();
    expect(consentBtn.textContent).toContain('I have read and agree');
  });

  it('shows validation errors when submitting empty form', async () => {
    mockFetch(jsonResponse({ ...mockProfile, name: '' }));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-form')).toBeInTheDocument();
    });

    // Clear the pre-filled name
    fireEvent.change(screen.getByTestId('intake-fullName'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('submit-intake-btn'));

    expect(screen.getByTestId('error-fullName')).toBeInTheDocument();
    expect(screen.getByTestId('error-dateOfBirth')).toBeInTheDocument();
    expect(screen.getByTestId('error-emergencyContactName')).toBeInTheDocument();
    expect(screen.getByTestId('error-emergencyContactPhone')).toBeInTheDocument();
    expect(screen.getByTestId('error-consentGiven')).toBeInTheDocument();
    expect(screen.getByTestId('error-signatureName')).toBeInTheDocument();
  });

  it('submits intake form data via API', async () => {
    mockFetch(jsonResponse(mockProfile), jsonResponse({ id: 'cust-1' }));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-form')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByTestId('intake-dateOfBirth'), {
      target: { value: '1990-05-15' },
    });
    fireEvent.change(screen.getByTestId('intake-emergencyContactName'), {
      target: { value: 'John Doe' },
    });
    fireEvent.change(screen.getByTestId('intake-emergencyContactPhone'), {
      target: { value: '+15550009999' },
    });
    fireEvent.change(screen.getByTestId('intake-medicalConditions'), {
      target: { value: 'None known' },
    });
    fireEvent.change(screen.getByTestId('intake-currentMedications'), {
      target: { value: 'Vitamin D' },
    });
    fireEvent.click(screen.getByTestId('intake-consentGiven'));
    fireEvent.change(screen.getByTestId('intake-signatureName'), {
      target: { value: 'Jane Doe' },
    });

    fireEvent.click(screen.getByTestId('submit-intake-btn'));

    await waitFor(() => {
      const patchCall = fetchCalls.find(
        (call: any) => call[0]?.includes?.('/portal/me') && call[1]?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(patchCall[1].body);
      expect(body.customFields.intakeComplete).toBe(true);
      expect(body.customFields.intakeFullName).toBe('Jane Doe');
      expect(body.customFields.intakeDateOfBirth).toBe('1990-05-15');
      expect(body.customFields.intakeEmergencyContactName).toBe('John Doe');
      expect(body.customFields.intakeEmergencyContactPhone).toBe('+15550009999');
      expect(body.customFields.intakeMedicalConditions).toBe('None known');
      expect(body.customFields.intakeCurrentMedications).toBe('Vitamin D');
      expect(body.customFields.intakeConsentGiven).toBe(true);
      expect(body.customFields.intakeSignatureName).toBe('Jane Doe');
    });
  });

  it('shows success message after submit', async () => {
    mockFetch(jsonResponse(mockProfile), jsonResponse({ id: 'cust-1' }));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-form')).toBeInTheDocument();
    });

    // Fill required fields
    fireEvent.change(screen.getByTestId('intake-dateOfBirth'), {
      target: { value: '1990-05-15' },
    });
    fireEvent.change(screen.getByTestId('intake-emergencyContactName'), {
      target: { value: 'John Doe' },
    });
    fireEvent.change(screen.getByTestId('intake-emergencyContactPhone'), {
      target: { value: '+15550009999' },
    });
    fireEvent.click(screen.getByTestId('intake-consentGiven'));
    fireEvent.change(screen.getByTestId('intake-signatureName'), {
      target: { value: 'Jane Doe' },
    });

    fireEvent.click(screen.getByTestId('submit-intake-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeInTheDocument();
    });
    expect(screen.getByText('Thank you!')).toBeInTheDocument();
    expect(
      screen.getByText('Your intake form has been submitted successfully.'),
    ).toBeInTheDocument();
  });

  it('shows already submitted state when intake is complete', async () => {
    mockFetch(jsonResponse(mockProfileWithIntake));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('already-complete')).toBeInTheDocument();
    });
    expect(screen.getByText('Your intake form is already on file')).toBeInTheDocument();
    expect(screen.getByTestId('update-intake-btn')).toBeInTheDocument();
  });

  it('allows editing when update button is clicked on already-complete state', async () => {
    mockFetch(jsonResponse(mockProfileWithIntake));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('already-complete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('update-intake-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('intake-form')).toBeInTheDocument();
      const nameInput = screen.getByTestId('intake-fullName') as HTMLInputElement;
      expect(nameInput.value).toBe('Jane Doe');
    });
    const dobInput = screen.getByTestId('intake-dateOfBirth') as HTMLInputElement;
    expect(dobInput.value).toBe('1990-05-15');
  });

  it('clears field errors when user starts typing', async () => {
    mockFetch(jsonResponse({ ...mockProfile, name: '' }));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-form')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('intake-fullName'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('submit-intake-btn'));
    expect(screen.getByTestId('error-fullName')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('intake-fullName'), { target: { value: 'J' } });
    expect(screen.queryByTestId('error-fullName')).not.toBeInTheDocument();
  });

  it('navigates back to dashboard when back button is clicked', async () => {
    mockFetch(jsonResponse(mockProfile));
    render(<PortalIntakePage />);

    await waitFor(() => {
      expect(screen.getByTestId('intake-form')).toBeInTheDocument();
    });

    const backButtons = screen.getAllByRole('button');
    const backBtn = backButtons[0];
    fireEvent.click(backBtn);

    expect(mockPush).toHaveBeenCalledWith('/portal/glow-clinic/dashboard');
  });
});
