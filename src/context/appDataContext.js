import { createContext, useContext } from 'react'

export const AppDataContext = createContext(null)

// Null on public pages (register, login), so shared components can tell where they are.
export const useAppData = () => useContext(AppDataContext)
