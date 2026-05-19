export const readJsonStorage = (key, emptyValue = null) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : emptyValue
  } catch {
    localStorage.removeItem(key)
    return emptyValue
  }
}

export const writeJsonStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}
