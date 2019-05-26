const { NormalModuleReplacementPlugin } = require( 'webpack' );
const resolver = require( './index' );

const debug = require( 'debug' )( 'universal-resolver:webpack' );

module.exports = new NormalModuleReplacementPlugin( /^~.*/u, ( rsrc ) => {
  const value = rsrc.request;
  const origin = rsrc.contextInfo.issuer;
  rsrc.request = resolver( value, origin, false );
} );
