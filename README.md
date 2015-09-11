Remove local branches which are no longer present in the remote git

Before running this command ensure that you have the latest state of the
repository using `git fetch -p`. -p flag will remove all refs of the branches
which are no longer presented in the remote repository.

# Installation

```bash
$ npm install -g git-remove-stale
```

Please install package globally with -g flag, so that you can use it directly
as subcommand of git, like this

```bash
$ git remove-stale
```

# Usage

```bash
$ git remove-stale
```

This command will look through the branches which are no longer available on
the remote and will display them.

In order to delete branches use --do-it flag

```bash
$ git remove-stale --do-it
```

If you have remote configured to something different then 'origin' you can use --remote flag to specify the name of the remote:

```bash
$ git remove-stale --remote some-remote
```

If you get error when trying to delete branch

```bash
The branch {branch_name} is not fully merged.
```

you can force deletion by using --force flag

```bash
$ git remove-stale --do-it --force
```


