import { useEffect, useRef } from 'react'
import Boton from './Boton'

const ModalDetalle = ({ abierto, alCerrar, titulo, children }) => {
  const refDialogo = useRef(null)

  useEffect(() => {
    const dialogo = refDialogo.current
    if (!dialogo) return undefined

    if (abierto) {
      if (!dialogo.open) dialogo.showModal()
    } else if (dialogo.open) {
      dialogo.close()
    }

    const alCerrarNativo = () => {
      if (abierto) alCerrar()
    }

    dialogo.addEventListener('close', alCerrarNativo)
    return () => dialogo.removeEventListener('close', alCerrarNativo)
  }, [abierto, alCerrar])

  const manejarClickFondo = (evento) => {
    const dialogo = refDialogo.current
    if (dialogo && evento.target === dialogo) {
      dialogo.close()
    }
  }

  return (
    <dialog
      ref={refDialogo}
      onClick={manejarClickFondo}
      className="max-h-[90vh] w-full max-w-lg overflow-visible rounded-lg border border-borde bg-superficie p-0 shadow-impresa backdrop:bg-tinta/30 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className="flex items-center justify-between border-b border-borde px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {titulo}
          </h2>
          <Boton
            tipo="button"
            variante="sutil"
            className="h-8 w-8 px-0"
            onClick={() => refDialogo.current?.close()}
            aria-label="Cerrar"
          >
            ×
          </Boton>
        </div>

        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  )
}

export default ModalDetalle
