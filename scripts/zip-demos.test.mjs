import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { zipDemos } from './zip-demos.mjs';

function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'zip-demos-'));
    const demosDir = join(root, 'demos');
    mkdirSync(join(demosDir, 'a', 'sub'), { recursive: true });
    mkdirSync(join(demosDir, 'b'), { recursive: true });
    writeFileSync(join(demosDir, 'a', 'sub', 'file.txt'), 'hello');
    writeFileSync(join(demosDir, 'b', 'index.ts'), 'export {}');
    writeFileSync(join(demosDir, 'stray.txt'), 'ignored');
    return { demosDir, outDir: join(root, 'out') };
}

test('creates one zip per demo folder and returns slugs', async () => {
    const dirs = fixture();
    assert.deepEqual(await zipDemos(dirs), ['a', 'b']);
    assert.deepEqual(readdirSync(dirs.outDir).sort(), ['a.zip', 'b.zip']);
});

test('archive keeps nested files under a <slug>/ root', async () => {
    const dirs = fixture();
    await zipDemos(dirs);
    const files = unzipSync(new Uint8Array(readFileSync(join(dirs.outDir, 'a.zip'))));
    assert.deepEqual(Object.keys(files), ['a/sub/file.txt']);
    assert.equal(strFromU8(files['a/sub/file.txt']), 'hello');
});

test('running twice overwrites archives without error', async () => {
    const dirs = fixture();
    await zipDemos(dirs);
    await assert.doesNotReject(zipDemos(dirs));
});

test('registry slugs match demo folders', () => {
    const registry = readFileSync(new URL('../src/demos/demos.registry.ts', import.meta.url), 'utf8');
    const slugs = [...registry.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]).sort();
    const folders = readdirSync(new URL('../src/demos/', import.meta.url), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
    assert.deepEqual(slugs, folders);
});
