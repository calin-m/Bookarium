import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cliProgress = require('./cli-progress');

describe('scripts/lib/cli-progress', () => {
  it('formats durations and ETA suffixes across sub-minute, minute, and multi-hour ranges', () => {
    expect(cliProgress.formatDuration(-1)).toBe('0.0s');
    expect(cliProgress.formatDuration(Number.NaN)).toBe('0.0s');
    expect(cliProgress.formatDuration(12.34)).toBe('12.3s');
    expect(cliProgress.formatDuration(258)).toBe('4m 18s');
    expect(cliProgress.formatDuration(3725)).toBe('1h 02m');

    expect(cliProgress.formatEtaSuffix(0, 100, 10)).toBe('');
    expect(cliProgress.formatEtaSuffix(5, 100, 0.5)).toBe('');
    expect(cliProgress.formatEtaSuffix(100, 100, 50)).toBe('');
    expect(cliProgress.formatEtaSuffix(25, 100, 10)).toBe(' · ETA ~30.0s');
  });

  it('detects interactive TTY vs GitHub Actions / CI environments deterministically', () => {
    const ttyStream = { isTTY: true, write: vi.fn() };
    const nonTtyStream = { isTTY: false, write: vi.fn() };

    expect(cliProgress.isInteractiveTty({ stream: ttyStream, env: {} })).toBe(true);
    expect(
      cliProgress.isInteractiveTty({ stream: ttyStream, env: { GITHUB_ACTIONS: 'true' } })
    ).toBe(false);
    expect(cliProgress.isInteractiveTty({ stream: ttyStream, env: { CI: 'true' } })).toBe(false);
    expect(cliProgress.isInteractiveTty({ stream: ttyStream, env: { CI: 'false' } })).toBe(true);
    expect(cliProgress.isInteractiveTty({ stream: nonTtyStream, env: {} })).toBe(false);
    expect(
      cliProgress.isInteractiveTty({ logger: { log: vi.fn() }, env: {} })
    ).toBe(false);
  });

  it('overwrites padded \\r lines cleanly in interactive TTY mode and clears ahead of logEvent and finish', () => {
    let now = 1_000;
    const stream = { isTTY: true, write: vi.fn() };
    const logger = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
    const reporter = cliProgress.createCliProgressReporter({
      stream,
      logger,
      env: {},
      nowFn: () => now,
      ttyThrottleMs: 250,
    });

    expect(reporter.interactive).toBe(true);

    reporter.update(1, 'Scanning long progress string [20.0%]');
    expect(stream.write).toHaveBeenCalledTimes(1);
    expect(stream.write.mock.calls[0][0]).toBe('\r  ↳ Scanning long progress string [20.0%]');

    // Within 250ms throttle window -> skipped unless forced
    now += 100;
    reporter.update(2, 'Skipped intermediate');
    expect(stream.write).toHaveBeenCalledTimes(1);

    // Shorter update pads trailing spaces to erase previous longer line
    now += 200;
    reporter.update(3, 'Short [60%]');
    expect(stream.write).toHaveBeenCalledTimes(2);
    const secondWrite = stream.write.mock.calls[1][0];
    expect(secondWrite.startsWith('\r  ↳ Short [60%]')).toBe(true);
    expect(secondWrite.length).toBe('\r  ↳ Scanning long progress string [20.0%]'.length);

    // logEvent clears active TTY line before printing alert cleanly
    reporter.logEvent('  🚨 [MATCH] #1342', 'log');
    reporter.logEvent('  ⚠ [WARN] check', 'warn');
    reporter.logEvent('  ✖ [ERR] timeout', 'error');
    expect(stream.write.mock.calls[2][0]).toMatch(/^\r +\r$/);
    expect(logger.log).toHaveBeenCalledWith('  🚨 [MATCH] #1342');
    expect(logger.warn).toHaveBeenCalledWith('  ⚠ [WARN] check');
    expect(logger.error).toHaveBeenCalledWith('  ✖ [ERR] timeout');

    // Redraws after logEvent and ends cleanly on finish
    now += 300;
    reporter.update(5, 'Done');
    reporter.finish('  ✔ Complete');
    expect(stream.write.mock.calls[4][0]).toMatch(/^\r +\r$/);
    expect(logger.log).toHaveBeenCalledWith('  ✔ Complete');

    // finish() without finalText emits a clean newline when an active TTY line is open
    now += 300;
    reporter.update(6, 'Trailing line');
    reporter.finish();
    expect(stream.write.mock.calls[6][0]).toBe('\n');
  });

  it('emits throttled newline heartbeats in CI / non-TTY mode without raw \\r and stays silent when disabled', () => {
    let now = 5_000;
    const stream = { isTTY: true, write: vi.fn() };
    const logger = { log: vi.fn(), error: vi.fn() };
    const ciReporter = cliProgress.createCliProgressReporter({
      total: 100,
      stream,
      logger,
      env: { GITHUB_ACTIONS: 'true' },
      nowFn: () => now,
      ciIntervalMs: 10_000,
      ciPercentStep: 25,
      ciMinTotalForPercent: 10,
    });

    expect(ciReporter.interactive).toBe(false);

    // Before interval & before 25% step -> muted
    now += 1_000;
    ciReporter.update(10, '10% progress');
    expect(logger.log).not.toHaveBeenCalled();

    // Crosses 25% step boundary -> emits clean newline log (zero \r stream writes)
    now += 500;
    ciReporter.update(25, '25% milestone');
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenLastCalledWith('  ↳ 25% milestone');

    // Same bucket within interval -> muted; once 10s interval elapses -> emits heartbeat
    now += 500;
    ciReporter.update(30, '30% muted');
    expect(logger.log).toHaveBeenCalledTimes(1);
    now += 10_000;
    ciReporter.update(40, '40% interval tick');
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenLastCalledWith('  ↳ 40% interval tick');
    expect(stream.write).not.toHaveBeenCalled();

    // Disabled (--json) reporter stays 100% silent
    const quietLogger = { log: vi.fn() };
    const quietReporter = cliProgress.createCliProgressReporter({
      enabled: false,
      logger: quietLogger,
      stream,
    });
    quietReporter.update(50, 'should not log', { force: true });
    quietReporter.logEvent('should not log event');
    quietReporter.finish('should not log finish');
    expect(quietLogger.log).not.toHaveBeenCalled();
  });
});
