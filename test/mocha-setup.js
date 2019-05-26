const chai = require( 'chai' );

chai.config.includeStack = true;
chai.config.truncateThreshold = 0;

chai.should();
global.expect = chai.expect;
