const utils = require('./utils.js');

module.exports = function (ops) {
  this.remote = ops.remote;

  this.force = !!ops.force;
  this.remove = !!ops.remove;
}

module.exports.prototype = {
  run: async function() {

    // cached branches from the remote
    this.remoteBranches = [];

    // local branches which are checkout from the remote
    this.localBranches = [];

    // branches which are available locally but not remotely
    this.staleBranches = [];

    // branches which are available on host
    this.liveBranches = [];

    // if we are unable to connect to remote
    // this will become true
    this.noConnection = false;

    await this.findLiveBranches();
    await this.findLocalBranches()
    await this.findRemoteBranches();
    await this.analyzeLiveAndCache();
    await this.findStaleBranches();
    await this.deleteBranches();
  },

  findLocalBranches: async function () {
    // list all the branches
    // by using format
    // git branch --format="%(refname:short)@{%(upstream)}"
    const { stdout } = await utils.exec(['git', 'branch', '--format="%(refname:short)@{%(upstream)}"']);
    const lines = utils.split(stdout);

    // take out star if active branch
    lines.forEach(line => {
      const startIndex = line.indexOf('@{');
      const localBranch = line.slice(0, startIndex);
      const upstream = line.slice(startIndex + 2, -1);
      // if upstream string empty, branch does not have upstream
      if (upstream === '') {
        return;
      }

      // upstream has format: "refs/remotes/origin/#333-work"
      const upParts = upstream.match(/refs\/remotes\/([^/]+)\/(.+)/);
      const [_, remote, remoteBranch] = upParts;
      if (remote !== this.remote) {
        // we are not interested in this branch
        return;
      }

      this.localBranches.push({
        localBranch,
        remoteBranch,
      });
    });
  },

  //
  // this method will use "git ls-remote"
  // to find branches which are still available on the remote
  // and store them in liveBranches state
  //
  findLiveBranches: async function() {
    if (this.remote === '') {
      const e = new Error('Remote is empty. Please specify remote with -r parameter');
      e.code = 1984;
      throw e;
    }

    const { stdout: remotesStr } = await utils.exec(['git', 'remote', '-v']);

    const hasRemote = utils.split(remotesStr).some((line) => {
      const re = new RegExp(`^${this.remote}\\s`);
      if (re.test(line)) {
        return true;
      }
    });

    if (!hasRemote) {
      console.log(`WARNING: Unable to find remote "${this.remote}".\r\n\r\nAvailable remotes are:\r\n${remotesStr}`);
      this.noConnection = true;
      return;
    }

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
      if (err.code && err.code === '128') {
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
      '         Following branches are not pruned yet locally:',
      ''
    ];
    const toRemove = [];
    let show = false;


    // compare absent remotes
    this.remoteBranches.forEach((branch) => {
      if (branch === 'HEAD') {
      } else if (this.liveBranches.indexOf(branch) === -1) {
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
    this.localBranches.forEach(({ localBranch, remoteBranch }) => {
      if (this.remoteBranches.indexOf(remoteBranch) === -1) {
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
        console.info(`Removing "${branchName}"`);

        const dFlag  = this.force ? '-D' : '-d';
        try {
          const { stdout } = await utils.exec(['git', 'branch', dFlag, `"${branchName}"`]);
          console.info(stdout);
        } catch (err) {
          console.error(`ERROR: Unable to remove: ${err.message}`);
          broken.push(branchName);
        }
      } else {
        console.info(`  - ${branchName}`);
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
      console.info('INFO: To remove all founded branches use --prune flag');
    }

  }
}
