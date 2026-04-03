import { renderHook, act } from '@testing-library/react';

// Mock dependencies before importing the hook
const mockApiPatch = jest.fn();
jest.mock('./api', () => ({ api: { patch: (...args: any[]) => mockApiPatch(...args) } }));

let mockUser: any = null;
jest.mock('./auth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('./vertical-pack', () => ({ usePack: () => ({ name: 'general' }) }));

import { ModeProvider, useMode } from './use-mode';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ModeProvider>{children}</ModeProvider>;
}

describe('useMode — modeReady', () => {
  beforeEach(() => {
    mockUser = null;
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('modeReady becomes true after user loads', async () => {
    mockUser = { id: 'u1', role: 'ADMIN' };
    const { result } = renderHook(() => useMode(), { wrapper });
    // After the re-derive effect fires, modeReady should be true
    await act(async () => {});
    expect(result.current.modeReady).toBe(true);
  });

  it('setMode with a mode the user cannot access does not change state', async () => {
    mockUser = { id: 'u1', role: 'SERVICE_PROVIDER' };
    const { result } = renderHook(() => useMode(), { wrapper });
    await act(async () => {});
    const initialMode = result.current.mode;
    act(() => {
      result.current.setMode('admin'); // SERVICE_PROVIDER cannot access admin mode
    });
    expect(result.current.mode).toBe(initialMode);
  });

  it('setMode with a valid mode updates state', async () => {
    mockUser = { id: 'u1', role: 'ADMIN' };
    const { result } = renderHook(() => useMode(), { wrapper });
    await act(async () => {});
    act(() => {
      result.current.setMode('agent');
    });
    expect(result.current.mode).toBe('agent');
  });

  it('stale admin localStorage with SERVICE_PROVIDER user is ignored', async () => {
    localStorage.setItem('app-mode', 'admin');
    mockUser = { id: 'u1', role: 'SERVICE_PROVIDER' };
    const { result } = renderHook(() => useMode(), { wrapper });
    await act(async () => {});
    // admin is not in SERVICE_PROVIDER's available modes — should fall back to provider
    expect(result.current.mode).toBe('provider');
  });
});
