import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

execFileSync(process.execPath, ['--check', join(root, 'index.js')], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', join(root, 'client.js')], { stdio: 'inherit' });

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

for (const file of ['locale/en.json', 'locale/zh.json']) {
	const meta = JSON.parse(readFileSync(join(root, file), 'utf8')).meta;
	if (typeof meta?.title !== 'string' || meta.title.length === 0 || typeof meta?.description !== 'string' || meta.description.length === 0) {
		throw new Error(`${file}: meta.title and meta.description are required`);
	}
}

if (pkg.dsh?.client?.platform !== 'web') throw new Error('package.json: dsh.client.platform must be "web"');
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('package.json: dsh.bundle.patch must be "./cordis.patch.yml"');

const client = readFileSync(join(root, 'client.js'), 'utf8');
const moduleId = /id:\s*'([^']+)'/.exec(client);
if (moduleId === null || moduleId[1] !== pkg.name) {
	throw new Error(`client.js module id ${moduleId?.[1] ?? '(missing)'} does not match package name ${pkg.name}`);
}

const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8');
if (!patch.includes(pkg.name)) throw new Error('cordis.patch.yml does not reference the package name');

for (const file of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'README.md', 'LICENSE']) {
	if (!existsSync(join(root, file))) throw new Error(`missing ${file}`);
}

console.log(`${pkg.name} ${pkg.version}: checks passed`);
