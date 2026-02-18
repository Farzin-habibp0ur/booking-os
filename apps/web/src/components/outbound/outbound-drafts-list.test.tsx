import { render, screen, fireEvent } from '@testing-library/react';
import { OutboundDraftsList } from './outbound-drafts-list';

const mockDrafts = [
  {
    id: 'ob1',
    content: 'Hi Emma, your appointment is ready',
    status: 'DRAFT',
    channel: 'WHATSAPP',
    customer: { id: 'c1', name: 'Emma Wilson' },
    staff: { id: 's1', name: 'Sarah' },
    createdAt: '2026-02-18T10:00:00Z',
  },
  {
    id: 'ob2',
    content: 'Reminder: deposit needed',
    status: 'APPROVED',
    channel: 'WHATSAPP',
    customer: { id: 'c2', name: 'John Smith' },
    staff: { id: 's1', name: 'Sarah' },
    createdAt: '2026-02-18T09:00:00Z',
  },
];

describe('OutboundDraftsList', () => {
  it('renders all drafts', () => {
    render(<OutboundDraftsList drafts={mockDrafts} />);

    expect(screen.getByTestId('outbound-drafts-list')).toBeInTheDocument();
    expect(screen.getByTestId('draft-ob1')).toBeInTheDocument();
    expect(screen.getByTestId('draft-ob2')).toBeInTheDocument();
  });

  it('shows customer name', () => {
    render(<OutboundDraftsList drafts={mockDrafts} />);

    expect(screen.getByText('Emma Wilson')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('shows status badges', () => {
    render(<OutboundDraftsList drafts={mockDrafts} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows approve/reject buttons only for DRAFT status', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();

    render(<OutboundDraftsList drafts={mockDrafts} onApprove={onApprove} onReject={onReject} />);

    expect(screen.getByTestId('approve-draft-ob1')).toBeInTheDocument();
    expect(screen.queryByTestId('approve-draft-ob2')).not.toBeInTheDocument();
  });

  it('calls onApprove when approve clicked', () => {
    const onApprove = jest.fn();

    render(<OutboundDraftsList drafts={mockDrafts} onApprove={onApprove} />);
    fireEvent.click(screen.getByTestId('approve-draft-ob1'));

    expect(onApprove).toHaveBeenCalledWith('ob1');
  });

  it('calls onReject when reject clicked', () => {
    const onReject = jest.fn();

    render(<OutboundDraftsList drafts={mockDrafts} onReject={onReject} />);
    fireEvent.click(screen.getByTestId('reject-ob1'));

    expect(onReject).toHaveBeenCalledWith('ob1');
  });

  it('shows empty state when no drafts', () => {
    render(<OutboundDraftsList drafts={[]} />);

    expect(screen.getByTestId('drafts-empty')).toBeInTheDocument();
  });
});
