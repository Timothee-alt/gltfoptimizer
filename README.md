# @gltf-optimizer/optimize-models

Une bibliothèque Node.js pour optimiser les modèles 3D au format GLTF/GLB. Elle utilise `gltf-transform` pour compresser les meshes (Draco), redimensionner les textures et les convertir en WebP.

## Installation

```bash
npm install @gltf-optimizer/optimize-models
```

## Utilisation en Bibliothèque (Programmatique)

Importez et utilisez les fonctions directement dans votre code Node.js.

```javascript
const { findGltfFiles, optimizeModel } = require('@gltf-optimizer/optimize-models');

// Trouver tous les fichiers GLTF dans un dossier
const modelsDir = './path/to/your/models';
const gltfFiles = findGltfFiles(modelsDir);

// Optimiser un modèle spécifique avec options personnalisées
gltfFiles.forEach(file => {
  optimizeModel(file, {
    compressDraco: true,      // Compression Draco (défaut: true)
    resizeTextures: true,     // Redimensionner textures (défaut: true)
    maxTextureSize: 1024,     // Taille max (défaut: 1024)
    backupOriginal: true      // Sauvegarder l'original (défaut: true)
  });
});
```

## Utilisation en CLI

Exécutez le script interactif pour optimiser des modèles via terminal.

```bash
npx gltf-optimizer
# ou après installation globale: gltf-optimizer
```

- Le script scanne par défaut le dossier `models/` (ajustez `MODELS_DIR` dans `cli.js` si besoin).
- Menu interactif pour sélectionner tous ou des modèles spécifiques.
- Confirmation avant optimisation.
- Logs colorés avec tailles avant/après.

## Configuration

Les options par défaut sont définies dans `lib/optimize.js`. Vous pouvez les surcharger lors des appels à `optimizeModel`.

## Dépendances

- `gltf-transform`: Outil principal pour l'optimisation GLTF.

## Développement

- Clonez le repo et `npm install`.
- Testez: `npm start` pour le CLI.
- Publiez: `npm publish` (après login NPM).

## Licence

MIT
