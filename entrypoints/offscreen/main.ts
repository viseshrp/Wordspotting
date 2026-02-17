import type { HighlightMatch } from '../shared/core/scanner';
import { getErrorMessage, logExtensionError } from '../shared/utils';

const DEFAULT_CHUNK_SIZE = 150000;
const DEFAULT_OVERLAP = 200;
const WORKER_REQUEST_TIMEOUT_MS = 5000;

type WorkerResult = string[] | Record<number, HighlightMatch[]>;
type ScanTextRequest = {
  target: 'offscreen';
  subject: 'scan_text_request';
  keywords: string[];
  text: string;
  chunkSize: number;
  overlap: number;
};
type ScanHighlightsRequest = {
  target: 'offscreen';
  subject: 'scan_highlights_request';
  keywords: string[];
  chunks: Array<{ id: number; text: string }>;
};
type ReadyCheckRequest = { target: 'offscreen'; subject: 'ready_check' };
type OffscreenRequest = ScanTextRequest | ScanHighlightsRequest | ReadyCheckRequest;

let scanWorker: Worker | null = null;
let scanRequestId = 0;

const workerRequests = new Map<number, {
  resolve: (value: WorkerResult | PromiseLike<WorkerResult>) => void;
  reject: (reason?: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}>();

function isScanTextRequest(request: unknown): request is ScanTextRequest {
  if (!request || typeof request !== 'object') return false;
  const typed = request as Partial<ScanTextRequest>;
  return typed.target === 'offscreen' &&
    typed.subject === 'scan_text_request' &&
    Array.isArray(typed.keywords) &&
    typeof typed.text === 'string' &&
    typeof typed.chunkSize === 'number' &&
    typeof typed.overlap === 'number';
}

function isScanHighlightsRequest(request: unknown): request is ScanHighlightsRequest {
  if (!request || typeof request !== 'object') return false;
  const typed = request as Partial<ScanHighlightsRequest>;
  return typed.target === 'offscreen' &&
    typed.subject === 'scan_highlights_request' &&
    Array.isArray(typed.keywords) &&
    Array.isArray(typed.chunks);
}

function isReadyCheckRequest(request: unknown): request is ReadyCheckRequest {
  if (!request || typeof request !== 'object') return false;
  const typed = request as Partial<ReadyCheckRequest>;
  return typed.target === 'offscreen' && typed.subject === 'ready_check';
}

function setupWorkerListeners(worker: Worker) {
  worker.addEventListener('message', handleWorkerMessage);
  worker.addEventListener('error', (error) => {
    logExtensionError('Offscreen worker error', error, { operation: 'runtime_context' });
    cleanupWorker();
  });
}

function handleWorkerMessage(event: MessageEvent) {
  const data = event.data || {};
  if (typeof data.id !== 'number') return;
  const pending = workerRequests.get(data.id);
  if (!pending) return;
  workerRequests.delete(data.id);
  clearTimeout(pending.timeoutHandle);

  if (data.type === 'scan_result') {
    pending.resolve(Array.isArray(data.words) ? data.words : []);
  } else if (data.type === 'scan_highlights_result') {
    pending.resolve(data.results || {});
  } else if (data.type === 'scan_error') {
    pending.reject(new Error(data.error || 'Worker scan failed'));
  }
}

function cleanupWorker() {
  if (scanWorker) {
    scanWorker.terminate();
    scanWorker = null;
  }

  workerRequests.forEach((pending) => {
    clearTimeout(pending.timeoutHandle);
    pending.reject(new Error('Worker terminated'));
  });
  workerRequests.clear();
}

function registerWorkerRequest<T extends WorkerResult>(
  id: number,
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason?: Error) => void
) {
  const timeoutHandle = setTimeout(() => {
    const pending = workerRequests.get(id);
    if (!pending) return;
    workerRequests.delete(id);
    clearTimeout(pending.timeoutHandle);
    const timeoutError = new Error('Worker scan timed out');
    logExtensionError('Offscreen worker request timed out', timeoutError, { operation: 'runtime_context' });
    pending.reject(timeoutError);
    cleanupWorker();
  }, WORKER_REQUEST_TIMEOUT_MS);

  workerRequests.set(id, {
    resolve: resolve as (value: WorkerResult | PromiseLike<WorkerResult>) => void,
    reject,
    timeoutHandle
  });
}

function getScanWorkerAsync() {
  if (scanWorker) return scanWorker;

  try {
    scanWorker = new Worker(browser.runtime.getURL('scan-worker.js'));
    setupWorkerListeners(scanWorker);
    return scanWorker;
  } catch (error) {
    logExtensionError('Failed to create offscreen worker', error, { operation: 'runtime_context' });
    return null;
  }
}

function getSafeChunkSize(chunkSize: unknown) {
  if (typeof chunkSize === 'number' && Number.isFinite(chunkSize) && chunkSize > 0) {
    return chunkSize;
  }
  return DEFAULT_CHUNK_SIZE;
}

function getSafeOverlap(overlap: unknown) {
  if (typeof overlap === 'number' && Number.isFinite(overlap) && overlap >= 0) {
    return overlap;
  }
  return DEFAULT_OVERLAP;
}

async function scanTextUsingWorker(request: ScanTextRequest) {
  const worker = getScanWorkerAsync();
  if (!worker) {
    throw new Error('Offscreen scan worker unavailable');
  }

  return await new Promise<string[]>((resolve, reject) => {
    const id = ++scanRequestId;
    registerWorkerRequest<string[]>(id, resolve, reject);
    worker.postMessage({
      type: 'scan',
      id,
      keywords: request.keywords,
      text: request.text,
      chunkSize: getSafeChunkSize(request.chunkSize),
      overlap: getSafeOverlap(request.overlap)
    });
  });
}

async function scanHighlightsUsingWorker(request: ScanHighlightsRequest) {
  const worker = getScanWorkerAsync();
  if (!worker) {
    throw new Error('Offscreen scan worker unavailable');
  }

  return await new Promise<Record<number, HighlightMatch[]>>((resolve, reject) => {
    const id = ++scanRequestId;
    registerWorkerRequest<Record<number, HighlightMatch[]>>(id, resolve, reject);
    worker.postMessage({
      type: 'scan_for_highlights',
      id,
      keywords: request.keywords,
      chunks: request.chunks
    });
  });
}

if (typeof browser !== 'undefined' && browser.runtime?.onMessage) {
  browser.runtime.onMessage.addListener((request: OffscreenRequest, _sender, sendResponse) => {
    if (isReadyCheckRequest(request)) {
      sendResponse({ ready: true });
      return false;
    }

    if (!isScanTextRequest(request) && !isScanHighlightsRequest(request)) {
      return false;
    }

    (async () => {
      try {
        if (isScanTextRequest(request)) {
          const words = await scanTextUsingWorker(request);
          sendResponse({ words });
          return;
        }

        const results = await scanHighlightsUsingWorker(request);
        sendResponse({ results });
      } catch (error) {
        logExtensionError('Offscreen scan request failed', error, { operation: 'runtime_context' });
        sendResponse({ error: getErrorMessage(error) });
      }
    })();

    return true;
  });

  // Notify background after listener registration to establish readiness gate.
  void browser.runtime.sendMessage({ from: 'offscreen', subject: 'ready' }).catch(() => undefined);
}
