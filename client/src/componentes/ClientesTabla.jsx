import Boton from './Boton'
import Paginacion from './Paginacion'

const claseEstado = (activo) =>
  activo
    ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
    : 'border-borde bg-superficie-2 text-tinta-suave'

const etiquetaEstado = (activo) => (activo ? 'Activo' : 'Inactivo')

const textoOpcional = (valor) => valor?.trim() || '—'

const ClientesTabla = ({
  clientes,
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
  const renderAcciones = (cliente) => {
    const ocupado = idAlternando === cliente.id
    const confirmando = confirmandoId === cliente.id

    return (
      <div className="flex flex-wrap items-center gap-2 [&>button]:px-2.5">
        {!confirmando && (
          <Boton
            variante="secundario"
            className="text-sm"
            onClick={() => alEditar(cliente)}
            deshabilitado={ocupado}
          >
            Editar
          </Boton>
        )}

        {cliente.activo ? (
          confirmando ? (
            <>
              <Boton
                variante="acento"
                className="text-sm"
                cargando={ocupado}
                onClick={() => alConfirmarDesactivar(cliente)}
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
              onClick={() => alSolicitarDesactivar(cliente)}
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
            onClick={() => alActivar(cliente)}
          >
            Activar
          </Boton>
        )}
      </div>
    )
  }

  const contacto = (cliente) => {
    const telefono = textoOpcional(cliente.telefono)
    const correo = textoOpcional(cliente.correo)
    if (telefono === '—' && correo === '—') return '—'
    return [telefono, correo].filter((valor) => valor !== '—').join(' · ')
  }

  return (
    <>
      {/* Escritorio/tablet: tabla de ancho fijo con proporciones intencionales. */}
      <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Clientes registrados</caption>
            <colgroup>
              <col />
              <col className="w-0 lg:w-[20%]" />
              <col className="w-[132px]" />
              <col className="w-0 xl:w-[26%]" />
              <col className="w-[104px]" />
              <col className="w-[200px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Cliente
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3 align-middle font-medium sm:px-4 lg:table-cell"
                >
                  Sucursal
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Documento
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-3 align-middle font-medium sm:px-4 xl:table-cell"
                >
                  Contacto
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
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="align-middle">
                  <td className="px-3 py-3 sm:px-4">
                    <p
                      className="truncate font-medium text-tinta"
                      title={cliente.nombre}
                    >
                      {cliente.nombre}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-tinta-suave lg:hidden">
                      {textoOpcional(cliente.sucursal_nombre)}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 sm:px-4 lg:table-cell">
                    <span
                      className="block truncate text-tinta-suave"
                      title={textoOpcional(cliente.sucursal_nombre)}
                    >
                      {textoOpcional(cliente.sucursal_nombre)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-tinta-suave sm:px-4">
                    {textoOpcional(cliente.documento)}
                  </td>
                  <td className="hidden px-3 py-3 sm:px-4 xl:table-cell">
                    <span
                      className="block truncate text-tinta-suave"
                      title={contacto(cliente)}
                    >
                      {contacto(cliente)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                        cliente.activo,
                      )}`}
                    >
                      {etiquetaEstado(cliente.activo)}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {renderAcciones(cliente)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Móvil: tarjetas, sin scroll horizontal. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {clientes.map((cliente) => (
          <li
            key={cliente.id}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-tinta">{cliente.nombre}</p>
                <p className="mt-0.5 font-mono text-xs text-tinta-suave">
                  {textoOpcional(cliente.sucursal_nombre)}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                  cliente.activo,
                )}`}
              >
                {etiquetaEstado(cliente.activo)}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-borde pt-3 text-sm">
              <div>
                <dt className="font-mono text-xs text-tinta-suave">
                  Documento
                </dt>
                <dd className="mt-0.5 font-mono tabular-nums text-tinta">
                  {textoOpcional(cliente.documento)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Teléfono</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-tinta">
                  {textoOpcional(cliente.telefono)}
                </dd>
              </div>
              {cliente.correo && (
                <div className="col-span-2">
                  <dt className="font-mono text-xs text-tinta-suave">Correo</dt>
                  <dd className="mt-0.5 break-words text-tinta">
                    {cliente.correo}
                  </dd>
                </div>
              )}
              {cliente.direccion && (
                <div className="col-span-2">
                  <dt className="font-mono text-xs text-tinta-suave">
                    Dirección
                  </dt>
                  <dd className="mt-0.5 break-words text-tinta">
                    {cliente.direccion}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-4">{renderAcciones(cliente)}</div>
          </li>
        ))}
      </ul>

      {Number(total) > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={porPagina}
          etiqueta="cliente"
          plural="clientes"
          ariaLabel="Paginación de clientes"
          alAnterior={alAnterior}
          alSiguiente={alSiguiente}
          alCambiarPorPagina={alCambiarPorPagina}
        />
      )}
    </>
  )
}

export default ClientesTabla
