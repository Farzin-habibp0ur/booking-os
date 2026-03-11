import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { PrismaService } from '../../common/prisma.service';
import { ProfileExtractor } from '../ai/profile-extractor';

describe('CustomerService - getJourney', () => {
  let service: CustomerService;
  let prisma: {
    business: { findUnique: jest.Mock };
    customer: { findFirst: jest.Mock };
    deal: { findMany: jest.Mock };
    testDrive: { findMany: jest.Mock };
    booking: { findMany: jest.Mock };
    conversation: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      business: { findUnique: jest.fn() },
      customer: { findFirst: jest.fn() },
      deal: { findMany: jest.fn().mockResolvedValue([]) },
      testDrive: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      conversation: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfileExtractor, useValue: {} },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  it('returns null for non-dealership businesses', async () => {
    prisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetics' });

    const result = await service.getJourney('biz-1', 'cust-1');
    expect(result).toBeNull();
  });

  it('returns null when customer not found', async () => {
    prisma.business.findUnique.mockResolvedValue({ verticalPack: 'dealership' });
    prisma.customer.findFirst.mockResolvedValue(null);

    const result = await service.getJourney('biz-1', 'cust-1');
    expect(result).toBeNull();
  });

  it('returns journey with deals, test drives, vehicles of interest', async () => {
    prisma.business.findUnique.mockResolvedValue({ verticalPack: 'dealership' });
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-1',
      createdAt: new Date('2026-01-10T10:00:00Z'),
    });

    const mockVehicle = {
      id: 'v1',
      stockNumber: 'AUT-001',
      year: 2025,
      make: 'Toyota',
      model: 'Camry',
      trim: 'XLE',
      askingPrice: 35000,
      status: 'IN_STOCK',
      imageUrls: [],
    };

    prisma.deal.findMany.mockResolvedValue([
      {
        id: 'd1',
        stage: 'NEGOTIATION',
        dealValue: 42000,
        vehicle: mockVehicle,
        assignedTo: { id: 's1', name: 'Mike Sales' },
        stageHistory: [
          { fromStage: null, toStage: 'INQUIRY', createdAt: new Date('2026-01-15T10:00:00Z'), changedBy: null },
        ],
        activities: [],
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
    ]);

    prisma.testDrive.findMany.mockResolvedValue([
      {
        id: 'td1',
        vehicle: { id: 'v1', stockNumber: 'AUT-001', year: 2025, make: 'Toyota', model: 'Camry', trim: 'XLE' },
        staff: { id: 's1', name: 'Mike Sales' },
        booking: null,
        createdAt: new Date('2026-01-18T10:00:00Z'),
      },
    ]);

    prisma.conversation.findMany.mockResolvedValue([
      { id: 'conv-1', channel: 'WALK_IN', createdAt: new Date('2026-01-12T10:00:00Z'), status: 'RESOLVED' },
    ]);

    const result = await service.getJourney('biz-1', 'cust-1');

    expect(result).not.toBeNull();
    expect(result!.customerId).toBe('cust-1');
    expect(result!.deals).toHaveLength(1);
    expect(result!.testDrives).toHaveLength(1);
    expect(result!.vehiclesOfInterest).toHaveLength(1);
    expect(result!.vehiclesOfInterest[0].id).toBe('v1');
  });

  it('calculates engagement score correctly', async () => {
    prisma.business.findUnique.mockResolvedValue({ verticalPack: 'dealership' });
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-1',
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });

    // 3 visits = 30 points, 2 test drives = 30 points, active deal = 20, no won = 0 => 80
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b1' },
      { id: 'b2' },
      { id: 'b3' },
    ]);
    prisma.testDrive.findMany.mockResolvedValue([
      { id: 'td1', vehicle: { id: 'v1', stockNumber: 'S1', year: 2025, make: 'A', model: 'B', trim: null } },
      { id: 'td2', vehicle: { id: 'v2', stockNumber: 'S2', year: 2025, make: 'C', model: 'D', trim: null } },
    ]);
    prisma.deal.findMany.mockResolvedValue([
      {
        id: 'd1',
        stage: 'NEGOTIATION',
        dealValue: null,
        vehicle: null,
        assignedTo: null,
        stageHistory: [],
        activities: [],
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
    ]);

    const result = await service.getJourney('biz-1', 'cust-1');

    expect(result).not.toBeNull();
    // 3 visits * 10 = 30, 2 test drives * 15 = 30, active deal = 20, won = 0 => 80
    expect(result!.stats.engagementScore).toBe(80);
  });

  it('includes stats with totalWonValue, activeDeals, etc.', async () => {
    prisma.business.findUnique.mockResolvedValue({ verticalPack: 'dealership' });
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-1',
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });

    prisma.deal.findMany.mockResolvedValue([
      {
        id: 'd1',
        stage: 'CLOSED_WON',
        dealValue: 30000,
        vehicle: null,
        assignedTo: null,
        stageHistory: [],
        activities: [],
        createdAt: new Date('2026-01-10T10:00:00Z'),
      },
      {
        id: 'd2',
        stage: 'CLOSED_LOST',
        dealValue: 25000,
        vehicle: null,
        assignedTo: null,
        stageHistory: [],
        activities: [],
        createdAt: new Date('2026-01-12T10:00:00Z'),
      },
      {
        id: 'd3',
        stage: 'NEGOTIATION',
        dealValue: 40000,
        vehicle: null,
        assignedTo: null,
        stageHistory: [],
        activities: [],
        createdAt: new Date('2026-02-01T10:00:00Z'),
      },
    ]);

    const result = await service.getJourney('biz-1', 'cust-1');

    expect(result).not.toBeNull();
    expect(result!.stats.totalWonValue).toBe(30000);
    expect(result!.stats.activeDeals).toBe(1);
    expect(result!.stats.wonDeals).toBe(1);
    expect(result!.stats.lostDeals).toBe(1);
  });

  it('deduplicates vehicles from deals and test drives', async () => {
    prisma.business.findUnique.mockResolvedValue({ verticalPack: 'dealership' });
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-1',
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });

    const sharedVehicle = {
      id: 'v1',
      stockNumber: 'AUT-001',
      year: 2025,
      make: 'Toyota',
      model: 'Camry',
      trim: 'XLE',
      askingPrice: 35000,
      status: 'IN_STOCK',
      imageUrls: [],
    };

    prisma.deal.findMany.mockResolvedValue([
      {
        id: 'd1',
        stage: 'NEGOTIATION',
        dealValue: 42000,
        vehicle: sharedVehicle,
        assignedTo: null,
        stageHistory: [],
        activities: [],
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
    ]);

    prisma.testDrive.findMany.mockResolvedValue([
      {
        id: 'td1',
        vehicle: { id: 'v1', stockNumber: 'AUT-001', year: 2025, make: 'Toyota', model: 'Camry', trim: 'XLE' },
        staff: null,
        booking: null,
        createdAt: new Date('2026-01-18T10:00:00Z'),
      },
    ]);

    const result = await service.getJourney('biz-1', 'cust-1');

    expect(result).not.toBeNull();
    // Same vehicle id from deal and test drive — should be deduplicated
    expect(result!.vehiclesOfInterest).toHaveLength(1);
    expect(result!.vehiclesOfInterest[0].id).toBe('v1');
  });

  it('returns firstContact from earliest conversation', async () => {
    prisma.business.findUnique.mockResolvedValue({ verticalPack: 'dealership' });
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-1',
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });

    const conversationDate = new Date('2026-01-05T10:00:00Z');
    prisma.conversation.findMany.mockResolvedValue([
      { id: 'conv-1', channel: 'WHATSAPP', createdAt: conversationDate, status: 'RESOLVED' },
    ]);

    const result = await service.getJourney('biz-1', 'cust-1');

    expect(result).not.toBeNull();
    expect(result!.firstContact.date).toEqual(conversationDate);
    expect(result!.firstContact.channel).toBe('WHATSAPP');
  });
});
