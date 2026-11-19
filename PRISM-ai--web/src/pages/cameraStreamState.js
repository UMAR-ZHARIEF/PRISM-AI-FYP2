export const STREAM_STARTUP_TIMEOUT_MS = 120_000;
export const STREAM_RETRY_DELAY_MS = 5_000;
export const MAX_STREAM_RETRIES = 3;

export const initialStreamState = { sessionKey: null, phase: 'connecting', attempt: 0, retryEpoch: 0 };

// Session-tagged actions prevent late image events/timers from reviving a
// stopped or replaced process. No timers or other side effects in the reducer.
export function cameraStreamReducer(state, action) {
  if (action.type === 'reset') return { ...initialStreamState, sessionKey: action.sessionKey };
  if (state.sessionKey !== action.sessionKey) return state;
  switch (action.type) {
    case 'loaded':
      return state.phase === 'connecting' ? { ...state, phase: 'live' } : state;
    case 'failed':
      if (state.phase === 'retry' || state.phase === 'error') return state;
      return { ...state, phase: state.attempt >= MAX_STREAM_RETRIES ? 'error' : 'retry', attempt: state.attempt + 1 };
    case 'retry':
      return state.phase === 'retry' ? { ...state, phase: 'connecting' } : state;
    case 'disconnected':
      return state.phase === 'live' ? { ...state, phase: 'connecting' } : state;
    case 'timeout':
      return state.phase === 'live' ? state : { ...state, phase: 'error' };
    case 'manual':
      return { ...state, phase: 'connecting', attempt: 0, retryEpoch: state.retryEpoch + 1 };
    default:
      return state;
  }
}
