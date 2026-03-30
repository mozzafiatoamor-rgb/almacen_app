interface Props {
  icon?:    string
  message?: string
}

export default function EmptyState({ icon = '📭', message = 'Sin resultados' }: Props) {
  return (
    <div className="text-center py-10 text-text2">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  )
}
