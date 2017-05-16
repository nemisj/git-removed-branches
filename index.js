var FindStale = require('./lib/find-stale.js');
var utils = require('./lib/utils.js');

var argv = require('minimist')(process.argv, {
  string: 'remote',
  boolean: ['prune', 'force'],
  alias: {p: "prune", f: "force", r: "remote"},
  'default': {
    'remote': 'origin',
    'force': false
  }
});

var options = ['prune', 'p', 'force', 'f', 'remote', 'r', '_'];
var hasInvalidParams = Object.keys(argv).some(function (name) {
  return (options.indexOf(name) == -1);
});

if (hasInvalidParams) {
  console.info('Usage: git removed-branches [-p|--prune] [-f|--force] [-r|--remote <remote>]');
} else {
  // check for git repository
  var exec = utils.asyncExec(['git', 'rev-parse', '--show-toplevel']);
  var obj = new FindStale({
    remove: argv.prune,
    force: argv.force,
    remote: argv.remote
  });
  
  exec(function (err, stdout, stderr) {
    if (err) {
      console.error(err.message);
      return;
    }

    obj.run();
  });
}
