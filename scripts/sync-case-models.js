const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const caseDir = process.env.LEGO_CASE_MODELS_DIR || 'E:\\lego maker\\案例模型';
const studioCustomPartsDir = process.env.STUDIO_CUSTOM_PARTS_DIR ||
  path.join(process.env.LOCALAPPDATA || '', 'Stud.io', 'CustomParts');

const modelExtensions = new Set(['.ldr', '.mpd']);
const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
const customPartSearchDirs = [
  path.join(studioCustomPartsDir, 'parts'),
  path.join(studioCustomPartsDir, 'p')
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(source, destination) {
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function normalizePartID(id) {
  return id.trim().replace(/\\/g, '/').toLowerCase();
}

function partCandidates(id) {
  const normalized = normalizePartID(id);
  if (!normalized.endsWith('.dat')) {
    return [];
  }
  if (normalized.startsWith('s/')) {
    return [
      path.join(projectRoot, 'official', 'parts', normalized),
      path.join(projectRoot, 'unofficial', 'parts', normalized),
      path.join(projectRoot, 'ldraw_parts', normalized),
      path.join(projectRoot, 'ldraw_unofficial', normalized)
    ];
  }
  if (normalized.startsWith('48/') || normalized.startsWith('8/')) {
    return [
      path.join(projectRoot, 'official', 'p', normalized),
      path.join(projectRoot, 'unofficial', 'p', normalized)
    ];
  }
  return [
    path.join(projectRoot, 'official', 'parts', normalized),
    path.join(projectRoot, 'official', 'p', normalized),
    path.join(projectRoot, 'unofficial', 'parts', normalized),
    path.join(projectRoot, 'unofficial', 'p', normalized),
    path.join(projectRoot, 'ldraw_parts', normalized),
    path.join(projectRoot, 'ldraw_unofficial', normalized)
  ];
}

function partExists(id) {
  return partCandidates(id).some(candidate => fs.existsSync(candidate));
}

function findStudioPart(id) {
  const normalized = normalizePartID(id);
  const fileName = path.basename(normalized);
  const subPath = normalized.includes('/') ? normalized : fileName;
  for (const dir of customPartSearchDirs) {
    const direct = path.join(dir, subPath);
    if (fs.existsSync(direct)) {
      return direct;
    }
  }

  for (const dir of customPartSearchDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const stack = [dir];
    while (stack.length > 0) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        }
        else if (entry.name.toLowerCase() === fileName) {
          return fullPath;
        }
      }
    }
  }
  return null;
}

function copyStudioPart(id) {
  if (partExists(id)) {
    return null;
  }

  const source = findStudioPart(id);
  if (!source) {
    return null;
  }

  const normalized = normalizePartID(id);
  const targetRoot = normalized.startsWith('48/') || normalized.startsWith('8/')
    ? path.join(projectRoot, 'unofficial', 'p')
    : path.join(projectRoot, 'unofficial', 'parts');
  const destination = path.join(targetRoot, normalized);
  copyFile(source, destination);
  return destination;
}

function referencedPartIDs(modelPath) {
  const text = fs.readFileSync(modelPath, 'utf8');
  const ids = new Set();
  text.split(/\r?\n/).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === '1' && parts.length >= 15) {
      ids.add(parts.slice(14).join(' '));
    }
  });
  return [...ids];
}

function findPreview(baseName) {
  for (const ext of imageExtensions) {
    const preview = path.join(caseDir, baseName + ext);
    if (fs.existsSync(preview)) {
      return preview;
    }
  }
  return null;
}

function writeCatalog(models) {
  const lines = [
    'window.LEGO_MODEL_CATALOG = ['
  ];
  models.forEach((model, index) => {
    lines.push('  {');
    lines.push(`    name: ${JSON.stringify(model.name)},`);
    lines.push(`    file: ${JSON.stringify(model.file)},`);
    lines.push(`    preview: ${JSON.stringify(model.preview)},`);
    lines.push('    category: "案例模型"');
    lines.push(index === models.length - 1 ? '  }' : '  },');
  });
  lines.push('];');
  lines.push('');
  fs.writeFileSync(path.join(projectRoot, 'js', 'case-models.js'), lines.join('\n'), 'utf8');
}

function main() {
  if (!fs.existsSync(caseDir)) {
    throw new Error(`案例模型文件夹不存在: ${caseDir}`);
  }

  ensureDir(path.join(projectRoot, 'models'));
  ensureDir(path.join(projectRoot, 'model-previews'));
  ensureDir(path.join(projectRoot, 'unofficial', 'parts'));
  ensureDir(path.join(projectRoot, 'unofficial', 'p'));

  const caseFiles = fs.readdirSync(caseDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && modelExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  const catalog = [];
  const copiedParts = [];
  const missingParts = new Map();

  for (const fileName of caseFiles) {
    const sourceModel = path.join(caseDir, fileName);
    const targetModel = path.join(projectRoot, 'models', fileName);
    copyFile(sourceModel, targetModel);

    const parsed = path.parse(fileName);
    const previewSource = findPreview(parsed.name);
    let preview = '';
    if (previewSource) {
      const previewName = path.basename(previewSource);
      copyFile(previewSource, path.join(projectRoot, 'model-previews', previewName));
      preview = 'model-previews/' + previewName;
    }

    for (const id of referencedPartIDs(sourceModel)) {
      if (!normalizePartID(id).endsWith('.dat')) {
        continue;
      }
      const copied = copyStudioPart(id);
      if (copied) {
        copiedParts.push(path.relative(projectRoot, copied));
      }
      if (!partExists(id)) {
        if (!missingParts.has(fileName)) {
          missingParts.set(fileName, []);
        }
        missingParts.get(fileName).push(id);
      }
    }

    catalog.push({
      name: parsed.name,
      file: 'models/' + fileName,
      preview
    });
  }

  writeCatalog(catalog);

  console.log(`Synced ${catalog.length} case model(s).`);
  console.log(`Copied ${copiedParts.length} Studio custom part(s).`);
  copiedParts.forEach(part => console.log(`  + ${part}`));
  if (missingParts.size > 0) {
    console.log('Missing referenced part(s):');
    for (const [model, ids] of missingParts.entries()) {
      console.log(`  ${model}: ${ids.join(', ')}`);
    }
  }
}

if (require.main === module) {
  main();
}
else {
  module.exports = main;
}
