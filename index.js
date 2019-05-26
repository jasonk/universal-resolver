const Resolver = require( './resolver' );
const findConfig = require( './config-utils' );

const config = findConfig();
const resolver = new Resolver( config );

module.exports = resolver.resolve.bind( resolver );
