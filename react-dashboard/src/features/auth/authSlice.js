import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { authService } from '../../services/api'
import { readJsonStorage, writeJsonStorage } from '../../utils/storage'

const USER_STORAGE_KEY = 'tdo_intel_user'

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  try {
    await authService.logout()
  } finally {
    localStorage.removeItem(USER_STORAGE_KEY)
  }
})

const savedUser = readJsonStorage(USER_STORAGE_KEY)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: savedUser,
    isLoggedIn: Boolean(savedUser),
    status: 'idle',
  },
  reducers: {
    loginSucceeded(state, action) {
      state.user = action.payload
      state.isLoggedIn = true
      writeJsonStorage(USER_STORAGE_KEY, action.payload)
    },
    sessionCleared(state) {
      state.user = null
      state.isLoggedIn = false
      localStorage.removeItem(USER_STORAGE_KEY)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logoutUser.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'idle'
        state.user = null
        state.isLoggedIn = false
      })
      .addCase(logoutUser.rejected, (state) => {
        state.status = 'idle'
        state.user = null
        state.isLoggedIn = false
      })
  },
})

export const { loginSucceeded, sessionCleared } = authSlice.actions
export default authSlice.reducer
