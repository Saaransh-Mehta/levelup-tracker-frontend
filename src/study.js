export const STUDY_ICONS = ['📚', '🧠', '🧪', '🧮', '💻', '🌍', '📐', '🔬', '📝', '🎓', '⚛️', '🧬', '📈', '🗣️', '🎼', '⚙️']

export const thumbnailUrl = (video) => `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`

// The privacy-enhanced player: YouTube sets no cookies until the video is played.
export const embedUrl = (video, { autoplay = false } = {}) => {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
  if (video.start) params.set('start', String(video.start))
  if (autoplay) params.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${video.videoId}?${params}`
}

export const watchUrl = (video) =>
  `https://www.youtube.com/watch?v=${video.videoId}${video.start ? `&t=${video.start}s` : ''}`
