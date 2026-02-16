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
});
