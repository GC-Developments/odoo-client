#!/usr/bin/env bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

TYPE=$1

if [ -z "$TYPE" ]; then
  echo -e "${RED}Error : Version type missing.${NC}"
  echo "Usage: npm run release -- [patch|minor|major]"
  exit 1
fi

# Check branch location on main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}Error : Releases must be create on 'main' branch. (actual : $CURRENT_BRANCH)${NC}"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}Error : Uncommit file exists.${NC}"
  echo "Please commit or stash local changes"
  exit 1
fi

echo -e "${YELLOW} Sync with origin/main...${NC}"
git pull origin main --rebase

echo -e "${YELLOW} Run qa steps...${NC}"
npm run typecheck
npm test

echo -e "${YELLOW}️ Increase version ($TYPE)...${NC}"
NEW_VERSION=$(npm version $TYPE --no-git-tag-version)

git add package.json package-lock.json
git commit -m "chore(release): $NEW_VERSION"
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"

echo -e "${YELLOW} Push commit and tag on GitHub...${NC}"
git push origin main
git push origin "$NEW_VERSION"

echo -e "${GREEN} Release $NEW_VERSION done !${NC}"