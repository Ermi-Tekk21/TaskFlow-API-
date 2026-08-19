import {
  AuthThrottle,
  BurstThrottle,
  SkipThrottleAll,
  SkipAuthThrottle,
} from './throttle.decorator';

describe('Throttle Decorators', () => {
  it('AuthThrottle should set THROTTLER:LIMITauth and THROTTLER:TTLauth metadata', () => {
    class TestClass {
      @AuthThrottle(5, 60000, 60000)
      testMethod() {}
    }

    const target = TestClass.prototype.testMethod;
    const limit = Reflect.getMetadata('THROTTLER:LIMITauth', target);
    const ttl = Reflect.getMetadata('THROTTLER:TTLauth', target);
    const blockDuration = Reflect.getMetadata(
      'THROTTLER:BLOCK_DURATIONauth',
      target,
    );

    expect(limit).toBe(5);
    expect(ttl).toBe(60000);
    expect(blockDuration).toBe(60000);
  });

  it('BurstThrottle should set THROTTLER:LIMITshort and THROTTLER:TTLshort metadata', () => {
    class TestClass {
      @BurstThrottle(10, 10000)
      testMethod() {}
    }

    const target = TestClass.prototype.testMethod;
    const limit = Reflect.getMetadata('THROTTLER:LIMITshort', target);
    const ttl = Reflect.getMetadata('THROTTLER:TTLshort', target);

    expect(limit).toBe(10);
    expect(ttl).toBe(10000);
  });

  it('SkipThrottleAll should set skip metadata for all throttlers', () => {
    class TestClass {
      @SkipThrottleAll()
      testMethod() {}
    }

    const target = TestClass.prototype.testMethod;
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', target)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:SKIPshort', target)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:SKIPauth', target)).toBe(true);
  });

  it('SkipAuthThrottle should set skip metadata for auth throttler only', () => {
    class TestClass {
      @SkipAuthThrottle()
      testMethod() {}
    }

    const target = TestClass.prototype.testMethod;
    expect(Reflect.getMetadata('THROTTLER:SKIPauth', target)).toBe(true);
    expect(
      Reflect.getMetadata('THROTTLER:SKIPdefault', target),
    ).toBeUndefined();
  });
});
