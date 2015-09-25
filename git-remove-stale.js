var child_process = require('child_process');
var async = require('async');

var argv = require('minimist')(process.argv, {
  string: 'remote',
  boolean: ['do-it', 'force'],
  'default': {
    'remote': 'origin',
    'force': false
  }
});

var options = ['do-it', 'force', 'remote', '_'];
var validParams = Object.keys(argv).some(function (name) {
  if (options.indexOf(name) == -1) {
    console.info('Usage: git-remove-stale --do-it --force --remote {remote}');
    return true;
  }
});

// Split the stdout and stderr output
// and will take out all the empty lines
function asyncSplit() {
  return function (stdout, stderr, callback) {
    var lines = stdout.split('\n').map(function (line) {
      return line.trim();
      })
      // remove empty
      .filter(function (line) {
        return line != '';
      });

    return callback(null, lines);
  };
}

function asyncExec(argsArray, skipError) {
  return function (callback) {
    child_process.exec(argsArray.join(' '), function (err, stdout, stderr) {
      if (err) {
        if (skipError) {
          return callback(null, stdout, stderr);
        }

        return callback(err);
      }

      return callback(null, stdout, stderr);
    });
  }
};

var obj = {
  run: function (callback) {

    // cached braches from the remote
    this.remoteBranches = [];

    // local branches which are checkout from the remote
    this.localBranches = [];

    // branches which are available locally but not remotly
    this.staleBranches = [];

    // branches which are available on host
    this.liveBranches = [];

    async.waterfall([
      this.findLocalBranches.bind(this),
      this.findRemoteBranches.bind(this),
      this.findLiveBranches.bind(this),
      this.analyzeLiveAndCache.bind(this),
      this.findStaleBranches.bind(this),
      this.deleteBranches.bind(this)
    ], callback);

  },



  _getRemoteForBranch: function (branchName, callback) {
    var exec = asyncExec([
      'git', 'config',
      '--get', 'branch.%s.remote'.replace('%s', branchName)]
    );

    exec(function (err, stdout, stderr) {
      if (err) {
        return callback(null, {
          name: branchName,
          remote: ''
        });
      }

      return callback(null, {
        name: branchName,
        remote: stdout.trim()
      });
    });
  },

  findLocalBranches: function(callback) {
    var _this = this;

    async.waterfall([

      // list all the branches
      asyncExec(['git', 'branch']),

      asyncSplit(),

      // take out star if active branch
      function (lines, h) {
        var branches = lines.map(function (branchName) {
          return branchName.replace(/\*/g, '').trim();
        });

        return h(null, branches);
      },

      // get remote for every branch
      function (branches, h) {
        async.map(branches, this._getRemoteForBranch.bind(this), h);
      }.bind(this),

      // filter branches based on remote
      function (branches, h) {
        branches = branches.filter(function (branch) {
          return branch.remote == argv.remote;
        });

        return h(null, branches);
      }

    ], function (err, branches) {

      _this.localBranches = branches.map(function (branch) {
        return branch.name;
      });

      return callback();
    });

  },

  //
  // this method will use "git ls-remote"
  // to find branches which are still available on the remote
  // and store them in liveBranches state
  //
  findLiveBranches: function (callback) {
    var _this = this;

    async.waterfall([
      // get list of remote branches from remote host
      asyncExec(['git', 'ls-remote', '-h', argv.remote]),

      asyncSplit(),

      // take out sha and refs/heads
      function (lines, h) {
        var correct_branches = [];
        lines.forEach(function (line) {
          var group = line.match(/refs\/heads\/([^\s]*)/);
          if (group) {
            correct_branches.push(group[1]);
          }
        });

        return h(null, correct_branches);
      }

    ], function (err, lines) {

      if (err) {

        _this.liveBranches = [];

        if (err.code && err.code == '128') {
          // error 128 means there is no connection currently to the remote
          // skip this step then
          _this.noConnection = true;
          return callback(null);
        } 

        return callback(err);
      }

      _this.liveBranches = lines;

      return callback(null);
    });
  },

  findRemoteBranches: function(callback) {
    var _this = this;

    async.waterfall([

      // get list of remote branches
      asyncExec(['git', 'branch', '-r']),

      //split lines
      asyncSplit(),

      // filter out non origin branches
      function (branches, h) {
        correct_branches = [];
        var re = new RegExp('^%s\\/([^\\s]*)'.replace('%s', argv.remote));
        branches.forEach(function (branchName) {
          var group = branchName.match(re);
          if (group) {
            correct_branches.push(group[1]);
          }
        });

        return h(null, correct_branches);
      }

    ], function (err, branches) {
      _this.remoteBranches = branches;
      return callback(null);
    });

  },

  //
  // this method will look which branches on remote are absent
  // but still available in here in remotes
  //
  analyzeLiveAndCache: function (callback) {
    if (this.noConnection) {
      // unable to determinate remote branches, because host is not available
      console.warn('WARNING: Unable to connect to remote host');
      return callback();
    } else {
      var message = [
        'WARNING: Your git repository is outdated, please run "git fetch -p"',
        '         Following branches are not pruned:',
        ''
      ];
      var toRemove = [];
      var show = false;

      // compare absent remotes
      this.remoteBranches.forEach(function (branch) {
        if (branch == 'HEAD') {
        } else if (this.liveBranches.indexOf(branch) == -1) {
          message.push('         - ' + branch);
          show = true;
        }
      }, this);

      message.push('');

      if (show) {
        console.warn(message.join('\r\n'));
      }

      this.remoteBranches = this.liveBranches;
      
      return callback();
    }
  },

  findStaleBranches: function(callback) {

    this.localBranches.forEach(function (localBranch) {
      if (this.remoteBranches.indexOf(localBranch) == -1) {
        this.staleBranches.push(localBranch);
      }
    }, this);

    return callback(null);
  },

  deleteBranches: function(callback) {

    if (!this.staleBranches.length) {
      console.info('No stale branches are found');
      return callback();
    }

    async.forEach(this.staleBranches, function (branchName, h) {
      if (argv['do-it']) {
        console.info('Removing "' + branchName + '"');

        var dFlag  = argv.force ? '-D' : '-d';
        var exec = asyncExec(['git', 'branch', dFlag, branchName]);
        exec(function (err, stdout, stderr) {
          if (err) {
            console.error('ERROR: Unable to remove: ' + err.message);
            return h();
          }

          console.info(stdout);
          return h();
        });
      } else {
        console.info('Found branch "' + branchName + '"');
        return h();
      }
    }, function (err) {
      console.info('');
      console.info('INFO: To remove found branches use --do-it flag');
      return callback();
    });

  }
}


if (!validParams) {
  // check for git repository
  var exec = asyncExec(['git', 'rev-parse', '--show-toplevel']);
  
  exec(function (err, stdout, stderr) {
    if (err) {
      console.error(err.message);
      return;
    }

    obj.run();
  });
}
