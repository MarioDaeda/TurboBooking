const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
// Isolated module graph with dependency substitution; executes the actual TypeScript handlers.
exports.load = function load(entry, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', entry);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const native = createRequire(filename);
  const requireTs = spec => {
    if (Object.hasOwn(mocks, spec)) return mocks[spec];
    if (spec === 'server-only') return {};
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      let resolved = spec.startsWith('@/') ? path.resolve(__dirname, '../src', spec.slice(2)) : path.resolve(path.dirname(filename), spec);
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks, cache);
    }
    return native(spec);
  };
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }, fileName: filename }).outputText;
  new Function('require', 'module', 'exports', js)(requireTs, module, module.exports);
  return module.exports;
};
