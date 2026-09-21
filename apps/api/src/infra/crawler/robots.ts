import robotsParser from 'robots-parser';

export interface RobotsRules {
  isAllowed(url: string): boolean;
  sitemaps: string[];
  /** Crawl-delay declarado para o nosso user-agent, em ms. */
  crawlDelayMs: number | undefined;
}

/** Interpreta o robots.txt; conteúdo ausente (404, erro) libera tudo. */
export function parseRobots(
  robotsUrl: string,
  content: string | null,
  userAgent: string,
): RobotsRules {
  const robots = robotsParser(robotsUrl, content ?? '');
  const delay = robots.getCrawlDelay(userAgent);
  return {
    // `undefined` = URL de outra origem; tratada como não permitida.
    isAllowed: (url) => robots.isAllowed(url, userAgent) === true,
    sitemaps: robots.getSitemaps(),
    crawlDelayMs: delay !== undefined && delay > 0 ? delay * 1000 : undefined,
  };
}
