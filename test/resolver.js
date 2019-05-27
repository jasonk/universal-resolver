const path = require( 'path' ),
  Resolver = require( '../resolver' );

describe( 'Resolver', () => {

  it( 'resolves things correctly', () => {
    const pathto = path.resolve.bind( null, __dirname, 'fixtures/js-repos' );
    const resolver = new Resolver( {
      packages : [ 'package-a', 'package-b', 'package-c' ].map( x => {
        return {
          name    : x,
          root    : pathto( x ),
          prefix  : '~',
          source  : 'src',
          dest    : 'dist',
        };
      } ),
    } );
    resolver.resolve( 'package-a', pathto( 'package-a/src/file.js' ), {
      relative  : true,
    } ).should.equal( './' );
    resolver.resolve( 'package-a', pathto( 'package-c/src/index.js' ), {
      relative  : true,
    } ).should.equal( '../../package-a/src' );
  } );

} );
