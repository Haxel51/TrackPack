const https = require('https');
const data = JSON.stringify({
  email: "test@example.com",
  amount: 10000,
  bank_transfer: {
    account_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  }
});
const options = {
  hostname: 'api.paystack.co',
  port: 443,
  path: '/charge',
  method: 'POST',
  headers: {
    Authorization: 'Bearer sk_test_d9b0a63eba0ee8fd40445ea3e4e934a928f8e6fa',
    'Content-Type': 'application/json'
  }
};
const req = https.request(options, res => {
  let d = '';
  res.on('data', chunk => d += chunk);
  res.on('end', () => console.log(d));
});
req.write(data);
req.end();
