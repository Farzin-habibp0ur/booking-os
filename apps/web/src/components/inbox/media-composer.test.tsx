import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaComposer } from './media-composer';

// Mock the api module
jest.mock('@/lib/api', () => ({
  api: {
    upload: jest.fn().mockResolvedValue({ id: 'msg1' }),
  },
}));

jest.mock('@/lib/toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

describe('MediaComposer', () => {
  const mockOnUploadComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders attach button', () => {
    render(<MediaComposer conversationId="conv1" onUploadComplete={mockOnUploadComplete} />);
    expect(screen.getByTestId('media-attach-button')).toBeInTheDocument();
  });

  it('shows file preview after selection', async () => {
    render(<MediaComposer conversationId="conv1" onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('media-file-input');

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  it('clears file on clear button click', async () => {
    render(<MediaComposer conversationId="conv1" onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('media-file-input');

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('media-clear')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('media-clear'));

    await waitFor(() => {
      expect(screen.getByTestId('media-attach-button')).toBeInTheDocument();
    });
  });
});
