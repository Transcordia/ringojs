var fs = require('fs');
var assert = require('assert');
var system = require('system');
var {createProcess} = require('ringo/subprocess');

const RINGO_BIN = (function() {
   var bin = 'ringo';
   var os = java.lang.System.getProperty('os.name').toLowerCase();

   if (os.indexOf('windows') >= 0) {
      bin += '.cmd';
   }

   return fs.join(module.resolve('../../bin'), bin);
})();

system.print('module', module.resolve('jars-to-classpath'))

/*
This integration test forks a process to run ringo from command line
which is not supported when building a single RingoJS artifact meant
to function as a maven dependency.

exports.testJarsToClasspath = function() {
   var process = createProcess({
      command: [RINGO_BIN, 'main.js'],
      dir: module.resolve('jars-to-classpath')
   });

   // wait for the exit code
   assert.equal(process.wait(), 0);
};
*/

exports.testRequireMain = require("./require-index/main").testCalculator;
exports.testHttpJsgiBinding = require("./http-jsgi-binding/simple").testHttpJsgiBinding;

// start the test runner if we're called directly from command line
if (require.main === module) {
   system.exit(require('test').run(exports));
}