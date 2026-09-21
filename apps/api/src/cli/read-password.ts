import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

/** Lê uma linha do terminal sem ecoar o que é digitado. */
async function promptHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const answer = rl.question(question);
  muted = true;
  try {
    return await answer;
  } finally {
    rl.close();
    process.stdout.write('\n');
  }
}

async function readFirstLine(): Promise<string> {
  let data = '';
  for await (const chunk of process.stdin) data += String(chunk);
  return data.split(/\r?\n/)[0] ?? '';
}

/**
 * Senha nunca como argumento (ficaria no histórico do shell): no terminal, pede duas vezes
 * sem eco; fora dele (pipe), lê a primeira linha da entrada padrão.
 */
export async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return readFirstLine();

  const password = await promptHidden('Senha: ');
  const confirmation = await promptHidden('Confirme a senha: ');
  if (password !== confirmation) throw new Error('As senhas não conferem.');
  return password;
}
