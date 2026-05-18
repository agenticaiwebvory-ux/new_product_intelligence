import { createSlice } from '@reduxjs/toolkit'

const productsSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    totalCount: 0,
    status: 'idle',
    error: null,
  },
  reducers: {
    setProducts(state, action) {
      state.items = action.payload.items || []
      state.totalCount = action.payload.totalCount || state.items.length
    },
  },
})

export const { setProducts } = productsSlice.actions
export default productsSlice.reducer
