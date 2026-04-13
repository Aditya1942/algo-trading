import { createSlice } from '@reduxjs/toolkit'

/** Placeholder for future global UI state (no duplicate server cache). */
const uiSlice = createSlice({
  name: 'ui',
  initialState: {},
  reducers: {},
})

export const uiReducer = uiSlice.reducer
