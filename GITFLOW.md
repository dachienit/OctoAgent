# 🚀 Lightweight GitFlow Guide (Modernized for Speed)

This guide explains how we manage branches and releases in our development workflow.

---

## 🌳 Branch Model Overview

We use a **lightweight GitFlow**, optimized for fast iteration and clean releases.

| Branch | Purpose | Notes |
|---------|----------|-------|
| `main` | Always deployable production branch | Only stable releases are merged here |
| `develop` | Stable pre-release integration | All new features merge here first |
| `feature/*` | New features or enhancements | Created from `develop`, merged back after review |
| `hotfix/*` | Emergency production fixes | Created from `main`, merged back into both `main` and `develop` |

### Visual Diagram

```

main         →  stable production (deployed)
↑
| (merge releases, hotfixes)
|
develop      →  pre-release integration
↑
| (merge features)
|
feature/*    →  per-task branches

hotfix/*     →  direct from main (urgent fixes)

````

---

## 🧩 Step-by-Step Workflow

### 1️⃣ Setup Base Branches

```bash
git checkout -b main
git push -u origin main

git checkout -b develop
git push -u origin develop
````

In GitHub, protect both branches (require PR + CI checks before merging).

---

### 2️⃣ Create a Feature Branch

Always branch off from `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<short-description>
```

Examples:

```
feature/login-ui
feature/add-vending-ai
feature/cap-odata-generator
```

Commit your work:

```bash
git add .
git commit -m "add vending AI orchestration logic"
git push origin feature/add-vending-ai
```

---

### 3️⃣ Merge Feature → Develop

1. Open a Pull Request (PR) from `feature/...` → `develop`
2. Ensure all CI checks pass
3. Get at least 1 reviewer approval
4. Merge using **"Squash and merge"** (for clean history)
5. Delete the feature branch after merging

```bash
git branch -d feature/add-vending-ai
git push origin --delete feature/add-vending-ai
```

---

### 4️⃣ Release Develop → Main

When `develop` is stable and tested:

```bash
git checkout main
git pull origin main
git merge --no-ff develop -m "Release v1.2.0"
git push origin main
```

Tag the release:

```bash
git tag -a v1.2.0 -m "Stable release with AI Orchestrator v2"
git push origin v1.2.0
```

> CI/CD will automatically deploy from `main`.

---

### 5️⃣ Create a Hotfix (urgent production issue)

```bash
git checkout main
git pull origin main
git checkout -b hotfix/fix-null-agent
```

Fix, commit, and push:

```bash
git add .
git commit -m "fix null agent pointer"
git push origin hotfix/fix-null-agent
```

Open PR → `main`
After merging, sync `develop` with `main`:

```bash
git checkout develop
git merge main
git push origin develop
```

---

## 🧠 Naming Conventions

| Type    | Example                  | Description              |
| ------- | ------------------------ | ------------------------ |
| Feature | `feature/add-login-ui`   | New functionality        |
| Hotfix  | `hotfix/fix-api-timeout` | Urgent fix on production |
| Release | `v1.2.0`                 | Semantic version tag     |

---

## 🧰 Tips for Team Efficiency

* ✅ Always update your local branch before starting (`git pull origin develop`)
* ✅ Use descriptive commit messages
* ✅ Keep PRs small and focused
* ✅ Add a reviewer tag (e.g. `@haule` or `@core-team`)
* ✅ Merge via GitHub, never directly push to `main` or `develop`
* ✅ Run `npm test` or project CI locally before PR

---

## 🧾 Optional GitHub Actions

We can automate:

* Version tagging on merge to `main`
* Automatic changelog updates
* Lint/test on every PR
* Auto-deploy to staging for `develop` and production for `main`

Example workflow trigger:

```yaml
on:
  push:
    branches: [ main, develop ]
```

---

## 🧭 Summary

| Flow    | From      | To               | Description         |
| ------- | --------- | ---------------- | ------------------- |
| Feature | `develop` | `develop`        | Build new features  |
| Release | `develop` | `main`           | Push stable release |
| Hotfix  | `main`    | `main + develop` | Emergency fix       |
| Tag     | `main`    | —                | Version tracking    |

---

🪴 *Keep it lightweight. Keep it clean. Every merge should move us forward.*
