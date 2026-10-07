const TarjetaKpi = ({ titulo, valor, detalle }) => (
  <div className="relative overflow-hidden rounded-lg border border-borde bg-superficie p-5 shadow-impresa">
    <span
      className="absolute inset-x-0 top-0 h-0.5 bg-marca"
      aria-hidden="true"
    />
    <p className="font-mono text-xs text-tinta-suave">{titulo}</p>
    <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-tinta sm:text-3xl">
      {valor}
    </p>
    {detalle && (
      <p className="mt-2 font-mono text-xs text-tinta-suave">{detalle}</p>
    )}
  </div>
)

export default TarjetaKpi
