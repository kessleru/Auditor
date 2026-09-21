import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { createSnapshotStorage } from './snapshot-storage.js';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('createSnapshotStorage', () => {
  it('grava HTML e resultado do axe comprimidos em <coleta>/<página>', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshots-'));
    dirs.push(dir);
    const storage = createSnapshotStorage(dir);

    const { snapshotPath } = await storage.save(3, 42, '<html>ok</html>', { violations: [] });
    expect(snapshotPath).toBe('3/42.html.gz');
    expect(await storage.read(snapshotPath)).toBe('<html>ok</html>');

    const raw = await readFile(join(dir, '3/42.axe.json.gz'));
    expect(JSON.parse(gunzipSync(raw).toString())).toEqual({ violations: [] });
  });
});
