#!/usr/bin/env python

import subprocess
import re
import argparse

parser = argparse.ArgumentParser(description="Remove local branches, which are no longer available in the remote")
parser.add_argument("--prune", action="store_true", help="Remove branches")
parser.add_argument("--force", action="store_true", help="Force deletion")
parser.add_argument("--remote", default="origin", help="Remote name")
args = parser.parse_args()


def find_local_branches():
  branches = subprocess.check_output(["git", "branch"])
  correct_branches = [];
  for line in branches.splitlines():
    # take out the active branch, we are only intersted in the name of the
    # branch
    branch_name = re.sub(r"\*", "", line).strip()

    # find out what is the remote of the branch
    try:
      remoteName = subprocess.check_output(["git", "config", "--get", "branch.%s.remote" % branch_name])
    except Exception as e:
      # Branch has no config"
      remoteName = ""

    remoteName = remoteName.strip();

    if "%s" % remoteName == args.remote:
      correct_branches.append(branch_name)

  return correct_branches


def find_remote_branches():
  branches = subprocess.check_output(["git", "branch", "-r"])
  correct_branches = [];

  for line in branches.splitlines():
    branch_name = line.strip();
    result = re.search(r"%s/([^\s]*)" % args.remote, branch_name)
    if result:
      correct_branches.append(result.group(1))

  return correct_branches

def find_live_branches():
  correct_branches = []

  try:
    branches = subprocess.check_output(["git", "ls-remote", "-h", args.remote])
  except Exception as e:
    #TODO: test that this is error 128

    return None

  for line in branches.splitlines():
    branch_name = line.strip();
    result = re.search(r"refs/heads/([^\s]*)", branch_name)

    if result:
      correct_branches.append(result.group(1))

  return correct_branches


def delete_branches(branches):

  broken = []

  if not branches:
    print("No removed branches found")
    return

  if not args.prune:
    print("Found removed branches:")

  print("")

  for branch_name in branches:
    if (args.prune):
      print("")
      print("Removing %s" % branch_name)

      if args.force:
        deleteFlag = "-D"
      else:
        deleteFlag = "-d"

      return_code = subprocess.call(["git", "branch", deleteFlag, branch_name]);
      if return_code != 0:
        print("ERROR: Unable to remove branch")
        broken.append(branch_name)
    else:
      print("  - %s" % branch_name)

  print("")
  if broken:
    print("Not all branches are removed:")

    for branch_name in broken:
      print("  - %s" % branch_name)

    print("INFO: To force removal use --force flag")

  elif args.prune:
    print("INFO: All branches are removed")

  else:
    print("INFO: To remove all found branches use --prune flag")

def analyze_live_and_remote(live_branches, remote_branches):
  if live_branches == None:
    return remote_branches

  notFound = []

  for branch_name in remote_branches:
    if branch_name != 'HEAD':
      try:
        index = live_branches.index(branch_name)
      except ValueError:
        notFound.append(branch_name)

  if notFound:
    print("WARNING: Your git repository is outdated, please run \"git fetch -p\"")
    print("         Following branches are not pruned:")
    print("")

    for name in notFound:
      print("  - %s" % name)
    print("")

  return live_branches

def find_to_remove(local=[], remote=[]):
  will_remove = []

  for branch_name in local_branches:
    try:
      index = remote_branches.index(branch_name)
    except ValueError:
      will_remove.append(branch_name)

  return will_remove



# test whether this is the git repo
try:
  subprocess.check_output(["git", "rev-parse", "--show-toplevel"]);
  is_git = True
except Exception:
  is_git = False

if is_git:
  # walk through the local branches
  # if local branch is not in remote branch list
  # prepare for removing
  remote_branches = find_remote_branches()
  local_branches = find_local_branches() 
  live_branches = find_live_branches()
  remote_branches = analyze_live_and_remote(live_branches, remote_branches)

  to_remove = find_to_remove(local=local_branches, remote=remote_branches)

  delete_branches(to_remove)
