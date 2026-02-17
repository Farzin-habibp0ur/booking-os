import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PackBuilderPage from './page';

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
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
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

// Auth mock — defaults to SUPER_ADMIN
let mockUser: any = { id: '1', name: 'Admin', role: 'SUPER_ADMIN', businessId: 'b1' };
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() },
}));
import { api } from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

const mockPackConfig = {
  labels: { customer: 'Client', booking: 'Appointment', service: 'Service' },
  intakeFields: [
    { key: 'make', label: 'Make', type: 'text', required: true },
    { key: 'model', label: 'Model', type: 'text', required: true },
  ],
  defaultServices: [],
  defaultTemplates: [],
  defaultAutomations: [],
  kanbanEnabled: false,
  kanbanStatuses: [],
};

const mockPack = {
  id: 'pack1',
  slug: 'dealership',
  version: 1,
  name: 'Dealership',
  description: 'Car dealership vertical',
  config: mockPackConfig,
  isPublished: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockPublishedPack = {
  ...mockPack,
  id: 'pack2',
  slug: 'aesthetic',
  name: 'Aesthetic',
  version: 2,
  isPublished: true,
  description: 'Aesthetic clinic',
  config: {
    ...mockPackConfig,
    labels: { customer: 'Patient', booking: 'Appointment', service: 'Treatment' },
    intakeFields: [],
  },
};

describe('PackBuilderPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: '1', name: 'Admin', role: 'SUPER_ADMIN', businessId: 'b1' };
  });

  // ─── Access Control ─────────────────────────────────────────────────────

  test('redirects non-SUPER_ADMIN users', async () => {
    mockUser = { id: '1', name: 'Staff', role: 'ADMIN', businessId: 'b1' };
    mockApi.get.mockResolvedValue([]);
    render(<PackBuilderPage />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('renders page for SUPER_ADMIN', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<PackBuilderPage />);
    await waitFor(() => {
      expect(screen.getByText('Pack Builder')).toBeInTheDocument();
    });
  });

  // ─── Pack List ──────────────────────────────────────────────────────────

  test('shows empty state when no packs', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<PackBuilderPage />);
    await waitFor(() => {
      expect(screen.getByText('No packs yet')).toBeInTheDocument();
    });
  });

  test('displays pack cards', async () => {
    mockApi.get.mockResolvedValue([mockPack, mockPublishedPack]);
    render(<PackBuilderPage />);
    await waitFor(() => {
      expect(screen.getByText('Dealership')).toBeInTheDocument();
      expect(screen.getByText('Aesthetic')).toBeInTheDocument();
    });
  });

  test('shows draft/published badges on cards', async () => {
    mockApi.get.mockResolvedValue([mockPack, mockPublishedPack]);
    render(<PackBuilderPage />);
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
    });
  });

  test('shows field count on cards', async () => {
    mockApi.get.mockResolvedValue([mockPack]);
    render(<PackBuilderPage />);
    await waitFor(() => {
      expect(screen.getByText('2 fields')).toBeInTheDocument();
    });
  });

  test('shows version on cards', async () => {
    mockApi.get.mockResolvedValue([mockPublishedPack]);
    render(<PackBuilderPage />);
    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument();
    });
  });

  // ─── Create Pack ────────────────────────────────────────────────────────

  test('opens create modal on New Pack click', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('New Pack'));

    fireEvent.click(screen.getByText('New Pack'));

    await waitFor(() => {
      expect(screen.getByText('Create New Pack')).toBeInTheDocument();
    });
  });

  test('creates pack via modal form', async () => {
    mockApi.get.mockResolvedValue([]);
    mockApi.post.mockResolvedValue(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('New Pack'));

    fireEvent.click(screen.getByText('New Pack'));
    await waitFor(() => screen.getByText('Create New Pack'));

    const nameInput = screen.getByPlaceholderText('e.g. Dealership');
    await userEvent.type(nameInput, 'Dealership');

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/admin/packs',
        expect.objectContaining({ name: 'Dealership' }),
      );
    });
  });

  test('closes create modal on Cancel', async () => {
    mockApi.get.mockResolvedValue([]);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('New Pack'));

    fireEvent.click(screen.getByText('New Pack'));
    await waitFor(() => screen.getByText('Create New Pack'));

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Create New Pack')).not.toBeInTheDocument();
    });
  });

  // ─── Pack Editor ────────────────────────────────────────────────────────

  test('opens editor when clicking a pack card', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/admin/packs/dealership');
    });
  });

  test('shows labels editor tab by default', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));

    await waitFor(() => {
      expect(screen.getByText('Entity Labels')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Client')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Appointment')).toBeInTheDocument();
    });
  });

  test('switches to fields tab', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));

    await waitFor(() => screen.getByText('Labels'));

    fireEvent.click(screen.getByText('Intake Fields'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Make')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Model')).toBeInTheDocument();
    });
  });

  test('shows save and publish buttons for draft packs', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Publish')).toBeInTheDocument();
    });
  });

  test('shows New Version button for published packs', async () => {
    mockApi.get.mockResolvedValueOnce([mockPublishedPack]).mockResolvedValueOnce(mockPublishedPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Aesthetic'));

    fireEvent.click(screen.getByText('Aesthetic'));

    await waitFor(() => {
      expect(screen.getByText('New Version')).toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });
  });

  test('saves draft pack config', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    mockApi.patch.mockResolvedValue(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));
    await waitFor(() => screen.getByText('Save'));

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockApi.patch).toHaveBeenCalledWith(
        `/admin/packs/${mockPack.id}`,
        expect.objectContaining({ config: expect.any(Object) }),
      );
    });
  });

  test('publishes pack when publish button clicked', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    mockApi.post.mockResolvedValue({ ...mockPack, isPublished: true });
    window.confirm = jest.fn(() => true);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));
    await waitFor(() => screen.getByText('Publish'));

    fireEvent.click(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(`/admin/packs/${mockPack.id}/publish`);
    });
  });

  // ─── Preview Panel ──────────────────────────────────────────────────────

  test('toggles preview panel', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));
    await waitFor(() => screen.getByText('Preview'));

    fireEvent.click(screen.getByText('Preview'));

    await waitFor(() => {
      expect(screen.getByText('Intake Card Preview')).toBeInTheDocument();
      expect(screen.getByText('Client Intake')).toBeInTheDocument();
    });
  });

  // ─── Field Builder ──────────────────────────────────────────────────────

  test('adds a new field', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));
    await waitFor(() => screen.getByText('Labels'));

    fireEvent.click(screen.getByText('Intake Fields'));
    await waitFor(() => screen.getByDisplayValue('Make'));

    fireEvent.click(screen.getByText('Add Field'));

    // Should now have 3 fields (2 existing + 1 new)
    const labelInputs = screen.getAllByPlaceholderText('Label');
    expect(labelInputs.length).toBe(3);
  });

  test('removes a field', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));
    await waitFor(() => screen.getByText('Labels'));

    fireEvent.click(screen.getByText('Intake Fields'));
    await waitFor(() => screen.getByDisplayValue('Make'));

    // Click the remove button on the first field
    const removeButtons = screen.getAllByLabelText('Remove field');
    fireEvent.click(removeButtons[0]);

    // Should now have 1 field
    const labelInputs = screen.getAllByPlaceholderText('Label');
    expect(labelInputs.length).toBe(1);
  });

  // ─── Kanban Settings ───────────────────────────────────────────────────

  test('shows kanban settings in labels tab', async () => {
    mockApi.get.mockResolvedValueOnce([mockPack]).mockResolvedValueOnce(mockPack);
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));

    await waitFor(() => {
      expect(screen.getByText('Kanban Board')).toBeInTheDocument();
      expect(screen.getByText('Enable service kanban board')).toBeInTheDocument();
    });
  });

  // ─── Back Navigation ───────────────────────────────────────────────────

  test('navigates back to list from editor', async () => {
    mockApi.get
      .mockResolvedValueOnce([mockPack])
      .mockResolvedValueOnce(mockPack)
      .mockResolvedValueOnce([mockPack]); // after back
    render(<PackBuilderPage />);
    await waitFor(() => screen.getByText('Dealership'));

    fireEvent.click(screen.getByText('Dealership'));
    await waitFor(() => screen.getByLabelText('Back to packs'));

    fireEvent.click(screen.getByLabelText('Back to packs'));

    await waitFor(() => {
      expect(screen.getByText('New Pack')).toBeInTheDocument();
    });
  });
});
