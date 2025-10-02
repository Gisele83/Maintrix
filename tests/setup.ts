import { config } from 'dotenv';

config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/maintrix_test';
process.env.SESSION_SECRET = 'test-session-secret-key-for-testing-only';
process.env.SENDGRID_API_KEY = 'SG.test_key_for_integration_tests';

global.beforeAll(() => {
  console.log('🧪 Starting integration tests...');
});

global.afterAll(() => {
  console.log('✅ Integration tests completed');
});
