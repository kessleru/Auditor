import { execFileSync } from 'node:child_process';

// Ativa os hooks versionados em .githooks (seção 0.1 do plano). Fora de um clone git — dentro do
// contêiner, por exemplo — não há o que instalar, e o `npm ci` não pode falhar por isso.
try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
