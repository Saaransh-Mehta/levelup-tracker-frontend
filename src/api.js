import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// An expired or invalid token on a signed-in request: clear it and go to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
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
