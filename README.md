Remove local branches which are no longer present in the remote git.

This command will compare your local branches with remote and will show you branches which are no longer available on remote but are still presented in your local repository. Also you can use it to remove all removed branches in one go using `--prune` flag.

This command works without need to run `git fetch -p`, but working network connection to your remote is required. If no connection can be established with remote repository, then local information about your remote will be used instead. If your local repository is not in sync with remote repository will it warn you about it.


## Installation

### NPM

```bash
$ npm install -g git-removed-branches
```

Please install package globally with -g flag, so that you can use it directly as subcommand of git, like this:

```bash
$ git removed-branches
```

### Python

It's also possible to use python, instead of node.js/npm package.
Download **git-removed-branches.py** script, remove extension and place it inside your $PATH variable, so that you can use it directly as subcommand of git:

```bash
$ git removed-branches
```

## Usage

```bash
$ git removed-branches
```

This command will look through the branches which are no longer available on the remote and will display them.
In case you haven't run `git fetch -p`, will it warn you to do so.


### Removing

In order to delete local branches use `--prune` flag

```bash
$ git removed-branches --prune
```

### Different remote

If you have configured remote alias to something different then **'origin'** you can use --remote flag to specify the name of the remote. e.g., to specify remote to be `upstream` you can use:

```bash
$ git removed-branches --remote upstream
```

## Forcing removal

If you get an error when trying to delete branches:

```bash
The branch {branch_name} is not fully merged.
```

you can force deletion by using `--force` flag

```bash
$ git removed-branches --remove --force
```
