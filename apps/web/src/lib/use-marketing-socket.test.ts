jest.mock('./use-socket', () => ({
  useSocket: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/ai/actions',
}));

import { renderHook } from '@testing-library/react';
import { useSocket } from './use-socket';
import { useMarketingSocket } from './use-marketing-socket';

const mockUseSocket = useSocket as jest.Mock;

describe('useMarketingSocket', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers 4 socket events', () => {
    renderHook(() => useMarketingSocket());
    expect(mockUseSocket).toHaveBeenCalledTimes(1);
    const events = mockUseSocket.mock.calls[0][0];
    expect(events).toHaveProperty('action-card:created');
    expect(events).toHaveProperty('action-card:updated');
    expect(events).toHaveProperty('agent-run:completed');
    expect(events).toHaveProperty('content-draft:status-changed');
  });

  it('calls onActionCardCreated when event fires', () => {
    const onActionCardCreated = jest.fn();
    renderHook(() => useMarketingSocket({ onActionCardCreated }));
    const events = mockUseSocket.mock.calls[0][0];
    events['action-card:created']({ id: '1' });
    expect(onActionCardCreated).toHaveBeenCalledWith({ id: '1' });
  });

  it('calls onActionCardUpdated when event fires', () => {
    const onActionCardUpdated = jest.fn();
    renderHook(() => useMarketingSocket({ onActionCardUpdated }));
    const events = mockUseSocket.mock.calls[0][0];
    events['action-card:updated']({ id: '2' });
    expect(onActionCardUpdated).toHaveBeenCalledWith({ id: '2' });
  });

  it('calls onAgentRunCompleted when event fires', () => {
    const onAgentRunCompleted = jest.fn();
    renderHook(() => useMarketingSocket({ onAgentRunCompleted }));
    const events = mockUseSocket.mock.calls[0][0];
    events['agent-run:completed']({ agentType: 'MKT_BLOG_WRITER', cardsCreated: 3 });
    expect(onAgentRunCompleted).toHaveBeenCalledWith({
      agentType: 'MKT_BLOG_WRITER',
      cardsCreated: 3,
    });
  });

  it('calls onContentDraftStatusChanged when event fires', () => {
    const onContentDraftStatusChanged = jest.fn();
    renderHook(() => useMarketingSocket({ onContentDraftStatusChanged }));
    const events = mockUseSocket.mock.calls[0][0];
    events['content-draft:status-changed']({ id: 'd1', status: 'APPROVED' });
    expect(onContentDraftStatusChanged).toHaveBeenCalledWith({ id: 'd1', status: 'APPROVED' });
  });

  it('does not throw when handlers are not provided', () => {
    renderHook(() => useMarketingSocket());
    const events = mockUseSocket.mock.calls[0][0];
    expect(() => events['action-card:created']({ id: '1' })).not.toThrow();
    expect(() => events['agent-run:completed']({ agentType: 'X', cardsCreated: 0 })).not.toThrow();
  });
});
