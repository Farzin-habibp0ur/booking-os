import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlaybookPreviewModal } from './playbook-preview-modal';

jest.mock('lucide-react', () => ({
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
  MessageSquare: (props: any) => <svg data-testid="msg-icon" {...props} />,
  Mail: (props: any) => <svg data-testid="mail-icon" {...props} />,
  Smartphone: (props: any) => <svg data-testid="phone-icon" {...props} />,
}));

const mockPlaybook = {
  name: 'No-Show Prevention',
  description: 'Send reminders before appointments',
  playbook: 'no-show-prevention',
};

const sampleMessage = 'Hi {name}, reminder about your {service} at {time}.';

describe('PlaybookPreviewModal', () => {
  it('renders playbook name and description', () => {
    render(
      <PlaybookPreviewModal
        playbook={mockPlaybook}
        sampleMessage={sampleMessage}
        businessName="Glow Clinic"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Preview: No-Show Prevention')).toBeInTheDocument();
    expect(screen.getByText('Send reminders before appointments')).toBeInTheDocument();
  });

  it('shows preview with interpolated variables', () => {
    render(
      <PlaybookPreviewModal
        playbook={mockPlaybook}
        sampleMessage={sampleMessage}
        businessName="Glow Clinic"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText(/Hi Sarah, reminder about your Hydra Facial/)).toBeInTheDocument();
  });

  it('highlights variables in template view', () => {
    render(
      <PlaybookPreviewModal
        playbook={mockPlaybook}
        sampleMessage={sampleMessage}
        businessName="Glow Clinic"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('{name}')).toHaveClass('bg-lavender-100');
  });

  it('allows editing the message template', () => {
    render(
      <PlaybookPreviewModal
        playbook={mockPlaybook}
        sampleMessage={sampleMessage}
        businessName="Glow Clinic"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    const editor = screen.getByTestId('message-editor');
    fireEvent.change(editor, { target: { value: 'Custom message' } });
    expect(editor).toHaveValue('Custom message');
  });

  it('calls onConfirm with message override when message is edited', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <PlaybookPreviewModal
        playbook={mockPlaybook}
        sampleMessage={sampleMessage}
        businessName="Glow Clinic"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );
    const editor = screen.getByTestId('message-editor');
    fireEvent.change(editor, { target: { value: 'Custom message' } });
    fireEvent.click(screen.getByTestId('confirm-activate-btn'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({ whatsapp: 'Custom message' });
    });
  });

  it('calls onConfirm without override when message is unchanged', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(
      <PlaybookPreviewModal
        playbook={mockPlaybook}
        sampleMessage={sampleMessage}
        businessName="Glow Clinic"
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('confirm-activate-btn'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(undefined);
    });
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <PlaybookPreviewModal
        playbook={mockPlaybook}
        sampleMessage={sampleMessage}
        businessName="Glow Clinic"
        onConfirm={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
