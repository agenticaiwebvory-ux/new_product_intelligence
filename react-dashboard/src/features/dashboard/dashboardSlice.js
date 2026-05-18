import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiService } from '../../services/api'

export const fetchDashboardStats = createAsyncThunk('dashboard/fetchStats', async () => {
  return apiService.getDashboardStats()
})

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    stats: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearDashboardStats(state) {
      state.stats = null
      state.status = 'idle'
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.stats = action.payload
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
  },
})

export const { clearDashboardStats } = dashboardSlice.actions
export default dashboardSlice.reducer
