import { useState } from 'react'
import { saveConfig, getConfig } from '../api/config'
import type { AppConfig } from '../api/types'

interface Props {
  onDone: () => void
}

export default function SetupScreen({ onDone }: Props) {
  const existing = getConfig()
  const [step, setStep]         = useState(1)
  const [sheetId, setSheetId]   = useState(existing.sheetId)
  const [apiKey, setApiKey]     = useState(existing.apiKey)
  const [scriptUrl, setScript]  = useState(existing.scriptUrl)

  function save() {
    const cfg: AppConfig = { sheetId, apiKey, scriptUrl }
    saveConfig(cfg)
    onDone()
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-10">
      <img
        src="/logo.png"
        alt="Mozzafiato"
        className="w-20 h-20 rounded-2xl mb-5 object-contain"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <h1 className="text-xl font-bold text-text1 mb-1">Almacén Mozzafiato</h1>

      {step === 1 && (
        <StepCard
          title="Paso 1 de 3 — Sheet ID"
          desc="ID del Google Sheet (en la URL del spreadsheet)"
          value={sheetId}
          onChange={setSheetId}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepCard
          title="Paso 2 de 3 — API Key"
          desc="Google Cloud API Key con permisos a Sheets API v4"
          value={apiKey}
          onChange={setApiKey}
          placeholder="AIzaSy..."
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepCard
          title="Paso 3 de 3 — Apps Script URL"
          desc="URL del Web App publicado desde Google Apps Script"
          value={scriptUrl}
          onChange={setScript}
          placeholder="https://script.google.com/macros/s/.../exec"
          onBack={() => setStep(2)}
          onNext={save}
          nextLabel="✅ Conectar"
        />
      )}
    </div>
  )
}

interface StepCardProps {
  title:      string
  desc:       string
  value:      string
  onChange:   (v: string) => void
  placeholder: string
  onNext:     () => void
  onBack?:    () => void
  nextLabel?: string
}

function StepCard({ title, desc, value, onChange, placeholder, onNext, onBack, nextLabel = 'Siguiente →' }: StepCardProps) {
  return (
    <div className="w-full max-w-sm mt-6 flex flex-col gap-3">
      <p className="text-accent text-xs font-semibold uppercase tracking-wider">{title}</p>
      <p className="text-text2 text-sm">{desc}</p>
      <input
        className="w-full bg-surface border border-surface3 rounded-card px-4 py-3 text-sm text-text1 font-mono outline-none focus:border-accent transition-colors"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <button
        disabled={!value.trim()}
        onClick={onNext}
        className="w-full bg-accent text-white font-semibold py-3 rounded-card disabled:opacity-40 transition-opacity"
      >
        {nextLabel}
      </button>
      {onBack && (
        <button
          onClick={onBack}
          className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card"
        >
          ← Atrás
        </button>
      )}
    </div>
  )
}
