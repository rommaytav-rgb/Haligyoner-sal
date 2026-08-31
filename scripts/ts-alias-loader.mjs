/**
 * ESM resolver hook for running the TypeScript sources directly under Node.
 *
 * Node's type stripping requires explicit file extensions and knows nothing
 * about the `@/*` path alias, so this hook maps `@/x` to `<cwd>/src/x` and fills
 * in `.ts` / `.tsx` / `/index.ts` for extensionless specifiers. Next.js and
 * Vitest resolve the same alias through their own configuration.
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC_ROOT = path.join(process.cwd(), 'src');

function isFile(candidate) {
  return existsSync(candidate) && statSync(candidate).isFile();
}

function resolveFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ];
  return candidates.find(isFile) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  let basePath = null;

  if (specifier.startsWith('@/')) {
    basePath = path.join(SRC_ROOT, specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parentPath = context.parentURL?.startsWith('file:')
      ? fileURLToPath(context.parentURL)
      : path.join(process.cwd(), 'index.js');
    basePath = path.resolve(path.dirname(parentPath), specifier);
  }

  if (basePath) {
    const resolved = resolveFile(basePath);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  return nextResolve(specifier, context);
}
