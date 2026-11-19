/**
 * @module scripts/lib/cli-progress
 * @scope Zero-dependency TTY- and CI-aware CLI progress telemetry utility rendering single-line `\r` overwrites in interactive terminals, throttled `\n` heartbeat checkpoints (`ciIntervalMs` / `ciPercentStep`) in GitHub Actions or non-TTY runners, and atomic event alerts across ingestion and scanning pipelines.
 * @invariant Keep stdout cleanly silent when `enabled === false` (`--json` mode), never emit raw `\r` overwrites when `GITHUB_ACTIONS` / `CI` is set or stdout is non-TTY, break/clear active `\r` lines atomically ahead of `logEvent()` alerts and `finish()`, and maintain zero third-party dependencies so zero-`npm ci` workflows (`r2-content-scan.yml`) execute cleanly.
 * @rationale GitHub Actions live log viewers buffer `\r` overwrites and strip cursor-control sequences, whereas naive per-item `console.log()` lines flood logs across 78,000+ book scans. Routing progress updates through a shared throttled reporter delivers real-time visibility in CI, crisp single-line tickers locally, and live match/anomaly alerts without drowning logs.
 * @adr ADR-085
 */

const DEFAULT_TTY_THROTTLE_MS = 250;
const DEFAULT_CI_INTERVAL_MS = 10_000;
const DEFAULT_CI_PERCENT_STEP = 10;
const DEFAULT_CI_MIN_TOTAL_FOR_PERCENT = 25;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0.0s';
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${minutes}m ${String(secs).padStart(2, '0')}s`;
}

function formatEtaSuffix(completed, total, elapsedSeconds) {
  if (
    !Number.isFinite(completed) ||
    !Number.isFinite(total) ||
    !Number.isFinite(elapsedSeconds) ||
    completed <= 0 ||
    total <= 0 ||
    completed >= total ||
    elapsedSeconds < 1
  ) {
    return '';
  }
  const rate = completed / elapsedSeconds;
  if (rate <= 0) {
    return '';
  }
  const remainingSeconds = (total - completed) / rate;
  return ` · ETA ~${formatDuration(remainingSeconds)}`;
}

function isInteractiveTty(options = {}) {
  const env = options.env || process.env;
  const isCiEnv =
    String(env.GITHUB_ACTIONS || '').toLowerCase() === 'true' ||
    (Boolean(env.CI) &&
      String(env.CI).toLowerCase() !== 'false' &&
      String(env.CI) !== '0');
  if (isCiEnv) {
    return false;
  }

  const logger = options.logger || console;
  const hasExplicitStream = Boolean(options.stream);
  if (logger !== console && !hasExplicitStream && typeof options.isTTY !== 'boolean') {
    return false;
  }

  const stream = options.stream || process.stdout;
  const canWrite = Boolean(stream && typeof stream.write === 'function');
  if (!canWrite) {
    return false;
  }

  if (typeof options.isTTY === 'boolean') {
    return options.isTTY;
  }
  return Boolean(stream.isTTY);
}

function createCliProgressReporter(options = {}) {
  const enabled = options.enabled !== false;
  if (!enabled) {
    return {
      interactive: false,
      update() {},
      logEvent() {},
      finish() {},
    };
  }

  const nowFn = typeof options.nowFn === 'function' ? options.nowFn : Date.now;
  const env = options.env || process.env;
  const logger = options.logger || console;
  const stream = options.stream || process.stdout;
  const interactive = isInteractiveTty({
    stream,
    isTTY: options.isTTY,
    env,
    logger,
  });

  const total =
    typeof options.total === 'number' && Number.isFinite(options.total) && options.total > 0
      ? options.total
      : null;
  const ttyThrottleMs =
    typeof options.ttyThrottleMs === 'number' && options.ttyThrottleMs >= 0
      ? options.ttyThrottleMs
      : DEFAULT_TTY_THROTTLE_MS;
  const ciIntervalMs =
    typeof options.ciIntervalMs === 'number' && options.ciIntervalMs >= 0
      ? options.ciIntervalMs
      : DEFAULT_CI_INTERVAL_MS;
  const ciPercentStep =
    typeof options.ciPercentStep === 'number' && options.ciPercentStep > 0
      ? options.ciPercentStep
      : DEFAULT_CI_PERCENT_STEP;
  const ciMinTotalForPercent =
    typeof options.ciMinTotalForPercent === 'number' && options.ciMinTotalForPercent >= 1
      ? options.ciMinTotalForPercent
      : DEFAULT_CI_MIN_TOTAL_FOR_PERCENT;

  const startMs = nowFn();
  let lastTtyEmitMs = -Infinity;
  let lastCiEmitMs = startMs;
  let lastCiPctBucket = 0;
  let hasActiveTtyLine = false;
  let maxTtyLineWidth = 0;

  const clearActiveTtyLine = () => {
    if (!interactive || !hasActiveTtyLine) return;
    if (stream && typeof stream.write === 'function') {
      const clearWidth = Math.max(0, maxTtyLineWidth);
      stream.write(`\r${' '.repeat(clearWidth)}\r`);
    }
    hasActiveTtyLine = false;
    maxTtyLineWidth = 0;
  };

  const update = (completed, text, updateOptions = {}) => {
    const cleanText = String(text || '').trim();
    if (!cleanText) return;

    const now = nowFn();
    const force = Boolean(updateOptions.force);

    if (interactive) {
      if (!force && now - lastTtyEmitMs < ttyThrottleMs) {
        return;
      }
      lastTtyEmitMs = now;
      const line = `  ↳ ${cleanText}`;
      const padding =
        maxTtyLineWidth > line.length ? ' '.repeat(maxTtyLineWidth - line.length) : '';
      maxTtyLineWidth = Math.max(maxTtyLineWidth, line.length);
      stream.write(`\r${line}${padding}`);
      hasActiveTtyLine = true;
      return;
    }

    let shouldEmitCi = force;
    if (!shouldEmitCi && now - lastCiEmitMs >= ciIntervalMs) {
      shouldEmitCi = true;
    }
    if (
      !shouldEmitCi &&
      total !== null &&
      total >= ciMinTotalForPercent &&
      typeof completed === 'number' &&
      completed > 0
    ) {
      const pct = Math.min(100, (completed / total) * 100);
      const bucket = Math.floor(pct / ciPercentStep);
      if (bucket > lastCiPctBucket) {
        lastCiPctBucket = bucket;
        shouldEmitCi = true;
      }
    }

    if (shouldEmitCi) {
      lastCiEmitMs = now;
      if (total !== null && typeof completed === 'number' && completed > 0) {
        const pct = Math.min(100, (completed / total) * 100);
        const bucket = Math.floor(pct / ciPercentStep);
        if (bucket > lastCiPctBucket) {
          lastCiPctBucket = bucket;
        }
      }
      if (logger && typeof logger.log === 'function') {
        logger.log(`  ↳ ${cleanText}`);
      }
    }
  };

  const logEvent = (line, level = 'log') => {
    const msg = String(line || '');
    if (!msg) return;
    clearActiveTtyLine();
    const sink =
      level === 'error' && logger && typeof logger.error === 'function'
        ? logger.error.bind(logger)
        : level === 'warn' && logger && typeof logger.warn === 'function'
          ? logger.warn.bind(logger)
          : logger && typeof logger.log === 'function'
            ? logger.log.bind(logger)
            : null;
    if (sink) {
      sink(msg);
    }
  };

  const finish = (finalText) => {
    if (interactive && hasActiveTtyLine) {
      if (finalText) {
        clearActiveTtyLine();
      } else if (stream && typeof stream.write === 'function') {
        stream.write('\n');
        hasActiveTtyLine = false;
        maxTtyLineWidth = 0;
        return;
      }
    }
    if (finalText && logger && typeof logger.log === 'function') {
      logger.log(String(finalText));
    }
  };

  return {
    interactive,
    update,
    logEvent,
    finish,
  };
}

module.exports = {
  DEFAULT_TTY_THROTTLE_MS,
  DEFAULT_CI_INTERVAL_MS,
  DEFAULT_CI_PERCENT_STEP,
  DEFAULT_CI_MIN_TOTAL_FOR_PERCENT,
  formatDuration,
  formatEtaSuffix,
  isInteractiveTty,
  createCliProgressReporter,
};
