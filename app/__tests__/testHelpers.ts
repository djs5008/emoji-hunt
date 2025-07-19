import { NextRequest } from 'next/server';

export function createMockNextRequest(url: string, init?: RequestInit & { json?: any }): NextRequest {
  const request = new NextRequest(url, {
    ...init,
    body: init?.json ? JSON.stringify(init.json) : init?.body,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  
  return request;
}

export async function parseNextResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}