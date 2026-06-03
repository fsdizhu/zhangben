interface CacheOptions {
  ttl?: number; // Time to live in seconds, default 5 minutes
}

export class CacheService {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const ttl = options.ttl || 300;

    try {
      const cached = await this.kv.get(key, 'json');
      if (cached !== null) {
        console.log(`Cache hit for key: ${key}`);
        return cached as T;
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }

    console.log(`Cache miss for key: ${key}, fetching data`);
    const data = await fetcher();

    try {
      await this.kv.put(key, JSON.stringify(data), {
        expirationTtl: ttl,
      });
      console.log(`Cache set for key: ${key} with TTL: ${ttl}s`);
    } catch (error) {
      console.warn('Cache write error:', error);
    }

    return data;
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.kv.list({ prefix: pattern });
      for (const key of keys.keys) {
        await this.kv.delete(key.name);
      }
      console.log(`Cache invalidated for pattern: ${pattern}, deleted ${keys.keys.length} keys`);
    } catch (error) {
      console.warn('Cache invalidate error:', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const keys = await this.kv.list();
      for (const key of keys.keys) {
        await this.kv.delete(key.name);
      }
      console.log(`All cache cleared, deleted ${keys.keys.length} keys`);
    } catch (error) {
      console.warn('Cache clearAll error:', error);
    }
  }

  // Helper methods for building cache keys
  buildStatsKey(startDate?: string, endDate?: string, persons?: string[]): string {
    const personKey = persons ? persons.join(',') : 'all';
    return `stats:${startDate || 'all'}:${endDate || 'all'}:${personKey}`;
  }

  buildStatsPersonKey(startDate?: string, endDate?: string, persons?: string[]): string {
    const personKey = persons ? persons.join(',') : 'all';
    return `stats-person:${startDate || 'all'}:${endDate || 'all'}:${personKey}`;
  }

  buildPersonsKey(): string {
    return 'persons:list';
  }
}
