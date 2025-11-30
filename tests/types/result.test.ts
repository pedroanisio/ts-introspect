/**
 * Result Pattern Tests
 * 
 * TDD: RED phase - Tests for Result type (explicit error handling)
 */

import { describe, it, expect } from 'vitest';
import {
  Result,
  Ok,
  Err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  unwrapErr,
  map,
  mapErr,
  andThen,
  orElse,
  match,
  tryCatch,
  tryCatchAsync,
  collect,
  type ResultError
} from '@/types/result.js';

describe('Result Pattern', () => {
  describe('Ok and Err constructors', () => {
    it('should create Ok result', () => {
      const result = Ok(42);
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should create Err result', () => {
      const result = Err('Something went wrong');
      
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('should create Ok with complex value', () => {
      const data = { name: 'Test', items: [1, 2, 3] };
      const result = Ok(data);
      
      expect(result.value).toEqual(data);
    });

    it('should create Err with error object', () => {
      const error = { code: 'NOT_FOUND', message: 'Resource not found' };
      const result = Err(error);
      
      expect(result.error).toEqual(error);
    });
  });

  describe('Type guards', () => {
    it('isOk should return true for Ok result', () => {
      const result = Ok('success');
      expect(isOk(result)).toBe(true);
    });

    it('isOk should return false for Err result', () => {
      const result = Err('error');
      expect(isOk(result)).toBe(false);
    });

    it('isErr should return true for Err result', () => {
      const result = Err('error');
      expect(isErr(result)).toBe(true);
    });

    it('isErr should return false for Ok result', () => {
      const result = Ok('success');
      expect(isErr(result)).toBe(false);
    });
  });

  describe('unwrap functions', () => {
    it('unwrap should return value for Ok', () => {
      const result = Ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('unwrap should throw for Err', () => {
      const result = Err('error message');
      expect(() => unwrap(result)).toThrow('error message');
    });

    it('unwrapOr should return value for Ok', () => {
      const result = Ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('unwrapOr should return default for Err', () => {
      const result = Err<string>('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });

    it('unwrapErr should return error for Err', () => {
      const result = Err('error message');
      expect(unwrapErr(result)).toBe('error message');
    });

    it('unwrapErr should throw for Ok', () => {
      const result = Ok('success');
      expect(() => unwrapErr(result)).toThrow();
    });
  });

  describe('map function', () => {
    it('should transform Ok value', () => {
      const result = Ok(5);
      const mapped = map(result, x => x * 2);
      
      expect(isOk(mapped)).toBe(true);
      expect(unwrap(mapped)).toBe(10);
    });

    it('should not transform Err', () => {
      const result: Result<number, string> = Err('error');
      const mapped = map(result, x => x * 2);
      
      expect(isErr(mapped)).toBe(true);
      expect(unwrapErr(mapped)).toBe('error');
    });

    it('should allow type change', () => {
      const result = Ok(42);
      const mapped = map(result, x => `Value: ${x}`);
      
      expect(unwrap(mapped)).toBe('Value: 42');
    });
  });

  describe('mapErr function', () => {
    it('should transform Err error', () => {
      const result = Err('simple error');
      const mapped = mapErr(result, e => ({ code: 'ERR', message: e }));
      
      expect(isErr(mapped)).toBe(true);
      expect(unwrapErr(mapped)).toEqual({ code: 'ERR', message: 'simple error' });
    });

    it('should not transform Ok', () => {
      const result = Ok<number, string>(42);
      const mapped = mapErr(result, e => ({ code: 'ERR', message: e }));
      
      expect(isOk(mapped)).toBe(true);
      expect(unwrap(mapped)).toBe(42);
    });
  });

  describe('andThen (flatMap)', () => {
    it('should chain Ok results', () => {
      const divide = (a: number, b: number): Result<number, string> => {
        if (b === 0) return Err('Division by zero');
        return Ok(a / b);
      };

      const result = Ok(10);
      const chained = andThen(result, x => divide(x, 2));
      
      expect(isOk(chained)).toBe(true);
      expect(unwrap(chained)).toBe(5);
    });

    it('should short-circuit on Err', () => {
      const divide = (a: number, b: number): Result<number, string> => {
        if (b === 0) return Err('Division by zero');
        return Ok(a / b);
      };

      const result: Result<number, string> = Err('initial error');
      const chained = andThen(result, x => divide(x, 2));
      
      expect(isErr(chained)).toBe(true);
      expect(unwrapErr(chained)).toBe('initial error');
    });

    it('should propagate new Err from chain', () => {
      const divide = (a: number, b: number): Result<number, string> => {
        if (b === 0) return Err('Division by zero');
        return Ok(a / b);
      };

      const result = Ok(10);
      const chained = andThen(result, x => divide(x, 0));
      
      expect(isErr(chained)).toBe(true);
      expect(unwrapErr(chained)).toBe('Division by zero');
    });
  });

  describe('orElse', () => {
    it('should not call handler for Ok', () => {
      const result = Ok(42);
      const handled = orElse(result, () => Ok(0));
      
      expect(unwrap(handled)).toBe(42);
    });

    it('should call handler for Err', () => {
      const result: Result<number, string> = Err('error');
      const handled = orElse(result, () => Ok(0));
      
      expect(unwrap(handled)).toBe(0);
    });

    it('should allow error recovery', () => {
      const result: Result<number, string> = Err('not found');
      const handled = orElse(result, err => {
        if (err === 'not found') return Ok(-1);
        return Err(err);
      });
      
      expect(unwrap(handled)).toBe(-1);
    });
  });

  describe('match function', () => {
    it('should call ok handler for Ok', () => {
      const result = Ok(42);
      const output = match(result, {
        ok: value => `Success: ${value}`,
        err: error => `Error: ${error}`
      });
      
      expect(output).toBe('Success: 42');
    });

    it('should call err handler for Err', () => {
      const result = Err('failure');
      const output = match(result, {
        ok: value => `Success: ${value}`,
        err: error => `Error: ${error}`
      });
      
      expect(output).toBe('Error: failure');
    });

    it('should allow different return types', () => {
      const result = Ok(42);
      const output = match(result, {
        ok: value => value * 2,
        err: () => 0
      });
      
      expect(output).toBe(84);
    });
  });

  describe('tryCatch', () => {
    it('should return Ok for successful function', () => {
      const result = tryCatch(() => JSON.parse('{"a": 1}'));
      
      expect(isOk(result)).toBe(true);
      expect(unwrap(result)).toEqual({ a: 1 });
    });

    it('should return Err for throwing function', () => {
      const result = tryCatch(() => JSON.parse('invalid json'));
      
      expect(isErr(result)).toBe(true);
      expect(unwrapErr(result)).toBeInstanceOf(Error);
    });

    it('should support custom error mapper', () => {
      const result = tryCatch(
        () => JSON.parse('invalid'),
        err => ({ code: 'PARSE_ERROR', original: err })
      );
      
      expect(isErr(result)).toBe(true);
      expect(unwrapErr(result).code).toBe('PARSE_ERROR');
    });
  });

  describe('tryCatchAsync', () => {
    it('should return Ok for successful async function', async () => {
      const result = await tryCatchAsync(async () => {
        return Promise.resolve(42);
      });
      
      expect(isOk(result)).toBe(true);
      expect(unwrap(result)).toBe(42);
    });

    it('should return Err for rejecting async function', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('async error');
      });
      
      expect(isErr(result)).toBe(true);
      expect(unwrapErr(result)).toBeInstanceOf(Error);
    });

    it('should support custom error mapper', async () => {
      const result = await tryCatchAsync(
        async () => { throw new Error('fail'); },
        err => `Caught: ${err instanceof Error ? err.message : String(err)}`
      );
      
      expect(isErr(result)).toBe(true);
      expect(unwrapErr(result)).toBe('Caught: fail');
    });
  });

  describe('collect', () => {
    it('should collect array of Ok results into single Ok', () => {
      const results = [Ok(1), Ok(2), Ok(3)];
      const collected = collect(results);
      
      expect(isOk(collected)).toBe(true);
      expect(unwrap(collected)).toEqual([1, 2, 3]);
    });

    it('should return first Err if any result is Err', () => {
      const results = [Ok(1), Err('error'), Ok(3)];
      const collected = collect(results);
      
      expect(isErr(collected)).toBe(true);
      expect(unwrapErr(collected)).toBe('error');
    });

    it('should return Ok with empty array for empty input', () => {
      const results: Result<number, string>[] = [];
      const collected = collect(results);
      
      expect(isOk(collected)).toBe(true);
      expect(unwrap(collected)).toEqual([]);
    });
  });

  describe('ResultError type', () => {
    it('should work with standard error structure', () => {
      const error: ResultError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input'
      };
      
      const result = Err(error);
      
      expect(unwrapErr(result).code).toBe('VALIDATION_ERROR');
      expect(unwrapErr(result).message).toBe('Invalid input');
    });

    it('should support optional details', () => {
      const error: ResultError = {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: { resourceId: '123' }
      };
      
      const result = Err(error);
      
      expect(unwrapErr(result).details?.resourceId).toBe('123');
    });
  });

  describe('Type inference', () => {
    it('should correctly infer types through map chain', () => {
      const result: Result<number, string> = Ok(5);
      
      const final = map(
        map(result, x => x * 2),
        x => `Value: ${x}`
      );
      
      // If types are correct, this should be string
      if (isOk(final)) {
        const value: string = final.value;
        expect(value).toBe('Value: 10');
      }
    });

    it('should maintain error type through transformations', () => {
      type MyError = { code: string; message: string };
      const result: Result<number, MyError> = Err({ code: 'ERR', message: 'test' });
      
      const mapped = map(result, x => x.toString());
      
      if (isErr(mapped)) {
        const error: MyError = mapped.error;
        expect(error.code).toBe('ERR');
      }
    });
  });
});

