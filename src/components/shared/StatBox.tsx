interface Props {
  value:  number | string
  label:  string
  color?: 'green' | 'red' | 'orange' | 'blue' | 'default'
}

const colorMap = {
  green:   'text-green',
  red:     'text-red',
  orange:  'text-orange',
  blue:    'text-accent',
  default: 'text-accent',
}

export default function StatBox({ value, label, color = 'default' }: Props) {
  return (
    <div className="bg-surface rounded-card p-4 text-center border border-white/[0.04]">
      <div className={`font-mono text-3xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-[11px] text-text2 mt-1">{label}</div>
    </div>
  )
}
