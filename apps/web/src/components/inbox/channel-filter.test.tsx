import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChannelFilterBar } from './channel-filter';

describe('ChannelFilterBar', () => {
  const defaultProps = {
    selected: 'ALL' as const,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all channel tabs', () => {
    render(<ChannelFilterBar {...defaultProps} />);
    expect(screen.getByTestId('channel-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter-whatsapp')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter-instagram')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter-facebook')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter-sms')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter-email')).toBeInTheDocument();
    expect(screen.getByTestId('channel-filter-web_chat')).toBeInTheDocument();
  });

  it('highlights the selected channel', () => {
    render(<ChannelFilterBar selected="SMS" onChange={jest.fn()} />);
    expect(screen.getByTestId('channel-filter-sms')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('channel-filter-all')).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange when a channel tab is clicked', () => {
    render(<ChannelFilterBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('channel-filter-sms'));
    expect(defaultProps.onChange).toHaveBeenCalledWith('SMS');
  });

  it('has proper tablist role', () => {
    render(<ChannelFilterBar {...defaultProps} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  describe('unread count badges', () => {
    it('shows unread count badge on channels with unread messages', () => {
      render(<ChannelFilterBar {...defaultProps} unreadCounts={{ WHATSAPP: 5, SMS: 12 }} />);
      const whatsappTab = screen.getByTestId('channel-filter-whatsapp');
      expect(whatsappTab).toHaveTextContent('5');
      const smsTab = screen.getByTestId('channel-filter-sms');
      expect(smsTab).toHaveTextContent('12');
    });

    it('does not show badge for ALL tab', () => {
      render(<ChannelFilterBar {...defaultProps} unreadCounts={{ WHATSAPP: 5 }} />);
      const allTab = screen.getByTestId('channel-filter-all');
      expect(allTab).toHaveTextContent('All');
      expect(allTab.querySelector('.bg-red-500')).toBeNull();
    });

    it('does not show badge when count is 0', () => {
      render(<ChannelFilterBar {...defaultProps} unreadCounts={{ WHATSAPP: 0 }} />);
      const whatsappTab = screen.getByTestId('channel-filter-whatsapp');
      expect(whatsappTab.querySelector('.bg-red-500')).toBeNull();
    });

    it('shows 99+ when count exceeds 99', () => {
      render(<ChannelFilterBar {...defaultProps} unreadCounts={{ EMAIL: 150 }} />);
      const emailTab = screen.getByTestId('channel-filter-email');
      expect(emailTab).toHaveTextContent('99+');
    });

    it('does not show badges when unreadCounts is not provided', () => {
      render(<ChannelFilterBar {...defaultProps} />);
      const whatsappTab = screen.getByTestId('channel-filter-whatsapp');
      expect(whatsappTab.querySelector('.bg-red-500')).toBeNull();
    });
  });
});
