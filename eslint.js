const resolver = require( '.' ),
  nodeResolver = require( 'eslint-import-resolver-node' ).resolve;
const debug = require( 'debug' )( 'universal-resolver:eslint' );

exports.interfaceVersion = 2;
exports.resolve = UniversalResolverEslintPlugin;

function UniversalResolverEslintPlugin( source, file, config ) {
  debug( 'resolve', source, file, config );
  const resolved = resolver( source, file, false );
  return nodeResolver( resolved, file, config );
}
