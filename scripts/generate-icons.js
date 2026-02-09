#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 * Generates all required PWA icons from a source logo
 *
 * Usage: node scripts/generate-icons.js
 *
 * Requirements:
 *   npm install sharp
 *
 * Input: public/logo.png (recommended: 1024x1024 or larger)
 * Output: All PWA icons in public/icons/
 */

const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

// Icon sizes required for PWA
const ICON_SIZES = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS
];

// Paths
const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_LOGO = path.join(ROOT_DIR, 'apps/web/public/logo.png');
const OUTPUT_DIR = path.join(ROOT_DIR, 'apps/web/public/icons');
const PLACEHOLDER_COLOR = '#4F46E5'; // Indigo-600

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a placeholder SVG icon
 */
function generatePlaceholderSVG(size, text = 'NG') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${PLACEHOLDER_COLOR}"/>
  <text 
    x="50%" 
    y="50%" 
    dominant-baseline="middle" 
    text-anchor="middle" 
    font-family="Arial, sans-serif" 
    font-size="${size * 0.4}" 
    font-weight="bold" 
    fill="white"
  >${text}</text>
</svg>`;
}

/**
 * Generate icon from source logo
 */
async function generateIconFromLogo(size, outputPath) {
  try {
    await sharp(SOURCE_LOGO)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to generate ${size}x${size}:`, error.message);
    return false;
  }
}

/**
 * Generate placeholder icon from SVG
 */
async function generatePlaceholderIcon(size, outputPath) {
  try {
    const svg = generatePlaceholderSVG(size);
    const buffer = Buffer.from(svg);

    await sharp(buffer).png().toFile(outputPath);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to generate placeholder ${size}x${size}:`, error.message);
    return false;
  }
}

/**
 * Generate maskable icon (PWA safe area)
 */
async function generateMaskableIcon() {
  const size = 512;
  const outputPath = path.join(OUTPUT_DIR, 'maskable-icon.png');

  try {
    // Create icon with safe area padding (20% on each side)
    const safeAreaSize = Math.floor(size * 0.6);
    const padding = Math.floor(size * 0.2);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${PLACEHOLDER_COLOR}"/>
  <rect x="${padding}" y="${padding}" width="${safeAreaSize}" height="${safeAreaSize}" fill="white" opacity="0.9"/>
  <text 
    x="50%" 
    y="50%" 
    dominant-baseline="middle" 
    text-anchor="middle" 
    font-family="Arial, sans-serif" 
    font-size="${safeAreaSize * 0.5}" 
    font-weight="bold" 
    fill="${PLACEHOLDER_COLOR}"
  >NG</text>
</svg>`;

    const buffer = Buffer.from(svg);
    await sharp(buffer).png().toFile(outputPath);
  } catch (error) {
    console.error('  ✗ Failed to generate maskable icon:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  const logoExists = fs.existsSync(SOURCE_LOGO);

  if (logoExists) {
  } else {
  }

  // Check if sharp is installed
  try {
    require.resolve('sharp');
  } catch (_e) {
    console.error('❌ Error: "sharp" package not found!');
    console.error('   Install it with: npm install sharp --save-dev\n');
    process.exit(1);
  }

  let _successCount = 0;
  let failCount = 0;

  // Generate all icons
  for (const { size, name } of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, name);

    let success = false;
    if (logoExists) {
      success = await generateIconFromLogo(size, outputPath);
    } else {
      success = await generatePlaceholderIcon(size, outputPath);
    }

    if (success) {
      _successCount++;
    } else {
      failCount++;
    }
  }

  // Generate maskable icon
  await generateMaskableIcon();
  _successCount++;

  // Generate favicon
  if (logoExists) {
    try {
      const faviconPath = path.join(ROOT_DIR, 'apps/web/public/favicon.ico');
      await sharp(SOURCE_LOGO).resize(32, 32).toFile(faviconPath);
      _successCount++;
    } catch (error) {
      console.error('  ✗ Failed to generate favicon:', error.message);
    }
  }
  if (failCount > 0) {
  }

  if (!logoExists) {
  }
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
