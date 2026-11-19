const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { probeMjpegStream } = require('./streamReadiness');

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(server.address().port);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('ready requires an MJPEG response with frame bytes, and closes the probe', async () => {
  let connectionClosed;
  const closed = new Promise(resolve => { connectionClosed = resolve; });
  await withServer((req, res) => {
    assert.equal(req.url, '/stream');
    res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=FRAME' });
    res.write('--FRAME\r\nContent-Type: image/jpeg\r\n\r\nframe');
    res.on('close', connectionClosed);
  }, async port => {
    assert.equal(await probeMjpegStream({ port }), true);
    await closed;
  });
});

test('a listening service with no frames is not stream-ready', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=FRAME' });
    res.flushHeaders();
  }, async port => {
    assert.equal(await probeMjpegStream({ port, timeoutMs: 50 }), false);
  });
});

test('unrelated services and HTTP errors are not mistaken for the camera', async () => {
  for (const status of [200, 503]) {
    await withServer((req, res) => {
      res.writeHead(status, { 'Content-Type': 'text/html' });
      res.end('not a camera');
    }, async port => {
      assert.equal(await probeMjpegStream({ port }), false);
    });
  }
});

test('connection refusal resolves false without throwing', async () => {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  assert.equal(await probeMjpegStream({ port }), false);
});

test('a connection that never sends headers has a bounded timeout', async () => {
  await withServer(() => {}, async port => {
    assert.equal(await probeMjpegStream({ port, timeoutMs: 50 }), false);
  });
});
