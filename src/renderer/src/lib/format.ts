export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatCount(count: number): string {
  return count.toLocaleString('en-US')
}
