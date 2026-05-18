import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiService } from '../../services/api'

export const fetchStoreConnections = createAsyncThunk('stores/fetchConnections', async () => {
  const status = await apiService.checkConnections()
  return Object.fromEntries(Object.entries(status || {}).map(([key, value]) => [key.toLowerCase(), value]))
})

const storesSlice = createSlice({
  name: 'stores',
  initialState: {
    connections: {},
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStoreConnections.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchStoreConnections.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.connections = action.payload
      })
      .addCase(fetchStoreConnections.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message
      })
  },
})

export default storesSlice.reducer
