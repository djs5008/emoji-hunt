export class Redis {
  private data = new Map<string, any>();

  async get(key: string) {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any) {
    this.data.set(key, value);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: any) {
    this.data.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]) {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async exists(...keys: string[]) {
    let count = 0;
    for (const key of keys) {
      if (this.data.has(key)) {
        count++;
      }
    }
    return count;
  }

  async expire(key: string, seconds: number) {
    return this.data.has(key) ? 1 : 0;
  }

  async ttl(key: string) {
    return this.data.has(key) ? 3600 : -2;
  }

  async scan(cursor: number, options?: { match?: string; count?: number }) {
    const keys = Array.from(this.data.keys());
    const filtered = options?.match 
      ? keys.filter(k => k.includes(options.match!.replace(/\*/g, '')))
      : keys;
    return [0, filtered];
  }

  async hset(key: string, field: string, value: any) {
    const hash = this.data.get(key) || {};
    hash[field] = value;
    this.data.set(key, hash);
    return 1;
  }

  async hget(key: string, field: string) {
    const hash = this.data.get(key);
    return hash ? hash[field] || null : null;
  }

  async hgetall(key: string) {
    return this.data.get(key) || {};
  }

  async hdel(key: string, ...fields: string[]) {
    const hash = this.data.get(key);
    if (!hash) return 0;
    
    let deleted = 0;
    for (const field of fields) {
      if (field in hash) {
        delete hash[field];
        deleted++;
      }
    }
    return deleted;
  }

  async hincrby(key: string, field: string, increment: number) {
    const hash = this.data.get(key) || {};
    hash[field] = (hash[field] || 0) + increment;
    this.data.set(key, hash);
    return hash[field];
  }

  async sadd(key: string, ...members: any[]) {
    const set = this.data.get(key) || new Set();
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    this.data.set(key, set);
    return added;
  }

  async srem(key: string, ...members: any[]) {
    const set = this.data.get(key);
    if (!set) return 0;
    
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }
    return removed;
  }

  async smembers(key: string) {
    const set = this.data.get(key);
    return set ? Array.from(set) : [];
  }

  async sismember(key: string, member: any) {
    const set = this.data.get(key);
    return set?.has(member) ? 1 : 0;
  }

  async zadd(key: string, ...args: any[]) {
    const sortedSet = this.data.get(key) || new Map();
    let added = 0;
    
    for (let i = 0; i < args.length; i += 2) {
      const score = args[i];
      const member = args[i + 1];
      if (!sortedSet.has(member)) {
        added++;
      }
      sortedSet.set(member, score);
    }
    
    this.data.set(key, sortedSet);
    return added;
  }

  async zrem(key: string, ...members: any[]) {
    const sortedSet = this.data.get(key);
    if (!sortedSet) return 0;
    
    let removed = 0;
    for (const member of members) {
      if (sortedSet.delete(member)) {
        removed++;
      }
    }
    return removed;
  }

  async zrange(key: string, start: number, stop: number, options?: { withScores?: boolean }) {
    const sortedSet = this.data.get(key);
    if (!sortedSet) return [];
    
    const entries = Array.from(sortedSet.entries()).sort((a, b) => a[1] - b[1]);
    const slice = entries.slice(start, stop === -1 ? undefined : stop + 1);
    
    if (options?.withScores) {
      return slice.flatMap(([member, score]) => [member, score.toString()]);
    }
    return slice.map(([member]) => member);
  }

  async pipeline() {
    const commands: any[] = [];
    const self = this;
    
    const proxy = new Proxy({}, {
      get(target, prop) {
        return (...args: any[]) => {
          commands.push({ method: prop, args });
          return proxy;
        };
      }
    });
    
    (proxy as any).exec = async () => {
      const results = [];
      for (const { method, args } of commands) {
        const result = await (self as any)[method](...args);
        results.push([null, result]);
      }
      return results;
    };
    
    return proxy;
  }
}

export default Redis;