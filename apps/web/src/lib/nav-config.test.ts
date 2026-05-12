/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — test file uses runtime assertions; Babel transform strips TS syntax
import { getNavItems } from './nav-config';

const baseOpts = {
  t: (key: string) => key,
  packName: 'aesthetic',
  packLabels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
};

describe('nav-config', () => {
  describe('getNavItems — Phase 6 ordering', () => {
    it('returns Inbox first, then AI Front Desk, then Calendar, Waitlist, Customers, Bookings as the primary block', () => {
      const items = getNavItems(baseOpts);
      const hrefs = items.map((i) => i.href);
      // Primary order: Inbox, AI, Calendar, Waitlist, Customers, Bookings
      expect(hrefs.slice(0, 6)).toEqual([
        '/inbox',
        '/ai',
        '/calendar',
        '/waitlist',
        '/customers',
        '/bookings',
      ]);
    });

    it('places /services and /staff (always-visible tools) after the primary block', () => {
      const items = getNavItems(baseOpts);
      const hrefs = items.map((i) => i.href);
      const servicesIdx = hrefs.indexOf('/services');
      const staffIdx = hrefs.indexOf('/staff');
      expect(servicesIdx).toBe(6);
      expect(staffIdx).toBe(7);
    });
  });

  describe('campaignsEnabled feature flag', () => {
    it('hides /campaigns when business.campaignsEnabled is undefined (pilot default)', () => {
      const items = getNavItems(baseOpts);
      const campaigns = items.find((i) => i.href === '/campaigns');
      expect(campaigns).toBeUndefined();
    });

    it('hides /campaigns when business.campaignsEnabled is false', () => {
      const items = getNavItems({ ...baseOpts, business: { campaignsEnabled: false } });
      expect(items.find((i) => i.href === '/campaigns')).toBeUndefined();
    });

    it('shows /campaigns only when business.campaignsEnabled === true', () => {
      const items = getNavItems({ ...baseOpts, business: { campaignsEnabled: true } });
      const campaigns = items.find((i) => i.href === '/campaigns');
      expect(campaigns).toBeDefined();
      expect(campaigns?.label).toBe('nav.campaigns');
    });
  });

  describe('AI Front Desk is admin-only', () => {
    it('/ai item has roles=["ADMIN"] only', () => {
      const items = getNavItems(baseOpts);
      const ai = items.find((i) => i.href === '/ai');
      expect(ai).toBeDefined();
      expect(ai?.roles).toEqual(['ADMIN']);
    });
  });
});
