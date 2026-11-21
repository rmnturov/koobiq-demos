import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

function collectFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        return entry.isDirectory() ? collectFiles(full) : [full];
    });
}

/** Packs every folder in `demosDir` into `<outDir>/<folder>.zip`; returns the folder names (slugs). */
export async function zipDemos({ demosDir, outDir }) {
    mkdirSync(outDir, { recursive: true });
    const slugs = readdirSync(demosDir)
        .filter((name) => statSync(join(demosDir, name)).isDirectory())
        .sort();

    for (const slug of slugs) {
        const folder = join(demosDir, slug);
        const entries = {};
        for (const file of collectFiles(folder)) {
            const inArchive = [slug, ...relative(folder, file).split(sep)].join('/');
            entries[inArchive] = new Uint8Array(readFileSync(file));
        }
        writeFileSync(join(outDir, `${slug}.zip`), zipSync(entries));
    }
    return slugs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const root = resolve(fileURLToPath(import.meta.url), '..', '..');
    const slugs = await zipDemos({ demosDir: join(root, 'src/demos'), outDir: join(root, 'public/downloads') });
    console.log(`zipped ${slugs.length} demo(s): ${slugs.join(', ')}`);
}
