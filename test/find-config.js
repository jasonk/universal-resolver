const path = require( 'path' ),
  findConfig = require( '../config-utils' );

describe( 'findConfig', () => {

  beforeEach( () => {
    [
      'UNIVERSAL_RESOLVER_CONFIG',
      'UNIVERSAL_RESOLVER_MODE',
      'UNIVERSAL_RESOLVER_ROOT',
    ].forEach( x => ( delete process.env[ x ] ) );
  } );

  it( 'finds the right config for a yarn repo', () => {
    tryRepo( 'yarn-monorepo' );
    tryRepo( 'yarn-monorepo', 'packages/package-c' );
  } );

  it( 'finds the right config for a lerna repo', () => {
    tryRepo( 'lerna-monorepo' );
    tryRepo( 'lerna-monorepo', 'packages/package-a' );
  } );

  it( 'finds the right config with a json config file', () => {
    tryRepo( 'json-repos' );
    tryRepo( 'json-repos', 'package-a' );
  } );

  it( 'finds the right config with a js config file', () => {
    tryRepo( 'js-repos' );
    tryRepo( 'js-repos', 'package-b' );
  } );

  it( 'does not find configs in other types of repos', () => {
    ( () => tryRepo( 'not-a-repo' ) )
      .should.throw( /Could not find packages/u );;
  } );

  it( 'finds configs using UNIVERSAL_RESOLVER_ROOT', () => {
    process.chdir( __dirname );
    const root = path.resolve( __dirname, 'fixtures', 'json-repos' );
    process.env.UNIVERSAL_RESOLVER_ROOT = root;
    tryLoad( root );
  } );

  it( 'finds configs using UNIVERSAL_RESOLVER_CONFIG', () => {
    process.chdir( __dirname );
    const root = path.resolve( __dirname, 'fixtures', 'js-repos' );
    const config = path.resolve( root, 'universal-resolver.js' );
    process.env.UNIVERSAL_RESOLVER_CONFIG = config;
    tryLoad( root );
  } );

} );

function tryRepo( fixture, subdir='.' ) {
  const root = path.resolve( __dirname, 'fixtures', fixture );
  const start = path.resolve( root, subdir );
  process.chdir( start );
  tryLoad( root );
}

function tryLoad( root ) {
  const config = findConfig();
  config.should.have.property( 'root', root );
  config.should.have.property( 'source', 'src' );
  config.should.have.property( 'packages' ).an( 'array' );
  config.should.have.property( 'mode', 'development' );
  config.packages.should.have.a.lengthOf( 3 );
  const b = config.packages.find( p => p.name === 'package-b' );
  b.should.be.an( 'object' );
  b.should.have.property( 'name', 'package-b' );
  b.should.have.property( 'root' );
  b.should.have.property( 'fakeOption', 'baz' );
}
