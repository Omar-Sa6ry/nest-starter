# @bts-soft/create-starter

Create a project from the [`Omar-Sa6ry/nest-starter`](https://github.com/Omar-Sa6ry/nest-starter) GitHub template:

```sh
npm create @bts-soft/starter my-app
cd my-app
npm install
npm run start:dev
```

The command downloads the current default branch of the public GitHub repository. Node.js 22+ and npm 10+ are required. Docker Compose is required for the included database/cache development setup.

## Publish

From this directory, after pushing the changes to GitHub:

```sh
npm login
npm publish --access public
```

The package name is `@bts-soft/create-starter`; npm's `npm create @bts-soft/starter` syntax expands to that package name.
