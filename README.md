List or remove local tracked branches, which are deleted from the remote.

![](https://github.com/nemisj/git-removed-branches/blob/master/usage.gif)

## Why?

Because I'm tired of doing every time `git fetch -p`, `git branch -r`, `git branch` and keep comparing which branches are gone from the GitHub, but still available locally and doing `git branch -D ${branch_name}` on one by one of them.

## What does it do?

This command will compare your local branches with remote and show you branches that are no longer available on remote but are still presented in your local repository. You can use it to view and delete all (remotely) removed branches in one go using `--prune` flag.

This command works without the need to run `git fetch -p`, but a working network connection to your remote is required. If no connection can be established with the remote repository, then local information about your remote will be used instead. If your local repository is not in sync with the remote repository, it will warn you about it.


## Installation

### NPM

```bash
$ npm install -g git-removed-branches
```

Please install a package globally with -g flag so that you can use it directly as a sub command of git, like this:

```bash
$ git removed-branches
```

### NPX

It's also possible to use package through npx directly. Execute inside any git folder:

```bash
$ npx git-removed-branches
```

## Usage

```bash
$ git removed-branches
```

This command will look through the branches that are no longer available on the remote and display them.
In case you haven't run `git fetch -p`, it will warn you to do so.

This command is safe to run and it will not alter your repository.


### Removing

To delete local branches use `--prune` or `-p` flag

```bash
$ git removed-branches --prune
```

This command will compare your local branches to the remote ones and remove, those which do not exist anymore on the remote side.

### Different remote

If you have configured remote alias to something different than **'origin'**, you can use `--remote` or `-r` flag to specify the name of the remote. e.g., to specify remote to be `upstream`, you can use:

```bash
$ git removed-branches --remote upstream
```

## Forcing removal

If you get an error when trying to delete branches:

```bash
The branch {branch_name} is not fully merged.
```

you can force deletion by using `--force` flag or use `-f` alias

```bash
$ git removed-branches --prune --force
```

## Version

To find out, which version you use ( since 2.3.0 )

```
git removed-branches --version
```

## Troubleshooting:


If you encounter error `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` it is possible that your repository contains too much branches, more then 3382. ( see [discussion](https://github.com/nemisj/git-removed-branches/issues/11) )

You can fix this, by specifying NODE_MAX_BUFFER environment variable, like:

```
NODE_MAX_BUFFER=1048576 git removed-branches
```
