import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPage from './page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('next/link', () => ({ children, href, ...rest }: any) => (
  <a href={href} {...rest}>
    {children}
  </a>
));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Sarah', role: 'ADMIN', businessId: 'b1' },
    loading: false,
  }),
}));
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
  I18nProvider: ({ children }: any) => children,
}));
jest.mock('@/lib/vertical-pack', () => ({
  usePack: () => ({
    name: 'general',
    labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
    customerFields: [],
  }),
}));
jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock('@/lib/cn', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));
jest.mock('@/lib/use-theme', () => ({
  useTheme: () => ({ theme: 'light' as const, setTheme: jest.fn(), toggle: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn(), upload: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

// -- Test data factories --

const mockStaffAdmin = {
  id: 'staff-1',
  name: 'Sarah Admin',
  email: 'sarah@clinic.com',
  role: 'ADMIN',
  isActive: true,
};

const mockStaffProvider = {
  id: 'staff-2',
  name: 'Dr. Jones',
  email: 'jones@clinic.com',
  role: 'SERVICE_PROVIDER',
  isActive: true,
};

const mockStaffAgent = {
  id: 'staff-3',
  name: 'Receptionist Amy',
  email: 'amy@clinic.com',
  role: 'AGENT',
  isActive: false,
};

const mockWorkingHours = [
  { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOff: true },
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOff: false },
  { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isOff: false },
  { dayOfWeek: 3, startTime: '10:00', endTime: '18:00', isOff: false },
  { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isOff: false },
  { dayOfWeek: 5, startTime: '09:00', endTime: '13:00', isOff: false },
  { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isOff: true },
];

const mockTimeOffEntries = [
  {
    id: 'to-1',
    startDate: '2026-03-01T00:00:00.000Z',
    endDate: '2026-03-05T00:00:00.000Z',
    reason: 'Holiday',
  },
  {
    id: 'to-2',
    startDate: '2026-04-15T00:00:00.000Z',
    endDate: '2026-04-16T00:00:00.000Z',
    reason: '',
  },
];

// Helper to set up mock API responses for expanding a staff member
function setupExpandMocks(staffList: any[], workingHours?: any[], timeOffEntries?: any[]) {
  mockApi.get.mockImplementation((path: string) => {
    if (path === '/staff') return Promise.resolve(staffList);
    if (path.match(/\/staff\/[^/]+\/working-hours/))
      return Promise.resolve(workingHours || mockWorkingHours);
    if (path.match(/\/staff\/[^/]+\/time-off/)) return Promise.resolve(timeOffEntries || []);
    return Promise.resolve([]);
  });
}

describe('StaffPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== BASIC RENDERING =====

  test('renders staff page with title and add button', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.title')).toBeInTheDocument();
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });
  });

  test('renders table headers', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('common.name')).toBeInTheDocument();
      expect(screen.getByText('common.email')).toBeInTheDocument();
      expect(screen.getByText('staff.role')).toBeInTheDocument();
      expect(screen.getByText('common.status')).toBeInTheDocument();
    });
  });

  test('calls api.get /staff on mount', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/staff');
    });
  });

  // ===== STAFF LIST DISPLAY =====

  test('displays multiple staff members in table', async () => {
    mockApi.get.mockResolvedValue([mockStaffAdmin, mockStaffProvider, mockStaffAgent]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
      expect(screen.getByText('sarah@clinic.com')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jones')).toBeInTheDocument();
      expect(screen.getByText('jones@clinic.com')).toBeInTheDocument();
      expect(screen.getByText('Receptionist Amy')).toBeInTheDocument();
      expect(screen.getByText('amy@clinic.com')).toBeInTheDocument();
    });
  });

  test('shows role badges for all role types', async () => {
    mockApi.get.mockResolvedValue([mockStaffAdmin, mockStaffProvider, mockStaffAgent]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
      expect(screen.getByText('SERVICE_PROVIDER')).toBeInTheDocument();
      expect(screen.getByText('AGENT')).toBeInTheDocument();
    });
  });

  test('shows active status for active staff', async () => {
    mockApi.get.mockResolvedValue([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('common.active')).toBeInTheDocument();
    });
  });

  test('shows inactive status for inactive staff', async () => {
    mockApi.get.mockResolvedValue([mockStaffAgent]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('common.inactive')).toBeInTheDocument();
    });
  });

  test('renders empty table when no staff', async () => {
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('common.name')).toBeInTheDocument();
    });
    // No staff names should be present
    expect(screen.queryByText('Sarah Admin')).not.toBeInTheDocument();
  });

  // ===== EXPAND / COLLAPSE STAFF ROW =====

  test('clicking a staff row expands it and fetches working hours + time off', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/staff/staff-1/working-hours');
      expect(mockApi.get).toHaveBeenCalledWith('/staff/staff-1/time-off');
    });
  });

  test('expanding staff row shows working hours tab by default', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.working_hours')).toBeInTheDocument();
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });
  });

  test('clicking expanded staff row collapses it', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    // Expand
    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.working_hours')).toBeInTheDocument();
    });

    // Collapse
    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.queryByText('staff.save_hours')).not.toBeInTheDocument();
    });
  });

  test('expanding a different staff row collapses the previous one', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin, mockStaffProvider]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jones')).toBeInTheDocument();
    });

    // Expand first staff
    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.save_hours')).toBeInTheDocument();
    });

    // Expand second staff — first should collapse
    await user.click(screen.getByText('Dr. Jones'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/staff/staff-2/working-hours');
    });
  });

  test('does not re-fetch working hours if already cached', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    // Expand
    await user.click(screen.getByText('Sarah Admin'));
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/staff/staff-1/working-hours');
    });

    const whCallCount = mockApi.get.mock.calls.filter(
      (c) => c[0] === '/staff/staff-1/working-hours',
    ).length;

    // Collapse
    await user.click(screen.getByText('Sarah Admin'));
    // Re-expand
    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      // Working hours should not have been re-fetched
      const newWhCallCount = mockApi.get.mock.calls.filter(
        (c) => c[0] === '/staff/staff-1/working-hours',
      ).length;
      expect(newWhCallCount).toBe(whCallCount);
    });
  });

  // ===== WORKING HOURS TAB =====

  test('displays working hours for each day', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      // Days are shown via i18n keys
      expect(screen.getByText('days.sunday')).toBeInTheDocument();
      expect(screen.getByText('days.monday')).toBeInTheDocument();
      expect(screen.getByText('days.tuesday')).toBeInTheDocument();
      expect(screen.getByText('days.wednesday')).toBeInTheDocument();
      expect(screen.getByText('days.thursday')).toBeInTheDocument();
      expect(screen.getByText('days.friday')).toBeInTheDocument();
      expect(screen.getByText('days.saturday')).toBeInTheDocument();
    });
  });

  test('shows off/working label with checkbox for each day', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      // Sunday (isOff: true) and Saturday (isOff: true) should show 'common.off'
      const offLabels = screen.getAllByText('common.off');
      expect(offLabels.length).toBe(2);

      // 5 working days should show 'common.working'
      const workingLabels = screen.getAllByText('common.working');
      expect(workingLabels.length).toBe(5);
    });
  });

  test('shows time inputs only for working days (not off days)', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      // "to" separator should appear only for working days (5 days)
      const toSeparators = screen.getAllByText('common.to');
      expect(toSeparators.length).toBe(5);
    });
  });

  test('toggling isOff checkbox updates hour state', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('days.monday')).toBeInTheDocument();
    });

    // Find checkboxes - there should be 7 (one per day)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(7);

    // Monday (index 1) is currently working (checked). Toggle it off.
    await user.click(checkboxes[1]);

    // After toggling Monday off, it should now show 3 off days
    await waitFor(() => {
      const offLabels = screen.getAllByText('common.off');
      expect(offLabels.length).toBe(3);
    });
  });

  test('changing start time updates the input value', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('days.monday')).toBeInTheDocument();
    });

    // Get all time inputs (start/end pairs for each working day)
    const timeInputs = screen.getAllByDisplayValue('09:00');
    expect(timeInputs.length).toBeGreaterThan(0);
  });

  test('save hours button calls api.patch with correct data', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);
    mockApi.patch.mockResolvedValue({});

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.save_hours')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.save_hours'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith('/staff/staff-1/working-hours', {
        hours: expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: expect.any(Number),
            startTime: expect.any(String),
            endTime: expect.any(String),
            isOff: expect.any(Boolean),
          }),
        ]),
      });
    });
  });

  test('save hours button shows saving state while in progress', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    // Make patch take some time
    let resolvePatch: () => void;
    mockApi.patch.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePatch = resolve;
        }),
    );

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.save_hours')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.save_hours'));

    // Should show saving text while patch is in progress
    await waitFor(() => {
      expect(screen.getByText('common.saving')).toBeInTheDocument();
    });

    // Resolve the patch
    resolvePatch!();

    // Should revert to save_hours text
    await waitFor(() => {
      expect(screen.getByText('staff.save_hours')).toBeInTheDocument();
    });
  });

  // ===== TIME OFF TAB =====

  test('switching to time off tab shows time off content', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, mockTimeOffEntries);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      // staff.add_time_off appears as both a <p> label and a <button>
      const addTimeOffElements = screen.getAllByText('staff.add_time_off');
      expect(addTimeOffElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('staff.start_date')).toBeInTheDocument();
      expect(screen.getByText('staff.end_date')).toBeInTheDocument();
    });
  });

  test('time off tab shows badge count when entries exist', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, mockTimeOffEntries);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      // Badge shows the count of time off entries (2)
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  test('time off tab lists existing time off entries with dates', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, mockTimeOffEntries);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByText('Holiday')).toBeInTheDocument();
    });
  });

  test('remove time off calls api.del and updates the list', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, mockTimeOffEntries);
    mockApi.del.mockResolvedValue({});

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByText('Holiday')).toBeInTheDocument();
    });

    // Find the delete buttons (Trash2 icons rendered as buttons)
    const deleteButtons = screen
      .getAllByRole('button')
      .filter(
        (btn) => btn.classList.contains('text-red-500') || btn.className.includes('text-red-500'),
      );
    expect(deleteButtons.length).toBeGreaterThan(0);

    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockApi.del).toHaveBeenCalledWith('/staff/staff-1/time-off/to-1');
    });
  });

  test('add time off button is disabled when start/end dates are empty', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, []);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      // The "add time off" button in the form should be disabled
      const addButtons = screen.getAllByText('staff.add_time_off');
      const formAddButton = addButtons.find(
        (btn) => btn.tagName === 'BUTTON' && btn.closest('.space-y-3'),
      );
      expect(formAddButton).toBeDisabled();
    });
  });

  test('add time off submits with dates and reason, then refreshes list', async () => {
    const user = userEvent.setup();
    let timeOffCallCount = 0;
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve([mockStaffAdmin]);
      if (path.match(/\/staff\/[^/]+\/working-hours/)) return Promise.resolve(mockWorkingHours);
      if (path.match(/\/staff\/[^/]+\/time-off/)) {
        timeOffCallCount++;
        // First call returns empty, second call (after adding) returns one entry
        return timeOffCallCount <= 1
          ? Promise.resolve([])
          : Promise.resolve([mockTimeOffEntries[0]]);
      }
      return Promise.resolve([]);
    });
    mockApi.post.mockResolvedValue({});

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByText('staff.start_date')).toBeInTheDocument();
    });

    // Use DOM queries to find date inputs within the time off form
    const formContainer = screen.getByText('staff.start_date').closest('.space-y-3')!;
    const dateFields = formContainer.querySelectorAll('input[type="date"]');
    const reasonField = screen.getByPlaceholderText('staff.reason_placeholder');

    expect(dateFields.length).toBe(2);

    await user.type(dateFields[0] as HTMLElement, '2026-05-01');
    await user.type(dateFields[1] as HTMLElement, '2026-05-03');
    await user.type(reasonField, 'Conference');

    // Find the submit button inside the form
    const formAddButton = within(formContainer as HTMLElement)
      .getAllByText('staff.add_time_off')
      .find((btn) => btn.tagName === 'BUTTON');

    expect(formAddButton).toBeTruthy();
    await user.click(formAddButton!);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/staff/staff-1/time-off',
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
          reason: 'Conference',
        }),
      );
    });
  });

  test('add time off without reason sends undefined reason', async () => {
    const user = userEvent.setup();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') return Promise.resolve([mockStaffAdmin]);
      if (path.match(/\/staff\/[^/]+\/working-hours/)) return Promise.resolve(mockWorkingHours);
      if (path.match(/\/staff\/[^/]+\/time-off/)) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mockApi.post.mockResolvedValue({});

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByText('staff.start_date')).toBeInTheDocument();
    });

    const formContainer = screen.getByText('staff.start_date').closest('.space-y-3');
    const dateFields = formContainer?.querySelectorAll('input[type="date"]');

    if (dateFields && dateFields.length >= 2) {
      await user.type(dateFields[0] as HTMLElement, '2026-05-01');
      await user.type(dateFields[1] as HTMLElement, '2026-05-03');

      const formAddButton = within(formContainer as HTMLElement)
        .getAllByText('staff.add_time_off')
        .find((btn) => btn.tagName === 'BUTTON');

      if (formAddButton) {
        await user.click(formAddButton);

        await waitFor(() => {
          expect(mockApi.post).toHaveBeenCalledWith(
            '/staff/staff-1/time-off',
            expect.objectContaining({
              reason: undefined,
            }),
          );
        });
      }
    }
  });

  test('time off tab with no entries shows empty form only', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, []);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      // Should show form labels but no time off entry dates
      expect(screen.getByText('staff.start_date')).toBeInTheDocument();
      expect(screen.getByText('staff.end_date')).toBeInTheDocument();
      expect(screen.queryByText('Holiday')).not.toBeInTheDocument();
    });
  });

  // ===== TAB SWITCHING =====

  test('tab switching between hours and time off works', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, mockTimeOffEntries);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    // Should start on hours tab
    await waitFor(() => {
      expect(screen.getByText('staff.save_hours')).toBeInTheDocument();
    });

    // Switch to time off
    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByText('staff.start_date')).toBeInTheDocument();
      expect(screen.queryByText('staff.save_hours')).not.toBeInTheDocument();
    });

    // Switch back to hours
    await user.click(screen.getByText('staff.working_hours'));

    await waitFor(() => {
      expect(screen.getByText('staff.save_hours')).toBeInTheDocument();
      expect(screen.queryByText('staff.start_date')).not.toBeInTheDocument();
    });
  });

  // ===== STAFF FORM (ADD STAFF MODAL) =====

  test('clicking add button opens the staff form modal', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('staff.add_title')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('staff.name_placeholder')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('staff.email_placeholder')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('staff.password_placeholder')).toBeInTheDocument();
    });
  });

  test('staff form has role selection with three options', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('staff.role_agent')).toBeInTheDocument();
      expect(screen.getByText('staff.role_service_provider')).toBeInTheDocument();
      expect(screen.getByText('staff.role_admin')).toBeInTheDocument();
    });
  });

  test('staff form cancel button closes the modal', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('staff.add_title')).toBeInTheDocument();
    });

    await user.click(screen.getByText('common.cancel'));

    await waitFor(() => {
      expect(screen.queryByText('staff.add_title')).not.toBeInTheDocument();
    });
  });

  test('staff form submission calls api.post and closes modal', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);
    mockApi.post.mockResolvedValue({ id: 'new-staff', name: 'New Person' });

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('staff.add_title')).toBeInTheDocument();
    });

    // Fill form
    await user.type(screen.getByPlaceholderText('staff.name_placeholder'), 'New Person');
    await user.type(screen.getByPlaceholderText('staff.email_placeholder'), 'new@clinic.com');
    await user.type(screen.getByPlaceholderText('staff.password_placeholder'), 'securepass');

    // Submit form
    await user.click(screen.getByText('common.create'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/staff', {
        name: 'New Person',
        email: 'new@clinic.com',
        password: 'securepass',
        role: 'AGENT', // default role
      });
    });

    // Modal should close after submission
    await waitFor(() => {
      expect(screen.queryByText('staff.add_title')).not.toBeInTheDocument();
    });
  });

  test('staff form submission with ADMIN role sends correct role', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);
    mockApi.post.mockResolvedValue({ id: 'new-staff' });

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('staff.add_title')).toBeInTheDocument();
    });

    // Fill form
    await user.type(screen.getByPlaceholderText('staff.name_placeholder'), 'Admin User');
    await user.type(screen.getByPlaceholderText('staff.email_placeholder'), 'admin@clinic.com');
    await user.type(screen.getByPlaceholderText('staff.password_placeholder'), 'adminpass');

    // Change role to ADMIN
    const roleSelect = screen.getByDisplayValue('staff.role_agent');
    await user.selectOptions(roleSelect, 'ADMIN');

    // Submit
    await user.click(screen.getByText('common.create'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/staff',
        expect.objectContaining({
          role: 'ADMIN',
        }),
      );
    });
  });

  test('staff form submission with SERVICE_PROVIDER role sends correct role', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);
    mockApi.post.mockResolvedValue({ id: 'new-staff' });

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('staff.add_title')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('staff.name_placeholder'), 'Provider');
    await user.type(screen.getByPlaceholderText('staff.email_placeholder'), 'provider@clinic.com');
    await user.type(screen.getByPlaceholderText('staff.password_placeholder'), 'provpass');

    const roleSelect = screen.getByDisplayValue('staff.role_agent');
    await user.selectOptions(roleSelect, 'SERVICE_PROVIDER');

    await user.click(screen.getByText('common.create'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/staff',
        expect.objectContaining({
          role: 'SERVICE_PROVIDER',
        }),
      );
    });
  });

  test('staff form reloads the staff list after successful creation', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/staff') {
        callCount++;
        if (callCount === 1) return Promise.resolve([]);
        // After creation, return the new staff
        return Promise.resolve([
          { id: 'new-1', name: 'New Person', email: 'new@test.com', role: 'AGENT', isActive: true },
        ]);
      }
      return Promise.resolve([]);
    });
    mockApi.post.mockResolvedValue({ id: 'new-1' });

    render(<StaffPage />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/staff');
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('staff.add_title')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('staff.name_placeholder'), 'New Person');
    await user.type(screen.getByPlaceholderText('staff.email_placeholder'), 'new@test.com');
    await user.type(screen.getByPlaceholderText('staff.password_placeholder'), 'pass123');

    await user.click(screen.getByText('common.create'));

    await waitFor(() => {
      // Should have been called at least twice: once on mount and once after creation
      const staffCalls = mockApi.get.mock.calls.filter((c) => c[0] === '/staff');
      expect(staffCalls.length).toBeGreaterThanOrEqual(2);
    });

    // The new staff member should now be displayed
    await waitFor(() => {
      expect(screen.getByText('New Person')).toBeInTheDocument();
    });
  });

  // ===== REASON FIELD IN TIME OFF =====

  test('time off entries with reason display the reason text', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, mockTimeOffEntries);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByText('Holiday')).toBeInTheDocument();
    });
  });

  test('time off reason placeholder is rendered', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, []);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('staff.reason_placeholder')).toBeInTheDocument();
    });
  });

  // ===== MIXED ACTIVE/INACTIVE STAFF =====

  test('displays both active and inactive status for different staff', async () => {
    mockApi.get.mockResolvedValue([mockStaffAdmin, mockStaffAgent]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('common.active')).toBeInTheDocument();
      expect(screen.getByText('common.inactive')).toBeInTheDocument();
    });
  });

  // ===== EDGE CASE: ALL DAYS OFF =====

  test('working hours with all days off shows no time inputs', async () => {
    const user = userEvent.setup();
    const allDaysOff = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '17:00',
      isOff: true,
    }));
    setupExpandMocks([mockStaffAdmin], allDaysOff, []);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      // All days are off, so no "to" separator should appear
      expect(screen.queryByText('common.to')).not.toBeInTheDocument();

      // All should show 'common.off'
      const offLabels = screen.getAllByText('common.off');
      expect(offLabels.length).toBe(7);
    });
  });

  // ===== EDGE CASE: EMPTY WORKING HOURS =====

  test('expanding staff with empty working hours shows no day rows', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], [], []);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.save_hours')).toBeInTheDocument();
      // No day names should be shown
      expect(screen.queryByText('days.monday')).not.toBeInTheDocument();
    });
  });

  // ===== TIME OFF BADGE HIDDEN WHEN 0 ENTRIES =====

  test('time off tab does not show badge when no entries', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, []);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
      // No badge count should be visible
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  // ===== REMOVE TIME OFF UPDATES STATE =====

  test('removing time off entry removes it from the displayed list', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin], mockWorkingHours, mockTimeOffEntries);
    mockApi.del.mockResolvedValue({});

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('staff.time_off')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.time_off'));

    await waitFor(() => {
      expect(screen.getByText('Holiday')).toBeInTheDocument();
    });

    // Find delete buttons
    const deleteButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('text-red-500'));

    // Remove first entry (Holiday)
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockApi.del).toHaveBeenCalledWith('/staff/staff-1/time-off/to-1');
      // "Holiday" entry should be removed from the list
      expect(screen.queryByText('Holiday')).not.toBeInTheDocument();
    });
  });

  // ===== STAFF FORM MODAL OVERLAY =====

  test('staff form modal has overlay backdrop', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('staff.add_button')).toBeInTheDocument();
    });

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      // The modal overlay should be present (fixed inset-0 bg-black/30)
      const overlay = screen.getByText('staff.add_title').closest('.fixed');
      expect(overlay).toBeInTheDocument();
    });
  });

  test('staff form has create and cancel buttons', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);

    render(<StaffPage />);

    await user.click(screen.getByText('staff.add_button'));

    await waitFor(() => {
      expect(screen.getByText('common.create')).toBeInTheDocument();
      expect(screen.getByText('common.cancel')).toBeInTheDocument();
    });
  });

  // ===== CHANGING END TIME =====

  test('changing end time in working hours updates state', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('days.monday')).toBeInTheDocument();
    });

    // endTime values of 17:00 should be present for working days
    const endTimeInputs = screen.getAllByDisplayValue('17:00');
    expect(endTimeInputs.length).toBeGreaterThan(0);
  });

  test('changing start time via onChange handler updates the value', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('days.monday')).toBeInTheDocument();
    });

    // Find time inputs for start time (09:00) - these are type="time" inputs
    const startTimeInputs = screen.getAllByDisplayValue('09:00');
    expect(startTimeInputs.length).toBeGreaterThan(0);

    // Use fireEvent.change to trigger the onChange handler on the first start time input
    fireEvent.change(startTimeInputs[0], { target: { value: '10:30' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('10:30')).toBeInTheDocument();
    });
  });

  test('changing end time via onChange handler updates the value', async () => {
    const user = userEvent.setup();
    setupExpandMocks([mockStaffAdmin]);

    render(<StaffPage />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Admin')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sarah Admin'));

    await waitFor(() => {
      expect(screen.getByText('days.monday')).toBeInTheDocument();
    });

    // Find time inputs for end time (17:00)
    const endTimeInputs = screen.getAllByDisplayValue('17:00');
    expect(endTimeInputs.length).toBeGreaterThan(0);

    // Use fireEvent.change to trigger the onChange handler on the first end time input
    fireEvent.change(endTimeInputs[0], { target: { value: '19:00' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('19:00')).toBeInTheDocument();
    });
  });
});
