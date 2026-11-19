import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraStreamReducer as reduce, initialStreamState, MAX_STREAM_RETRIES } from './cameraStreamState.js';

const action = type => ({ type, sessionKey: 'camera-A' });
const start = () => reduce(initialStreamState, action('reset'));

test('late image events cannot revive a stopped or replacement session', () => {
  let state = start();
  state = reduce(state, { type: 'reset', sessionKey: 'camera-B' });
  assert.equal(reduce(state, action('loaded')), state);
  assert.equal(reduce(state, action('retry')), state);
});

test('duplicate image errors schedule only one retry', () => {
  const state = reduce(start(), action('failed'));
  assert.equal(state.phase, 'retry');
  assert.equal(state.attempt, 1);
  assert.equal(reduce(state, action('failed')), state);
});

test('repeated stream failures stop automatically at the retry limit', () => {
  let state = start();
  for (let i = 0; i < MAX_STREAM_RETRIES; i++) {
    state = reduce(state, action('failed'));
    assert.equal(state.phase, 'retry');
    state = reduce(state, action('retry'));
  }
  state = reduce(state, action('failed'));
  assert.equal(state.phase, 'error');
  assert.equal(reduce(state, action('retry')), state);
});

test('startup timeout does not interrupt a successfully loaded stream', () => {
  assert.equal(reduce(start(), action('timeout')).phase, 'error');
  const live = reduce(start(), action('loaded'));
  assert.equal(reduce(live, action('timeout')), live);
});

test('loss of readiness leaves live state and manual retry resets the budget', () => {
  const live = reduce(start(), action('loaded'));
  assert.equal(reduce(live, action('disconnected')).phase, 'connecting');
  const failed = reduce(start(), action('timeout'));
  const retried = reduce(failed, action('manual'));
  assert.equal(retried.phase, 'connecting');
  assert.equal(retried.attempt, 0);
  assert.equal(retried.retryEpoch, failed.retryEpoch + 1);
});
