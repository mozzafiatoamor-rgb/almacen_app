interface Props {
  options:    string[]
  active:     string
  onSelect:   (v: string) => void
  allLabel?:  string
}

export default function FilterPills({ options, active, onSelect, allLabel = 'Todos' }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{ WebkitOverflowScrolling: 'touch' }}>
      <Pill label={allLabel} active={active === 'todos'} onClick={() => onSelect('todos')} />
      {options.map(o => (
        <Pill key={o} label={o} active={active === o} onClick={() => onSelect(o)} />
      ))}
    </div>
  )
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-none px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all
        ${active
          ? 'bg-accent text-white border-accent'
          : 'bg-surface text-text2 border-surface3 hover:border-accent/50'}
      `}
    >
      {label}
    </button>
  )
}
