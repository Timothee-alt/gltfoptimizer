# GLTF Optimizer

A powerful Node.js library and CLI tool to optimize 3D models in GLTF/GLB format. Uses `gltf-transform` to compress meshes (Draco), resize textures, and convert them to WebP for optimal web performance.

![npm version](https://img.shields.io/npm/v/@gltf-optimizer/optimize-models)
![license](https://img.shields.io/npm/l/@gltf-optimizer/optimize-models)
![node version](https://img.shields.io/node/v/@gltf-optimizer/optimize-models)

## 🚀 Features

- **Multi-format support**: GLTF (.gltf + .bin) and GLB (single file)
- **Advanced optimizations**:
  - Draco mesh compression
  - Texture resizing (configurable max size)
  - WebP texture conversion
  - Automatic deduplication and optimization
- **Model validation**: Checks file integrity before optimization
- **Backup system**: Automatic original file backups
- **Detailed reporting**: Size comparisons and optimization statistics
- **CLI & API**: Both command-line interface and programmatic API
- **Configuration**: JSON-based configuration support
- **Non-interactive mode**: Perfect for CI/CD pipelines

## 📦 Installation

```bash
npm i gltf-optimizer-breizhwebsolution
```

## 🛠️ Usage

### Programmatic API

Import and use functions directly in your Node.js code:

```javascript
const { findGltfFiles, optimizeModel } = require('@gltf-optimizer/optimize-models');

// Find all GLTF files in a directory
const modelsDir = './path/to/your/models';
const gltfFiles = findGltfFiles(modelsDir);

// Optimize a specific model with custom options
gltfFiles.forEach(file => {
  optimizeModel(file, {
    compressDraco: true,      // Draco compression (default: true)
    resizeTextures: true,     // Resize textures (default: true)
    maxTextureSize: 1024,     // Max texture size (default: 1024)
    backupOriginal: true      // Backup original files (default: true)
  });
});
```

### Command Line Interface (CLI)

Run the interactive script to optimize models via terminal:

```bash
npx gltf-optimizer
# or after global installation: gltf-optimizer
```

#### CLI Options

```bash
gltf-optimizer [options]

Options:
  --yes, -y                Non-interactive mode (automation)
  --models-dir=<path>      Directory containing the models
  --output-dir=<path>      Output directory (optional)
  --help, -h              Show this help

Examples:
  gltf-optimizer --yes
  gltf-optimizer --models-dir=./assets --yes
  gltf-optimizer --yes --output-dir=./optimized
```

- **Default behavior**: Scans `models/` folder
- **Interactive mode**: Menu to select specific models or optimize all
- **Non-interactive mode**: Optimizes all models automatically
- **Colored logs**: Shows sizes before/after and optimization details

## ⚙️ Configuration

Create a `gltf-optimizer.config.json` file in your project root:

```json
{
  "modelsDir": "./models",
  "outputDir": null,
  "options": {
    "compressDraco": true,
    "resizeTextures": true,
    "maxTextureSize": 1024,
    "backupOriginal": true
  },
  "excludePatterns": [
    "**/node_modules/**",
    "**/*.backup.*",
    "**/*-original.*"
  ],
  "includePatterns": [
    "**/*.gltf",
    "**/*.glb"
  ],
  "parallelProcessing": false,
  "maxConcurrency": 4,
  "logLevel": "info",
  "generateReport": false,
  "reportFormat": "json"
}
```

Or add a `gltf-optimizer` section to your `package.json`:

```json
{
  "name": "my-project",
  "gltf-optimizer": {
    "modelsDir": "./assets/models",
    "options": {
      "maxTextureSize": 2048
    }
  }
}
```

## 📊 Optimization Results

The tool provides detailed optimization reports:

```
📦 Original size: 4.32 MB → 1.14 MB
💾 Reduction: 73.6% (3.18 MB saved)

📋 Detailed information:
   📄 Format: .GLTF
   🔧 Applied optimizations:
     ✓ Draco compression (geometry)
     ✓ Texture resizing (max 1024px)
     ✓ WebP texture compression
     ✓ gltf-transform optimizations

📊 GLOBAL OPTIMIZATION REPORT
📈 Statistics:
   ✅ Successfully optimized models: 5
   ❌ Optimization failures: 0
   📦 Total original size: 21.5 MB
   📦 Total optimized size: 6.8 MB
   💾 Total reduction: 68.4% (14.7 MB saved)
```

## 🔧 Advanced Usage

### Custom Validation

```javascript
const { validateGltfModel } = require('@gltf-optimizer/optimize-models');

const validation = validateGltfModel('model.gltf');
if (!validation.valid) {
  console.log(`Model invalid: ${validation.error}`);
}
```

### Loading Configuration

```javascript
const { loadConfig } = require('@gltf-optimizer/optimize-models');

const config = loadConfig('./custom-config.json');
console.log('Loaded configuration:', config);
```

### Custom Optimization Pipeline

```javascript
const { optimizeModel } = require('@gltf-optimizer/optimize-models');

await optimizeModel('input.gltf', {
  compressDraco: true,
  resizeTextures: false,  // Skip texture resizing
  maxTextureSize: 512,    // Smaller textures
  backupOriginal: false   // Don't backup
});
```

## 🏗️ Architecture

```
gltf-optimizer/
├── cli.js              # Command-line interface
├── lib/
│   └── optimize.js     # Core optimization logic
├── index.js            # Main API exports
├── gltf-optimizer.config.json  # Default configuration
└── README.md           # This file
```

## 🔧 Development

### Setup
```bash
git clone https://github.com/Timothee-alt/gltfoptimizer.git
cd gltfoptimizer
npm install
```

### Testing
```bash
npm start  # Run CLI
node test-validation.js  # Test validation
```

### Publishing
```bash
npm login
npm publish
```

## 📋 Requirements

- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0
- **gltf-transform**: ^2.2.0 (automatically installed)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [gltf-transform](https://github.com/donmccurdy/gltf-transform) - Core optimization engine
- [Khronos Group](https://www.khronos.org/) - GLTF/GLB specifications
- All contributors and the open-source community

--

**Made with ❤️ for the 3D web community**
