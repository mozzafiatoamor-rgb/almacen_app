import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'

import { AuthProvider, useAuth } from './auth/AuthContext'
import { ToastProvider }         from './hooks/useToast'

import SetupScreen  from './auth/SetupScreen'
import LoginScreen  from './auth/LoginScreen'

import StatusBar    from './components/layout/StatusBar'
import BottomNav    from './components/layout/BottomNav'
import Modal        from './components/layout/Modal'
import ToastContainer  from './components/shared/Toast'
import LoadingOverlay  from './components/shared/LoadingOverlay'

import MovimientoForm from './components/forms/MovimientoForm'
import MermaForm      from './components/forms/MermaForm'

import HomePage      from './pages/HomePage'
import MovimientosPage from './pages/MovimientosPage'
import InventarioPage  from './pages/InventarioPage'
import ComprasPage      from './pages/ComprasPage'
import PedidosPage      from './pages/PedidosPage'
import MermasPage       from './pages/MermasPage'
import CatalogoPage     from './pages/CatalogoPage'
import BitacoraPage     from './pages/BitacoraPage'
import ReportesPage     from './pages/ReportesPage'
import GastosPage       from './pages/GastosPage'
import UsuariosPage     from './pages/UsuariosPage'
import ProveedoresPage  from './pages/ProveedoresPage'

import { useCatalogo, useMovimientos, useMermas } from './hooks/useSheets'
import { getConfig, isConfigured, saveConfig } from './api/config'
import { useTabHistory } from './hooks/useTabHistory'

import type { Tab, ModalType } from './api/types'
import { useAuth as useAuthHook } from './auth/AuthContext'
import { useToast } from './hooks/useToast'
import { useInvalidate } from './hooks/useSheets'

// ─── React Query client ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
})

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <LoadingOverlay />
          <ToastContainer />
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

// ─── Shell: decides which screen to show ──────────────────────────────────────

function AppShell() {
  const { user }  = useAuth()
  const cfg       = getConfig()
  const configured = isConfigured(cfg)

  if (!configured) {
    return <SetupScreen onDone={() => window.location.reload()} />
  }

  if (!user) {
    return <LoginScreen />
  }

  return <MainApp />
}

// ─── Main app (authenticated) ─────────────────────────────────────────────────

function MainApp() {
  const { logout, user } = useAuthHook()
  const toast            = useToast()
  const invalidate       = useInvalidate()

  const { tab, navigate: setTab } = useTabHistory('home')
  const [modal,     setModal]     = useState<ModalType>(null)

  const { data: catalogo    = [] } = useCatalogo()
  const { data: movimientos = [] } = useMovimientos()
  const { data: mermas      = [] } = useMermas()

  function openModal(t: ModalType) { setModal(t) }
  function closeModal()            { setModal(null) }

  function switchTab(t: Tab) { setTab(t) }

  const pageVariants = {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0  },
    exit:    { opacity: 0, x: -10 },
  }

  const rolLabel =
    user?.rol === 'admin'      ? '🔑 Administrador' :
    user?.rol === 'encargado'  ? '👨‍🍳 Encargado'   :
    user?.rol === 'barista'    ? '🍸 Barista'        :
    user?.rol === 'cocinero'   ? '🍳 Cocinero'       :
                                 '📦 Almacenista'

  return (
    <div className="min-h-screen bg-bg text-text1 font-sans">
      <StatusBar
        onOpenUserMenu={() => openModal('userMenu')}
        onOpenSettings={() => openModal('settings')}
      />

      <main className="overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            variants={pageVariants}
            initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.18 }}
          >
            {tab === 'home'        && <HomePage      onOpenModal={openModal as (t: 'entrada'|'salida'|'merma') => void} onSwitch={switchTab} />}
            {tab === 'movimientos' && <MovimientosPage onOpenEntrada={() => openModal('entrada')} onOpenSalida={() => openModal('salida')} />}
            {tab === 'inventario'  && <InventarioPage />}
            {tab === 'compras'     && <ComprasPage />}
            {tab === 'pedidos'     && <PedidosPage />}
            {tab === 'mermas'      && <MermasPage onOpenMerma={() => openModal('merma')} />}
            {tab === 'catalogo'    && <CatalogoPage />}
            {tab === 'bitacora'    && <BitacoraPage />}
            {tab === 'reportes'    && <ReportesPage />}
            {tab === 'gastos'      && <GastosPage />}
            {tab === 'usuarios'    && <UsuariosPage />}
            {tab === 'proveedores' && <ProveedoresPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={tab} onSwitch={switchTab} />

      {/* ── Movimiento Modal (Entrada) ─────────────────────────── */}
      <Modal open={modal === 'entrada'} onClose={closeModal}>
        <MovimientoForm
          tipo="Entrada"
          catalogo={catalogo}
          movimientos={movimientos}
          onClose={closeModal}
        />
      </Modal>

      {/* ── Movimiento Modal (Salida) ──────────────────────────── */}
      <Modal open={modal === 'salida'} onClose={closeModal}>
        <MovimientoForm
          tipo="Salida"
          catalogo={catalogo}
          movimientos={movimientos}
          onClose={closeModal}
        />
      </Modal>

      {/* ── Merma Modal ───────────────────────────────────────── */}
      <Modal open={modal === 'merma'} onClose={closeModal}>
        <MermaForm catalogo={catalogo} mermas={mermas} onClose={closeModal} />
      </Modal>

      {/* ── Settings Modal ────────────────────────────────────── */}
      <Modal open={modal === 'settings'} onClose={closeModal} title="⚙️ Configuración">
        <SettingsForm onClose={closeModal} />
      </Modal>

      {/* ── User Menu Modal ───────────────────────────────────── */}
      <Modal open={modal === 'userMenu'} onClose={closeModal}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center font-bold text-white text-2xl mx-auto mb-3">
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="text-base font-bold text-text1 mb-0.5">{user?.nombre}</div>
          <div className="text-xs text-text2 mb-1">@{user?.usuario}</div>
          <div className="text-xs text-accent mb-5">{rolLabel}</div>
          <button onClick={closeModal} className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card mb-2">
            Cerrar
          </button>
          <button
            onClick={() => { logout(); closeModal() }}
            className="w-full bg-red text-white font-semibold py-3 rounded-card"
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Settings Form ─────────────────────────────────────────────────────────────

function SettingsForm({ onClose }: { onClose: () => void }) {
  const toast    = useToast()
  const cfg      = getConfig()
  const invalidate = useInvalidate()

  const [sheetId,   setSheetId]   = useState(cfg.sheetId)
  const [apiKey,    setApiKey]    = useState(cfg.apiKey)
  const [scriptUrl, setScriptUrl] = useState(cfg.scriptUrl)

  function save() {
    saveConfig({ sheetId, apiKey, scriptUrl })
    toast('Configuración guardada')
    invalidate.all()
    onClose()
  }

  const inp = 'w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent font-mono'

  return (
    <div>
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Sheet ID</label>
        <input value={sheetId} onChange={e => setSheetId(e.target.value)} className={inp} autoCapitalize="off" />
      </div>
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">API Key</label>
        <input value={apiKey} onChange={e => setApiKey(e.target.value)} className={inp} autoCapitalize="off" />
      </div>
      <div className="mb-5">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Apps Script URL</label>
        <input value={scriptUrl} onChange={e => setScriptUrl(e.target.value)} className={inp} autoCapitalize="off" />
      </div>
      <button onClick={save} className="w-full bg-accent text-white font-semibold py-3 rounded-card mb-2">
        💾 Guardar
      </button>
      <button onClick={onClose} className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card">
        Cerrar
      </button>
    </div>
  )
}
