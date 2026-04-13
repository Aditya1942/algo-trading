// server/modules/market-data/index.ts — public API

export {
  listInstruments,
  getInstrument,
  getInstrumentByKey,
  addInstrument,
  removeInstrument,
  updateInstrumentStatus,
  updateInstrumentProgress,
  updateInstrumentError,
  insertCandles,
  queryCandles,
  countCandles,
  deleteInstrumentCandles,
  listInstrumentsWithStats,
  getNextActiveInstrument,
} from './db'

export {
  startDownloadWorker,
  stopDownloadWorker,
  isWorkerRunning,
} from './worker'

export type {
  TrackedInstrument,
  CandleRow,
  InstrumentWithStats,
  UpstoxCandleResponse,
} from './types'
