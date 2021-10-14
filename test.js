var child_process = require('child_process');
var os = require('os');
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var FindStale = require('./lib/find-stale.js');

var tempdir;
var bareDir;
var workingDir;

var setup = function () {
	var tmp = os.tmpdir()
	tempdir = fs.mkdtempSync(tmp + path.sep + 'git-removed-branches-');
	bareDir = tempdir + path.sep + 'bare';
	workingDir = tempdir + path.sep + 'working';

	fs.mkdirSync(bareDir);

	console.log('Using "' + tempdir + '" dir');

	// create bare repository
	child_process.execSync('git init --bare', { cwd: bareDir, stderr: 'stdio'});

	// clone repository
	child_process.execSync('git clone bare working', { cwd: tempdir });

	// create Inital commit
	fs.writeFileSync(workingDir + path.sep + 'lolipop', 'lolipop content');
	child_process.execSync('git add lolipop', { cwd: workingDir });
	child_process.execSync('git commit -m "inital commit"', { cwd: workingDir });

	// create new branch, which will be deleted by -d flag
	child_process.execSync('git branch feature/fast-forwarded', { cwd: workingDir });
	// create another branch with special character
	child_process.execSync('git branch "#333-work"', { cwd: workingDir });
	// create new branch, which can be deleted only with -D flag
	child_process.execSync('git checkout -b no-ff', { cwd: workingDir });
	// update file content
	fs.writeFileSync(workingDir + path.sep + 'lolipop', 'lolipop content changed');
	child_process.execSync('git commit -a -m "second commit"', { cwd: workingDir });

	// push all the branches to the remote and update config
	child_process.execSync('git push origin -u master', { cwd: workingDir });
	child_process.execSync('git push origin -u feature/fast-forwarded', { cwd: workingDir });
	child_process.execSync('git push origin -u no-ff', { cwd: workingDir });
	child_process.execSync('git push origin -u "#333-work"', { cwd: workingDir });

	// remove all the branches from the remote
	child_process.execSync('git push origin :feature/fast-forwarded', { cwd: workingDir });
	child_process.execSync('git push origin :no-ff', { cwd: workingDir });
	child_process.execSync('git push origin :"#333-work"', { cwd: workingDir });

	// checkout master branch
	child_process.execSync('git checkout master', { cwd: workingDir });
};

var test_nothing = function () {
	var output = child_process.execFileSync('node', [__dirname + path.sep + 'index.js'], {
		cwd: workingDir,
		encoding: 'utf8',
	});

	assert.notEqual(output.indexOf('- #333-work'), -1);
  	assert.notEqual(output.indexOf('- feature/fast-forwarded'), -1);
  	assert.notEqual(output.indexOf('- no-ff'), -1);
};

var testing_prune = function () {
	var output = child_process.execFileSync('node', [__dirname + path.sep + 'index.js', '--prune'], {
		cwd: workingDir,
		encoding: 'utf8',
	});

	assert.notEqual(output.indexOf('Deleted branch #333-work'), -1)
	assert.notEqual(output.indexOf('Deleted branch feature/fast-forwarded'), -1);
	assert.notEqual(output.indexOf('Not all branches are removed:'), -1);
	assert.notEqual(output.indexOf('- no-ff'), -1);
};

var testing_force = function () {
	var output = child_process.execFileSync('node', [__dirname + path.sep + 'index.js', '--force', '--prune'], {
		cwd: workingDir,
		encoding: 'utf8',
	});

	assert.notEqual(output.indexOf('Deleted branch no-ff'), -1);
};

setup();
test_nothing();
testing_prune();
testing_force();
console.log('We are good to go!');
