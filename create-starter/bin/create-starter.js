#!/usr/bin/env node
import degit from 'degit';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TEMPLATE = 'Omar-Sa6ry/nest-starter';
const validName = (name) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && name !== '.' && name !== '..';

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
    const packagePath = path.join(target, 'package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    packageJson.name = projectName.toLowerCase();
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    console.error(`Could not download the template: ${error.message}`);
    console.error('Check that the GitHub repository is public and the repository name is correct.');
    process.exitCode = 1;
    return;
  }

  console.log('\nProject created. Next steps:');
  console.log(`  cd ${projectName}`);
  console.log('  npm install');
  console.log('  npm run start:dev');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
