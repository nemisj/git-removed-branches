const utils = require('./utils.js');

module.exports = function (ops) {
  this.remote = ops.remote;

  this.force = !!ops.force;
  this.remove = !!ops.remove;
}

module.exports.prototype = {
  run: async function() {

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

    await this.findLocalBranches()
    await this.findRemoteBranches();
    await this.findLiveBranches();
    await this.analyzeLiveAndCache();
    await this.findStaleBranches();
    await this.deleteBranches();
  },

  _getRemoteForBranch: async function(branchName) {
    try {
      const { stdout, stderr } = await utils.exec([
        'git', 'config',
        '--get', 'branch.%s.remote'.replace('%s', branchName)]
      );

      return stdout.trim()
    } catch (err) {
      return '';
    }
  },

  findLocalBranches: async function () {
    // list all the branches
    const { stdout } = await utils.exec(['git', 'branch']);
    const lines = utils.split(stdout);

    // take out star if active branch
    const branches = lines.map(branchName => branchName.replace(/\*/g, '').trim());

    // get remote for every branch
    for (const branchName of branches) {
      const remote = await this._getRemoteForBranch(branchName);
      if (remote === this.remote) {
        this.localBranches.push(branchName);
      }
    }
  },

  //
  // this method will use "git ls-remote"
  // to find branches which are still available on the remote
  // and store them in liveBranches state
  //
	findLiveBranches: async function() {
    try {
      // get list of remote branches from remote host
      const { stdout } = await utils.exec(['git', 'ls-remote', '-h', this.remote]);
      const lines = utils.split(stdout);

      // take out sha and refs/heads
      lines.forEach((line) => {
        const group = line.match(/refs\/heads\/([^\s]*)/);
        if (group) {
          this.liveBranches.push(group[1]);
        }
      })
    } catch (err) {
      // reset branches
      this.liveBranches = [];
      if (err.code && err.code == '128') {
        // error 128 means there is no connection currently to the remote
        // skip this step then
        this.noConnection = true;
        return;
      } 

      throw err
    }

  },

	findRemoteBranches: async function() {
    this.remoteBranches = [];

    // get list of remote branches
    const { stdout } = await utils.exec(['git', 'branch', '-r']);

    //split lines
    const branches = utils.split(stdout);

    // filter out non origin branches
    const re = new RegExp('^%s\\/([^\\s]*)'.replace('%s', this.remote));
    branches.forEach((branchName) => {
      const group = branchName.match(re);
      if (group) {
        this.remoteBranches.push(group[1]);
      }
    });
  },

  //
  // this method will look which branches on remote are absent
  // but still available in here in remotes
  //
	analyzeLiveAndCache : async function () {
    if (this.noConnection) {
      // unable to determinate remote branches, because host is not available
      console.warn('WARNING: Unable to connect to remote host');
      return;
    }

    const message = [
      'WARNING: Your git repository is outdated, please run "git fetch -p"',
      '         Following branches are not pruned:',
      ''
    ];
    const toRemove = [];
    let show = false;


    // compare absent remotes
    this.remoteBranches.forEach((branch) => {
      if (branch == 'HEAD') {
      } else if (this.liveBranches.indexOf(branch) == -1) {
        message.push('         - ' + branch);
        show = true;
      }
    });

    message.push('');

    if (show) {
      console.warn(message.join('\r\n'));
    }

    this.remoteBranches = this.liveBranches;
  },

	findStaleBranches: async function() {
    this.localBranches.forEach((localBranch) => {
      if (this.remoteBranches.indexOf(localBranch) == -1) {
        this.staleBranches.push(localBranch);
      }
    });
  },

	deleteBranches: async function() {
    if (!this.staleBranches.length) {
      console.info('No removed branches found');
      return;
    }

    if (!this.remove) {
      console.log('Found removed branches:'); 
    }

    const broken = [];

    for(const branchName of this.staleBranches) {
      if (this.remove) {
        console.info('');
        console.info('Removing "' + branchName + '"');

        const dFlag  = this.force ? '-D' : '-d';
        try {
          const { stdout } = await utils.exec(['git', 'branch', dFlag, '"' + branchName + '"']);
          console.info(stdout);
        } catch (err) {
          console.error('ERROR: Unable to remove: ' + err.message);
          broken.push(branchName);
        }
      } else {
        console.info('  - ' + branchName);
      }
    }

    console.info('');

    if (broken.length) {
      // unable to remove branch
      console.info('Not all branches are removed:');
      broken.forEach((name) => {
        console.info('  - ' + name);
      });
      console.info('');
      console.info('INFO: To force removal use --force flag');
    } else if (this.remove) {
      console.info('INFO: All branches are removed');
    } else {
      console.info('INFO: To remove all found branches use --prune flag');
    }

  }
}
