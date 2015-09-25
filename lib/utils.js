
var child_process = require('child_process');

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

module.exports = {
  asyncExec: asyncExec,
  asyncSplit: asyncSplit
}
