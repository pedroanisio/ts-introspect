/**
 * Result Pattern
 * 
 * Type-safe error handling without exceptions.
 * Inspired by Rust's Result type and functional programming patterns.
 * 
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return Err('Division by zero');
 *   return Ok(a / b);
 * }
 * 
 * const result = divide(10, 2);
 * const value = match(result, {
 *   ok: v => `Result: ${v}`,
 *   err: e => `Error: ${e}`
 * });
 * ```
 */

// ============================================
// Types
// ============================================

/**
 * Successful result variant
 */
export interface OkResult<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Error result variant
 */
export interface ErrResult<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok or Err
 */
export type Result<T, E> = OkResult<T> | ErrResult<E>;

/**
 * Standard error structure for consistent error handling
 */
export interface ResultError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Constructors
// ============================================

/**
 * Create a successful result
 */
export function Ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok;
}

/**
 * Check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return !result.ok;
}

// ============================================
// Unwrap Functions
// ============================================

/**
 * Extract value from Ok, throw on Err
 * @throws Error when result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  const errorMessage = typeof result.error === 'string' 
    ? result.error 
    : result.error instanceof Error 
      ? result.error.message 
      : String(result.error);
  throw new Error(errorMessage);
}

/**
 * Extract value from Ok, or return default on Err
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Extract error from Err, throw on Ok
 * @throws Error when result is Ok
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error('Called unwrapErr on Ok result');
}

// ============================================
// Transformations
// ============================================

/**
 * Transform the Ok value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return Ok(fn(result.value));
  }
  return result;
}

/**
 * Transform the Err error
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return Err(fn(result.error));
  }
  return result;
}

/**
 * Chain Result-returning functions (flatMap/bind)
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Handle error by providing alternative result
 */
export function orElse<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> {
  if (isErr(result)) {
    return fn(result.error);
  }
  return result;
}

// ============================================
// Pattern Matching
// ============================================

/**
 * Match handlers for Result patterns
 */
export interface MatchHandlers<T, E, U> {
  ok: (value: T) => U;
  err: (error: E) => U;
}

/**
 * Pattern match on Result
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: MatchHandlers<T, E, U>
): U {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Wrap a throwing function in Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return Ok(fn());
  } catch (error) {
    if (mapError) {
      return Err(mapError(error));
    }
    return Err(error as E);
  }
}

/**
 * Wrap an async throwing function in Result
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    if (mapError) {
      return Err(mapError(error));
    }
    return Err(error as E);
  }
}

/**
 * Collect array of Results into Result of array
 * Returns first Err if any, otherwise Ok with all values
 */
export function collect<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  
  return Ok(values);
}

