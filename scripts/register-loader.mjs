/** Registers the TypeScript path-alias resolver for `node --import`. */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-alias-loader.mjs', pathToFileURL(`${process.cwd()}/scripts/`));
