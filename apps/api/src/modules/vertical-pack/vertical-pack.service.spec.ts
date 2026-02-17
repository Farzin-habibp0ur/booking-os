import { VerticalPackService } from './vertical-pack.service';

describe('VerticalPackService', () => {
  let service: VerticalPackService;

  beforeEach(() => {
    service = new VerticalPackService();
  });

  it('returns the aesthetic pack', () => {
    const pack = service.getPack('aesthetic');
    expect(pack.name).toBe('aesthetic');
  });

  it('aesthetic pack has 7 customerFields', () => {
    const pack = service.getPack('aesthetic');
    expect(pack.customerFields).toHaveLength(7);
  });

  it('aesthetic pack contains all expected intake fields', () => {
    const pack = service.getPack('aesthetic');
    const keys = pack.customerFields.map((f) => f.key);
    expect(keys).toEqual([
      'isMedicalFlagged',
      'allergies',
      'concernArea',
      'desiredTreatment',
      'budget',
      'preferredProvider',
      'contraindications',
    ]);
  });

  it('budget field has select type with 4 options', () => {
    const pack = service.getPack('aesthetic');
    const budget = pack.customerFields.find((f) => f.key === 'budget');
    expect(budget?.type).toBe('select');
    expect(budget?.options).toHaveLength(4);
  });

  it('throws NotFoundException for unknown pack', () => {
    expect(() => service.getPack('unknown')).toThrow();
  });

  // ─── Dealership pack ──────────────────────────────────────────────────

  it('returns the dealership pack', () => {
    const pack = service.getPack('dealership');
    expect(pack.name).toBe('dealership');
  });

  it('dealership pack has correct labels', () => {
    const pack = service.getPack('dealership');
    expect(pack.labels).toEqual({
      customer: 'Client',
      booking: 'Appointment',
      service: 'Service',
    });
  });

  it('dealership pack has 6 vehicle dossier fields', () => {
    const pack = service.getPack('dealership');
    expect(pack.customerFields).toHaveLength(6);
  });

  it('dealership pack contains all expected intake fields', () => {
    const pack = service.getPack('dealership');
    const keys = pack.customerFields.map((f) => f.key);
    expect(keys).toEqual(['make', 'model', 'year', 'vin', 'mileage', 'interestType']);
  });

  it('dealership make and model fields are required', () => {
    const pack = service.getPack('dealership');
    const make = pack.customerFields.find((f) => f.key === 'make');
    const model = pack.customerFields.find((f) => f.key === 'model');
    expect(make?.required).toBe(true);
    expect(model?.required).toBe(true);
  });

  it('dealership interestType field has select type with 4 options', () => {
    const pack = service.getPack('dealership');
    const interestType = pack.customerFields.find((f) => f.key === 'interestType');
    expect(interestType?.type).toBe('select');
    expect(interestType?.options).toEqual(['New', 'Used', 'Trade-in', 'Service']);
  });

  it('dealership year and mileage fields are number type', () => {
    const pack = service.getPack('dealership');
    const year = pack.customerFields.find((f) => f.key === 'year');
    const mileage = pack.customerFields.find((f) => f.key === 'mileage');
    expect(year?.type).toBe('number');
    expect(mileage?.type).toBe('number');
  });

  it('dealership pack has 5 default services', () => {
    const pack = service.getPack('dealership');
    expect(pack.defaultServices).toHaveLength(5);
  });

  it('dealership default services include Test Drive and Oil Change', () => {
    const pack = service.getPack('dealership');
    const names = pack.defaultServices?.map((s) => s.name);
    expect(names).toContain('Test Drive');
    expect(names).toContain('Oil Change');
    expect(names).toContain('Routine Maintenance');
    expect(names).toContain('Brake Service');
    expect(names).toContain('Diagnostic Check');
  });

  it('dealership Test Drive is CONSULT type', () => {
    const pack = service.getPack('dealership');
    const testDrive = pack.defaultServices?.find((s) => s.name === 'Test Drive');
    expect(testDrive?.kind).toBe('CONSULT');
    expect(testDrive?.durationMins).toBe(30);
    expect(testDrive?.price).toBe(0);
  });

  it('dealership pack has 10 default templates', () => {
    const pack = service.getPack('dealership');
    expect(pack.defaultTemplates).toHaveLength(10);
  });

  it('dealership templates include dealership-specific ones', () => {
    const pack = service.getPack('dealership');
    const names = pack.defaultTemplates.map((t) => t.name);
    expect(names).toContain('Car Ready for Pickup');
    expect(names).toContain('Service Status Update');
    expect(names).toContain('Quote Approval Request');
    expect(names).toContain('6-Month Maintenance Nudge');
    expect(names).toContain('Test Drive Confirmation');
  });

  it('dealership pack config has kanban enabled', () => {
    const pack = service.getPack('dealership');
    expect(pack.defaultPackConfig?.kanbanEnabled).toBe(true);
    expect(pack.defaultPackConfig?.kanbanStatuses).toEqual([
      'CHECKED_IN',
      'DIAGNOSING',
      'AWAITING_APPROVAL',
      'IN_PROGRESS',
      'READY_FOR_PICKUP',
    ]);
  });

  // ─── getAllPacks ──────────────────────────────────────────────────────

  it('getAllPacks includes dealership', () => {
    const packs = service.getAllPacks();
    expect(packs).toContain('aesthetic');
    expect(packs).toContain('general');
    expect(packs).toContain('dealership');
  });
});
