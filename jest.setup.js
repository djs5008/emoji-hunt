// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Only mock Next.js navigation when necessary - tests should explicitly mock when needed
// Set test environment variables
process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io'
process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN = 'test-token'

// Add missing globals for Node.js environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock NextResponse for API testing
jest.mock('next/server', () => ({
  NextRequest: class NextRequest extends Request {
    constructor(input, init) {
      super(input, init);
    }
  },
  NextResponse: {
    json: (body, init) => {
      const response = new Response(JSON.stringify(body), {
        ...init,
        headers: {
          ...init?.headers,
          'content-type': 'application/json',
        },
      });
      response.status = init?.status || 200;
      return response;
    },
    redirect: (url, status = 302) => {
      return new Response(null, {
        status,
        headers: {
          Location: url.toString(),
        },
      });
    },
  },
}))

// Mock Request/Response for Next.js server components
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this._body = init?.body;
    }
    
    async json() {
      if (typeof this._body === 'string') {
        return JSON.parse(this._body);
      }
      return this._body;
    }
    
    async text() {
      if (typeof this._body === 'string') {
        return this._body;
      }
      return JSON.stringify(this._body);
    }
  };
}

if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Headers(init?.headers);
    }
    
    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }
    
    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }
  };
}

if (typeof Headers === 'undefined') {
  global.Headers = class Headers {
    constructor(init = {}) {
      this._headers = {};
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers[key.toLowerCase()] = value;
        });
      }
    }
    
    get(name) {
      return this._headers[name.toLowerCase()] || null;
    }
    
    set(name, value) {
      this._headers[name.toLowerCase()] = value;
    }
    
    has(name) {
      return name.toLowerCase() in this._headers;
    }
    
    delete(name) {
      delete this._headers[name.toLowerCase()];
    }
    
    forEach(callback) {
      Object.entries(this._headers).forEach(([key, value]) => {
        callback(value, key, this);
      });
    }
  };
}

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Mock upstash-storage module
jest.mock('@/app/lib/upstash-storage', () => ({
  getLobby: jest.fn(),
  setLobby: jest.fn(),
  deleteLobby: jest.fn(),
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
  deletePlayer: jest.fn(),
  getLobbyPlayers: jest.fn(),
  deleteAllLobbyData: jest.fn(),
  __esModule: true,
}))