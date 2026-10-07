import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'

const BannerCredenciales = ({
  titulo,
  entidad,
  entidadLabel = 'Empresa',
  correo,
  password,
  advertencia = 'Contraseña temporal. Compártela de forma segura; el usuario debe cambiarla al ingresar.',
  alCerrar,
}) => {
  const [copiado, setCopiado] = useState(false)

  const copiarPassword = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="anim-aparecer rounded-lg border border-acento/40 bg-acento-suave p-5 shadow-impresa">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight text-tinta">
            {titulo}
          </h3>
          <p className="mt-1 text-sm text-tinta-suave">
            {entidadLabel}: <span className="font-medium text-tinta">{entidad}</span>
          </p>
          <p className="mt-1 text-sm text-tinta-suave">
            Correo:{' '}
            <span className="font-mono text-sm text-tinta">{correo}</span>
          </p>

          <div className="mt-3 inline-flex items-center gap-3 rounded-md border border-borde-fuerte bg-fondo px-3 py-2">
            <span className="font-mono text-sm text-tinta-suave">Contraseña</span>
            <span className="font-mono text-lg font-semibold tracking-tight text-tinta">
              {password}
            </span>
            <Boton
              tipo="button"
              variante="secundario"
              className="h-8 px-2.5 text-sm"
              onClick={copiarPassword}
            >
              {copiado ? 'Copiada' : 'Copiar'}
            </Boton>
          </div>
        </div>

        <Boton
          tipo="button"
          variante="sutil"
          className="h-8 px-2.5 text-sm"
          onClick={alCerrar}
        >
          Cerrar
        </Boton>
      </div>

      <div className="mt-4">
        <Alerta variante="info">{advertencia}</Alerta>
      </div>
    </div>
  )
}

export default BannerCredenciales
