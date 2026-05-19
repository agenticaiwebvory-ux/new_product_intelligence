import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { authService } from '../../services/api'

const USER_STORAGE_KEY = 'tdo_intel_user'

const readSavedUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  try {
    await authService.logout()
  } finally {
    localStorage.removeItem(USER_STORAGE_KEY)
  }
})

const savedUser = readSavedUser()

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
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(action.payload))
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
