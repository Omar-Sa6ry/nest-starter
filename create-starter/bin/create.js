#!/usr/bin/env node
import degit from 'degit';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const TEMPLATE = 'Omar-Sa6ry/nest-starter';

const TEXT_EXTENSIONS = new Set([
  '.ts', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml',
  '.md', '.env', '.development', '.test', '.staging', '.production',
  '.example', '.conf', '.tmpl', '.sh', '.gql', '.graphql', '',
]);

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'coverage',
]);

function isValidName(name) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name !== '.' && name !== '..';
}

async function processDirectory(dirPath, replacements) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await processDirectory(fullPath, replacements);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext) || entry.name === 'Makefile') {
        try {
          let content = await readFile(fullPath, 'utf8');
          let changed = false;
          for (const [from, to] of replacements) {
            if (content.includes(from)) {
              content = content.replaceAll(from, to);
              changed = true;
            }
          }
          if (changed) {
            await writeFile(fullPath, content, 'utf8');
          }
        } catch {
          // skip unreadable or binary files
        }
      }
    }
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command "${command} ${args.join(' ')}" exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function customizeProject(target, projectName) {
  const cleanName = projectName.toLowerCase();
  const dbName = cleanName.replace(/[^a-zA-Z0-9_]/g, '_');

  // Remove scaffolding directories that must not exist in the generated project
  await rm(path.join(target, 'create-starter'), { recursive: true, force: true });
  await rm(path.join(target, 'media-frontend'), { recursive: true, force: true });

  // Replacements applied recursively across all text files
  const replacements = [
    ['@bts-soft/nest-starter', cleanName],
    ['Nest Starter', projectName],
    ['nest-starter-alerts', `${cleanName}-alerts`],
    ['nest_starter_test_db', `${dbName}_test_db`],
    ['nest_starter_staging', `${dbName}_staging`],
    ['nest_starter_db', `${dbName}_db`],
    ['nest-starter-dev', `${cleanName}-dev`],
    ['nest-starter-test', `${cleanName}-test`],
    ['nest-starter-staging', `${cleanName}-staging`],
    ['nest-starter-prod', `${cleanName}-prod`],
    ['starter-dev-', `${cleanName}-dev-`],
    ['starter-test-', `${cleanName}-test-`],
    ['starter-staging-', `${cleanName}-staging-`],
    ['starter-prod-', `${cleanName}-prod-`],
    ['nest-starter/alertmanager-discord', `${cleanName}/alertmanager-discord`],
    ["service: 'nest-starter'", `service: '${cleanName}'`],
    ['"service": "nest-starter"', `"service": "${cleanName}"`],
    ["toBe('nest-starter')", `toBe('${cleanName}')`],
    ['job_name: nest-starter', `job_name: ${cleanName}`],
    ["job_name: 'nest-starter'", `job_name: '${cleanName}'`],
    ['nest-starter', cleanName],
  ];

  await processDirectory(target, replacements);

  // Ensure package.json name field is set to the clean project name
  const packagePath = path.join(target, 'package.json');
  try {
    const raw = await readFile(packagePath, 'utf8');
    const pkg = JSON.parse(raw);
    pkg.name = cleanName;
    await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  } catch {
    // ignore if package.json is missing or malformed
  }
}

async function main() {
  let projectName = process.argv[2];

  if (!projectName) {
    const rl = createInterface({ input: stdin, output: stdout });
    projectName = (await rl.question('Project name: ')).trim();
    rl.close();
  }

  if (!projectName || !isValidName(projectName)) {
    console.error('Please provide a valid project name (letters, numbers, ., _ or -).');
    process.exitCode = 1;
    return;
  }

  const target = path.resolve(process.cwd(), projectName);

  if (existsSync(target)) {
    console.error(`Directory already exists: ${target}`);
    process.exitCode = 1;
    return;
  }

  await mkdir(target, { recursive: true });

  try {
    console.log(`\nDownloading template ${TEMPLATE} into ${projectName}...`);

    let downloadError;
    for (const branch of ['main', 'master']) {
      try {
        const emitter = degit(`${TEMPLATE}#${branch}`, { cache: false, force: false, verbose: false });
        await emitter.clone(target);
        downloadError = undefined;
        break;
      } catch (err) {
        downloadError = err;
        await rm(target, { recursive: true, force: true });
        if (branch === 'main') {
          await mkdir(target, { recursive: true });
        }
      }
    }

    if (downloadError) throw downloadError;

    console.log('Customizing project files...');
    await customizeProject(target, projectName);

    console.log('Updating dependencies (npm run update)...');
    await runCommand('npm', ['run', 'update'], target);

    console.log('Installing dependencies (make install)...');
    await runCommand('make', ['install'], target);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    console.error(`\nSetup failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`
Project "${projectName}" created successfully!

Recommended next steps:
  cd ${projectName}
  make dev-deps         (start PostgreSQL, Redis, MinIO via Docker)
  make dev              (start the NestJS development server in watch mode)
  # Or use 'make docker-dev-up' to run everything (including the app) inside Docker
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
