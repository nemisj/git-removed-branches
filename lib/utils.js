const child_process = require('child_process');

const maxBuffer = 'NODE_MAX_BUFFER' in process.env ? Number(process.env.NODE_MAX_BUFFER): undefined;
const exec = (argsArray, skipError) => {
  return new Promise((resolve, reject) => {
    child_process.exec(argsArray.join(' '), { maxBuffer }, (err, stdout, stderr) => {
      if (err) {
        if (skipError) {
          return resolve({ stdout, stderr });
        }

        return reject(err);
      }

      return resolve({ stdout, stderr });
    });
  });
}

const asyncExec = (argsArray, skipError) => {
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

// Split the stdout output
// and will take out all the empty lines
const split = (stdout) => {
  return stdout.split('\n').map(line => line.trim())
  // remove empty
    .filter(line => line != '');
}

module.exports = {
  asyncExec: asyncExec,
  split: split,
  exec: exec,
}
