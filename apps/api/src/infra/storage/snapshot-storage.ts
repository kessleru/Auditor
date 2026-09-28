import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Snapshots em disco, nunca como BLOB: `<collectionId>/<pageId>.html.gz` (seção 2). Ao lado,
 * `<pageId>.axe.json.gz` guarda o resultado bruto do axe (passes, violations, incomplete e
 * inapplicable completos) para reprodutibilidade. Fotos dos elementos reprovados ficam em
 * `<collectionId>/<pageId>/<findingId>.jpg`.
 */
export function createSnapshotStorage(baseDir: string) {
  const root = resolve(baseDir);
  const absolute = (relativePath: string) => join(root, relativePath);
  const resultsPathFor = (snapshotPath: string) =>
    snapshotPath.replace(/\.html\.gz$/, '.axe.json.gz');

  const writeRaw = async (relativePath: string, content: Buffer) => {
    const file = absolute(relativePath);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  const write = async (relativePath: string, content: string) =>
    writeRaw(relativePath, await gzipAsync(content));

  return {
    root,
    resultsPathFor,

    async save(collectionId: number, pageId: number, html: string, results: unknown) {
      const snapshotPath = `${collectionId}/${pageId}.html.gz`;
      await write(snapshotPath, html);
      await write(resultsPathFor(snapshotPath), JSON.stringify(results));
      return { snapshotPath };
    },

    async read(relativePath: string): Promise<string> {
      return (await gunzipAsync(await readFile(absolute(relativePath)))).toString('utf8');
    },

    /** Foto de um achado (ADR 0014): `<coleta>/<página>/<achado>.jpg`, sem compressão extra. */
    async saveScreenshot(collectionId: number, pageId: number, findingId: number, image: Buffer) {
      const screenshotPath = `${collectionId}/${pageId}/${findingId}.jpg`;
      await writeRaw(screenshotPath, image);
      return { screenshotPath };
    },

    readFile(relativePath: string): Promise<Buffer> {
      return readFile(absolute(relativePath));
    },
  };
}

export type SnapshotStorage = ReturnType<typeof createSnapshotStorage>;
