const path = require( 'path' );
module.exports = {
  packages  : [
    'a', 'b', 'c',
  ].map( x => path.resolve( __dirname, `./package-${x}` ) ),
  moreStuff : 'there',
};
