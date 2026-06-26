import { resolve } from 'path';
import { rm } from 'fs/promises';
import { loadConfig } from './config.js';
import { scanFolder, printTree, countLeaves } from './scan.js';
import { buildCollection } from './build/collection.js';
import { buildViewerPage } from './build/viewer.js';

async function main() {
  const args = process.argv.slice(2);
  const configPath = resolve(args[0] ?? 'config.yaml');

  console.log('');
  console.log('┌─────────────────────────────────────┐');
  console.log('│       IMMARKUS Publisher            │');
  console.log('└─────────────────────────────────────┘');
  console.log('');

  // Load config
  let config;
  try {
    config = await loadConfig(configPath);
  } catch (err) {
    console.error(`✗ Config error: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`Source : ${config.sourceDir}`);
  console.log(`Output : ${config.outputDir}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('');

  // Scan the source folder
  console.log('Scanning source folder...');
  let tree;
  try {
    tree = await scanFolder(config.sourceDir);
  } catch (err) {
    console.error(`✗ Could not read source folder: ${(err as Error).message}`);
    console.error(`  Check that sourceDir in config.yaml points to your IMMARKUS folder.`);
    process.exit(1);
  }

  const leafCount = countLeaves(tree);
  console.log(`Found ${leafCount} resource(s).\n`);
  printTree(tree);
  console.log('');

  // Clean output directory
  try {
    await rm(config.outputDir, { recursive: true, force: true });
  } catch {
    // Ignore — may not exist
  }

  // Build everything
  console.log('Building IIIF resources...');
  try {
    const rootCollectionUrl = await buildCollection(tree, config, true);
    console.log('');
    console.log('✓ Done!');
    console.log('');
    console.log(`Root collection: ${rootCollectionUrl}`);
    await buildViewerPage(config);
    console.log(`Viewer:          ${config.outputDir}/index.html`);
    console.log(`Output written to: ${config.outputDir}`);
    console.log('');
  } catch (err) {
    console.error(`\n✗ Build failed: ${(err as Error).message}`);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
}

main();
