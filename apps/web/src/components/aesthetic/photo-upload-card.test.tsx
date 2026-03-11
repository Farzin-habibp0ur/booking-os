import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotoUploadCard } from './photo-upload-card';

jest.mock('@/lib/api', () => ({
  api: {
    upload: jest.fn().mockResolvedValue({ id: 'p1' }),
  },
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

describe('PhotoUploadCard', () => {
  it('renders upload card', () => {
    render(<PhotoUploadCard customerId="c1" />);
    expect(screen.getByTestId('photo-upload-card')).toBeInTheDocument();
    expect(screen.getByText('Upload Clinical Photo')).toBeInTheDocument();
  });

  it('renders drop zone', () => {
    render(<PhotoUploadCard customerId="c1" />);
    expect(screen.getByTestId('photo-drop-zone')).toBeInTheDocument();
    expect(screen.getByText('Drop an image or click to browse')).toBeInTheDocument();
  });

  it('renders photo type buttons', () => {
    render(<PhotoUploadCard customerId="c1" />);
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('renders body area selector', () => {
    render(<PhotoUploadCard customerId="c1" />);
    expect(screen.getByLabelText('Body area')).toBeInTheDocument();
  });

  it('shows suggested body areas banner', () => {
    render(<PhotoUploadCard customerId="c1" suggestedBodyAreas={['face', 'lips']} />);
    expect(screen.getByText('After photos suggested')).toBeInTheDocument();
    expect(screen.getByText('Before photos exist for: face, lips')).toBeInTheDocument();
  });

  it('switches photo type on click', () => {
    render(<PhotoUploadCard customerId="c1" />);
    const afterBtn = screen.getByText('After');
    fireEvent.click(afterBtn);
    expect(afterBtn.className).toContain('bg-sage-600');
  });
});
