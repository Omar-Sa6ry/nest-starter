#!/usr/bin/env node
import degit from 'degit';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TEMPLATE = 'Omar-Sa6ry/nest-starter';
const validName = (name) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name !== '.' && name !== '..';

const TEXT_EXTENSIONS = new Set([
  '.ts', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml',
  '.md', '.env', '.development', '.test', '.staging', '.production',
  '.example', '.conf', '.tmpl', '.sh', '.gql', '.graphql', ''
]);

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'coverage'
]);

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
      // Allow known text extensions or files without extension like Makefile
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
          // ignore unreadable/binary files
        }
      }
    }
  }
}

async function customizeProject(target, projectName) {
  const cleanName = projectName.toLowerCase();
  const dbName = cleanName.replace(/[^a-zA-Z0-9_]/g, '_');

  // 1. Remove create-starter directory from cloned project
  await rm(path.join(target, 'create-starter'), { recursive: true, force: true });

  // 2. Comprehensive replacements across all files
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

  // 3. Ensure package.json name is specifically cleanName
  const packagePath = path.join(target, 'package.json');
  try {
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    packageJson.name = cleanName;
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  } catch {
    // ignore
  }
}

async function main() {
  let projectName = process.argv[2];
  if (!projectName) {
    const rl = createInterface({ input: stdin, output: stdout });
    projectName = (await rl.question('Project name: ')).trim();
    rl.close();
  }

  if (!projectName || !validName(projectName)) {
    console.error('Please provide a valid project name (letters, numbers, ., _ or -).');
    process.exitCode = 1;
    return;
  }

  const target = path.resolve(process.cwd(), projectName);
  try {
    await access(target);
    console.error(`Target already exists: ${target}`);
    process.exitCode = 1;
    return;
  } catch {
    // Target does not exist.
  }

  await mkdir(target, { recursive: true });
  try {
    console.log(`Downloading ${TEMPLATE} into ${target}...`);
    let downloadError;
    for (const branch of ['main', 'master']) {
      try {
        const emitter = degit(`${TEMPLATE}#${branch}`, { cache: false, force: false, verbose: true });
        await emitter.clone(target);
        downloadError = undefined;
        break;
      } catch (error) {
        downloadError = error;
        await rm(target, { recursive: true, force: true });
        if (branch === 'main') await mkdir(target, { recursive: true });
      }
    }
    if (downloadError) throw downloadError;

    await customizeProject(target, projectName);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    console.error(`Could not download the template: ${error.message}`);
    console.error('Check that the GitHub repository is public and the repository name is correct.');
    process.exitCode = 1;
    return;
  }

  console.log('\nProject created successfully! Next steps:');
  console.log(`  cd ${projectName}`);
  console.log('  npm install');
  console.log('  npm run start:dev');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
