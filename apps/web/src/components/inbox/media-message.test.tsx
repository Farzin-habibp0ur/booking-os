import { render, screen, fireEvent } from '@testing-library/react';
import { MediaMessage } from './media-message';

describe('MediaMessage', () => {
  const imageAttachment = {
    id: 'att1',
    fileName: 'photo.jpg',
    fileType: 'image/jpeg',
    fileSize: 1024 * 500,
    storageKey: 'abc.jpg',
  };

  const docAttachment = {
    id: 'att2',
    fileName: 'contract.pdf',
    fileType: 'application/pdf',
    fileSize: 1024 * 1024 * 2,
    storageKey: 'def.pdf',
  };

  const audioAttachment = {
    id: 'att3',
    fileName: 'voice.mp3',
    fileType: 'audio/mpeg',
    fileSize: 1024 * 800,
    storageKey: 'ghi.mp3',
  };

  it('renders nothing when no attachments', () => {
    const { container } = render(<MediaMessage attachments={[]} direction="OUTBOUND" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders image attachment with thumbnail', () => {
    render(<MediaMessage attachments={[imageAttachment]} direction="OUTBOUND" />);
    expect(screen.getByTestId('media-image-att1')).toBeInTheDocument();
  });

  it('opens lightbox when image clicked', () => {
    render(<MediaMessage attachments={[imageAttachment]} direction="OUTBOUND" />);
    fireEvent.click(screen.getByTestId('media-image-att1'));
    expect(screen.getByTestId('media-lightbox')).toBeInTheDocument();
  });

  it('renders document attachment with download', () => {
    render(<MediaMessage attachments={[docAttachment]} direction="OUTBOUND" />);
    expect(screen.getByTestId('media-document-att2')).toBeInTheDocument();
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
  });

  it('renders audio attachment with player', () => {
    render(<MediaMessage attachments={[audioAttachment]} direction="INBOUND" />);
    expect(screen.getByTestId('media-audio-att3')).toBeInTheDocument();
  });

  it('renders multiple attachment types', () => {
    render(<MediaMessage attachments={[imageAttachment, docAttachment]} direction="OUTBOUND" />);
    expect(screen.getByTestId('media-image-att1')).toBeInTheDocument();
    expect(screen.getByTestId('media-document-att2')).toBeInTheDocument();
  });
});
