import { Module, Global } from '@nestjs/common';
import { OnboardingDripService } from './onboarding-drip.service';

@Global()
@Module({
  providers: [OnboardingDripService],
  exports: [OnboardingDripService],
})
export class OnboardingDripModule {}
