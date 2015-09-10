var child_process = require('child_process');
var async = require('async');

var argv = require('minimist')(process.argv, {
  string: 'remote',
  boolean: 'do-it',
  'default': {
    'remote': 'origin'
  }
});

var options = ['do-it', 'remote', '_'];
var validParams = Object.keys(argv).some(function (name) {
  if (options.indexOf(name) == -1) {
    console.log('Usage: git-remove-stale --do-it --remote {remote}');
  }
});

var obj = {
  run: function (callback) {

    async.waterfall([
      this.findLocalBranches.bind(this),
      this.findRemoteBranches.bind(this),
      this.findStaleBranches.bind(this),
      this.removeBranches.bind(this)
    ], callback);

  },

  findLocalBranches: function(callback) {
    this.localBranches = [];
    child_process.exec(["git", "branch"].join(' '), function (err, stdout, stderr) {
      // console.log(stdout);
      return callback(null);
    });
  },

  findRemoteBranches: function(callback) {
    this.removeBranches = [];
    child_process.exec(["git", "branch", "-r"].join(' '), function (err, stdout, stderr) {
      // console.log(stdout);
      return callback(null);
    });
  },

  findStaleBranches: function(callback) {
    this.staleBranches = [];
    return callback(null);
  },

  removeBranches: function(callback) {
    if (argv['do-it']) {
      console.log('Removing...');
    } else {
      console.log('Will be removed...');
    }

    return callback();
  }
}


if (!validParams) {
  // check for git repository
  child_process.exec('git rev-parse --show-toplevel', function (err, stdout, stderr) {
    if (err) {
      console.error(stderr);
    }

    obj.run();

  });
}
