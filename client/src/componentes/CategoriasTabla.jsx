import Boton from './Boton'
import Paginacion from './Paginacion'

const claseEstado = (activo) =>
  activo
    ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
    : 'border-borde bg-superficie-2 text-tinta-suave'

const etiquetaEstado = (activo) => (activo ? 'Activa' : 'Inactiva')

const CategoriasTabla = ({
  categorias,
  idAlternando,
  confirmandoId,
  alEditar,
  alActivar,
  alSolicitarDesactivar,
  alConfirmarDesactivar,
  alCancelarDesactivar,
  pagina,
  totalPaginas,
  total,
  porPagina,
  alAnterior,
  alSiguiente,
  alCambiarPorPagina,
}) => {
  const renderAcciones = (categoria) => {
    const ocupado = idAlternando === categoria.id
    const confirmando = confirmandoId === categoria.id

    return (
      <div className="flex flex-wrap items-center gap-2 [&>button]:px-2.5">
        {!confirmando && (
          <Boton
            variante="secundario"
            className="text-sm"
            onClick={() => alEditar(categoria)}
            deshabilitado={ocupado}
          >
            Editar
          </Boton>
        )}

        {categoria.activo ? (
          confirmando ? (
            <>
              <Boton
                variante="acento"
                className="text-sm"
                cargando={ocupado}
                onClick={() => alConfirmarDesactivar(categoria)}
              >
                Confirmar
              </Boton>
              <Boton
                variante="sutil"
                className="text-sm"
                onClick={alCancelarDesactivar}
                deshabilitado={ocupado}
              >
                Cancelar
              </Boton>
            </>
          ) : (
            <Boton
              variante="sutil"
              className="text-sm"
              onClick={() => alSolicitarDesactivar(categoria)}
              deshabilitado={ocupado}
            >
              Desactivar
            </Boton>
          )
        ) : (
          <Boton
            variante="secundario"
            className="text-sm"
            cargando={ocupado}
            onClick={() => alActivar(categoria)}
          >
            Activar
          </Boton>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Escritorio/tablet: tabla con `min-w` como suelo legible. */}
      <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-[520px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Categorías registradas</caption>
            <colgroup>
              <col />
              <col className="w-[120px]" />
              <col className="w-[200px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Categoría
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {categorias.map((categoria) => (
                <tr key={categoria.id} className="align-middle">
                  <td className="px-3 py-3 sm:px-4">
                    <p
                      className="truncate font-medium text-tinta"
                      title={categoria.nombre}
                    >
                      {categoria.nombre}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                        categoria.activo,
                      )}`}
                    >
                      {etiquetaEstado(categoria.activo)}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {renderAcciones(categoria)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Móvil: tarjetas, sin scroll horizontal. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {categorias.map((categoria) => (
          <li
            key={categoria.id}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-medium text-tinta">
                {categoria.nombre}
              </p>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                  categoria.activo,
                )}`}
              >
                {etiquetaEstado(categoria.activo)}
              </span>
            </div>

            <div className="mt-4">{renderAcciones(categoria)}</div>
          </li>
        ))}
      </ul>

      {Number(total) > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={porPagina}
          etiqueta="categoría"
          plural="categorías"
          ariaLabel="Paginación de categorías"
          alAnterior={alAnterior}
          alSiguiente={alSiguiente}
          alCambiarPorPagina={alCambiarPorPagina}
        />
      )}
    </>
  )
}

export default CategoriasTabla
