#!/usr/bin/env node

const path = require('path');
const readline = require('readline');
const { findGltfFiles, optimizeModel, log, colors, COMPRESS_DRACO, RESIZE_TEXTURES, MAX_TEXTURE_SIZE } = require('./lib/optimize');

// Parse command line arguments
const args = process.argv.slice(2);
const nonInteractive = args.includes('--yes') || args.includes('-y');
const modelsDirArg = args.find(arg => arg.startsWith('--models-dir='))?.split('=')[1];
const outputDirArg = args.find(arg => arg.startsWith('--output-dir='))?.split('=')[1];

const MODELS_DIR = modelsDirArg ? path.resolve(modelsDirArg) : path.join(process.cwd(), 'models');
const OUTPUT_DIR = outputDirArg ? path.resolve(outputDirArg) : null;

function showHelp() {
  log('\n📖 Usage:', 'bright');
  log('  gltf-optimizer [options]', 'yellow');
  log('\n🚀 Options:', 'bright');
  log('  --yes, -y                Non-interactive mode (automation)', 'blue');
  log('  --models-dir=<path>      Directory containing the models', 'blue');
  log('  --output-dir=<path>      Output directory (optional)', 'blue');
  log('  --help, -h              Show this help', 'blue');
  log('\n💡 Examples:', 'bright');
  log('  gltf-optimizer --yes', 'yellow');
  log('  gltf-optimizer --models-dir=./assets --yes', 'yellow');
  log('  gltf-optimizer --yes --output-dir=./optimized', 'yellow');
  log('\n✨ Starting in interactive mode if no options...', 'green');
}

// Check if user requests help
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

async function selectModels(gltfFiles) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    log('\n📋 Available models:\n', 'bright');
    gltfFiles.forEach((file, index) => {
      log(`${index + 1}. ${path.relative(process.cwd(), file)}`, 'yellow');
    });

    log('\n💡 Enter the model numbers to optimize separated by commas', 'blue');
    log('(e.g.: 1,3,5 or just 1)\n', 'blue');

    rl.question('Numbers: ', (answer) => {
      rl.close();
      
      const selected = [];
      const indices = answer.split(',').map(s => s.trim());
      
      indices.forEach(idx => {
        const num = parseInt(idx) - 1;
        if (!isNaN(num) && num >= 0 && num < gltfFiles.length) {
          selected.push(gltfFiles[num]);
        }
      });
      
      resolve(selected);
    });
  });
}

async function showMenu(gltfFiles) {
  // Non-interactive mode: optimize all models directly
  if (nonInteractive) {
    log('\n🚀 Non-interactive mode activated: optimizing all models', 'green');
    return gltfFiles;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    log('\n' + '='.repeat(60), 'bright');
    log('🎯 Optimization mode selection', 'bright');
    log('='.repeat(60), 'bright');
    log('\n1. Optimize ALL models', 'blue');
    log('2. Select specific models', 'blue');
    log('3. Cancel', 'blue');
    log('\n💡 Use --yes for non-interactive mode', 'yellow');
    log('\n' + '='.repeat(60) + '\n', 'bright');

    rl.question('Choose an option (1, 2 or 3): ', async (answer) => {
      rl.close();

      switch (answer.trim()) {
        case '1':
          resolve(gltfFiles);
          break;
        case '2':
          const selected = await selectModels(gltfFiles);
          resolve(selected);
          break;
        case '3':
          resolve(null);
          break;
        default:
          log('❌ Invalid option', 'red');
          const retry = await showMenu(gltfFiles);
          resolve(retry);
      }
    });
  });
}

async function main() {
  log('🚀 Starting 3D model optimization', 'bright');
  log('='.repeat(60), 'blue');

  const gltfFiles = findGltfFiles(MODELS_DIR);

  if (gltfFiles.length === 0) {
    log('⚠️  No GLTF/GLB files found in ' + MODELS_DIR + '!', 'yellow');
    process.exit(0);
  }

  log(`\n📊 ${gltfFiles.length} file(s) found\n`, 'blue');

  const selectedFiles = await showMenu(gltfFiles);

  if (selectedFiles === null || selectedFiles.length === 0) {
    log('\n❌ Optimization cancelled or no models selected', 'red');
    process.exit(0);
  }

  log(`\n✅ ${selectedFiles.length} model(s) selected for optimization\n`, 'green');

  selectedFiles.forEach((file, index) => {
    log(`[${index + 1}/${selectedFiles.length}] ${path.relative(process.cwd(), file)}`, 'bright');
  });

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  let successCount = 0;
  let errorCount = 0;

  // Mode non-interactif : pas de confirmation
  if (nonInteractive) {
    log('\n🚀 Starting automatic optimization...', 'green');

    selectedFiles.forEach((file, index) => {
      const { getGltfModelSize } = require('./lib/optimize');

      try {
        const originalSize = getGltfModelSize(file);

        optimizeModel(file, {
          compressDraco: COMPRESS_DRACO,
          resizeTextures: RESIZE_TEXTURES,
          maxTextureSize: MAX_TEXTURE_SIZE,
          backupOriginal: true
        });

        // Calculer la taille après optimisation (le fichier a été remplacé)
        const optimizedSize = getGltfModelSize(file);

        totalOriginalSize += parseFloat(originalSize) || 0;
        totalOptimizedSize += parseFloat(optimizedSize) || 0;
        successCount++;

      } catch (error) {
        log(`❌ Optimization failed: ${path.basename(file)} - ${error.message}`, 'red');
        errorCount++;
      }
    });

    // Résumé statistique global
    log('\n' + '='.repeat(60), 'green');
    log('📊 GLOBAL OPTIMIZATION REPORT', 'bright');
    log('='.repeat(60), 'green');

    log(`\n📈 Statistics:`, 'blue');
    log(`   ✅ Successfully optimized models: ${successCount}`, 'green');
    log(`   ❌ Optimization failures: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   📦 Total original size: ${totalOriginalSize.toFixed(2)} MB`, 'yellow');
    log(`   📦 Total optimized size: ${totalOptimizedSize.toFixed(2)} MB`, 'green');

    if (successCount > 0) {
      const totalReduction = ((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1);
      const totalSavings = (totalOriginalSize - totalOptimizedSize).toFixed(2);
      log(`   💾 Total reduction: ${totalReduction}% (${totalSavings} MB saved)`, 'green');
    }

    log('\n🎉 All models optimization completed!', 'green');
    log('='.repeat(60), 'green');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n⚠️  Continue with optimization? (y/n): ', (answer) => {
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      log('\n❌ Optimization cancelled', 'red');
      process.exit(0);
    }

    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    let successCount = 0;
    let errorCount = 0;

    selectedFiles.forEach((file, index) => {
      const { getGltfModelSize } = require('./lib/optimize');

      try {
        const originalSize = getGltfModelSize(file);

        optimizeModel(file, {
          compressDraco: COMPRESS_DRACO,
          resizeTextures: RESIZE_TEXTURES,
          maxTextureSize: MAX_TEXTURE_SIZE,
          backupOriginal: true
        });

        // Calculer la taille après optimisation (le fichier a été remplacé)
        const optimizedSize = getGltfModelSize(file);

        totalOriginalSize += parseFloat(originalSize) || 0;
        totalOptimizedSize += parseFloat(optimizedSize) || 0;
        successCount++;

      } catch (error) {
        log(`❌ Optimization failed: ${path.basename(file)} - ${error.message}`, 'red');
        errorCount++;
      }
    });

    // Résumé statistique global
    log('\n' + '='.repeat(60), 'green');
    log('📊 GLOBAL OPTIMIZATION REPORT', 'bright');
    log('='.repeat(60), 'green');

    log(`\n📈 Statistics:`, 'blue');
    log(`   ✅ Successfully optimized models: ${successCount}`, 'green');
    log(`   ❌ Optimization failures: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   📦 Total original size: ${totalOriginalSize.toFixed(2)} MB`, 'yellow');
    log(`   📦 Total optimized size: ${totalOptimizedSize.toFixed(2)} MB`, 'green');

    if (successCount > 0) {
      const totalReduction = ((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1);
      const totalSavings = (totalOriginalSize - totalOptimizedSize).toFixed(2);
      log(`   💾 Total reduction: ${totalReduction}% (${totalSavings} MB saved)`, 'green');
    }

    log('\n🎉 All models optimization completed!', 'green');
    log('='.repeat(60), 'green');
  });
}

main();
