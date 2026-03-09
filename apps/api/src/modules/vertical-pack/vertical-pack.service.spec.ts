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

  // ─── Wellness pack ──────────────────────────────────────────────────

  it('returns the wellness pack', () => {
    const pack = service.getPack('wellness');
    expect(pack.name).toBe('wellness');
  });

  it('wellness pack has correct labels', () => {
    const pack = service.getPack('wellness');
    expect(pack.labels).toEqual({
      customer: 'Client',
      booking: 'Session',
      service: 'Service',
    });
  });

  it('wellness pack has 7 customer intake fields', () => {
    const pack = service.getPack('wellness');
    expect(pack.customerFields).toHaveLength(7);
  });

  it('wellness pack contains all expected intake fields', () => {
    const pack = service.getPack('wellness');
    const keys = pack.customerFields.map((f) => f.key);
    expect(keys).toEqual([
      'healthGoals',
      'fitnessLevel',
      'injuries',
      'medications',
      'allergies',
      'preferredModality',
      'membershipType',
    ]);
  });

  it('wellness healthGoals field is required', () => {
    const pack = service.getPack('wellness');
    const healthGoals = pack.customerFields.find((f) => f.key === 'healthGoals');
    expect(healthGoals?.required).toBe(true);
  });

  it('wellness fitnessLevel field has select type with 4 options', () => {
    const pack = service.getPack('wellness');
    const fitnessLevel = pack.customerFields.find((f) => f.key === 'fitnessLevel');
    expect(fitnessLevel?.type).toBe('select');
    expect(fitnessLevel?.options).toEqual(['Beginner', 'Intermediate', 'Advanced', 'Elite']);
  });

  it('wellness preferredModality field has 6 options', () => {
    const pack = service.getPack('wellness');
    const modality = pack.customerFields.find((f) => f.key === 'preferredModality');
    expect(modality?.type).toBe('select');
    expect(modality?.options).toHaveLength(6);
    expect(modality?.options).toContain('Massage');
    expect(modality?.options).toContain('Yoga');
  });

  it('wellness membershipType field has 4 tiers', () => {
    const pack = service.getPack('wellness');
    const membership = pack.customerFields.find((f) => f.key === 'membershipType');
    expect(membership?.type).toBe('select');
    expect(membership?.options).toEqual(['Drop-in', 'Monthly', 'Annual', 'VIP']);
  });

  it('wellness pack has 2 booking fields', () => {
    const pack = service.getPack('wellness');
    expect(pack.bookingFields).toHaveLength(2);
    expect(pack.bookingFields[0].key).toBe('sessionNotes');
    expect(pack.bookingFields[1].key).toBe('pressureLevel');
  });

  it('wellness pack has 6 default services', () => {
    const pack = service.getPack('wellness');
    expect(pack.defaultServices).toHaveLength(6);
  });

  it('wellness default services include all expected services', () => {
    const pack = service.getPack('wellness');
    const names = pack.defaultServices?.map((s) => s.name);
    expect(names).toContain('Initial Wellness Consultation');
    expect(names).toContain('Swedish Massage');
    expect(names).toContain('Deep Tissue Massage');
    expect(names).toContain('Yoga Private Session');
    expect(names).toContain('Personal Training');
    expect(names).toContain('Nutrition Coaching');
  });

  it('wellness Initial Wellness Consultation is CONSULT type and free', () => {
    const pack = service.getPack('wellness');
    const consult = pack.defaultServices?.find((s) => s.name === 'Initial Wellness Consultation');
    expect(consult?.kind).toBe('CONSULT');
    expect(consult?.price).toBe(0);
    expect(consult?.durationMins).toBe(30);
  });

  it('wellness pack has 9 default templates', () => {
    const pack = service.getPack('wellness');
    expect(pack.defaultTemplates).toHaveLength(9);
  });

  it('wellness templates include wellness-specific ones', () => {
    const pack = service.getPack('wellness');
    const names = pack.defaultTemplates.map((t) => t.name);
    expect(names).toContain('Post-Session Follow-up');
    expect(names).toContain('Progress Check-in');
    expect(names).toContain('Wellness Tip');
    expect(names).toContain('Membership Renewal');
  });

  it('wellness pack config has tracking and membership enabled', () => {
    const pack = service.getPack('wellness');
    expect(pack.defaultPackConfig?.trackProgress).toBe(true);
    expect(pack.defaultPackConfig?.membershipEnabled).toBe(true);
    expect(pack.defaultPackConfig?.intakeFormRequired).toBe(true);
  });

  // ─── getAllPacks ──────────────────────────────────────────────────────

  it('getAllPacks includes all packs', () => {
    const packs = service.getAllPacks();
    expect(packs).toContain('aesthetic');
    expect(packs).toContain('general');
    expect(packs).toContain('dealership');
    expect(packs).toContain('wellness');
  });
});
