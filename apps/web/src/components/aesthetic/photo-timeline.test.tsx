import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoTimeline } from './photo-timeline';

const mockPhotos = [
  {
    id: 'p1',
    type: 'BEFORE',
    bodyArea: 'face',
    fileUrl: '/file/p1.jpg',
    thumbnailUrl: '/thumb/p1.jpg',
    notes: 'Initial consultation',
    takenAt: '2026-01-15T12:00:00Z',
    booking: { id: 'b1', startTime: '2026-01-15T10:00:00Z', service: { name: 'Botox' } },
    takenBy: { id: 's1', name: 'Dr. Smith' },
  },
  {
    id: 'p2',
    type: 'AFTER',
    bodyArea: 'face',
    fileUrl: '/file/p2.jpg',
    takenAt: '2026-02-15T12:00:00Z',
    booking: null,
    takenBy: null,
  },
  {
    id: 'p3',
    type: 'PROGRESS',
    bodyArea: 'lips',
    fileUrl: '/file/p3.jpg',
    takenAt: '2026-01-20T12:00:00Z',
    booking: null,
    takenBy: null,
  },
];

describe('PhotoTimeline', () => {
  it('renders empty state', () => {
    render(<PhotoTimeline photos={[]} />);
    expect(screen.getByText('No photos in timeline')).toBeInTheDocument();
  });

  it('renders timeline entries', () => {
    render(<PhotoTimeline photos={mockPhotos} />);
    expect(screen.getByTestId('photo-timeline')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-entry')).toHaveLength(3);
  });

  it('groups by body area', () => {
    render(<PhotoTimeline photos={mockPhotos} />);
    // Should show face and lips sections
    expect(screen.getByText(/Face/)).toBeInTheDocument();
    expect(screen.getByText(/Lips/)).toBeInTheDocument();
  });

  it('shows photo counts per body area', () => {
    render(<PhotoTimeline photos={mockPhotos} />);
    expect(screen.getByText('(2)')).toBeInTheDocument(); // face
    expect(screen.getByText('(1)')).toBeInTheDocument(); // lips
  });

  it('shows photo notes', () => {
    render(<PhotoTimeline photos={mockPhotos} />);
    expect(screen.getByText('Initial consultation')).toBeInTheDocument();
  });

  it('shows booking service name', () => {
    render(<PhotoTimeline photos={mockPhotos} />);
    expect(screen.getByText('Botox')).toBeInTheDocument();
  });

  it('shows staff name', () => {
    render(<PhotoTimeline photos={mockPhotos} />);
    expect(screen.getByText('by Dr. Smith')).toBeInTheDocument();
  });

  it('calls onPhotoClick when thumbnail clicked', () => {
    const onClick = jest.fn();
    render(<PhotoTimeline photos={mockPhotos} onPhotoClick={onClick} />);

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });
});
