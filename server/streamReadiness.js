const http = require('node:http');

// A child PID is not proof that the camera is ready. Wait for actual MJPEG
// bytes, then close the probe immediately without retaining any frame data.
// Connection refusal during model loading is an expected false result.
function probeMjpegStream({ port = 5174, timeoutMs = 750 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let request;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request?.destroy();
      resolve(ready);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    request = http.get({ hostname: '127.0.0.1', port, path: '/stream', agent: false }, (response) => {
      response.once('error', () => finish(false));
      if (response.statusCode !== 200 || !String(response.headers['content-type']).startsWith('multipart/x-mixed-replace')) {
        response.resume();
        finish(false);
        return;
      }
      response.once('data', () => finish(true));
      response.once('end', () => finish(false));
    });
    request.once('error', () => finish(false));
  });
}

module.exports = { probeMjpegStream };
