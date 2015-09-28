var async = require('async');
var utils = require('./utils.js');

module.exports = function (ops) {
  this.remote = ops.remote;

  this.force = !!ops.force;
  this.remove = !!ops.remove;
}

module.exports.prototype = {
  run: function (callback) {

    // cached braches from the remote
    this.remoteBranches = [];

    // local branches which are checkout from the remote
    this.localBranches = [];

    // branches which are available locally but not remotly
    this.staleBranches = [];

    // branches which are available on host
    this.liveBranches = [];

    // if we are unable to connect to remote
    // this will become true
    this.noConnection = false;

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
    var exec = utils.asyncExec([
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
      utils.asyncExec(['git', 'branch']),

      utils.asyncSplit(),

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
          return branch.remote == this.remote;
        }, this);

        return h(null, branches);
      }.bind(this)

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
      utils.asyncExec(['git', 'ls-remote', '-h', this.remote]),

      utils.asyncSplit(),

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
      utils.asyncExec(['git', 'branch', '-r']),

      //split lines
      utils.asyncSplit(),

      // filter out non origin branches
      function (branches, h) {
        correct_branches = [];
        var re = new RegExp('^%s\\/([^\\s]*)'.replace('%s', this.remote));
        branches.forEach(function (branchName) {
          var group = branchName.match(re);
          if (group) {
            correct_branches.push(group[1]);
          }
        });

        return h(null, correct_branches);
      }.bind(this)

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
      console.info('No removed branches found');
      return callback();
    }

    if (!this.remove) {
      console.log('Found removed branches: '); 
    }

    async.forEach(this.staleBranches, function (branchName, h) {
      if (this.remove) {
        console.info('Removing "' + branchName + '"');

        var dFlag  = this.force ? '-D' : '-d';
        var exec = utils.asyncExec(['git', 'branch', dFlag, branchName]);
        exec(function (err, stdout, stderr) {
          if (err) {
            console.error('ERROR: Unable to remove: ' + err.message);
            return h();
          }

          console.info(stdout);
          return h();
        });
      } else {
        console.info('  - ' + branchName);
        return h();
      }
    }.bind(this), function (err) {
      console.info('');
      console.info('INFO: To remove all found branches use --prune flag');
      return callback();
    });

  }
}
