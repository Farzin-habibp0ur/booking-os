import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  X: (props: any) => <div data-testid="x-icon" {...props} />,
}));

import { api } from '@/lib/api';
import { SaveViewModal } from './save-view-modal';

const defaultProps = {
  page: 'bookings',
  filters: { status: 'ACTIVE' } as Record<string, unknown>,
  onClose: jest.fn(),
  onSaved: jest.fn(),
};

describe('SaveViewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with name input and save/cancel buttons', () => {
    render(<SaveViewModal {...defaultProps} />);

    expect(screen.getByTestId('save-view-modal')).toBeInTheDocument();
    expect(screen.getByText('saved_views.save_title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('saved_views.name_placeholder')).toBeInTheDocument();
    expect(screen.getByText('common.save')).toBeInTheDocument();
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('save button is disabled when name is empty', () => {
    render(<SaveViewModal {...defaultProps} />);

    const saveButton = screen.getByText('common.save');
    expect(saveButton).toBeDisabled();
  });

  it('calls api.post with correct data on save', async () => {
    const savedView = {
      id: 'v-new',
      name: 'My Filter',
      filters: { status: 'ACTIVE' },
      icon: null,
      color: null,
    };
    (api.post as jest.Mock).mockResolvedValue(savedView);
    const user = userEvent.setup();

    render(<SaveViewModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('saved_views.name_placeholder');
    await user.type(input, 'My Filter');

    const saveButton = screen.getByText('common.save');
    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    expect(api.post).toHaveBeenCalledWith('/saved-views', {
      page: 'bookings',
      name: 'My Filter',
      filters: { status: 'ACTIVE' },
      icon: null,
      color: null,
    });
  });

  it('calls onClose when cancel clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<SaveViewModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText('common.cancel'));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSaved and onClose after successful save', async () => {
    const savedView = {
      id: 'v-new',
      name: 'Test View',
      filters: { status: 'ACTIVE' },
      icon: null,
      color: null,
    };
    (api.post as jest.Mock).mockResolvedValue(savedView);
    const onSaved = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<SaveViewModal {...defaultProps} onSaved={onSaved} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('saved_views.name_placeholder'), 'Test View');
    await user.click(screen.getByText('common.save'));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(savedView);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows icon and color picker options', () => {
    render(<SaveViewModal {...defaultProps} />);

    // Icon picker label and options
    expect(screen.getByText('saved_views.icon_label')).toBeInTheDocument();
    // Icon options show first 2 chars: fi, st, fl, bo, he, ey, be, za
    expect(screen.getByText('fi')).toBeInTheDocument();
    expect(screen.getByText('st')).toBeInTheDocument();
    expect(screen.getByText('fl')).toBeInTheDocument();
    expect(screen.getByText('bo')).toBeInTheDocument();
    expect(screen.getByText('he')).toBeInTheDocument();
    expect(screen.getByText('ey')).toBeInTheDocument();
    expect(screen.getByText('be')).toBeInTheDocument();
    expect(screen.getByText('za')).toBeInTheDocument();

    // Color picker label and 4 color buttons
    expect(screen.getByText('saved_views.color_label')).toBeInTheDocument();
    // 4 color swatches are rendered (sage, lavender, amber, slate)
    const colorButtons = document.querySelectorAll('.rounded-full');
    expect(colorButtons.length).toBe(4);
  });
});
