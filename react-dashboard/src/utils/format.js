export const formatCompactNumber = (num) => {
  if (num === undefined || num === null) return '0'
  const value = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
  if (Number.isNaN(value)) return '0'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return value.toLocaleString()
}
