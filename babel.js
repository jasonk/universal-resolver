const resolver = require( '.' );
const debug = require( 'debug' )( 'universal-resolver:babel' );

function isValueObject( val ) {
  return ( typeof val === 'object' )
    && ( typeof val.raw === 'string' )
    && ( typeof val.cooked === 'string' )
    && ( val.raw === val.cooked );
}

function replacePrefixes( node, state ) {
  if ( ! node ) return;
  const file = state.file.opts.filename;
  if ( isValueObject( node.value ) ) {
    const newval = resolver( node.value.raw, file );
    if ( newval ) node.value.raw = node.value.cooked = newval;
  } else {
    const newval = resolver( node.value, file );
    if ( newval ) node.value = newval;
  }
}

function UniversalResolverBabelPlugin( babel ) {
  const t = babel.types;

  return {
    name    : 'universal-resolver',
    visitor : {
      CallExpression( path, state ) {
        const callee = path.node.callee;
        const isRelevant = ( callee.name === 'require' )
          || ( callee.name === 'import' )
          || t.isImport( callee );
        if ( ! isRelevant ) return;
        const node = path.node.arguments[ 0 ];
        if ( t.isStringLiteral( node ) ) {
          return replacePrefixes( node, state );
        } else if ( t.isTemplateLiteral( node ) ) {
          return replacePrefixes( node.quasis[ 0 ], state );
        } else {
          debug( `Unable to resolve node`, node );
        }
      },
      ImportDeclaration( path, state ) {
        replacePrefixes( path.node.source, state );
      },
      ExportNamedDeclaration( path, state ) {
        replacePrefixes( path.node.source, state );
      },
      ExportAllDeclaration( path, state ) {
        replacePrefixes( path.node.source, state );
      },
      ExportDeclaration( path, state ) {
        replacePrefixes( path.node.source, state );
      },
    },
  };
}

module.exports = UniversalResolverBabelPlugin;
