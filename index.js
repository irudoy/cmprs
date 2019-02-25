#!/usr/bin/env node

const program = require('commander')
const path = require('path')
const fs = require('fs')

const checkPathExists = (p) => {
  if (!fs.existsSync(p)) {
    console.error(`Error: ${p} does not exist!`)
    process.exit(1)
  }
}

const normalizeStats = (stats) => {
  const { assetsByChunkName: assetsMap } = stats;
  const chunkNames = Object.keys(assetsMap).reduce((res, key) => ({ ...res, [String(assetsMap[key])]: key }), {})
  const assets = stats.assets.reduce((res, { name, size }) => ({ ...res, [chunkNames[name] || name]: size }), {})
  return Object.keys(assets).reduce((res, key) => ({ ...res, [key]: { size: assets[key] } }), {})
}

const renderGroup = (obj = {}) => Object.entries(obj).map((
  [
    key,
    {
      oldSize,
      newSize,
      diff,
      pdiff,
    },
  ],
) => `
  <tr>
    <td>${key}</td>
    <td>${oldSize ? `${oldSize.toFixed(2)} KB` : ''}</td>
    <td>${newSize ? `${newSize.toFixed(2)} KB` : ''}</td>
    <td>${diff ? `${diff.toFixed(2)} KB` : ''}</td>
    <td>${pdiff ? `${pdiff.toFixed(2)}%` : ''}</td>
  </tr>
`).join('');

function render(template, data) {
  Object.entries(data).forEach(([key, value]) => {
    this[key] = value
  })
  return eval(`\`${template}\``) // eslint-disable-line no-eval
}

program
  .arguments('<old> <new>')
  .option('-o, --output <path>', 'Path to output file to. Defaults to compare/')
  .action((oldStats, newStats) => {
    const output = program.output || 'compare/'
    const oldPath = path.resolve(process.cwd(), oldStats)
    const newPath = path.resolve(process.cwd(), newStats)
    const outputPath = path.resolve(process.cwd(), output)

    checkPathExists(oldPath)
    checkPathExists(newPath)

    const oldAssets = normalizeStats(require(oldPath))
    const newAssets = normalizeStats(require(newPath))

    const assets = Object.keys({ ...oldAssets, ...newAssets })
      .reduce((res, key) => {
        const oldAsset = oldAssets[key];
        const newAsset = newAssets[key];

        const {
          bigger,
          smaller,
          same,
          onlyOld,
          onlyNew,
        } = res;

        const oldSize = oldAsset && oldAsset.size / 1024;
        const newSize = newAsset && newAsset.size / 1024;
        const diff = newSize - oldSize;
        const pdiff = (1 - (newSize / oldSize)) * -100;

        const asset = {
          oldSize,
          newSize,
          diff,
          pdiff,
        };

        if (Math.abs(pdiff) < 5) {
          same[key] = asset
        } else if (diff > 0) {
          bigger[key] = asset
        } else if (diff < 0) {
          smaller[key] = asset
        } else if (oldSize && !newSize) {
          onlyOld[key] = asset
        } else if (newSize && !oldSize) {
          onlyNew[key] = asset
        }

        return res;
      }, {
        bigger: {},
        smaller: {},
        same: {},
        onlyOld: {},
        onlyNew: {},
      })

    if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath)

    const tmpl = fs.readFileSync(path.resolve(__dirname, 'index.html'))
    const data = Object.entries(assets)
      .reduce((res, [key, value]) => ({ ...res, [key]: renderGroup(value) }), {});

    fs.writeFileSync(path.resolve(outputPath, 'index.html'), render(tmpl, data))

    process.exit(0)
  })
  .parse(process.argv)
