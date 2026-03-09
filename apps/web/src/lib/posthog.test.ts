/* eslint-disable @typescript-eslint/no-require-imports */
const mockInit = jest.fn();
const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    init: mockInit,
    capture: mockCapture,
    identify: mockIdentify,
    reset: mockReset,
  },
}));

describe('posthog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('initPostHog calls posthog.init when env var is present', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const mod = require('./posthog');
    mod.initPostHog();
    expect(mockInit).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({ capture_pageview: true }),
    );
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it('initPostHog does not call posthog.init when no env var', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const mod = require('./posthog');
    mod.initPostHog();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('captureEvent calls posthog.capture when initialized', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const mod = require('./posthog');
    mod.initPostHog();
    mod.captureEvent('test_event', { foo: 'bar' });
    expect(mockCapture).toHaveBeenCalledWith('test_event', { foo: 'bar' });
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it('captureEvent does not call posthog.capture when not initialized', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const mod = require('./posthog');
    mod.captureEvent('test_event');
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('identifyUser calls posthog.identify when initialized', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const mod = require('./posthog');
    mod.initPostHog();
    mod.identifyUser('user-1', { email: 'test@test.com' });
    expect(mockIdentify).toHaveBeenCalledWith('user-1', { email: 'test@test.com' });
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it('resetUser calls posthog.reset when initialized', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const mod = require('./posthog');
    mod.initPostHog();
    mod.resetUser();
    expect(mockReset).toHaveBeenCalled();
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it('isEnabled returns false when not initialized', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const mod = require('./posthog');
    expect(mod.isEnabled()).toBe(false);
  });

  it('isEnabled returns true when initialized', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    const mod = require('./posthog');
    mod.initPostHog();
    expect(mod.isEnabled()).toBe(true);
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });
});
