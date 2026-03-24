#!/usr/bin/env node

/**
 * Generate app icons for iOS and Android from a programmatically-created source.
 * Uses sharp to create a sage-600 background with white "B" lettermark.
 *
 * Usage: node scripts/generate-app-icon.js
 * Requires: npm install -D sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SAGE_600 = '#71907C';
const WHITE = '#FFFFFF';
const SOURCE_SIZE = 1024;

// Android drawable density directories
const ANDROID_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// iOS icon sizes (all required for App Store)
const IOS_SIZES = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];

async function generateSourceIcon() {
  // Create SVG with sage background and white "B"
  const svg = `<svg width="${SOURCE_SIZE}" height="${SOURCE_SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${SOURCE_SIZE}" height="${SOURCE_SIZE}" fill="${SAGE_600}" rx="180"/>
    <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
          font-family="Georgia, serif" font-weight="bold" font-size="600"
          fill="${WHITE}">B</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const sourceBuffer = await generateSourceIcon();

  // Save source icon
  const sourceDir = path.join(__dirname, '..', 'apps', 'web');
  await sharp(sourceBuffer).toFile(path.join(sourceDir, 'app-icon-source.png'));
  console.log('Created source icon (1024x1024)');

  // Generate Android icons
  const androidResDir = path.join(sourceDir, 'android', 'app', 'src', 'main', 'res');
  for (const [density, size] of Object.entries(ANDROID_SIZES)) {
    const dir = path.join(androidResDir, `mipmap-${density}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(sourceBuffer)
      .resize(size, size)
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Round icon (same for now)
    await sharp(sourceBuffer)
      .resize(size, size)
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`Android ${density} (${size}x${size})`);
  }

  // Generate foreground for adaptive icon
  const foregroundDir = path.join(androidResDir, 'mipmap-xxxhdpi');
  await sharp(sourceBuffer)
    .resize(192, 192)
    .toFile(path.join(foregroundDir, 'ic_launcher_foreground.png'));
  console.log('Android foreground (192x192)');

  // Generate iOS icons
  const iosAssetsDir = path.join(sourceDir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (fs.existsSync(iosAssetsDir)) {
    for (const size of IOS_SIZES) {
      await sharp(sourceBuffer)
        .resize(size, size)
        .toFile(path.join(iosAssetsDir, `icon-${size}.png`));
      console.log(`iOS ${size}x${size}`);
    }

    // Write Contents.json
    const contents = {
      images: IOS_SIZES.map((size) => ({
        filename: `icon-${size}.png`,
        idiom: 'universal',
        platform: 'ios',
        size: `${size}x${size}`,
      })),
      info: { author: 'xcode', version: 1 },
    };
    fs.writeFileSync(
      path.join(iosAssetsDir, 'Contents.json'),
      JSON.stringify(contents, null, 2),
    );
    console.log('iOS Contents.json created');
  } else {
    console.log('iOS directory not found — skipping iOS icons (run cap add ios first)');
  }

  console.log('\nDone! App icons generated.');
}

main().catch(console.error);
