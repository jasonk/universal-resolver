const path = require( 'path' ),
  fs = require( 'fs' );

const debug = require( 'debug' )( 'universal-resolver' );

/**
 * A resolver package configuration object.  For the optional
 * properties, if you don't specify them the value from the resolver
 * will be used instead.
 *
 * @typedef {Object} Resolver~PkgConf
 * @property {string} name - The package name.
 * @property {string} root - The path to the root directory.
 * @property {string} [source] - The path to the source directory.
 * @property {string} [main] - The path to the replacement "main" file.
 * @property {string} [prefix] - The prefix for this package.
 */

class Resolver {

  /**
   * @property packages
   * @type {string[]|Resolver~PkgConf[]}
   *
   * An array containing the configurations for each of your packages.
   * You can specify this as simply an array of strings (the {@link
   * Resolver~PkgConf#root}s) or you can provide complete
   * configurations.
   */

  /**
   * @property mode
   * @type {string}
   * @default `$BABEL_ENV || $NODE_ENV || 'development'`
   *
   * The resolution mode.  Must be one of 'development' or
   * 'production'.  If not provided directly in the config, will be
   * guessed by checking `$BABEL_ENV` and `$NODE_ENV` from your
   * environment variables.
   *
   * You can also override the checking and whatever value was set in
   * the config by setting `$UNIVERSAL_RESOLVER_MODE` in your
   * environment.
   */

  /**
   * @property prefix
   * @type {string}
   * @default '~'
   *
   * The prefix for source resolution paths.  When you import a path
   * that begins with this prefix it will be turned into a relative
   * path to that file based on the packages source directory.  That
   * way it will point to the right location regardless of where in
   * the directory tree you import from and save you from having write
   * `import x from '../../../../../../../'` ever again.
   */

  /**
   * @property source
   * @type {string}
   * @default "src"
   *
   * The name of the source directory in your packages.
   */

  /**
   * @property main
   * @type {string}
   * @default `${this.source}/index`
   *
   * The path to use to replace the `main` property from package.json.
   * When running in development mode, if anything attempts to import
   * your package with just it's name then instead of resolving to the
   * value of the `main` property in `package.json` it will resolve to
   * this value.
   */

  /**
   * @property resolvePrefixes
   * @type {boolean}
   * @default true
   *
   * Set to false to disable resolving the prefix.
   */

  /**
   * @property resolvePackages
   * @type {boolean}
   * @default true
   *
   * Set to false to disable resolving packages in the repo to their
   * source directories.
   */

  /**
   * @property resolveMain
   * @type {boolean}
   * @default true
   *
   * Set to false to disable resolving configured packages to their
   * source instead of the package.json main.
   */

  /**
   * @property resolveSymlinks
   * @type {boolean}
   * @default true
   *
   * Whether or not to resolve symlinked paths to their real
   * locations.  If you have `overrides` configured in your
   * `babel.config.js` their `test` properties specify full pathnames,
   * then that configuration may not get applied in a monorepo, where
   * the path to the file goes through a symlink that points to that
   * directory.  When this value is true the resolver will resolve
   * symlinks to try and avoid that.
   */

  /**
   * @property resolveSelf
   * @type {boolean}
   * @default true
   *
   * Set to false to disable "self resolution".  Self resolution means
   * being able to import "package-name" from within that same package
   * and have it turned into a working relative path.
   */

  constructor( opts={} ) {
    Object.assign( this, {
      resolvePrefixes   : true,
      resolvePackages   : true,
      resolveMain       : true,
      resolveSymlinks   : true,
      resolveSelf       : true,
      mode              : 'development',
      prefix            : '~',
      source            : 'src',
    }, opts );
    if ( ! this.main ) this.main = this.source;
    this.preparePackages();
  }

  preparePackages( packages ) {
    debug( 'THIS', this );
    this.packages.forEach( pkg => {
      [ 'prefix', 'source', 'main' ].forEach( x => {
        if ( ! pkg[ x ] ) pkg[ x ] = this[ x ];
      } );
    } );
  }

  get prod() { return this.mode === 'production'; }
  get dev() { return this.mode !== 'production'; }

  findPackageForOrigin( file ) {
    for ( const pkg of this.packages ) {
      if ( file.startsWith( pkg.root + '/' ) ) return pkg;
    }
  }

  findPackageForTarget( name ) {
    for ( const pkg of this.packages ) {
      if ( name === pkg.name ) return pkg;
      if ( name.startsWith( pkg.name + '/' ) ) return pkg;
    }
  }

  // eslint-disable-next-line max-lines-per-function, complexity
  resolve( target, origin, options={} ) {
    if ( typeof options === 'boolean' ) options = { relative : options };
    const opts = {
      relative    : true,
      // fallback    : x => require.resolve( x ), // has to be the
      // right "require", from the package using us, not from our
      // package
      ...options,
    };
    debug( '*** resolving ***' );
    debug( 'target =', target );
    debug( 'origin =', origin );
    const initialOrigin = origin;
    const initialTarget = target;

    if ( this.resolveSymlinks ) origin = fs.realpathSync( origin );
    if ( origin !== initialOrigin ) {
      debug( `Origin symlink resolved to`, origin );
    }

    // We can identify the origin package earlier because the origin
    // path is already resolved.
    const opkg = this.findPackageForOrigin( origin );
    if ( opkg ) {
      debug( `Found package ${opkg.name} for origin` );
    } else {
      debug( `No origin package for ${origin}` );
    }

    const matches = x => {
      if ( x.length === 0 ) return false;
      return target === x || target.startsWith( x + '/' );
    };

    // Types of imports:
    //  "prefix"    - is '~' or starts with '~/'
    //  "self"      - is '@our/package' or starts with '@our/package'
    //  "relative"  - is '.' or '..' or starts with './' or '../'
    //  "module"    - none of the above

    // If the target is a "prefix" or "self" import then the first
    // thing we do is to to turn it into a relative import
    if ( opkg ) {
      let prefix = null;
      let which = null;
      if ( this.resolvePrefixes && matches( opkg.prefix ) ) {
        prefix = opkg.prefix;
        which = 'resolvePrefixes';
      } else if ( this.resolveSelf && matches( opkg.name ) ) {
        prefix = opkg.name;
        which = 'resolveSelf';
      }
      if ( prefix ) {
        // If it's prefixed or self then we treat those the same way,
        // by turning them into relative imports
        target = target.substring( prefix.length );
        debug( `${which} removed prefix and got ${target}` );
        target = path.resolve( opkg.root, opkg.source, `./${target}` );
        debug( `${which} resolved to ${target}` );
        target = path.relative( path.dirname( origin ), target );
        debug( `prefix relativized to ${target}` );
      }
    }

    const rel = matches( '.' ) || matches( '..' )
      || ( opkg && matches( opkg.prefix ) );

    const tpkg = rel ? opkg : this.findPackageForTarget( target );

    if ( tpkg && ( tpkg !== opkg ) && matches( tpkg.name ) ) {
      const direct = path.resolve(
        tpkg.root,
        './' + target.substring( tpkg.name.length ),
      );
      if ( fs.existsSync( direct ) ) {
        debug( `Direct path exists, using it`, direct );
        target = direct;
      } else if ( this.resolvePackages ) {
        target = path.resolve(
          tpkg.root,
          this.prod ? tpkg.dest : tpkg.source,
          './' + target.substring( tpkg.name.length ),
        );
        debug( `resolvePackages resolved to ${target}` );
      } else if ( this.resolveMain && target === tpkg.name ) {
        target = path.resolve(
          tpkg.root,
          this.prod ? tpkg.dest : tpkg.source,
        );
        debug( `resolveMain resolved to ${target}` );
      }
    }

    let is_module = false;
    const finish = ( msg ) => {
      debug( 'Finishing', target, msg ? `because ${msg}` : '' );
      if ( is_module ) return target;

      target = path.normalize( target );
      if ( opts.relative ) {
        if ( path.isAbsolute( target ) ) {
          target = path.relative( path.dirname( origin ), target );
        }
        // If it was in a subdirectory then path.relative won't
        // include the './', but we need it or it will be
        // interpreted as a module name
        const lead = target.split( path.sep )[0];
        if ( lead !== '.' && lead !== '..' ) target = `./${target}`;
      } else {
        // eslint-disable-next-line no-lonely-if
        if ( ! path.isAbsolute( target ) ) {
          target = path.resolve( path.dirname( origin ), target );
        }
      }
      // If the original request ended with a slash, make sure the
      // resolved one does too..
      if ( initialTarget.endsWith( '/' ) && ! target.endsWith( '/' ) ) {
        target += '/';
      }
      debug( 'Returning resolved path', target, msg ? `(${msg})` : '' );
      return target;
    };

    // "relative" - starts with "./" or "../" or is "." or ".."
    // If it's a relative import, then all we have to do is turn it
    // into an absolute path (if the `relative` param was false)
    // if ( matches( '.' ) || matches( '..' ) ) return finish( 'relative' );

    // If we reach this point then the thing being required is
    // a module name, so we don't treat it as a relative path anymore.
    is_module = true;

    // None of the stuff below happens when doing a production build
    if ( this.prod ) return finish();

    // If we get to here then the target is in a different package
    // from the origin.
    if ( ! tpkg ) {
      // If we don't have a configuration for the target package, then
      // there isn't anything for us to do.
      return finish();
    }

    return finish();
  }

}

module.exports = Resolver;
