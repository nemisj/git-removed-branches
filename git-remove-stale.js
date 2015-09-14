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

    this.remoteBranches = [];
    this.localBranches = [];
    this.staleBranches = [];

    async.waterfall([
      this.findLocalBranches.bind(this),
      this.findRemoteBranches.bind(this),
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

      // take out all the spaces and star if active branch
      function (stdout, stderr, h) {
        var branches = stdout.split('\n').map(function (branchName) {
          return branchName.trim().replace(/\*/g, '');
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

  findRemoteBranches: function(callback) {
    var _this = this;

    async.waterfall([

      // get list of remote branches
      asyncExec(['git', 'branch', '-r']),

      //split lines
      function (stdout, stderr, h) {
        var branches = stdout.split('\n').map(function (branchName) {
          return branchName.trim();
        });

        return h(null, branches);
      },

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
        console.info('Will remove "' + branchName + '"');
        return h();
      }
    }, function (err) {
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
