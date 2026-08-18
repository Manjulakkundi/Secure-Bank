/**
 * backend/tests/healthCheckTest.js
 * Validates backend server startup in production-like mode, routes initialization,
 * database connectivity, and GET /health response.
 */
const http = require('http');
const app = require('../index');

const server = app.listen(8089, () => {
  console.log('✅ Test production server listening on port 8089');

  http.get('http://127.0.0.1:8089/health', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(rawData);
        console.log('GET /health Response:', parsed);
        if (parsed.success && parsed.message.includes('SecureBank API is running')) {
          console.log('✅ PASS: Health check endpoint passed successfully');
          server.close(() => process.exit(0));
        } else {
          console.error('❌ FAIL: Unexpected health check response', parsed);
          server.close(() => process.exit(1));
        }
      } catch (e) {
        console.error('❌ FAIL: Error parsing response', e);
        server.close(() => process.exit(1));
      }
    });
  }).on('error', (e) => {
    console.error(`❌ FAIL: Health check request error: ${e.message}`);
    server.close(() => process.exit(1));
  });
});
