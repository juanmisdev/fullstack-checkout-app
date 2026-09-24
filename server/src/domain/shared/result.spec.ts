// Unit tests — Result type (ROP) utilities.

import { Ok, Err, flatMap, map, attempt, attemptAsync } from './result';

describe('Result (ROP)', () => {
  it('Ok wraps a value', () => {
    const r = Ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('Err wraps an error', () => {
    const r = Err(new Error('boom'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe('boom');
  });

  it('flatMap chains on success and skips on failure', () => {
    const doubled = flatMap(Ok(21), (v) => Ok(v * 2));
    expect(doubled.ok).toBe(true);
    if (doubled.ok) expect(doubled.value).toBe(42);

    const skipped = flatMap(Err(new Error('fail')), (_v) => Ok(42));
    expect(skipped.ok).toBe(false);
  });

  it('map transforms the success value', () => {
    const r = map(Ok(2), (v) => v + 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(3);
  });

  it('attempt captures thrown errors', () => {
    const r = attempt(() => {
      throw new Error('boom');
    });
    expect(r.ok).toBe(false);
  });

  it('attemptAsync captures async rejections', async () => {
    const r = await attemptAsync(async () => {
      throw new Error('async boom');
    });
    expect(r.ok).toBe(false);
  });
});