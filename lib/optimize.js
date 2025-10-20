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

  // Size of main GLTF/GLB file
  if (fs.existsSync(filePath)) {
    totalSize += fs.statSync(filePath).size;
  }

  // Size of associated .bin file (for external GLTF models)
  if (filePath.endsWith('.gltf')) {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.gltf');

    // Look for potential .bin files
    const possibleBinFiles = [
      path.join(dir, baseName + '.bin'),
      path.join(dir, 'scene.bin'), // Common case
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
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File not found' };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { valid: false, error: 'Empty file' };
    }

    // For .gltf files, check basic JSON structure
    if (filePath.endsWith('.gltf')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check if it's valid JSON
        JSON.parse(content);

        // Check for required fields
        const gltf = JSON.parse(content);
        if (!gltf.asset || !gltf.asset.version) {
          return { valid: false, error: 'Invalid GLTF structure (asset.version missing)' };
        }

        // Check supported GLTF version
        const version = gltf.asset.version;
        if (!['2.0'].includes(version)) {
          return { valid: false, error: `Unsupported GLTF version: ${version}` };
        }

        // Check if referenced binary file exists
        if (gltf.buffers && gltf.buffers.length > 0) {
          const buffer = gltf.buffers[0];
          if (buffer.uri) {
            const binPath = path.join(path.dirname(filePath), buffer.uri);
            if (!fs.existsSync(binPath)) {
              return { valid: false, error: `Missing binary file: ${buffer.uri}` };
            }
          }
        }

      } catch (error) {
        return { valid: false, error: `Invalid JSON: ${error.message}` };
      }
    }

    // For .glb files, complete structure validation
    if (filePath.endsWith('.glb')) {
      try {
        const content = fs.readFileSync(filePath);

        // Check GLB header (magic + version + length)
        if (content.length < 12) {
          return { valid: false, error: 'GLB file too small' };
        }

        // Check magic number "glTF"
        const magic = content.toString('utf8', 0, 4);
        if (magic !== 'glTF') {
          return { valid: false, error: 'Invalid GLB magic number' };
        }

        // Check GLB version
        const version = content.readUInt32LE(4);
        if (version !== 2) {
          return { valid: false, error: `Unsupported GLB version: ${version}` };
        }

        // Check total length
        const length = content.readUInt32LE(8);
        if (length !== content.length) {
          return { valid: false, error: `Incorrect GLB declared length: ${length} vs ${content.length}` };
        }

        // Analyze chunk structure
        let offset = 12;
        let hasJSONChunk = false;
        let hasBINChunk = false;

        while (offset < content.length) {
          if (offset + 8 > content.length) {
            return { valid: false, error: 'Incomplete GLB chunk' };
          }

          const chunkLength = content.readUInt32LE(offset);
          const chunkType = content.toString('utf8', offset + 4, offset + 8);

          if (chunkType === 'JSON') {
            hasJSONChunk = true;
            // Check if JSON is valid
            try {
              const jsonContent = content.toString('utf8', offset + 8, offset + 8 + chunkLength);
              const gltf = JSON.parse(jsonContent);

              // Check basic GLTF structure
              if (!gltf.asset || !gltf.asset.version) {
                return { valid: false, error: 'Invalid GLB JSON chunk (asset.version missing)' };
              }

              if (!['2.0'].includes(gltf.asset.version)) {
                return { valid: false, error: `Unsupported GLTF version in GLB: ${gltf.asset.version}` };
              }

            } catch (error) {
              return { valid: false, error: `Invalid GLB JSON: ${error.message}` };
            }

          } else if (chunkType === 'BIN\0') {
            hasBINChunk = true;
          }

          offset += 8 + chunkLength;
        }

        // A valid GLB must have at least a JSON chunk
        if (!hasJSONChunk) {
          return { valid: false, error: 'GLB without JSON chunk' };
        }

        // Optional: may have a BIN chunk

      } catch (error) {
        return { valid: false, error: `GLB read error: ${error.message}` };
      }
    }

    return { valid: true };

  } catch (error) {
    return { valid: false, error: `Validation error: ${error.message}` };
  }
}

function loadConfig(configPath = null) {
  const fs = require('fs');
  const path = require('path');

  // Default configuration
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
    // Look for configuration file
    let configFile = configPath;

    if (!configFile) {
      // Look in current directory
      const possiblePaths = [
        'gltf-optimizer.config.json',
        '.gltf-optimizer.json',
        'package.json' // gltf-optimizer section
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          configFile = possiblePath;
          break;
        }
      }
    }

    if (configFile && fs.existsSync(configFile)) {
      log(`📋 Loading configuration: ${configFile}`, 'blue');

      let userConfig = {};

      if (configFile.endsWith('package.json')) {
        // Extract gltf-optimizer section from package.json
        const packageContent = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        userConfig = packageContent['gltf-optimizer'] || {};
      } else {
        // Load configuration file directly
        userConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      }

      // Merge with default configuration
      const mergedConfig = {
        ...defaultConfig,
        ...userConfig,
        options: {
          ...defaultConfig.options,
          ...userConfig.options
        }
      };

      log(`✅ Configuration loaded (${Object.keys(mergedConfig.options).length} options)`, 'green');
      return mergedConfig;

    } else {
      log('📋 Using default configuration', 'yellow');
      return defaultConfig;
    }

  } catch (error) {
    log(`⚠️ Error loading configuration: ${error.message}`, 'yellow');
    log('📋 Using default configuration', 'yellow');
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

  // Validate model before optimization
  log('\n🔍 Validating model...', 'blue');
  const validation = validateGltfModel(inputPath);
  if (!validation.valid) {
    log(`❌ Invalid model: ${validation.error}`, 'red');
    return; // Exit without optimizing
  }
  log('✅ Model is valid', 'green');

  const originalSize = getGltfModelSize(inputPath);
  log(`📦 Original size: ${originalSize} MB`, 'yellow');

  try {
    log('\n⚙️  Step 1: General optimization...', 'blue');
    let cmd = `npx gltf-transform optimize "${inputPath}" "${outputPath}"`;
    if (compressDraco) {
      cmd += ' --compress draco';
    }
    execSync(cmd, { stdio: 'inherit' });
    
    let currentPath = outputPath;
    
    if (resizeTextures) {
      log('\n⚙️  Step 2: Resizing textures...', 'blue');
      const tempPath = outputPath.replace(ext, `-temp${ext}`);
      try {
        execSync(`npx gltf-transform resize "${currentPath}" "${tempPath}" --width ${maxTextureSize} --height ${maxTextureSize}`, { stdio: 'inherit' });
        fs.unlinkSync(currentPath);
        fs.renameSync(tempPath, currentPath);
      } catch (error) {
        log('⚠️  Texture resizing failed, continuing without it...', 'yellow');
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    }

    log('\n⚙️  Step 3: Compressing textures to WebP...', 'blue');
    const tempPath2 = currentPath.replace(ext, `-temp2${ext}`);
    try {
      execSync(`npx gltf-transform webp "${currentPath}" "${tempPath2}"`, { stdio: 'inherit' });
      fs.unlinkSync(currentPath);
      fs.renameSync(tempPath2, currentPath);
    } catch (error) {
      log('⚠️  WebP compression failed, continuing without it...', 'yellow');
      if (fs.existsSync(tempPath2)) {
        fs.unlinkSync(tempPath2);
      }
    }
    
    const optimizedSize = getGltfModelSize(inputPath);
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
    
  log('\n✅ Optimization completed!', 'green');
  log(`📦 Original size: ${originalSize} MB → ${optimizedSize} MB`, 'green');
  log(`💾 Reduction: ${reduction}% (${(originalSize - optimizedSize).toFixed(2)} MB saved)`, 'green');

  // Detailed information about the model
  log(`\n📋 Detailed information:`, 'blue');
  log(`   📄 Format: ${ext.toUpperCase()}`, 'blue');
  log(`   🔧 Applied optimizations:`, 'blue');

  if (compressDraco) log(`     ✓ Draco compression (geometry)`, 'green');
  if (resizeTextures) log(`     ✓ Texture resizing (max ${maxTextureSize}px)`, 'green');
  log(`     ✓ WebP texture compression`, 'green');
  log(`     ✓ gltf-transform optimizations`, 'green');
    
    if (backupOriginal && !fs.existsSync(backupPath)) {
      log(`\n💾 Original backup saved as: ${baseName}-original${ext}`, 'yellow');
      fs.copyFileSync(inputPath, backupPath);
    }
    
    log(`\n📄 Replacing original file...`, 'blue');
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

    log('✅ File successfully replaced!', 'green');
    
  } catch (error) {
    log(`\n❌ Optimization error: ${error.message}`, 'red');
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
