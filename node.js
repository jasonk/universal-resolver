const resolver = require( '.' ), Module = require( 'module' );
const debug = require( 'debug' )( 'universal-resolver:node' );

// TODO - This probably only works with cjs modules, need to see what
// the currently-experimental esm module support in node will require

const originalResolver = Module._resolveFilename;
if ( typeof originalResolver !== 'function' ) {
  // eslint-disable-next-line no-console
  console.error( [
    `Error: Expected Module._resolveFilename to be a function -`,
    `found ${typeof originalResolver} instead!`,
  ].join( ' ' ) );
}

Module._resolveFilename = replacementResolver;

function replacementResolver( request, parent, isMain, options ) {
  const initialRequest = request;
  request = resolver( request, parent.filename );
  if ( initialRequest !== request ) {
    debug( 'Transformed', initialRequest, 'to', request );
  }
  return originalResolver( request, parent, isMain, options );
}

// See also:
// https://github.com/nodejs/node/blob/55de6ff38dfc639d82a1acbd9016fd4ebe67240f/lib/internal/modules/cjs/loader.js#L570
// https://github.com/elastic/require-in-the-middle
// https://github.com/ariporad/pirates
// https://github.com/ariporad/pirates/issues/3
