import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoGallery } from './photo-gallery';

const mockPhotos = [
  {
    id: 'p1',
    type: 'BEFORE',
    bodyArea: 'face',
    fileUrl: '/file/p1.jpg',
    thumbnailUrl: '/thumb/p1.jpg',
    notes: 'Before treatment',
    takenAt: '2026-01-15T12:00:00Z',
    booking: { id: 'b1', startTime: '2026-01-15T10:00:00Z', service: { name: 'Botox' } },
    takenBy: { id: 's1', name: 'Dr. Smith' },
  },
  {
    id: 'p2',
    type: 'AFTER',
    bodyArea: 'face',
    fileUrl: '/file/p2.jpg',
    thumbnailUrl: '/thumb/p2.jpg',
    takenAt: '2026-02-15T12:00:00Z',
    booking: null,
    takenBy: null,
  },
  {
    id: 'p3',
    type: 'BEFORE',
    bodyArea: 'lips',
    fileUrl: '/file/p3.jpg',
    takenAt: '2026-01-20T12:00:00Z',
    booking: null,
    takenBy: null,
  },
];

describe('PhotoGallery', () => {
  it('renders gallery with photos', () => {
    render(<PhotoGallery photos={mockPhotos} />);
    expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
    expect(screen.getAllByTestId('photo-card')).toHaveLength(3);
  });

  it('shows photo count', () => {
    render(<PhotoGallery photos={mockPhotos} />);
    expect(screen.getByText('3 photos')).toBeInTheDocument();
  });

  it('shows empty state when no photos', () => {
    render(<PhotoGallery photos={[]} />);
    expect(screen.getByText('No photos found')).toBeInTheDocument();
  });

  it('filters by type', () => {
    render(<PhotoGallery photos={mockPhotos} />);
    const typeFilter = screen.getByLabelText('Filter by type');
    fireEvent.change(typeFilter, { target: { value: 'AFTER' } });
    expect(screen.getAllByTestId('photo-card')).toHaveLength(1);
    expect(screen.getByText('1 photo')).toBeInTheDocument();
  });

  it('filters by body area', () => {
    render(<PhotoGallery photos={mockPhotos} />);
    const areaFilter = screen.getByLabelText('Filter by body area');
    fireEvent.change(areaFilter, { target: { value: 'lips' } });
    expect(screen.getAllByTestId('photo-card')).toHaveLength(1);
  });

  it('opens lightbox on photo click', () => {
    render(<PhotoGallery photos={mockPhotos} />);
    const cards = screen.getAllByTestId('photo-card');
    fireEvent.click(cards[0]);
    // Lightbox should show the photo notes
    expect(screen.getByText('Before treatment')).toBeInTheDocument();
  });

  it('closes lightbox on X click', () => {
    render(<PhotoGallery photos={mockPhotos} />);
    fireEvent.click(screen.getAllByTestId('photo-card')[0]);
    expect(screen.getByText('Before treatment')).toBeInTheDocument();

    // Click the close button (X icon)
    const closeButtons = screen.getAllByRole('button');
    const lightboxClose = closeButtons.find((btn) => btn.className.includes('text-white'));
    if (lightboxClose) fireEvent.click(lightboxClose);
  });
});
