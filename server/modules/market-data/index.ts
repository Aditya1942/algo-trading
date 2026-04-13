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
  queryCandlesAggregated,
  countCandles,
  deleteInstrumentCandles,
  listInstrumentsWithStats,
  getNextActiveInstrument,
  listTrackedInstrumentKeys,
  upsertInstruments,
  searchStoredInstruments,
  countStoredInstruments,
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
  StoredInstrument,
  StoredInstrumentsPage,
} from './types'
