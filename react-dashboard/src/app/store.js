import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import layoutReducer from '../features/layout/layoutSlice'
import dashboardReducer from '../features/dashboard/dashboardSlice'
import merchandisingReducer from '../features/merchandising/merchandisingSlice'
import productsReducer from '../features/products/productsSlice'
import storesReducer from '../features/stores/storesSlice'
import usersReducer from '../features/users/usersSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    layout: layoutReducer,
    dashboard: dashboardReducer,
    merchandising: merchandisingReducer,
    products: productsReducer,
    stores: storesReducer,
    users: usersReducer,
  },
})
