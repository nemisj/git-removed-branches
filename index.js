const FindStale = require('./lib/find-stale.js');
const utils = require('./lib/utils.js');
const fs = require('fs');
const path = require('path');

let version = '0.0.0';
try {
  const packageContent = fs.readFileSync(path.join(__dirname, 'package.json'))
  const info = JSON.parse(packageContent)
  version = info.version
} catch (e) {
  // do not care
}

const argv = require('minimist')(process.argv, {
  string: 'remote',
  boolean: ['prune', 'force', 'version'],
  alias: {p: "prune", f: "force", r: "remote"},
  'default': {
    'remote': 'origin',
    'force': false
  }
});

const options = ['version', 'prune', 'p', 'force', 'f', 'remote', 'r', '_'];
const hasInvalidParams = Object.keys(argv).some(name => options.indexOf(name) == -1);

(async () => {
  if (hasInvalidParams) {
    console.info('Usage: git removed-branches [-p|--prune] [-f|--force] [-r|--remote <remote>] [--version]');
    return
  }

  if (argv.version) {
    console.log(version);
    process.exit(0);
  }

  const obj = new FindStale({
    remove: argv.prune,
    force: argv.force,
    remote: argv.remote
  });
  // check for git repository
  try {
    await utils.exec(['git', 'rev-parse', '--show-toplevel']);
    await obj.run();
  } catch (err) {
    if (err.code === 128) {
      process.stderr.write('ERROR: Not a git repository\r\n');
    } else if (err.code === 1984) {
      process.stderr.write(`ERROR: ${err.message} \r\n`);
    } else {
      process.stderr.write(err.stack + '\r\n');
    }
    process.exit(1);
  }
})();
