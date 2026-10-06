import { useId } from 'react'
import Boton from './Boton'
import { formatearNumero } from '../utilidades/formatoMoneda'
import { OPCIONES_POR_PAGINA } from '../utilidades/paginacion'

const Paginacion = ({
  pagina,
  totalPaginas,
  total,
  porPagina,
  etiqueta = 'registro',
  plural = 'registros',
  ariaLabel = 'Paginación',
  alAnterior,
  alSiguiente,
  opcionesPorPagina = OPCIONES_POR_PAGINA,
  alCambiarPorPagina,
}) => {
  const idSelect = useId()
  const paginas = Math.max(1, totalPaginas || 1)
  const hayAnterior = pagina > 1
  const haySiguiente = pagina < paginas

  const primero = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const ultimo = Math.min(pagina * porPagina, total)

  // El valor del select SIEMPRE debe existir entre las opciones: si el
  // `porPagina` recibido no está en la lista, caemos al primer valor válido.
  const opciones =
    Array.isArray(opcionesPorPagina) && opcionesPorPagina.length > 0
      ? opcionesPorPagina
      : OPCIONES_POR_PAGINA
  const porPaginaNumerico = Number(porPagina)
  const valorSelect = opciones.includes(porPaginaNumerico)
    ? porPaginaNumerico
    : opciones[0]

  const manejarCambioPorPagina = (evento) => {
    const numero = Number(evento.target.value)
    if (!Number.isFinite(numero)) return
    // EC-006: elegir el tamaño ya seleccionado no recarga.
    if (numero === porPaginaNumerico) return
    alCambiarPorPagina(numero)
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="mt-3 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="font-mono text-xs text-tinta-suave">
        {formatearNumero(total)} {total === 1 ? etiqueta : plural}
        {total > 0 && (
          <>
            {' · mostrando '}
            {formatearNumero(primero)}–{formatearNumero(ultimo)}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {alCambiarPorPagina && (
          <div className="flex items-center gap-2">
            <label
              htmlFor={idSelect}
              className="font-mono text-xs text-tinta-suave"
            >
              Por página
            </label>
            <select
              id={idSelect}
              value={valorSelect}
              onChange={manejarCambioPorPagina}
              className="h-9 rounded-md border border-borde bg-superficie px-2 font-mono text-xs tabular-nums text-tinta transition-colors duration-150 hover:border-borde-fuerte"
            >
              {opciones.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {formatearNumero(opcion)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Boton
            variante="secundario"
            className="px-3"
            deshabilitado={!hayAnterior}
            onClick={alAnterior}
          >
            Anterior
          </Boton>
          <span
            className="min-w-[7rem] text-center font-mono text-xs text-tinta-suave"
            aria-live="polite"
          >
            Página {pagina} de {paginas}
          </span>
          <Boton
            variante="secundario"
            className="px-3"
            deshabilitado={!haySiguiente}
            onClick={alSiguiente}
          >
            Siguiente
          </Boton>
        </div>
      </div>
    </nav>
  )
}

export default Paginacion
