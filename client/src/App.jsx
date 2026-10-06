import { useState } from 'react'
import ArmazonPanel from './componentes/ArmazonPanel'
import { useAutenticacion } from './hooks/useAutenticacion'
import Categorias from './paginas/Categorias'
import Clientes from './paginas/Clientes'
import Facturacion from './paginas/Facturacion'
import Inicio from './paginas/Inicio'
import Inventario from './paginas/Inventario'
import Login from './paginas/Login'
import Productos from './paginas/Productos'
import PuntoDeVenta from './paginas/PuntoDeVenta'
import Sucursales from './paginas/Sucursales'

const VISTAS = {
  inicio: Inicio,
  productos: Productos,
  categorias: Categorias,
  sucursales: Sucursales,
  clientes: Clientes,
  'punto-de-venta': PuntoDeVenta,
  inventario: Inventario,
  facturacion: Facturacion,
}

const PanelAutenticado = () => {
  const [seccion, setSeccion] = useState('inicio')

  const Vista = VISTAS[seccion] ?? Inicio

  return (
    <ArmazonPanel seccionActiva={seccion} alNavegar={setSeccion}>
      <Vista />
    </ArmazonPanel>
  )
}

const App = () => {
  const { autenticado } = useAutenticacion()

  return autenticado ? <PanelAutenticado /> : <Login />
}

export default App
