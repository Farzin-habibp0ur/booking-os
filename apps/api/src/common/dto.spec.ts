import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateBookingDto,
  CreateCustomerDto,
  CreateStaffDto,
  CreateServiceDto,
  CreateTemplateDto,
  AddNoteDto,
  WorkingHoursEntryDto,
  UpdateSavedViewDto,
} from './dto';

describe('DTO Validation (Security)', () => {
  describe('CreateBookingDto', () => {
    it('rejects notes exceeding 2000 chars', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        customerId: 'c1',
        serviceId: 's1',
        startTime: '2026-03-01T10:00:00Z',
        notes: 'a'.repeat(2001),
      });
      const errors = await validate(dto);
      const noteErr = errors.find((e) => e.property === 'notes');
      expect(noteErr).toBeDefined();
    });

    it('accepts notes within 2000 chars', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        customerId: 'c1',
        serviceId: 's1',
        startTime: '2026-03-01T10:00:00Z',
        notes: 'a'.repeat(2000),
      });
      const errors = await validate(dto);
      const noteErr = errors.find((e) => e.property === 'notes');
      expect(noteErr).toBeUndefined();
    });

    it('rejects forceBookReason exceeding 500 chars', async () => {
      const dto = plainToInstance(CreateBookingDto, {
        customerId: 'c1',
        serviceId: 's1',
        startTime: '2026-03-01T10:00:00Z',
        forceBook: true,
        forceBookReason: 'a'.repeat(501),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'forceBookReason');
      expect(err).toBeDefined();
    });
  });

  describe('CreateCustomerDto', () => {
    it('rejects name exceeding 200 chars', async () => {
      const dto = plainToInstance(CreateCustomerDto, {
        name: 'a'.repeat(201),
        phone: '+1234567890',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'name');
      expect(err).toBeDefined();
    });

    it('rejects phone exceeding 30 chars', async () => {
      const dto = plainToInstance(CreateCustomerDto, {
        name: 'Test',
        phone: '1'.repeat(31),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'phone');
      expect(err).toBeDefined();
    });

    it('rejects email exceeding 254 chars', async () => {
      const dto = plainToInstance(CreateCustomerDto, {
        name: 'Test',
        phone: '+1234567890',
        email: 'a'.repeat(245) + '@test.com',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'email');
      expect(err).toBeDefined();
    });
  });

  describe('CreateStaffDto', () => {
    it('rejects password shorter than 8 chars', async () => {
      const dto = plainToInstance(CreateStaffDto, {
        name: 'Test Staff',
        email: 'test@example.com',
        password: 'short',
        role: 'ADMIN',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'password');
      expect(err).toBeDefined();
    });

    it('rejects password exceeding 128 chars', async () => {
      const dto = plainToInstance(CreateStaffDto, {
        name: 'Test Staff',
        email: 'test@example.com',
        password: 'a'.repeat(129),
        role: 'ADMIN',
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'password');
      expect(err).toBeDefined();
    });

    it('accepts valid password of 8+ chars', async () => {
      const dto = plainToInstance(CreateStaffDto, {
        name: 'Test Staff',
        email: 'test@example.com',
        password: 'ValidPass1',
        role: 'ADMIN',
      });
      const errors = await validate(dto);
      const passErr = errors.find((e) => e.property === 'password');
      expect(passErr).toBeUndefined();
    });
  });

  describe('CreateServiceDto', () => {
    it('rejects name exceeding 200 chars', async () => {
      const dto = plainToInstance(CreateServiceDto, {
        name: 'a'.repeat(201),
        durationMins: 30,
        price: 100,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'name');
      expect(err).toBeDefined();
    });
  });

  describe('CreateTemplateDto', () => {
    it('rejects body exceeding 10000 chars', async () => {
      const dto = plainToInstance(CreateTemplateDto, {
        name: 'Test Template',
        category: 'general',
        body: 'a'.repeat(10001),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'body');
      expect(err).toBeDefined();
    });
  });

  describe('AddNoteDto', () => {
    it('rejects content exceeding 5000 chars', async () => {
      const dto = plainToInstance(AddNoteDto, {
        content: 'a'.repeat(5001),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'content');
      expect(err).toBeDefined();
    });

    it('accepts content within 5000 chars', async () => {
      const dto = plainToInstance(AddNoteDto, {
        content: 'a'.repeat(5000),
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'content');
      expect(err).toBeUndefined();
    });
  });

  describe('WorkingHoursEntryDto', () => {
    it('rejects dayOfWeek below 0', async () => {
      const dto = plainToInstance(WorkingHoursEntryDto, {
        dayOfWeek: -1,
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'dayOfWeek');
      expect(err).toBeDefined();
    });

    it('rejects dayOfWeek above 6', async () => {
      const dto = plainToInstance(WorkingHoursEntryDto, {
        dayOfWeek: 7,
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'dayOfWeek');
      expect(err).toBeDefined();
    });

    it('accepts dayOfWeek in range 0-6', async () => {
      const dto = plainToInstance(WorkingHoursEntryDto, {
        dayOfWeek: 3,
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'dayOfWeek');
      expect(err).toBeUndefined();
    });
  });

  describe('UpdateSavedViewDto', () => {
    it('rejects negative sortOrder', async () => {
      const dto = plainToInstance(UpdateSavedViewDto, {
        sortOrder: -1,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'sortOrder');
      expect(err).toBeDefined();
    });

    it('rejects non-integer sortOrder', async () => {
      const dto = plainToInstance(UpdateSavedViewDto, {
        sortOrder: 1.5,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'sortOrder');
      expect(err).toBeDefined();
    });

    it('accepts valid sortOrder', async () => {
      const dto = plainToInstance(UpdateSavedViewDto, {
        sortOrder: 5,
      });
      const errors = await validate(dto);
      const err = errors.find((e) => e.property === 'sortOrder');
      expect(err).toBeUndefined();
    });
  });
});
