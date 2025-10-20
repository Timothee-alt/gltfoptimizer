// Configuration defaults (can be overridden in function calls)
const COMPRESS_DRACO = true;
const RESIZE_TEXTURES = true;
const MAX_TEXTURE_SIZE = 1024;

// Colors for logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createProgressBar(total, current, width = 30) {
  const percentage = (current / total) * 100;
  const filled = Math.round((width * current) / total);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage.toFixed(1)}% (${current}/${total})`;
}

function getFileSize(filePath) {
  const fs = require('fs');
  const stats = fs.statSync(filePath);
  return (stats.size / (1024 * 1024)).toFixed(2);
}

function getGltfModelSize(filePath) {
  const fs = require('fs');
  const path = require('path');

  let totalSize = 0;

  // Taille du fichier GLTF/GLB principal
  if (fs.existsSync(filePath)) {
    totalSize += fs.statSync(filePath).size;
  }

  // Taille du fichier .bin associé (pour les modèles GLTF externes)
  if (filePath.endsWith('.gltf')) {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.gltf');

    // Chercher les fichiers .bin potentiels
    const possibleBinFiles = [
      path.join(dir, baseName + '.bin'),
      path.join(dir, 'scene.bin'), // Cas courant
    ];

    for (const binFile of possibleBinFiles) {
      if (fs.existsSync(binFile)) {
        totalSize += fs.statSync(binFile).size;
        break; // Prendre le premier trouvé
      }
    }
  }

  return (totalSize / (1024 * 1024)).toFixed(2);
}

function findGltfFiles(dir) {
  const fs = require('fs');
  const path = require('path');
  const files = [];

  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);

    items.forEach(item => {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.gltf') || item.endsWith('.glb')) {
        files.push(fullPath);
      }
    });
  }

  traverse(dir);
  return files;
}

function validateGltfModel(filePath) {
  const fs = require('fs');
  const path = require('path');

  try {
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'Fichier introuvable' };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { valid: false, error: 'Fichier vide' };
    }

    // Pour les fichiers .gltf, vérifier la structure JSON basique
    if (filePath.endsWith('.gltf')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Vérifier que c'est du JSON valide
        JSON.parse(content);

        // Vérifier la présence des champs requis
        const gltf = JSON.parse(content);
        if (!gltf.asset || !gltf.asset.version) {
          return { valid: false, error: 'Structure GLTF invalide (asset.version manquant)' };
        }

        // Vérifier la version GLTF supportée
        const version = gltf.asset.version;
        if (!['2.0'].includes(version)) {
          return { valid: false, error: `Version GLTF non supportée: ${version}` };
        }

        // Vérifier que le fichier .bin associé existe (si référencé)
        if (gltf.buffers && gltf.buffers.length > 0) {
          const buffer = gltf.buffers[0];
          if (buffer.uri) {
            const binPath = path.join(path.dirname(filePath), buffer.uri);
            if (!fs.existsSync(binPath)) {
              return { valid: false, error: `Fichier binaire manquant: ${buffer.uri}` };
            }
          }
        }

      } catch (error) {
        return { valid: false, error: `JSON invalide: ${error.message}` };
      }
    }

    // Pour les fichiers .glb, vérification complète de la structure
    if (filePath.endsWith('.glb')) {
      try {
        const content = fs.readFileSync(filePath);

        // Vérifier l'en-tête GLB (magic + version + length)
        if (content.length < 12) {
          return { valid: false, error: 'Fichier GLB trop petit' };
        }

        // Vérifier le magic number "glTF"
        const magic = content.toString('utf8', 0, 4);
        if (magic !== 'glTF') {
          return { valid: false, error: 'Magic number GLB invalide' };
        }

        // Vérifier la version GLB
        const version = content.readUInt32LE(4);
        if (version !== 2) {
          return { valid: false, error: `Version GLB non supportée: ${version}` };
        }

        // Vérifier la longueur totale
        const length = content.readUInt32LE(8);
        if (length !== content.length) {
          return { valid: false, error: `Longueur GLB déclarée incorrecte: ${length} vs ${content.length}` };
        }

        // Analyser la structure des chunks
        let offset = 12;
        let hasJSONChunk = false;
        let hasBINChunk = false;

        while (offset < content.length) {
          if (offset + 8 > content.length) {
            return { valid: false, error: 'Chunk GLB incomplet' };
          }

          const chunkLength = content.readUInt32LE(offset);
          const chunkType = content.toString('utf8', offset + 4, offset + 8);

          if (chunkType === 'JSON') {
            hasJSONChunk = true;
            // Vérifier que le JSON est valide
            try {
              const jsonContent = content.toString('utf8', offset + 8, offset + 8 + chunkLength);
              const gltf = JSON.parse(jsonContent);

              // Vérifier la structure GLTF de base
              if (!gltf.asset || !gltf.asset.version) {
                return { valid: false, error: 'Chunk JSON GLB invalide (asset.version manquant)' };
              }

              if (!['2.0'].includes(gltf.asset.version)) {
                return { valid: false, error: `Version GLTF dans GLB non supportée: ${gltf.asset.version}` };
              }

            } catch (error) {
              return { valid: false, error: `JSON GLB invalide: ${error.message}` };
            }

          } else if (chunkType === 'BIN\0') {
            hasBINChunk = true;
          }

          offset += 8 + chunkLength;
        }

        // Un GLB valide doit avoir au moins un chunk JSON
        if (!hasJSONChunk) {
          return { valid: false, error: 'GLB sans chunk JSON' };
        }

        // Optionnel : peut avoir un chunk BIN

      } catch (error) {
        return { valid: false, error: `Erreur de lecture GLB: ${error.message}` };
      }
    }

    return { valid: true };

  } catch (error) {
    return { valid: false, error: `Erreur lors de la validation: ${error.message}` };
  }
}

function loadConfig(configPath = null) {
  const fs = require('fs');
  const path = require('path');

  // Configuration par défaut
  const defaultConfig = {
    modelsDir: "./models",
    outputDir: null,
    options: {
      compressDraco: true,
      resizeTextures: true,
      maxTextureSize: 1024,
      backupOriginal: true
    },
    excludePatterns: [
      "**/node_modules/**",
      "**/*.backup.*",
      "**/*-original.*"
    ],
    includePatterns: [
      "**/*.gltf",
      "**/*.glb"
    ],
    parallelProcessing: false,
    maxConcurrency: 4,
    logLevel: "info",
    generateReport: false,
    reportFormat: "json"
  };

  try {
    // Chercher le fichier de configuration
    let configFile = configPath;

    if (!configFile) {
      // Chercher dans le répertoire courant
      const possiblePaths = [
        'gltf-optimizer.config.json',
        '.gltf-optimizer.json',
        'package.json' // section gltf-optimizer
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          configFile = possiblePath;
          break;
        }
      }
    }

    if (configFile && fs.existsSync(configFile)) {
      log(`📋 Chargement de la configuration: ${configFile}`, 'blue');

      let userConfig = {};

      if (configFile.endsWith('package.json')) {
        // Extraire la section gltf-optimizer du package.json
        const packageContent = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        userConfig = packageContent['gltf-optimizer'] || {};
      } else {
        // Charger le fichier de configuration directement
        userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      }

      // Fusionner avec la configuration par défaut
      const mergedConfig = {
        ...defaultConfig,
        ...userConfig,
        options: {
          ...defaultConfig.options,
          ...userConfig.options
        }
      };

      log(`✅ Configuration chargée (${Object.keys(mergedConfig.options).length} options)`, 'green');
      return mergedConfig;

    } else {
      log('📋 Utilisation de la configuration par défaut', 'yellow');
      return defaultConfig;
    }

  } catch (error) {
    log(`⚠️ Erreur lors du chargement de la configuration: ${error.message}`, 'yellow');
    log('📋 Utilisation de la configuration par défaut', 'yellow');
    return defaultConfig;
  }
}

function optimizeModel(inputPath, options = {}) {
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');
  
  const {
    compressDraco = COMPRESS_DRACO,
    resizeTextures = RESIZE_TEXTURES,
    maxTextureSize = MAX_TEXTURE_SIZE,
    backupOriginal = true
  } = options;
  
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const baseName = path.basename(inputPath, ext);
  const outputPath = path.join(dir, `${baseName}-optimized${ext}`);
  const backupPath = path.join(dir, `${baseName}-original${ext}`);
  
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Optimisation: ${path.relative(process.cwd(), inputPath)}`, 'bright');
  log(`${'='.repeat(60)}`, 'blue');

  // Validation du modèle avant optimisation
  log('\n🔍 Validation du modèle...', 'blue');
  const validation = validateGltfModel(inputPath);
  if (!validation.valid) {
    log(`❌ Modèle invalide: ${validation.error}`, 'red');
    return; // Sortir sans optimiser
  }
  log('✅ Modèle valide', 'green');

  const originalSize = getGltfModelSize(inputPath);
  log(`📦 Taille originale: ${originalSize} MB`, 'yellow');
  
  try {
    log('\n⚙️  Étape 1: Optimisation générale...', 'blue');
    let cmd = `npx gltf-transform optimize "${inputPath}" "${outputPath}"`;
    if (compressDraco) {
      cmd += ' --compress draco';
    }
    execSync(cmd, { stdio: 'inherit' });
    
    let currentPath = outputPath;
    
    if (resizeTextures) {
      log('\n⚙️  Étape 2: Redimensionnement des textures...', 'blue');
      const tempPath = outputPath.replace(ext, `-temp${ext}`);
      try {
        execSync(`npx gltf-transform resize "${currentPath}" "${tempPath}" --width ${maxTextureSize} --height ${maxTextureSize}`, { stdio: 'inherit' });
        fs.unlinkSync(currentPath);
        fs.renameSync(tempPath, currentPath);
      } catch (error) {
        log('⚠️  Le redimensionnement a échoué, on continue sans...', 'yellow');
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }
    
    log('\n⚙️  Étape 3: Compression WebP des textures...', 'blue');
    const tempPath2 = currentPath.replace(ext, `-temp2${ext}`);
    try {
      execSync(`npx gltf-transform webp "${currentPath}" "${tempPath2}"`, { stdio: 'inherit' });
      fs.unlinkSync(currentPath);
      fs.renameSync(tempPath2, currentPath);
    } catch (error) {
      log('⚠️  La compression WebP a échoué, on continue sans...', 'yellow');
      if (fs.existsSync(tempPath2)) {
        fs.unlinkSync(tempPath2);
      }
    }
    
    const optimizedSize = getGltfModelSize(inputPath);
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
    
  log('\n✅ Optimisation terminée!', 'green');
  log(`📦 Taille originale: ${originalSize} MB → ${optimizedSize} MB`, 'green');
  log(`💾 Réduction: ${reduction}% (${(originalSize - optimizedSize).toFixed(2)} MB économisés)`, 'green');

  // Informations détaillées sur le modèle
  log(`\n📋 Informations détaillées:`, 'blue');
  log(`   📄 Format: ${ext.toUpperCase()}`, 'blue');
  log(`   🔧 Optimisations appliquées:`, 'blue');

  if (compressDraco) log(`     ✓ Compression Draco (géométrie)`, 'green');
  if (resizeTextures) log(`     ✓ Redimensionnement textures (max ${maxTextureSize}px)`, 'green');
  log(`     ✓ Compression WebP des textures`, 'green');
  log(`     ✓ Optimisations gltf-transform`, 'green');
    
    if (backupOriginal && !fs.existsSync(backupPath)) {
      log(`\n💾 Sauvegarde de l'original dans: ${baseName}-original${ext}`, 'yellow');
      fs.copyFileSync(inputPath, backupPath);
    }
    
    log(`\n📄 Remplacement du fichier original...`, 'blue');
    fs.unlinkSync(inputPath);
    fs.renameSync(currentPath, inputPath);
    
    if (ext === '.gltf') {
      const binPath = path.join(dir, 'scene.bin');
      if (fs.existsSync(binPath)) {
        const binBackupPath = path.join(dir, 'scene-original.bin');
        if (backupOriginal && !fs.existsSync(binBackupPath)) {
          fs.copyFileSync(binPath, binBackupPath);
        }
      }
    }
    
    log('✅ Fichier remplacé avec succès!', 'green');
    
  } catch (error) {
    log(`\n❌ Erreur lors de l'optimisation: ${error.message}`, 'red');
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }
}

// Export the main functions and configs
module.exports = {
  findGltfFiles,
  optimizeModel,
  validateGltfModel,
  loadConfig,
  createProgressBar,
  log,
  getFileSize,
  getGltfModelSize,
  colors,
  COMPRESS_DRACO,
  RESIZE_TEXTURES,
  MAX_TEXTURE_SIZE
};
