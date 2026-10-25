#!/usr/bin/env node
import degit from 'degit';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TEMPLATE = 'Omar-Sa6ry/nest-starter';
const validName = (name) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name !== '.' && name !== '..';

async function replaceInFile(filePath, replacements) {
  try {
    let content = await readFile(filePath, 'utf8');
    let changed = false;
    for (const [from, to] of replacements) {
      if (content.includes(from)) {
        content = content.replaceAll(from, to);
        changed = true;
      }
    }
    if (changed) {
      await writeFile(filePath, content, 'utf8');
    }
  } catch {
    // If file doesn't exist or cannot be read, ignore
  }
}

async function customizeProject(target, projectName) {
  const cleanName = projectName.toLowerCase();
  const dbName = cleanName.replace(/[^a-zA-Z0-9_]/g, '_');

  // 1. Remove create-starter directory from cloned project
  await rm(path.join(target, 'create-starter'), { recursive: true, force: true });

  // 2. Update package.json
  const packagePath = path.join(target, 'package.json');
  try {
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    packageJson.name = cleanName;
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  } catch {
    // ignore
  }

  // 3. Replacements in configuration and docker files
  const replacements = [
    ['nest-starter-dev', `${cleanName}-dev`],
    ['nest-starter-test', `${cleanName}-test`],
    ['nest-starter-staging', `${cleanName}-staging`],
    ['nest-starter-prod', `${cleanName}-prod`],
    ['starter-dev-', `${cleanName}-dev-`],
    ['starter-test-', `${cleanName}-test-`],
    ['starter-staging-', `${cleanName}-staging-`],
    ['starter-prod-', `${cleanName}-prod-`],
    ['nest-starter/alertmanager-discord', `${cleanName}/alertmanager-discord`],
    ['nest_starter_db', `${dbName}_db`],
    ['nest-starter-alerts', `${cleanName}-alerts`],
    ["service: 'nest-starter'", `service: '${cleanName}'`],
    ['job_name: nest-starter', `job_name: ${cleanName}`],
    ["job_name: 'nest-starter'", `job_name: '${cleanName}'`],
  ];

  const filesToUpdate = [
    path.join(target, 'infrastructure/docker/development/docker-compose.yml'),
    path.join(target, 'infrastructure/docker/test/docker-compose.yml'),
    path.join(target, 'infrastructure/docker/staging/docker-compose.yml'),
    path.join(target, 'infrastructure/docker/production/docker-compose.yml'),
    path.join(target, 'infrastructure/docker/common/prometheus/prometheus.yml'),
    path.join(target, 'environments/.env.development'),
    path.join(target, 'environments/.env.test'),
    path.join(target, 'environments/.env.staging'),
    path.join(target, 'environments/.env.production'),
    path.join(target, 'src/common/automation/health.controller.ts'),
    path.join(target, 'src/common/automation/health.controller.spec.ts'),
    path.join(target, 'test/app.e2e-spec.ts'),
    path.join(target, 'Makefile'),
    path.join(target, 'Taskfile.yml'),
  ];

  for (const file of filesToUpdate) {
    await replaceInFile(file, replacements);
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
