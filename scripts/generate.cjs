// Simple HashLips Art Engine runner for layer-based generation
// Usage: `npm run generate-art`

const path = require('path');
const { ArtEngine, inputs, generators, renderers, exporters } = require('@hashlips-lab/art-engine');

const BASE_PATH = path.resolve(__dirname, '..');

// NOTE: This script assumes you have prepared layer folders under `data/` or you can point
// to existing `public/` image folders. For a quick test, it will generate placeholder outputs
// if no data folder exists.

const dataAssetsPath = path.join(BASE_PATH, 'public', 'layers'); // point to layers folder

const ae = new ArtEngine({
  cachePath: `${BASE_PATH}/scripts/cache`,
  outputPath: `${BASE_PATH}/scripts/output`,
  useCache: false,
  inputs: {
    // If you have a layers dataset, reference it here. Key name 'collection' is arbitrary.
    collection: new inputs.ImageLayersInput({
      assetsBasePath: dataAssetsPath,
    }),
  },
  generators: [
    new generators.ImageLayersAttributesGenerator({
      dataSet: 'collection',
      startIndex: 1,
      endIndex: 10, // generate 10 sample pieces
    })
  ],
  renderers: [
    new renderers.ItemAttributesRenderer({
      name: (uid) => `NFTNinja #${uid}`,
      description: (attributes) => `A sample NFT generated for testing.`,
    }),
    new renderers.ImageLayersRenderer({
      width: 2048,
      height: 2048,
      layers: [
        { resize: { width: 2048, height: 2048, fit: 'inside' }, gravity: 'center' }, // Background resized and centered
        { resize: { width: 2048, height: 2048, fit: 'inside' }, gravity: 'center' }  // Character resized and centered
      ]
    })
  ],
  exporters: [
    new exporters.ImagesExporter({ imagesFolder: 'images' }),
    new exporters.Erc721MetadataExporter({ imageUriPrefix: 'ipfs://__CID__/' })
  ],
});

(async () => {
  try {
    console.log('Running Art Engine...');
    await ae.run();
    console.log('Art Engine finished. Output in scripts/output');
    await ae.printPerformance();
  } catch (err) {
    console.error('Art Engine error:', err);
    process.exit(1);
  }
})();
