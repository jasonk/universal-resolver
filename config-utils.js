const path = require( 'path' ),
  globby = require( 'globby' );

const debug = require( 'debug' )( 'universal-resolver:config-utils' );

// TODO - Should have a way to specify one or more alternate monorepo
// locations
module.exports = findConfig;

function env( key ) {
  const name = `UNIVERSAL_RESOLVER_${key.toUpperCase()}`;
  const val = process.env[ name ]; // eslint-disable-line no-process-env
  debug( name, val );
  return val;
}

function findConfig() {
  const root = env( 'root' );
  if ( root ) {
    const config = findConfigIn( root );
    if ( config ) return config;
  }
  const conf = env( 'config' );
  if ( conf ) {
    const config = require( conf );
    if ( config ) return resolveConfig( config, path.dirname( conf ) );
  }

  let iter = process.cwd();
  let counter = 0;

  while ( counter++ < 100 ) {
    debug( 'checking for configs in', iter );
    let config = findConfigIn( iter );
    if ( config ) {
      debug( 'configs found in', iter, config );
      return config;
    }
    const next = path.resolve( iter, '..' );
    if ( next === iter ) return;
    iter = next;
    continue;
  }
  // istanbul ignore next
  throw new Error(
    `[universal-resolver] Failed to find config, recursed too many times`,
  );
}

function resolveConfig( config, directory ) {
  debug( 'resolveConfig', config, directory );
  if ( Array.isArray( config ) ) config = { packages : config };
  config.root = directory;
  if ( ! config.source ) config.source = 'src';
  if ( ! config.dest ) config.dest = 'dist';
  if ( ! config.prefix ) config.prefix = '~';
  if ( ! config.mode ) {
    // eslint-disable-next-line no-process-env
    config.mode = process.env.BABEL_ENV || process.env.NODE_ENV;
  }
  if ( ! ( config.mode === 'development' || config.mode === 'production' ) ) {
    config.mode = 'development';
  }
  if ( env( 'mode' ) ) config.mode = env( 'mode' );
  const pkgs = preparePackages( config );
  debug( 'prepared packages', pkgs );
  config.packages = pkgs;
  debug( 'resolved config', config );
  return config;
}

function findConfigIn( dir ) {
  debug( 'findConfigIn', dir );
  const ownConfig = readConfig( dir, 'universal-resolver' );
  debug( 'ownConfig', ownConfig );
  if ( ownConfig ) {
    debug( 'found universal-resolver config in', dir, ownConfig );
    return resolveConfig( ownConfig, dir );
  }
  for ( const name of [ 'lerna.json', 'package.json' ] ) {
    const config = readConfig( dir, name );
    if ( ! config ) continue;
    const ws = config.workspaces;
    const pkgs = config.packages;
    const ur = config[ 'universal-resolver' ];
    if ( ! ( ws || pkgs ) ) continue;
    debug( 'found', name, 'in', dir );
    const conf = ur || {};
    if ( ! conf.packages ) conf.packages = ws || pkgs;
    return resolveConfig( conf, dir );
  }
}

function readConfig( dir, name ) {
  try {
    return require( path.join( dir, name ) );
  } catch( err ) {
    if ( err.code === 'MODULE_NOT_FOUND' ) {
      if ( err.message.includes( name ) ) return;
    }
    throw err;
  }
}

function preparePackages( config ) {
  if ( ! Array.isArray( config.packages ) ) config.packages = [];
  const pkgs = [];
  config.packages.forEach( pkg => {
    const root = ( typeof pkg === 'string' ) ? pkg : pkg.root;
    if ( ! root ) {
      const json = JSON.stringify( pkg );
      // eslint-disable-next-line no-console
      console.error( `[universal-resolver] No root for ${json}` );
      return;
    }
    const files = [];
    const pack = ( name ) => files.push( path.resolve( config.root, name ) );
    if ( globby.hasMagic( root ) ) {
      const opts = { cwd : config.root, onlyDirectories : true };
      globby.sync( root, opts ).forEach( pack );
    } else {
      pack( root );
    }
    if ( typeof pkg === 'string' ) pkg = {};
    debug( 'FILES', files );
    files.forEach( file => pkgs.push( { ...pkg, root : file } ) );
  } );
  return pkgs.map( preparePackage );
}

function preparePackage( pkg ) {
  debug( 'preparePackage', pkg );
  // istanbul ignore next
  if ( typeof pkg === 'undefined' ) return;
  if ( typeof pkg === 'string' ) pkg = { root : pkg };
  if ( ! pkg.root ) {
    throw new Error( `No root for package "${JSON.stringify( pkg )}"` );
  }
  try {
    const pj = require( path.resolve( pkg.root, 'package.json' ) );
    if ( pj[ 'universal-resolver' ] ) {
      Object.assign( pkg, pj[ 'universal-resolver' ] );
    }
    if ( ! pkg.name ) pkg.name = pj.name;
  } catch( err ) {
    debug( `Unable to read package.json for ${pkg.root}: ${err}` );
    return pkg;
  }
  return pkg;
}

