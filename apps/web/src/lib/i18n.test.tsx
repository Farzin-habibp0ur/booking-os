import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nProvider, useI18n } from './i18n';
import { api } from './api';
import { useAuth } from './auth';

jest.mock('./api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('./auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../locales/en.json', () => ({
  common: { hello: 'Hello', greeting: 'Hi {{name}}' },
  nested: { deep: { key: 'Deep Value' } },
}));
jest.mock('../locales/es.json', () => ({
  common: { hello: 'Hola', greeting: 'Hola {{name}}' },
}));

function TestConsumer({ tKey, vars }: { tKey: string; vars?: Record<string, string | number> }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <span data-testid="result">{t(tKey, vars)}</span>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale('es')}>Switch to ES</button>
    </div>
  );
}

describe('I18nProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    (api.get as jest.Mock).mockRejectedValue(new Error('no overrides'));
  });

  it('returns English translation for known key', () => {
    render(
      <I18nProvider>
        <TestConsumer tKey="common.hello" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('result')).toHaveTextContent('Hello');
  });

  it('returns nested key value', () => {
    render(
      <I18nProvider>
        <TestConsumer tKey="nested.deep.key" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('result')).toHaveTextContent('Deep Value');
  });

  it('performs variable interpolation', () => {
    render(
      <I18nProvider>
        <TestConsumer tKey="common.greeting" vars={{ name: 'World' }} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('result')).toHaveTextContent('Hi World');
  });

  it('returns key string as fallback for unknown key', () => {
    render(
      <I18nProvider>
        <TestConsumer tKey="nonexistent.key" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('result')).toHaveTextContent('nonexistent.key');
  });

  it('falls back to English when current locale key is missing', async () => {
    localStorage.setItem('locale', 'es');

    render(
      <I18nProvider>
        <TestConsumer tKey="nested.deep.key" />
      </I18nProvider>,
    );

    // nested.deep.key is missing in es.json, so should fall back to English 'Deep Value'
    expect(screen.getByTestId('result')).toHaveTextContent('Deep Value');
  });

  it('uses DB override when available', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'u1', businessId: 'b1', locale: 'en' },
    });
    (api.get as jest.Mock).mockResolvedValue({ 'common.hello': 'Override' });

    render(
      <I18nProvider>
        <TestConsumer tKey="common.hello" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('Override');
    });
  });

  it('locale defaults to en', () => {
    render(
      <I18nProvider>
        <TestConsumer tKey="common.hello" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });

  it('setLocale persists to localStorage', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'u1', businessId: 'b1', locale: 'en' },
    });
    (api.patch as jest.Mock).mockResolvedValue({});
    (api.get as jest.Mock).mockResolvedValue({});

    render(
      <I18nProvider>
        <TestConsumer tKey="common.hello" />
      </I18nProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Switch to ES'));
    });

    expect(localStorage.getItem('locale')).toBe('es');
  });
});
