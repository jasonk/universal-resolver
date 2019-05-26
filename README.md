> This is a modular resolver for use by transpilation tools.  It's an
> attempt to solve some of the problems that plagued me as I started
> move more of my projects to [lerna][lerna] and [yarn][yarn] managed
> monorepos.  It's very useful if you aren't using a monorepo too, it
> just takes a little more explicit configuration in that case.

# TL; DR - Usage #

If you want some more detail about how this works and the philosophy
behind it then make sure you read the whole thing.  If you just want
a quickstart then here is what you need to do to get it working.

## automatic configuration ##

In a monorepo you can get running with the default settings just by
adding the `universal-resolver` package to your project.  If you don't
provide any kind of configuration then it will attempt to find either
a `lerna.json` or `package.json` file that indicates a monorepo and use
that to figure out where the package directories are.

If you don't have a monorepo config but you do you can fake it by putting
a `universal-resolver.json` file

## manual configuration ##

If you don't have a monorepo, or you just want to configure it all
yourself, then you can use a configuration file.  If you keep all the
repos for your project in the same directory, you can just create
a `universal-resolver.json` or `universal-resolver.js` file in that
directory and the configuration-searching code will find it.  Otherwise
you can create it wherever you like and then set the
`UNIVERSAL_RESOLVER_CONFIG` environment variable to be the full path
to that file.

# Configuration #

The configuration that you provide from a config file can be either an
object or an array.  If it's an object then it needs to include
a `packages` array, but can also include configuration for the resolver
itself.  If it's an array then it will just be used for the packages
configuration and you'll get the defaults for everything else.

```javascript
// Example config for universal-resolver
module.exports = {
  // These are the default values for the resolver configuration
  // options, included here for documentation purposes.
  mode            : 'development',
  prefix          : '~',
  source          : 'src',
  main            : 'src/index',
  resolvePrefixes : true,
  resolvePackages : true,
  resolveMain     : true,
  resolveSymlinks : true,
  resolveSelf     : true,
  packages        : [
    {
      name    : '@my-project/server',
      root    : path.resolve( __dirname, 'server' ),
    },
    {
      name    : '@my-project/client',
      root    : path.resolve( __dirname, 'client' ),
    },
  ],
};
```

## Configuring Tools ##

### Babel ###

To use with [Babel][babel] just add `universal-resolver/babel` to the
plugins list in your Babel configuration.  To see a real-life example,
see [@jasonk/swiper/babel.config.js][swiper-babel].

### ESLint ###

To use with [ESLint][eslint] you need to set
`universal-resolver/eslint` as the value for the `import/resolver`
setting.  For a real-life example you can check the babel config in
[@jasonk/eslint-config/babel.js][my-eslint-config].

```javascript

  settings : {
    'import/resolver': 'universal-resolver/eslint',
  }
```

### Webpack ###

For [Webpack][webpack] it will probably just work as long as you are
using [babel-loader][babel-loader] to load JavaScript.  If you are using
something else, you can add `universal-resolver/webpack` as a plugin in
your webpack configuration.

# Technical Details #

## What is a resolver? ##

In your code, whenever you import or require another file, something like:

```javascript
import stuff from 'foo';
const stuff = require( 'foo' );
import( 'foo' ).then( stuff => {} );
```

The resolver is responsible for figuring out exactly what `foo` refers
to.  In most cases that process is simple, if you are importing
`./stuff` then there aren't a whole lot of places to look, but
sometimes it gets more complicated.

## What does universal-resolver do? ##

These are the problems I was trying to solve with universal-resolver:

### Tool-specific resolution ###

As you read through the rest of the problems I was trying to solve,
you may very well react with "hey, I know of an existing plugi that
can handle that!"  There are existing solutions for many of these,
but they often only solve the problem for one tool.

Before I started switching to monorepos I often used
[babel-plugin-root-import][bpri] to solve part of this problem, but
then to make [ESLint][eslit] understand those imports you also need
[eslint-import-resolver-babel-plugin-root-import][bpri-eslint] and
lacking a good solution for making [Webpack][webpack] understand them
I resorted to just creating an alias for `~`, but then that only
worked for the packages that were using webpack.

The goal of universal-resolver is to be truly universal, and be able
to plug it in to whatever tools you need. Currently it supports:

* babel
* webpack
* eslint

### Root Importing ###

When working on a large project, doing things like `import { thing
} from '../../../../../../../utils` gets old really fast.  Not to
mention the pain when you decide to move a file that contains a bunch
of imports like that into a different directory.

There are plugins like [babel-plugin-root-import][bpri] that help
with this by letting you refer to the "root" of your project with
something simple like `~`.  That way you can just say `import { thing
} from '~/utils'` and it always just works.  That plugin is what I was
using before, but for a monorepo setup it would need to be configured
separately for every package in the repo, which I wanted to avoid.

What this resolver does is to figure out automatically where your `~`
prefix refers to.  Whenever you attempt to import something that
starts with the `~` prefix (don't worry, you can change that prefix if
you want) it looks at where the file doing the import is located, and
if it's located in one of the configured packages.  If it is, then it
replaces the `~` with a relative path to the source directory for that
package.

### Self Import ###

Some people dislike the idea of using `~` as a prefix to mean "the
root of this project" (especially old-school unix people like me, who
still see it and think "home directory").  If you are one of those
people, you have an alternative now.  This resolver will work the same
way if you attempt to import a named package from inside that package.
So if you are working on your `@my-project/server` package, and you
want to import something from it's `src/utils` directory, you can use
the prefix and say `import { thing } from '~/utils'` or you can
say `import { thing } from '@my-project/server/utils';` and it will
resolve them both the same way.

### Override package.json "main" property ###

One of the issues that has long plagued me when using [Babel][babel]
is the `main` property in `package.json`.  For published packages you
want this to be set to the transpiled location of your main file, but
that means that if you are doing development with a monorepo (or even
just with packages linked together by `npm link` or `yarn link`) then
you have to run babel in that package before changes are visible to
your other packages.  There are ways to handle this, and I've tried
them all.  Changing `package.json` during publishing is the least
intrusive, but still feels hacky.  Having main point at an `index.js`
that checks whether there is a `dist` directory and either re-exports
it or loads `@babel/register` and then re-exports `src` is another
option which seems to work but will cause unexpected and difficult
to diagnose problems (especially when webpack tries to bundle both
versions).

So what universal-resolver does is whenever you import a package,
it checks whether that package is one of the packages you configured
the resolver with.  If it is and you are running in development mode
then it rewrites the import to be directly from that packages source
directory, so the `main` property gets ignored completely.  That way
when you are developing all the packages you are working on are
getting transpiled by the same process at the same time.

### Use a single babel.config.js file for the monorepo ###

In a monorepo I'd like to have just a single `babel.config.js` at the
root of the repo that handles transpiling for all of the packages in
that repo.  Most of the "how to monorepo" tutorials I've seen,
however, are telling you to either include a `.babelrc` file in each
package that extends your main `babel.config.js` or are doing tricks
with scripts that set the config path when running babel.

From what I've seen it seems that the reason people are doing this is
that when you have your `babel.config.js` set up with overrides like
this:

```javascript
  overrides : [
    {
      test    : path.resolve( __dirname, 'packages/client' ),
      presets : [ '@babel/preset-react' ],
    },
  ],
```

Then you expect that the react preset would get applied to all the
transpiling of your `client` repo, but it doesn't seem to unless you
add a `.babelrc` file in the `packages/client` directory that extends
from your `babel.config.js`.

The real reason it doesn't work though, is that your config has
specified that the override applies to everything under
`/path/to/your/project/packages/client`, but because of the way that
[lerna][lerna] or [yarn][yarn] set up your repo, when something
imported `@your-project/client` it got resolved to
`/path/to/your/project/node_modules/@your-project/client`, which is
a symlink to the real directory.  That means that when that file gets
loaded the overrides don't apply because the `test` value didn't match.

This resolver handles that by resolving symlinks to their real paths
during resolution, so that the overrides apply correctly.

## Contributing ##

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details about our
contribution process.  Make sure you have also read
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Versioning ##

I use [SemVer](http://semver.org/) for versioning. For the versions
available, see the [tags on this repository][tags].

## Authors ##

* **Jason Kohles** - [jasonk](https://github.com/jasonk)

See also the list of [contributors][contribs] who participated in this
project.

## License ##

This project is licensed under the MIT License - see the
[LICENSE](LICENSE) file for details.

## See Also ##

Here are some other projects that solve some or all of these problems, if
this isn't quite what you were looking for, they may be of help:

* [babel-plugin-root-import][bpri]
* [babel-plugin-module-resolver][bpmr]

[lerna]: https://lerna.js.org/
[yarn]: https://yarnpkg.com/
[babel]: https://babeljs.io/
[bpri]: https://www.npmjs.com/package/babel-plugin-root-import
[eslint]: https://eslint.org/
[webpack]: https://webpack.js.org/
[bpri-eslint]: https://github.com/bingqichen/eslint-import-resolver-babel-plugin-root-import
[swiper-babel]: https://github.com/jasonk/swiper/blob/master/babel.config.js
[my-eslint-config]: https://github.com/jasonk/eslint-config/blob/master/babel.js
[babel-loader]: https://webpack.js.org/loaders/babel-loader/
[nmrp]: https://webpack.js.org/plugins/normal-module-replacement-plugin/
[bpmr]: https://github.com/tleunen/babel-plugin-module-resolver
[contribs]: https://github.com/jasonk/universal-resolver/contributors
[tags]: https://github.com/jasonk/universal-resolver/tags
