import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock '@/lib/api'
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

// Mock 'next/link'
jest.mock('next/link', () => {
  const MockLink = ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock 'lucide-react'
jest.mock('lucide-react', () => ({
  Shield: ({ size, className }: any) => (
    <div data-testid="shield-icon" data-size={size} className={className} />
  ),
  Clock: ({ size, className }: any) => (
    <div data-testid="clock-icon" data-size={size} className={className} />
  ),
  MessageSquare: ({ size, className }: any) => (
    <div data-testid="message-square-icon" data-size={size} className={className} />
  ),
  ShieldCheck: ({ size, className }: any) => (
    <div data-testid="shield-check-icon" data-size={size} className={className} />
  ),
}));

// Mock '@/lib/cn'
jest.mock('@/lib/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { AIGuardrails } from './ai-guardrails';
import { api } from '@/lib/api';

const mockStats = {
  processedToday: 42,
  autoReplied: 30,
  draftsCreated: 10,
  failed: 2,
  dailyLimit: 500,
  history: [],
};

const mockSettings = {
  enabled: true,
  autoReply: {
    enabled: true,
    channelOverrides: { WHATSAPP: { enabled: true }, SMS: { enabled: false } },
  },
};

const mockGet = api.get as jest.Mock;

beforeEach(() => {
  mockGet.mockReset();
});

describe('AIGuardrails', () => {
  it('renders guardrails card with data-testid="ai-guardrails"', async () => {
    mockGet.mockResolvedValue({});
    render(<AIGuardrails />);
    // The data-testid is always present (both loading and loaded states)
    expect(screen.getByTestId('ai-guardrails')).toBeInTheDocument();
  });

  it('shows loading skeleton when data is loading', () => {
    // Return a promise that never resolves during the test
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<AIGuardrails />);
    const container = screen.getByTestId('ai-guardrails');
    // Loading skeleton has animate-pulse
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows daily limit text with progress bar', async () => {
    mockGet.mockResolvedValueOnce(mockStats).mockResolvedValueOnce(mockSettings);
    render(<AIGuardrails />);
    await waitFor(() => {
      expect(screen.getByText(/42 \/ 500 used today/)).toBeInTheDocument();
    });
    // Progress bar should exist
    const container = screen.getByTestId('ai-guardrails');
    const progressBar = container.querySelector('.bg-sage-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('shows static safety indicators (clock, sms, booking)', async () => {
    mockGet.mockResolvedValueOnce(mockStats).mockResolvedValueOnce(mockSettings);
    render(<AIGuardrails />);
    await waitFor(() => {
      expect(screen.getByText('Replies only within 24h of last message')).toBeInTheDocument();
    });
    expect(screen.getByText('Auto-shortened to 160 characters')).toBeInTheDocument();
    expect(
      screen.getByText('Cancellations & reschedules require confirmation'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    expect(screen.getByTestId('message-square-icon')).toBeInTheDocument();
    expect(screen.getByTestId('shield-check-icon')).toBeInTheDocument();
  });

  it('shows "Adjust settings" link pointing to /ai/settings', async () => {
    mockGet.mockResolvedValueOnce(mockStats).mockResolvedValueOnce(mockSettings);
    render(<AIGuardrails />);
    await waitFor(() => {
      expect(screen.getByText(/Adjust settings/)).toBeInTheDocument();
    });
    const link = screen.getByText(/Adjust settings/).closest('a');
    expect(link).toHaveAttribute('href', '/ai/settings');
  });

  it('shows channel status (green dot for enabled, gray for disabled based on channelOverrides)', async () => {
    mockGet.mockResolvedValueOnce(mockStats).mockResolvedValueOnce(mockSettings);
    render(<AIGuardrails />);
    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    // WhatsApp is enabled => green dot
    const whatsappLabel = screen.getByText('WhatsApp');
    const whatsappDot = whatsappLabel.previousSibling as HTMLElement;
    expect(whatsappDot).toHaveClass('bg-green-500');

    // SMS is disabled => gray dot
    const smsLabel = screen.getByText('SMS');
    const smsDot = smsLabel.previousSibling as HTMLElement;
    expect(smsDot).not.toHaveClass('bg-green-500');

    // INSTAGRAM, FACEBOOK, EMAIL, WEB_CHAT are not in overrides => default enabled => green dot
    const instagramLabel = screen.getByText('Instagram');
    const instagramDot = instagramLabel.previousSibling as HTMLElement;
    expect(instagramDot).toHaveClass('bg-green-500');
  });
});
