#!/usr/bin/env node

const path = require('path');
const readline = require('readline');
const { findGltfFiles, optimizeModel, log, colors, COMPRESS_DRACO, RESIZE_TEXTURES, MAX_TEXTURE_SIZE } = require('./lib/optimize');

// Parse command line arguments
const args = process.argv.slice(2);
const nonInteractive = args.includes('--yes') || args.includes('-y');
const modelsDirArg = args.find(arg => arg.startsWith('--models-dir='))?.split('=')[1];
const outputDirArg = args.find(arg => arg.startsWith('--output-dir='))?.split('=')[1];

const MODELS_DIR = modelsDirArg ? path.resolve(modelsDirArg) : path.join(__dirname, 'models');
const OUTPUT_DIR = outputDirArg ? path.resolve(outputDirArg) : null;

function showHelp() {
  log('\n📖 Utilisation:', 'bright');
  log('  gltf-optimizer [options]', 'yellow');
  log('\n🚀 Options:', 'bright');
  log('  --yes, -y                Mode non-interactif (automatisation)', 'blue');
  log('  --models-dir=<path>      Dossier contenant les modèles', 'blue');
  log('  --output-dir=<path>      Dossier de sortie (optionnel)', 'blue');
  log('  --help, -h              Afficher cette aide', 'blue');
  log('\n💡 Exemples:', 'bright');
  log('  gltf-optimizer --yes', 'yellow');
  log('  gltf-optimizer --models-dir=./assets --yes', 'yellow');
  log('  gltf-optimizer --yes --output-dir=./optimized', 'yellow');
  log('\n✨ Démarrage en mode interactif si aucune option...', 'green');
}

// Vérifier si l'utilisateur demande de l'aide
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
    log('\n📋 Modèles disponibles:\n', 'bright');
    gltfFiles.forEach((file, index) => {
      log(`${index + 1}. ${path.relative(process.cwd(), file)}`, 'yellow');
    });

    log('\n💡 Entrez les numéros des modèles à optimiser séparés par des virgules', 'blue');
    log('(ex: 1,3,5 ou simplement 1)\n', 'blue');

    rl.question('Numéros: ', (answer) => {
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
  // Mode non-interactif : optimiser tous les modèles directement
  if (nonInteractive) {
    log('\n🚀 Mode non-interactif activé : optimisation de tous les modèles', 'green');
    return gltfFiles;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    log('\n' + '='.repeat(60), 'bright');
    log('🎯 Sélection du mode d\'optimisation', 'bright');
    log('='.repeat(60), 'bright');
    log('\n1. Optimiser TOUS les modèles', 'blue');
    log('2. Sélectionner des modèles spécifiques', 'blue');
    log('3. Annuler', 'blue');
    log('\n💡 Utilisez --yes pour le mode non-interactif', 'yellow');
    log('\n' + '='.repeat(60) + '\n', 'bright');

    rl.question('Choisissez une option (1, 2 ou 3): ', async (answer) => {
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
          log('❌ Option invalide', 'red');
          const retry = await showMenu(gltfFiles);
          resolve(retry);
      }
    });
  });
}

async function main() {
  log('🚀 Début de l\'optimisation des modèles 3D', 'bright');
  log('='.repeat(60), 'blue');

  const gltfFiles = findGltfFiles(MODELS_DIR);

  if (gltfFiles.length === 0) {
    log('⚠️  Aucun fichier GLTF/GLB trouvé dans ' + MODELS_DIR + '!', 'yellow');
    process.exit(0);
  }

  log(`\n📊 ${gltfFiles.length} fichier(s) trouvé(s)\n`, 'blue');

  const selectedFiles = await showMenu(gltfFiles);

  if (selectedFiles === null || selectedFiles.length === 0) {
    log('\n❌ Optimisation annulée ou aucun modèle sélectionné', 'red');
    process.exit(0);
  }

  log(`\n✅ ${selectedFiles.length} modèle(s) sélectionné(s) pour optimisation\n`, 'green');

  selectedFiles.forEach((file, index) => {
    log(`[${index + 1}/${selectedFiles.length}] ${path.relative(process.cwd(), file)}`, 'bright');
  });

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  let successCount = 0;
  let errorCount = 0;

  // Mode non-interactif : pas de confirmation
  if (nonInteractive) {
    log('\n🚀 Démarrage de l\'optimisation en mode automatique...', 'green');

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
        log(`❌ Échec de l'optimisation: ${path.basename(file)} - ${error.message}`, 'red');
        errorCount++;
      }
    });

    // Résumé statistique global
    log('\n' + '='.repeat(60), 'green');
    log('📊 RAPPORT D\'OPTIMISATION GLOBAL', 'bright');
    log('='.repeat(60), 'green');

    log(`\n📈 Statistiques:`, 'blue');
    log(`   ✅ Modèles optimisés avec succès: ${successCount}`, 'green');
    log(`   ❌ Échecs d'optimisation: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   📦 Taille totale originale: ${totalOriginalSize.toFixed(2)} MB`, 'yellow');
    log(`   📦 Taille totale optimisée: ${totalOptimizedSize.toFixed(2)} MB`, 'green');

    if (successCount > 0) {
      const totalReduction = ((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1);
      const totalSavings = (totalOriginalSize - totalOptimizedSize).toFixed(2);
      log(`   💾 Réduction totale: ${totalReduction}% (${totalSavings} MB économisés)`, 'green');
    }

    log('\n🎉 Optimisation de tous les modèles terminée!', 'green');
    log('='.repeat(60), 'green');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n⚠️  Continuer avec l\'optimisation? (o/n): ', (answer) => {
    rl.close();

    if (answer.toLowerCase() !== 'o' && answer.toLowerCase() !== 'oui') {
      log('\n❌ Optimisation annulée', 'red');
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
        log(`❌ Échec de l'optimisation: ${path.basename(file)} - ${error.message}`, 'red');
        errorCount++;
      }
    });

    // Résumé statistique global
    log('\n' + '='.repeat(60), 'green');
    log('📊 RAPPORT D\'OPTIMISATION GLOBAL', 'bright');
    log('='.repeat(60), 'green');

    log(`\n📈 Statistiques:`, 'blue');
    log(`   ✅ Modèles optimisés avec succès: ${successCount}`, 'green');
    log(`   ❌ Échecs d'optimisation: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   📦 Taille totale originale: ${totalOriginalSize.toFixed(2)} MB`, 'yellow');
    log(`   📦 Taille totale optimisée: ${totalOptimizedSize.toFixed(2)} MB`, 'green');

    if (successCount > 0) {
      const totalReduction = ((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1);
      const totalSavings = (totalOriginalSize - totalOptimizedSize).toFixed(2);
      log(`   💾 Réduction totale: ${totalReduction}% (${totalSavings} MB économisés)`, 'green');
    }

    log('\n🎉 Optimisation de tous les modèles terminée!', 'green');
    log('='.repeat(60), 'green');
  });
}

main();
