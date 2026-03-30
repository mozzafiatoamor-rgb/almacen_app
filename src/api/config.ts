import type { AppConfig } from './types'

const KEYS = {
  sheetId:   'mozz_sheetId',
  apiKey:    'mozz_apiKey',
  scriptUrl: 'mozz_scriptUrl',
}

export function getConfig(): AppConfig {
  return {
    sheetId:   localStorage.getItem(KEYS.sheetId)   ?? '',
    apiKey:    localStorage.getItem(KEYS.apiKey)    ?? '',
    scriptUrl: localStorage.getItem(KEYS.scriptUrl) ?? '',
  }
}

export function saveConfig(cfg: AppConfig): void {
  localStorage.setItem(KEYS.sheetId,   cfg.sheetId)
  localStorage.setItem(KEYS.apiKey,    cfg.apiKey)
  localStorage.setItem(KEYS.scriptUrl, cfg.scriptUrl)
}

export function isConfigured(cfg: AppConfig): boolean {
  return Boolean(cfg.sheetId && cfg.apiKey && cfg.scriptUrl)
}

export const SHEET_NAMES = {
  catalogo:    '📦 Catálogo',
  movimientos: '📥 Movimientos',
  mermas:      '⚠️ Mermas',
  usuarios:    '👤 Usuarios',
  bitacora:    '📜 Bitácora',
  gastos:      '💰 Gastos',
} as const
