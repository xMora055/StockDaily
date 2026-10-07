import Boton from './Boton'
import Paginacion from './Paginacion'

const claseEstado = (activo) =>
  activo
    ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
    : 'border-borde bg-superficie-2 text-tinta-suave'

const etiquetaEstado = (activo) => (activo ? 'Activo' : 'Inactivo')

const textoOpcional = (valor) => valor?.trim() || '—'

const UsuariosTabla = ({
  usuarios,
  empresasPorId,
  idAlternando,
  confirmandoId,
  alVer,
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
  const renderAcciones = (usuario) => {
    const ocupado = idAlternando === usuario.id
    const confirmando = confirmandoId === usuario.id

    return (
      <div className="flex flex-wrap items-center gap-2 [&>button]:px-2.5">
        {!confirmando && (
          <Boton
            variante="sutil"
            className="text-sm"
            onClick={() => alVer(usuario)}
            deshabilitado={ocupado}
          >
            Ver
          </Boton>
        )}

        {!confirmando && (
          <Boton
            variante="secundario"
            className="text-sm"
            onClick={() => alEditar(usuario)}
            deshabilitado={ocupado}
          >
            Editar
          </Boton>
        )}

        {usuario.activo ? (
          confirmando ? (
            <>
              <Boton
                variante="acento"
                className="text-sm"
                cargando={ocupado}
                onClick={() => alConfirmarDesactivar(usuario)}
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
              onClick={() => alSolicitarDesactivar(usuario)}
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
            onClick={() => alActivar(usuario)}
          >
            Activar
          </Boton>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Administradores registrados</caption>
            <colgroup>
              <col />
              <col className="w-[28%]" />
              <col className="w-[110px]" />
              <col className="w-[220px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Nombre
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Empresa
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 align-middle font-medium sm:px-4"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="align-middle">
                  <td className="px-3 py-3 sm:px-4">
                    <p
                      className="truncate font-medium text-tinta"
                      title={usuario.nombre}
                    >
                      {usuario.nombre}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-tinta-suave">
                      {textoOpcional(usuario.correo)}
                    </p>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <span
                      className="block truncate text-tinta-suave"
                      title={textoOpcional(empresasPorId[usuario.empresa_id])}
                    >
                      {textoOpcional(empresasPorId[usuario.empresa_id])}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                        usuario.activo,
                      )}`}
                    >
                      {etiquetaEstado(usuario.activo)}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    {renderAcciones(usuario)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {usuarios.map((usuario) => (
          <li
            key={usuario.id}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-medium text-tinta">{usuario.nombre}</p>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                  usuario.activo,
                )}`}
              >
                {etiquetaEstado(usuario.activo)}
              </span>
            </div>

            <dl className="mt-3 flex flex-col gap-3 border-t border-borde pt-3 text-sm">
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Correo</dt>
                <dd className="mt-0.5 break-words font-mono text-tinta">
                  {textoOpcional(usuario.correo)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Empresa</dt>
                <dd className="mt-0.5 text-tinta">
                  {textoOpcional(empresasPorId[usuario.empresa_id])}
                </dd>
              </div>
            </dl>

            <div className="mt-4">{renderAcciones(usuario)}</div>
          </li>
        ))}
      </ul>

      {Number(total) > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={porPagina}
          etiqueta="administrador"
          plural="administradores"
          ariaLabel="Paginación de administradores"
          alAnterior={alAnterior}
          alSiguiente={alSiguiente}
          alCambiarPorPagina={alCambiarPorPagina}
        />
      )}
    </>
  )
}

export default UsuariosTabla
