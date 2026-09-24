// Result type for Railway Oriented Programming.
// Use cases return Ok(value) or Err(error) instead of throwing.

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Chains a function over a successful result (railway switch). */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => (result.ok ? fn(result.value) : result);

/** Maps the success value. */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => (result.ok ? Ok(fn(result.value)) : result);

/** Wraps a throwing sync function into a Result. */
export const attempt = <T>(fn: () => T): Result<T, Error> => {
  try {
    return Ok(fn());
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
};

/** Wraps a throwing async function into a Result. */
export const attemptAsync = async <T>(fn: () => Promise<T>): Promise<Result<T, Error>> => {
  try {
    return Ok(await fn());
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
};