const child_process = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const FindStale = require('./lib/find-stale.js');

const bin = `${__dirname}${path.sep}index.js`;

let tempdir;
let bareDir;
let workingDir;

const setup = () => {
  const tmp = os.tmpdir()
  tempdir = fs.mkdtempSync(tmp + path.sep + 'git-removed-branches-');
  bareDir = tempdir + path.sep + 'bare';
  workingDir = tempdir + path.sep + 'working';

  const file = `${workingDir}${path.sep}lolipop`;

  fs.mkdirSync(bareDir);

  console.log(`Using "${tempdir}" dir`);

  // create bare repository
  child_process.execSync('git init --bare --initial-branch=master', { cwd: bareDir, stderr: 'stdio'});

  // clone repository
  child_process.execSync('git clone bare working', { cwd: tempdir });

  // create initial commit
  fs.writeFileSync(file, 'lolipop content');
  child_process.execSync('git add lolipop', { cwd: workingDir });
  child_process.execSync('git commit -m "inital commit"', { cwd: workingDir });

  // create new branch, which will be deleted by -d flag
  child_process.execSync('git branch feature/fast-forwarded', { cwd: workingDir });
  // create another branch with special character
  child_process.execSync('git branch "#333-work"', { cwd: workingDir });
  // create branch with renamed name, which is deleted on remote
  child_process.execSync('git branch chore/local-name-deleted', { cwd: workingDir });
  // create branch with renamed name, which is NOT deleted on remote
  child_process.execSync('git branch chore/local-name-persistent', { cwd: workingDir });
  // create new branch, which can be deleted only with -D flag
  child_process.execSync('git branch no-ff', { cwd: workingDir });

  // checkout working branch
  child_process.execSync('git checkout no-ff', { cwd: workingDir });

  // update file content
  fs.writeFileSync(file, 'lolipop content changed');
  child_process.execSync('git commit -a -m "second commit"', { cwd: workingDir });

  // push all the branches to the remote and update config
  child_process.execSync('git push origin -u master', { cwd: workingDir });
  child_process.execSync('git push origin -u feature/fast-forwarded', { cwd: workingDir });
  child_process.execSync('git push origin -u "#333-work"', { cwd: workingDir });
  child_process.execSync('git push origin -u chore/local-name-deleted:chore/remote-name-deleted', { cwd: workingDir });
  child_process.execSync('git push origin -u chore/local-name-persistent:chore/remote-name-persistent', { cwd: workingDir });
  child_process.execSync('git push origin -u no-ff', { cwd: workingDir });

  // remove all the branches from the remote, except for the local-name
  child_process.execSync('git push origin :feature/fast-forwarded', { cwd: workingDir });
  child_process.execSync('git push origin :no-ff', { cwd: workingDir });
  child_process.execSync('git push origin :"#333-work"', { cwd: workingDir });
  child_process.execSync('git push origin :chore/remote-name-deleted', { cwd: workingDir });

  // checkout master branch
  child_process.execSync('git checkout master', { cwd: workingDir });
};

const test_nothing = () => {
  const output = child_process.execFileSync('node', [bin], {
    cwd: workingDir,
    encoding: 'utf8',
  });

  console.log(`------ test_nothing ------
${output}
-------------------`);

  assert.equal(output.indexOf('- chore/local-name-persistent'), -1);
  assert.notEqual(output.indexOf('- chore/local-name-deleted'), -1);
  assert.notEqual(output.indexOf('- #333-work'), -1);
  assert.notEqual(output.indexOf('- feature/fast-forwarded'), -1);
  assert.notEqual(output.indexOf('- no-ff'), -1);
};

const testing_prune = () => {
  const output = child_process.execFileSync('node', [bin, '--prune'], {
    cwd: workingDir,
    encoding: 'utf8',
  });

  console.log(`------ test_prune ------
${output}
-------------------`);

  assert.notEqual(output.indexOf('Deleted branch #333-work'), -1)
  assert.notEqual(output.indexOf('Deleted branch feature/fast-forwarded'), -1);
  assert.notEqual(output.indexOf('Not all branches are removed:'), -1);
  assert.notEqual(output.indexOf('- no-ff'), -1);
};

const testing_force = () => {
  const output = child_process.execFileSync('node', [bin, '--force', '--prune'], {
    cwd: workingDir,
    encoding: 'utf8',
  });

  console.log(`------ test_force ------
${output}
-------------------`);

  assert.notEqual(output.indexOf('Deleted branch no-ff'), -1);
};

setup();
test_nothing();
testing_prune();
testing_force();
console.log('We are good to go!');
