import { Injectable, NotFoundException } from '@nestjs/common';
import { VerticalPackDefinition } from '@booking-os/shared';
import { aestheticPack } from './packs/aesthetic.pack';
import { generalPack } from './packs/general.pack';

const PACKS: Record<string, VerticalPackDefinition> = {
  aesthetic: aestheticPack,
  general: generalPack,
};

@Injectable()
export class VerticalPackService {
  getPack(name: string): VerticalPackDefinition {
    const pack = PACKS[name];
    if (!pack) throw new NotFoundException(`Pack "${name}" not found`);
    return pack;
  }

  getAllPacks(): string[] {
    return Object.keys(PACKS);
  }
}
