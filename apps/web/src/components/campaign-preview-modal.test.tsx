import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignPreviewModal from './campaign-preview-modal';

// Mock lucide-react
jest.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon" />,
}));

describe('CampaignPreviewModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    content: 'Hello {{name}}, your {{service}} is coming up!',
    channel: 'WHATSAPP',
    businessName: 'Glow Clinic',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<CampaignPreviewModal {...defaultProps} />);
    expect(screen.getByTestId('preview-modal')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<CampaignPreviewModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();
  });

  it('shows all three device mockups', () => {
    render(<CampaignPreviewModal {...defaultProps} />);
    expect(screen.getByTestId('preview-whatsapp')).toBeInTheDocument();
    expect(screen.getByTestId('preview-sms')).toBeInTheDocument();
    expect(screen.getByTestId('preview-email')).toBeInTheDocument();
  });

  it('replaces merge variables with sample data', () => {
    render(<CampaignPreviewModal {...defaultProps} />);
    // Should show "Sarah" instead of "{{name}}"
    const sarahInstances = screen.getAllByText(/Sarah/);
    expect(sarahInstances.length).toBeGreaterThan(0);
    // Should show "Botox Treatment" instead of "{{service}}"
    const serviceInstances = screen.getAllByText(/Botox Treatment/);
    expect(serviceInstances.length).toBeGreaterThan(0);
  });

  it('displays business name in previews', () => {
    render(<CampaignPreviewModal {...defaultProps} />);
    const nameInstances = screen.getAllByText('Glow Clinic');
    expect(nameInstances.length).toBeGreaterThan(0);
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<CampaignPreviewModal {...defaultProps} />);

    const closeButton = screen.getByTestId('x-icon').closest('button');
    if (closeButton) {
      await user.click(closeButton);
    }
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
