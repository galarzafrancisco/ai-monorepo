# 1. Init
From the root of this repo run this command (replace $project_name with the name of your project)

```bash
npx nest new $project_name --directory apps/$project_name --skip-git --package-manager npm
```

# 2. Config
### apps/$project_name/package.json:
- "name": "$project_name"
- "version": "0.0.1" to start with
- "private": true
- Minimum scripts needed:
  - dev: runs the app with hot reload (watch mode) without compiling
  - build: compiles the app
  - start: runs the app from the compiled directory
  - test: runs tests
  - lint: runs a linter and fixes issues
  If nest already created some of these scripts, fine. If they have different names (like `"start:dev": "nest start --watch"`) don't modify it, create a different one as an alias (like `"dev": "npm run start:dev"`)

## apps/$project_name/tsconfig.json:
- "extends": "../../tsconfig.base.json"
- "include": ["src/**/*"]
- "module": "nodenext"
- "noEmit": false

