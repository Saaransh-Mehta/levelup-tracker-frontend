import axios from 'axios'

// Servers to try in order, e.g. local backend first, then the Vercel one.
const API_URLS = (import.meta.env.VITE_API_URLS || '/api')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean)

// Index of the server that last answered; requests start there.
let active = 0

const api = axios.create({ timeout: 15000 })

api.interceptors.request.use((config) => {
  config.server ??= active
  config.baseURL = API_URLS[config.server]
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Server unreachable: retry on the next one. A timeout only retries reads, so a slow
    // write that did land is not sent twice.
    const { config } = err
    const timedOut = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT'
    const unreachable =
      config && !err.response && !axios.isCancel(err) && (!timedOut || config.method === 'get')
    if (unreachable && (config.attempts ?? 1) < API_URLS.length) {
      config.attempts = (config.attempts ?? 1) + 1
      config.server = (config.server + 1) % API_URLS.length
      active = config.server
      return api(config)
    }

    // An expired or invalid token on a signed-in request: clear it and go to login.
    const isAuthCall = err.config?.url?.startsWith('/auth/')
    if (err.response?.status === 401 && !isAuthCall && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      window.location.assign('/login')
    }
    return Promise.reject(err)
  },
)

export const getErrorMessage = (err) =>
  err.response?.data?.message || 'Could not reach the server, please try again'

export default api
