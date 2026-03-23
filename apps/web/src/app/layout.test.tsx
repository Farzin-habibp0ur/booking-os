import fs from 'fs';
import path from 'path';

describe('RootLayout', () => {
  it('does not register a service worker', () => {
    const layoutSource = fs.readFileSync(path.join(__dirname, 'layout.tsx'), 'utf-8');
    expect(layoutSource).not.toContain('serviceWorker');
    expect(layoutSource).not.toContain('sw.js');
  });

  it('keeps manifest.json link for basic PWA metadata', () => {
    const layoutSource = fs.readFileSync(path.join(__dirname, 'layout.tsx'), 'utf-8');
    expect(layoutSource).toContain('manifest');
  });
});
