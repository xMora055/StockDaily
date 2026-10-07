import Boton from './Boton'
import Marca from './Marca'
import { useAutenticacion } from '../hooks/useAutenticacion'

const SECCIONES_OPERATIVAS = [
  { id: 'inicio', nombre: 'Inicio' },
  { id: 'productos', nombre: 'Productos' },
  { id: 'categorias', nombre: 'Categorías' },
  { id: 'sucursales', nombre: 'Sucursales' },
  { id: 'clientes', nombre: 'Clientes' },
  { id: 'punto-de-venta', nombre: 'Punto de venta' },
  { id: 'inventario', nombre: 'Inventario' },
  { id: 'facturacion', nombre: 'Facturación' },
]

const SECCIONES_ADMIN = [
  { id: 'admin-empresas', nombre: 'Empresas' },
  { id: 'admin-usuarios', nombre: 'Administradores' },
]

const ArmazonPanel = ({ seccionActiva, alNavegar, children }) => {
  const { usuario, cerrarSesion } = useAutenticacion()

  const inicial = usuario?.nombre?.charAt(0)?.toUpperCase() ?? '?'
  const esSuperadmin = usuario?.rol === 'superadmin'

  const renderSeccion = (seccion) => {
    if (seccion.proximamente) {
      return (
        <span
          key={seccion.id}
          aria-disabled="true"
          className="flex min-h-11 items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-sm text-tinta-suave opacity-80"
        >
          <span>{seccion.nombre}</span>
          <span className="rounded border border-borde px-1.5 py-0.5 font-mono text-[11px]">
            Pronto
          </span>
        </span>
      )
    }

    const activa = seccionActiva === seccion.id
    return (
      <button
        key={seccion.id}
        type="button"
        onClick={() => alNavegar(seccion.id)}
        aria-current={activa ? 'page' : undefined}
        className={`flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
          activa
            ? 'bg-petroleo font-medium text-fondo'
            : 'text-tinta-suave hover:bg-superficie-2 hover:text-tinta'
        }`}
      >
        {seccion.nombre}
      </button>
    )
  }

  const renderGrupoAdmin = () => {
    if (!esSuperadmin) return null

    return (
      <div className="mt-6 flex flex-col gap-1">
        <div className="mb-1 flex items-center gap-2 px-3">
          <span className="h-px flex-1 bg-borde" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-tinta-suave">
            Administración
          </span>
          <span className="h-px flex-1 bg-borde" aria-hidden="true" />
        </div>
        {SECCIONES_ADMIN.map(renderSeccion)}
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-fondo text-tinta">
      <header className="sticky top-0 z-20 border-b border-borde bg-superficie/90 backdrop-blur lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-2.5">
            <Marca className="h-8 w-8" />
            <span className="font-display text-base font-semibold tracking-tight">
              StockDaily
            </span>
          </div>
          <Boton
            variante="secundario"
            onClick={cerrarSesion}
            className="h-9 px-3 text-sm"
          >
            Salir
          </Boton>
        </div>
        <nav
          aria-label="Secciones del panel"
          className="flex gap-1 overflow-x-auto border-t border-borde px-3 py-2"
        >
          {SECCIONES_OPERATIVAS.map(renderSeccion)}
          {esSuperadmin && SECCIONES_ADMIN.map(renderSeccion)}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] 2xl:max-w-[1760px]">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-borde bg-superficie px-5 py-6 lg:flex xl:w-72">
          <div className="flex items-center gap-2.5">
            <Marca className="h-9 w-9" />
            <div>
              <p className="font-display text-base font-semibold leading-tight tracking-tight">
                StockDaily
              </p>
              <p className="text-xs text-tinta-suave">Punto de venta</p>
            </div>
          </div>

          <nav
            aria-label="Secciones del panel"
            className="mt-9 flex flex-col gap-0.5"
          >
            {SECCIONES_OPERATIVAS.map(renderSeccion)}
            {renderGrupoAdmin()}
          </nav>

          <div className="mt-auto border-t border-borde pt-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-marca-suave font-display text-sm font-semibold text-marca-fuerte">
                {inicial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {usuario?.nombre}
                </p>
                <p className="truncate text-xs text-tinta-suave">
                  {usuario?.correo}
                </p>
              </div>
            </div>
            <Boton
              variante="secundario"
              onClick={cerrarSesion}
              className="mt-4 w-full"
            >
              Cerrar sesión
            </Boton>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  )
}

export default ArmazonPanel
