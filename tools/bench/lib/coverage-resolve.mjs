import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require = createRequire(import.meta.url);
export async function resolve(specifier, context, next) {
  if (specifier === '@vitest/coverage-v8' || specifier.startsWith('@vitest/coverage-v8/')) {
    const sub = specifier.slice('@vitest/coverage-v8'.length);
    const pkg = require.resolve('@vitest/coverage-v8/package.json').replace(/package\.json$/, '');
    return next(pathToFileURL(require.resolve(sub ? pkg + 'dist' + sub + '.js' : '@vitest/coverage-v8')).href, context);
  }
  return next(specifier, context);
}
