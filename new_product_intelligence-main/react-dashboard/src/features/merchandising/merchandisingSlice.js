import { createSlice } from '@reduxjs/toolkit'

const merchandisingSlice = createSlice({
  name: 'merchandising',
  initialState: {
    items: [],
    stats: null,
    totalCount: 0,
    status: 'idle',
    error: null,
    filters: {
      search: '',
      vendor: 'TDO_MERCH',
      store: 'ALL',
      page: 1,
      sort: 'newest',
      timeframe: '90',
    },
  },
  reducers: {
    setMerchandisingData(state, action) {
      state.items = action.payload.items || []
      state.totalCount = action.payload.totalCount || 0
      state.stats = action.payload.stats || state.stats
    },
    setMerchandisingFilter(state, action) {
      state.filters = { ...state.filters, ...action.payload }
    },
  },
})

export const { setMerchandisingData, setMerchandisingFilter } = merchandisingSlice.actions
export default merchandisingSlice.reducer
