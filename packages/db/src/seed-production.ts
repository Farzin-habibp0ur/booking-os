import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLATFORM_SETTINGS = [
  { key: 'platform.name', value: 'Booking OS' },
  { key: 'platform.support_email', value: 'support@businesscommandcentre.com' },
  { key: 'security.session_timeout_minutes', value: 30 },
  { key: 'security.max_login_attempts', value: 5 },
  { key: 'security.lockout_duration_minutes', value: 15 },
  { key: 'notifications.email_enabled', value: true },
  { key: 'notifications.slack_enabled', value: false },
  { key: 'regional.default_timezone', value: 'America/New_York' },
  { key: 'regional.default_locale', value: 'en' },
  { key: 'regional.default_currency', value: 'USD' },
] as const;

const PLATFORM_AGENT_DEFAULTS = [
  {
    agentType: 'WAITLIST',
    maxAutonomyLevel: 'SUGGEST',
    defaultEnabled: true,
    confidenceThreshold: 0.7,
    requiresReview: true,
  },
  {
    agentType: 'RETENTION',
    maxAutonomyLevel: 'SUGGEST',
    defaultEnabled: true,
    confidenceThreshold: 0.8,
    requiresReview: true,
  },
  {
    agentType: 'DATA_HYGIENE',
    maxAutonomyLevel: 'AUTO_WITH_REVIEW',
    defaultEnabled: true,
    confidenceThreshold: 0.9,
    requiresReview: true,
  },
  {
    agentType: 'SCHEDULING_OPTIMIZER',
    maxAutonomyLevel: 'SUGGEST',
    defaultEnabled: false,
    confidenceThreshold: 0.7,
    requiresReview: true,
  },
  {
    agentType: 'QUOTE_FOLLOWUP',
    maxAutonomyLevel: 'SUGGEST',
    defaultEnabled: true,
    confidenceThreshold: 0.75,
    requiresReview: true,
  },
] as const;

async function main() {
  console.log('=== Production Seed: Start ===\n');

  // Seed PlatformSettings
  console.log('Seeding PlatformSettings...');
  for (const setting of PLATFORM_SETTINGS) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    });
    console.log(`  ✓ ${setting.key} = ${JSON.stringify(setting.value)}`);
  }
  console.log(`  → ${PLATFORM_SETTINGS.length} settings seeded.\n`);

  // Seed PlatformAgentDefaults
  console.log('Seeding PlatformAgentDefaults...');
  for (const agent of PLATFORM_AGENT_DEFAULTS) {
    await prisma.platformAgentDefault.upsert({
      where: { agentType: agent.agentType },
      update: {
        maxAutonomyLevel: agent.maxAutonomyLevel,
        defaultEnabled: agent.defaultEnabled,
        confidenceThreshold: agent.confidenceThreshold,
        requiresReview: agent.requiresReview,
      },
      create: {
        agentType: agent.agentType,
        maxAutonomyLevel: agent.maxAutonomyLevel,
        defaultEnabled: agent.defaultEnabled,
        confidenceThreshold: agent.confidenceThreshold,
        requiresReview: agent.requiresReview,
      },
    });
    console.log(
      `  ✓ ${agent.agentType} — autonomy: ${agent.maxAutonomyLevel}, enabled: ${agent.defaultEnabled}, confidence: ${agent.confidenceThreshold}`,
    );
  }
  console.log(`  → ${PLATFORM_AGENT_DEFAULTS.length} agent defaults seeded.\n`);

  console.log('=== Production Seed: Complete ===');
}

main()
  .catch((error) => {
    console.error('Production seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
