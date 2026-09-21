/**
 * Trava por domínio (seção 3.1.8): um domínio só pode estar em uma coleta em execução por vez.
 * A aquisição é tudo ou nada, para uma coleta com várias instituições não ficar pela metade.
 */
export class DomainLocks {
  private readonly owners = new Map<string, number>();

  tryAcquire(domains: readonly string[], owner: number): boolean {
    const keys = domains.map((d) => d.toLowerCase());
    if (keys.some((key) => this.owners.has(key) && this.owners.get(key) !== owner)) return false;
    for (const key of keys) this.owners.set(key, owner);
    return true;
  }

  release(owner: number): void {
    for (const [key, holder] of this.owners) if (holder === owner) this.owners.delete(key);
  }

  holder(domain: string): number | undefined {
    return this.owners.get(domain.toLowerCase());
  }
}
