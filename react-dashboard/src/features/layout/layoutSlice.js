import { createSlice } from '@reduxjs/toolkit'
import { readJsonStorage, writeJsonStorage } from '../../utils/storage'

const LINKS_STORAGE_KEY = 'tdo_sidebar_links'

const persistLinks = (links) => {
  if (links.length > 0) {
    writeJsonStorage(LINKS_STORAGE_KEY, links)
  } else {
    localStorage.removeItem(LINKS_STORAGE_KEY)
  }
}

const layoutSlice = createSlice({
  name: 'layout',
  initialState: {
    activeView: 'merchandise',
    isSidebarCollapsed: false,
    sidebarLinks: readJsonStorage(LINKS_STORAGE_KEY, []),
  },
  reducers: {
    setActiveView(state, action) {
      state.activeView = action.payload
    },
    setSidebarCollapsed(state, action) {
      state.isSidebarCollapsed = action.payload
    },
    setSidebarLinks(state, action) {
      state.sidebarLinks = action.payload
      persistLinks(state.sidebarLinks)
    },
    addSidebarLink(state, action) {
      state.sidebarLinks.push(action.payload)
      persistLinks(state.sidebarLinks)
    },
    removeSidebarLink(state, action) {
      state.sidebarLinks = state.sidebarLinks.filter((_, index) => index !== action.payload)
      persistLinks(state.sidebarLinks)
    },
  },
})

export const {
  addSidebarLink,
  removeSidebarLink,
  setActiveView,
  setSidebarCollapsed,
  setSidebarLinks,
} = layoutSlice.actions

export default layoutSlice.reducer
