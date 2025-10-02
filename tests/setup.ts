import { config } from 'dotenv';
import request from 'supertest';

config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/maintrix_test';
process.env.SESSION_SECRET = 'test-session-secret-key-for-testing-only';
process.env.SENDGRID_API_KEY = 'SG.test_key_for_integration_tests';

const API_BASE = process.env.API_URL || 'http://localhost:5000';

export interface AuthenticatedAgent {
  agent: any;
  cookies: string[];
  csrfToken: string;
  userId?: number;
  tenantId?: number;
}

export async function getCsrfToken(): Promise<{ csrfToken: string; cookies: string[] }> {
  const response = await request(API_BASE).get('/api/health');
  
  const rawCookies = response.headers['set-cookie'];
  const cookies = Array.isArray(rawCookies) ? rawCookies : [];
  let csrfToken = '';
  
  for (const cookie of cookies) {
    const match = cookie.match(/csrfToken=([^;]+)/);
    if (match) {
      csrfToken = decodeURIComponent(match[1]);
      break;
    }
  }
  
  return { csrfToken, cookies };
}

export async function authenticateUser(
  email: string,
  password: string,
  tenantId?: number
): Promise<AuthenticatedAgent> {
  const agent = request.agent(API_BASE);
  
  const healthResponse = await agent.get('/api/health');
  
  const rawCookies = healthResponse.headers['set-cookie'];
  const cookies = Array.isArray(rawCookies) ? rawCookies : [];
  let csrfToken = '';
  
  for (const cookie of cookies) {
    const match = cookie.match(/csrfToken=([^;]+)/);
    if (match) {
      csrfToken = decodeURIComponent(match[1]);
      break;
    }
  }
  
  const loginHeaders: Record<string, string> = {
    'X-CSRF-Token': csrfToken,
  };
  
  if (tenantId) {
    loginHeaders['X-Tenant-Id'] = String(tenantId);
  }
  
  const loginResponse = await agent
    .post('/api/enterprise-auth/login')
    .set(loginHeaders)
    .send({ email, password });
  
  if (loginResponse.status !== 200) {
    throw new Error(`Login failed with status ${loginResponse.status}: ${JSON.stringify(loginResponse.body)}`);
  }
  
  const rawSessionCookies = loginResponse.headers['set-cookie'];
  const sessionCookies = Array.isArray(rawSessionCookies) ? rawSessionCookies : cookies;
  
  return {
    agent,
    cookies: sessionCookies,
    csrfToken,
    userId: loginResponse.body.user?.id,
    tenantId: loginResponse.body.user?.tenantId || tenantId,
  };
}

export function createAuthenticatedRequest(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  auth: AuthenticatedAgent
): request.Test {
  const req = auth.agent[method](path)
    .set('Cookie', auth.cookies.join('; '))
    .set('X-CSRF-Token', auth.csrfToken);
  
  if (auth.tenantId) {
    req.set('X-Tenant-Id', String(auth.tenantId));
  }
  
  return req;
}

global.beforeAll(() => {
  console.log('🧪 Starting integration tests...');
});

global.afterAll(() => {
  console.log('✅ Integration tests completed');
});
