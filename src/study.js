export const STUDY_ICONS = ['📚', '🧠', '🧪', '🧮', '💻', '🌍', '📐', '🔬', '📝', '🎓', '⚛️', '🧬', '📈', '🗣️', '🎼', '⚙️']

export const thumbnailUrl = (video) => `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`

// The privacy-enhanced player: YouTube sets no cookies until the video is played.
// enablejsapi lets the page read the playing time and seek, for timestamped notes.
export const embedUrl = (video, { autoplay = false } = {}) => {
  const params = new URLSearchParams({
    rel: '0', modestbranding: '1', playsinline: '1', enablejsapi: '1', origin: window.location.origin,
  })
  if (video.start) params.set('start', String(video.start))
  if (autoplay) params.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${video.videoId}?${params}`
}

let apiLoading = null

// Loads YouTube's IFrame API once, for controlling embedded players.
export const loadYouTubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiLoading ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      apiLoading = null
      reject(new Error('YouTube API unavailable'))
    }
    document.head.appendChild(script)
  })
  return apiLoading
}

export const watchUrl = (video) =>
  `https://www.youtube.com/watch?v=${video.videoId}${video.start ? `&t=${video.start}s` : ''}`
