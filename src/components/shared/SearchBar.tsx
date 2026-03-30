interface Props {
  value:       string
  onChange:    (v: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChange, placeholder = 'Buscar…' }: Props) {
  return (
    <div className="flex items-center gap-2 bg-surface2 rounded-card px-3.5 mb-3">
      <span className="text-text2 text-sm">🔍</span>
      <input
        className="flex-1 bg-transparent border-none text-sm text-text1 py-3 outline-none font-sans placeholder:text-text2"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-text2 text-xs hover:text-red transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  )
}
