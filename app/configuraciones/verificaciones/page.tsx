"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type ClienteSesion = {
  uid?: string;
  email?: string;
  clienteId?: string;
  nit?: string;
  razonSocial?: string;
};

type ClienteData = {
  razonSocial?: string;
  nombreComercial?: string;
  logoUrl?: string;
  representante?: string;
  Representante?: string;
  [key: string]: unknown;
};

type ArchivoGuardado = {
  nombre?: string;
  url?: string;
  path?: string;
  tipo?: string;
};

type ExtraDocumento = {
  nombre?: string;
  archivo?: ArchivoGuardado;
  vencimiento?: string;
};

type Movil = {
  id: string;
  nombre?: string;
  denominacion?: string;
  placa?: string;
  modelo?: string;
  kilometrajeInicial?: string;
  kilometrajeActual?: string;
  tipo?: string;
  estado?: "Activo" | "Inactivo" | string;
  status?: string;
  fotos?: ArchivoGuardado[] | string[];
  fotoUrl?: string;
  imagenUrl?: string;
  soatExpiry?: string;
  tecnomecanicaExpiry?: string;
  policyAllRiskExpiry?: string;
  aceiteExpiry?: string;
  aceiteVencimiento?: string;
  oilExpiry?: string;
  extras?: ExtraDocumento[];
  [key: string]: unknown;
};

type VerificacionItem = {
  codigo: string;
  descripcion: string;
};

type CategoriaVerificacion = {
  nombre: string;
  items: VerificacionItem[];
};

type TipoCheck = "estado" | "cumple";

type ConfiguracionCheck = Record<string, TipoCheck>;

type RespuestaItem = {
  codigo: string;
  descripcion: string;
  tipo: TipoCheck;
  estado?: string;
  cumple?: string;
  observaciones?: string;
};

type ReporteVerificacion = {
  id: string;
  movilId: string;
  movilNombre: string;
  placa?: string;
  fecha: string;
  kilometraje: string;
  datos: Record<string, RespuestaItem>;
  completados: number;
  totalItems: number;
  porcentaje: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DEFAULT_LOGO = "/logo.png";
const DEFAULT_MOVIL_IMAGE =
  "data:image/svg+xml,%3Csvg width='600' height='360' viewBox='0 0 600 360' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='600' height='360' rx='36' fill='%23F1F5F9'/%3E%3Cpath d='M149 215h302l-28-72c-5-13-18-22-32-22H209c-14 0-27 9-32 22l-28 72Z' fill='%23CBD5E1'/%3E%3Cpath d='M181 215h238v37H181v-37Z' fill='%2394A3B8'/%3E%3Ccircle cx='221' cy='260' r='28' fill='%23475569'/%3E%3Ccircle cx='379' cy='260' r='28' fill='%23475569'/%3E%3Crect x='234' y='139' width='132' height='48' rx='10' fill='%23E2E8F0'/%3E%3Cpath d='M292 150h16v12h12v16h-12v12h-16v-12h-12v-16h12v-12Z' fill='%234F46E5'/%3E%3Ctext x='300' y='323' text-anchor='middle' font-family='Arial' font-size='22' font-weight='700' fill='%2364758B'%3ESin foto%3C/text%3E%3C/svg%3E";

const HOY = new Date().toISOString().slice(0, 10);

const CATEGORIAS_VERIFICACION: CategoriaVerificacion[] = [
  {
    nombre: "Estado de Presentación (1)",
    items: [
      { codigo: "1.3", descripcion: "Latas" },
      { codigo: "1.4", descripcion: "Pintura" },
    ],
  },
  {
    nombre: "Estado de Comodidad (2)",
    items: [
      { codigo: "2.1", descripcion: "Aire Acondicionado" },
      { codigo: "2.2", descripcion: "Silletería (Anclaje, estado)" },
      { codigo: "2.3", descripcion: "Encendedor" },
      { codigo: "2.4", descripcion: "Luz Interior o de techo" },
    ],
  },
  {
    nombre: "Niveles y perdidas de líquidos (3)",
    items: [
      { codigo: "3.1", descripcion: "Nivel de Aceite de motor" },
      { codigo: "3.2", descripcion: "Nivel de liquido de frenos" },
      { codigo: "3.3", descripcion: "Nivel de agua del radiador" },
      { codigo: "3.4", descripcion: "Nivel de agua de la batería" },
      { codigo: "3.5", descripcion: "Nivel de aceite hidráulico" },
      { codigo: "3.6", descripcion: "Fugas de A.C.P.M" },
      { codigo: "3.7", descripcion: "Fugas de Agua" },
      { codigo: "3.8", descripcion: "Fugas de Aceite de transmisión" },
      { codigo: "3.9", descripcion: "Fuga aceite de caja" },
      { codigo: "3.10", descripcion: "Fugas de líquidos de frenos" },
    ],
  },
  {
    nombre: "Tablero de Control (4)",
    items: [
      { codigo: "4.1", descripcion: "Instrumentos" },
      { codigo: "4.2", descripcion: "Luces de Tablero" },
      { codigo: "4.3", descripcion: "Nivel de Combustible" },
      { codigo: "4.4", descripcion: "Odómetro" },
      { codigo: "4.5", descripcion: "Pito" },
      { codigo: "4.6", descripcion: "Tacómetro" },
      { codigo: "4.7", descripcion: "Velocímetro" },
      { codigo: "4.8", descripcion: "Indicador de Aceite" },
      { codigo: "4.9", descripcion: "Indicador de Temperatura" },
    ],
  },
  {
    nombre: "Seguridad Pasiva (5)",
    items: [
      { codigo: "5.1", descripcion: "Cinturones de Seguridad" },
      { codigo: "5.2", descripcion: "Airbags" },
      { codigo: "5.3", descripcion: "Chasis y carrocería" },
      { codigo: "5.4", descripcion: "Cristales (Vidrios)" },
      { codigo: "5.5", descripcion: "Apoyacabezas" },
      { codigo: "5.6", descripcion: "Estado Espejos" },
      { codigo: "5.6A", descripcion: "Espejo Lateral Derecho" },
      { codigo: "5.6B", descripcion: "Espejo Lateral Izquierdo" },
      { codigo: "5.6C", descripcion: "Espejo Retrovisor" },
    ],
  },
  {
    nombre: "Seguridad Activa (6)",
    items: [
      { codigo: "6.1", descripcion: "Estado de la Dirección" },
      { codigo: "6.2", descripcion: "Estado Suspensión Delantera" },
      { codigo: "6.2.1", descripcion: "Amortiguadores (Delantera)" },
      { codigo: "6.3", descripcion: "Estado suspensión Trasera" },
      { codigo: "6.3.1", descripcion: "Amortiguadores (Trasera)" },
      { codigo: "6.4", descripcion: "Estado Parabrisas" },
      { codigo: "6.4A", descripcion: "Vidrio Frontal" },
      { codigo: "6.4B", descripcion: "Limpiabrisas Derecho" },
      { codigo: "6.4C", descripcion: "Limpiabrisas Izquierdo" },
      { codigo: "6.4D", descripcion: "Lavaparabrisas" },
      { codigo: "6.5", descripcion: "Estado de Luces" },
      { codigo: "6.5.1", descripcion: "Luces Medias" },
      { codigo: "6.5.2", descripcion: "Luces Altas" },
      { codigo: "6.5.3", descripcion: "Luces Bajas" },
      { codigo: "6.5.4", descripcion: "Direccional Izquie. Delant." },
      { codigo: "6.5.5", descripcion: "Direccional Derec. Delant." },
      { codigo: "6.5.6", descripcion: "Direccional Izquie. Trasera" },
      { codigo: "6.5.7", descripcion: "Direccional Derec. Trasera" },
      { codigo: "6.5.8", descripcion: "Luces de Parqueo" },
      { codigo: "6.5.9", descripcion: "Luz Freno" },
      { codigo: "6.5.10", descripcion: "Luz Reverso" },
      { codigo: "6.5.11", descripcion: "L. Antiniebla Exploradoras" },
      { codigo: "6.6", descripcion: "Estado Llantas (Labrado, Presión)" },
      { codigo: "6.6.1", descripcion: "Delantera Derecha" },
      { codigo: "6.6.2", descripcion: "Delantera Izquierda" },
      { codigo: "6.6.3", descripcion: "Trasera Derecha" },
      { codigo: "6.6.4", descripcion: "Trasera Izquierda" },
      { codigo: "6.6.5", descripcion: "Repuesto" },
      { codigo: "6.6.6", descripcion: "Presión aire llanta" },
      { codigo: "6.6.7", descripcion: "Rines" },
      { codigo: "6.7", descripcion: "Frenos" },
      { codigo: "6.7.1", descripcion: "Estado de los Frenos" },
      { codigo: "6.7.2", descripcion: "Freno de Mano" },
      { codigo: "6.7.3", descripcion: "Pastillas" },
    ],
  },
  {
    nombre: "Otros (7)",
    items: [
      { codigo: "7.1", descripcion: "Instalaciones eléctricas" },
      { codigo: "7.2", descripcion: "Clutch" },
      { codigo: "7.3", descripcion: "Exosto" },
      { codigo: "7.4", descripcion: "Alarma Sonora de Reversa" },
      { codigo: "7.5", descripcion: "Salto de cambios" },
      { codigo: "7.6", descripcion: "Cambios suaves" },
      { codigo: "7.7", descripcion: "Guaya del acelerador" },
      { codigo: "7.8", descripcion: "Sistema de embrague" },
      { codigo: "7.9", descripcion: "Encendido" },
      { codigo: "7.10", descripcion: "Sincronización" },
      { codigo: "7.11", descripcion: "Placas" },
    ],
  },
  {
    nombre: "Equipo de Carretera (8)",
    items: [
      { codigo: "8.1", descripcion: "Gato con capacidad" },
      { codigo: "8.3", descripcion: "2 tacos para bloquear" },
      { codigo: "8.4", descripcion: "2 señales triangulares" },
      { codigo: "8.5", descripcion: "Guantes de lona" },
      { codigo: "8.6", descripcion: "Cruceta" },
      { codigo: "8.7", descripcion: "Cable de iniciar" },
      { codigo: "8.9", descripcion: "2 conos reflectivos" },
      { codigo: "8.10", descripcion: "Linterna recargable" },
      { codigo: "8.11", descripcion: "Caja de herramientas" },
    ],
  },
];

function getStoredClienteSesion(): ClienteSesion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("clienteSesion");
    return raw ? (JSON.parse(raw) as ClienteSesion) : null;
  } catch {
    return null;
  }
}

function texto(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

function normalizarNit(value?: string) {
  return String(value || "").replace(/[^0-9a-zA-Z]/g, "");
}

function itemKey(codigo: string) {
  return codigo.replace(/\./g, "_");
}

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

function calcularPorcentaje(total: number, completados: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completados / total) * 100)));
}

function parseFechaLocal(fecha?: string) {
  if (!fecha) return null;
  const partes = fecha.split("-").map(Number);
  if (partes.length !== 3 || partes.some((item) => Number.isNaN(item))) return null;
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

function calcularDiasRestantes(fecha?: string) {
  const fechaFinal = parseFechaLocal(fecha);
  if (!fechaFinal) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fechaFinal.setHours(0, 0, 0, 0);
  return Math.ceil((fechaFinal.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function etiquetaDias(fecha?: string) {
  const dias = calcularDiasRestantes(fecha);
  if (dias === null) return "N/A";
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día(s)`;
  if (dias === 0) return "Vence hoy";
  return `${dias} día(s)`;
}

function estaVencido(fecha?: string) {
  const dias = calcularDiasRestantes(fecha);
  return dias !== null && dias < 0;
}

function fotoMovil(movil: Movil) {
  if (typeof movil.fotoUrl === "string" && movil.fotoUrl.trim()) return movil.fotoUrl;
  if (typeof movil.imagenUrl === "string" && movil.imagenUrl.trim()) return movil.imagenUrl;
  if (Array.isArray(movil.fotos)) {
    for (const item of movil.fotos) {
      if (typeof item === "string" && item.trim()) return item;
      if (item && typeof item === "object" && "url" in item && String((item as ArchivoGuardado).url || "").trim()) {
        return String((item as ArchivoGuardado).url);
      }
    }
  }
  return DEFAULT_MOVIL_IMAGE;
}

function estadoMovil(movil: Movil) {
  return texto(movil.estado, movil.status, "Activo");
}

function movilActivo(movil: Movil) {
  return estadoMovil(movil).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "activo";
}

function formatDateTime(value: unknown) {
  if (!value) return "";
  try {
    if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as any).toDate === "function") {
      return (value as any).toDate().toLocaleString("es-CO");
    }
    if (typeof value === "object" && value !== null && "seconds" in value) {
      return new Date(Number((value as any).seconds) * 1000).toLocaleString("es-CO");
    }
    const fecha = new Date(String(value));
    return Number.isNaN(fecha.getTime()) ? String(value) : fecha.toLocaleString("es-CO");
  } catch {
    return "";
  }
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function VerificacionesDiariasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [clienteSesion, setClienteSesion] = useState<ClienteSesion | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [operativaOpen, setOperativaOpen] = useState(false);
  const [movilesOpen, setMovilesOpen] = useState(true);
  const [tareasOpen, setTareasOpen] = useState(false);
  const [soporteOpen, setSoporteOpen] = useState(false);
  const [moviles, setMoviles] = useState<Movil[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error">("ok");
  const [configuracionCheck, setConfiguracionCheck] = useState<ConfiguracionCheck>({});
  const [modalConfigOpen, setModalConfigOpen] = useState(false);
  const [configTemporal, setConfigTemporal] = useState<ConfiguracionCheck>({});
  const [modalVerificacionOpen, setModalVerificacionOpen] = useState(false);
  const [movilVerificando, setMovilVerificando] = useState<Movil | null>(null);
  const [kilometraje, setKilometraje] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaItem>>({});
  const [guardando, setGuardando] = useState(false);
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false);
  const [fechaHistorial, setFechaHistorial] = useState(HOY);
  const [reportes, setReportes] = useState<ReporteVerificacion[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const [reporteDetalle, setReporteDetalle] = useState<ReporteVerificacion | null>(null);

  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);

  const nombreHeader = useMemo(() => {
    return texto(
      cliente?.representante,
      cliente?.Representante,
      user?.displayName,
      clienteSesion?.razonSocial,
      cliente?.razonSocial,
      cliente?.nombreComercial,
      "Usuario",
    );
  }, [cliente, clienteSesion, user]);

  const movilesFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    const data = moviles.filter(movilActivo);
    if (!textoBusqueda) return data;
    return data.filter((movil) =>
      [movil.nombre, movil.placa, movil.denominacion, movil.modelo, movil.tipo]
        .join(" ")
        .toLowerCase()
        .includes(textoBusqueda),
    );
  }, [moviles, busqueda]);

  const totalItems = useMemo(
    () => CATEGORIAS_VERIFICACION.reduce((acc, cat) => acc + cat.items.length, 0),
    [],
  );

  const mostrarMensaje = (textoMensaje: string, tipo: "ok" | "error" = "ok") => {
    setMensaje(textoMensaje);
    setTipoMensaje(tipo);
    window.setTimeout(() => setMensaje(""), 4200);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/login_users");
        return;
      }

      setUser(firebaseUser);
      const stored = getStoredClienteSesion();
      setClienteSesion(stored);
      const id = normalizarNit(stored?.clienteId || stored?.nit);
      if (!id) {
        router.replace("/login_users");
        return;
      }
      setClienteId(id);

      try {
        const snap = await getDoc(doc(db, "clientes", id));
        if (snap.exists()) setCliente(snap.data() as ClienteData);
      } catch (error) {
        console.error("Error cargando cliente:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!clienteId) return;
    const refMoviles = collection(db, "clientes", clienteId, "moviles");
    const unsubscribe = onSnapshot(refMoviles, (snapshot) => {
      const data: Movil[] = snapshot.docs.map((item) => ({
  id: item.id,
  ...(item.data() as Omit<Movil, "id">),
}));

data.sort((a, b) =>
  texto(a.nombre).localeCompare(texto(b.nombre), "es"),
);

setMoviles(data);
    });
    return () => unsubscribe();
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId) return;
    const refConfig = doc(db, "clientes", clienteId, "configuracionVerificaciones", "checklistDiario");
    const unsubscribe = onSnapshot(refConfig, (snapshot) => {
      const data = snapshot.exists() ? (snapshot.data().items || {}) : {};
      setConfiguracionCheck(data as ConfiguracionCheck);
    });
    return () => unsubscribe();
  }, [clienteId]);

  const abrirConfig = () => {
    setConfigTemporal({ ...configuracionCheck });
    setModalConfigOpen(true);
  };

  const guardarConfiguracion = async () => {
    if (!clienteId) return;
    try {
      await setDoc(
        doc(db, "clientes", clienteId, "configuracionVerificaciones", "checklistDiario"),
        { items: configTemporal, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setModalConfigOpen(false);
      mostrarMensaje("Configuración del checklist guardada correctamente.");
    } catch (error) {
      console.error("Error guardando configuración:", error);
      mostrarMensaje("No fue posible guardar la configuración.", "error");
    }
  };

  const abrirVerificacion = async (movil: Movil) => {
    setMovilVerificando(movil);
    setKilometraje(texto(movil.kilometrajeActual, movil.kilometrajeInicial));
    setRespuestas({});

    if (clienteId) {
      try {
        const snapHoy = await getDoc(
          doc(db, "clientes", clienteId, "verificacionesMoviles", hoyIso(), "reportes", movil.id),
        );
        if (snapHoy.exists()) {
          const data = snapHoy.data() as ReporteVerificacion;
          setKilometraje(texto(data.kilometraje, movil.kilometrajeActual, movil.kilometrajeInicial));
          setRespuestas(data.datos || {});
        }
      } catch (error) {
        console.error("Error cargando verificación del día:", error);
      }
    }

    setModalVerificacionOpen(true);
  };

  const actualizarRespuesta = (codigo: string, campo: "estado" | "cumple" | "observaciones", value: string) => {
    const key = itemKey(codigo);
    const item = CATEGORIAS_VERIFICACION.flatMap((cat) => cat.items).find((i) => i.codigo === codigo);
    const tipo = configuracionCheck[key] || "cumple";
    setRespuestas((actual) => ({
      ...actual,
      [key]: {
  ...(actual[key] || {}),
  codigo,
  descripcion: item?.descripcion || "",
  tipo,
  [campo]: value,
},
    }));
  };

  const guardarVerificacion = async () => {
    if (!clienteId || !movilVerificando || guardando) return;
    setGuardando(true);
    try {
      const datos: Record<string, RespuestaItem> = {};
      let completados = 0;

      CATEGORIAS_VERIFICACION.forEach((categoria) => {
        categoria.items.forEach((item) => {
          const key = itemKey(item.codigo);
          const tipo = configuracionCheck[key] || "cumple";
          const actual = respuestas[key] || ({} as RespuestaItem);
          const estado = texto(actual.estado);
          const cumple = texto(actual.cumple);
          const observaciones = texto(actual.observaciones);
          const diligenciado = tipo === "estado" ? Boolean(estado) : Boolean(cumple);

          if (diligenciado) completados += 1;

          datos[key] = {
            codigo: item.codigo,
            descripcion: item.descripcion,
            tipo,
            estado,
            cumple,
            observaciones,
          };
        });
      });

      const fecha = hoyIso();
      const porcentaje = calcularPorcentaje(totalItems, completados);
      const itemsPendientes: Array<Record<string, unknown>> = [];
      const itemsNoCumple: Array<Record<string, unknown>> = [];
      const itemsNoAplica: Array<Record<string, unknown>> = [];

      CATEGORIAS_VERIFICACION.forEach((categoria) => {
        categoria.items.forEach((item) => {
          const key = itemKey(item.codigo);
          const respuesta = datos[key];
          const observacion = texto(respuesta?.observaciones);
          const estadoOriginal = texto(respuesta?.estado);
          const cumpleOriginal = texto(respuesta?.cumple);
          const estadoNormalizado = estadoOriginal.toLowerCase();
          const cumpleNormalizado = cumpleOriginal.toLowerCase();
          const valorPrincipal =
            respuesta.tipo === "estado" ? estadoOriginal : cumpleOriginal;

          if (!valorPrincipal) {
            itemsPendientes.push({
              id: `${key}_pendiente`,
              categoria: categoria.nombre,
              codigo: item.codigo,
              item: item.descripcion,
              descripcion: item.descripcion,
              tipo: respuesta.tipo,
              estado: "Pendiente",
              cumple: "",
              motivo: "Ítem sin diligenciar en la verificación diaria.",
              observacion: "",
              observaciones: "",
              fecha,
            });
          }

          if (estadoNormalizado === "no aplica" && observacion) {
            itemsNoAplica.push({
              id: `${key}_no_aplica`,
              categoria: categoria.nombre,
              codigo: item.codigo,
              item: item.descripcion,
              descripcion: item.descripcion,
              tipo: respuesta.tipo,
              estado: "No aplica",
              cumple: cumpleOriginal,
              motivo: "Ítem marcado como No aplica por el operario.",
              observacion,
              observaciones: observacion,
              fecha,
            });
          }

          if (cumpleNormalizado === "no cumple" && observacion) {
            itemsNoCumple.push({
              id: `${key}_no_cumple`,
              categoria: categoria.nombre,
              codigo: item.codigo,
              item: item.descripcion,
              descripcion: item.descripcion,
              tipo: respuesta.tipo,
              estado: estadoOriginal,
              cumple: "No cumple",
              motivo: "Ítem marcado como No cumple por el operario.",
              observacion,
              observaciones: observacion,
              fecha,
            });
          }
        });
      });

      const payload: Omit<ReporteVerificacion, "id"> = {
        movilId: movilVerificando.id,
        movilNombre: texto(movilVerificando.nombre, "Móvil sin nombre"),
        placa: texto(movilVerificando.placa),
        fecha,
        kilometraje: kilometraje.trim(),
        datos,
        completados,
        totalItems,
        porcentaje,
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, "clientes", clienteId, "verificacionesMoviles", fecha, "reportes", movilVerificando.id),
        payload,
        { merge: true },
      );

      await setDoc(
        doc(db, "clientes", clienteId, "moviles", movilVerificando.id),
        { kilometrajeActual: kilometraje.trim(), ultimaVerificacionDiaria: fecha, updatedAt: serverTimestamp() },
        { merge: true },
      );

      const pendientes = Math.max(totalItems - completados, 0);
      const motivosDetalle = [...itemsPendientes, ...itemsNoCumple, ...itemsNoAplica];
      const alertaActiva = pendientes > 0 || itemsNoCumple.length > 0 || itemsNoAplica.length > 0;
      const nombreMovil = texto(movilVerificando.nombre, "Móvil sin nombre");
      const placaMovil = texto(movilVerificando.placa);
      const mensajeAlerta = alertaActiva
        ? pendientes > 0
          ? `Móvil ${nombreMovil} con verificación diaria incompleta: ${completados}/${totalItems}.`
          : `Móvil ${nombreMovil} con novedades en la verificación diaria.`
        : `Móvil ${nombreMovil} con verificación diaria completa y sin novedades.`;

      const alertaPayload = {
        activo: alertaActiva,
        tipo: "verificaciones_diarias",
        categoria: "verificaciones móviles",
        movilId: movilVerificando.id,
        movilNombre: nombreMovil,
        nombreMovil,
        placa: placaMovil,
        fecha,
        fechaVerificacion: fecha,
        totalItems,
        totalChecks: totalItems,
        diligenciados: completados,
        respondidos: completados,
        pendientes,
        porcentaje,
        totalNovedades: itemsNoCumple.length + itemsNoAplica.length,
        totalNoCumple: itemsNoCumple.length,
        totalNoAplica: itemsNoAplica.length,
        itemsPendientes,
        itemsNoCumple,
        itemsNoAplica,
        motivos: motivosDetalle,
        motivosDetalle,
        mensaje: mensajeAlerta,
        updatedAt: serverTimestamp(),
        fechaGeneracion: serverTimestamp(),
      };

      await setDoc(
        doc(db, "clientes", clienteId, "alertas", "verificaciones_diarias"),
        {
          tipo: "grupo_alertas",
          categoria: "verificaciones móviles",
          nombre: "Verificaciones diarias",
          descripcion: "Alertas agrupadas por vehículo y fecha.",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "alertas",
          "verificaciones_diarias",
          "vehiculos",
          movilVerificando.id,
        ),
        {
          activo: alertaActiva,
          tipo: "verificaciones_diarias",
          movilId: movilVerificando.id,
          movilNombre: nombreMovil,
          nombreMovil,
          placa: placaMovil,
          ultimaFecha: fecha,
          pendientes,
          porcentaje,
          totalNovedades: itemsNoCumple.length + itemsNoAplica.length,
          mensaje: mensajeAlerta,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "alertas",
          "verificaciones_diarias",
          "vehiculos",
          movilVerificando.id,
          "fechas",
          fecha,
        ),
        alertaPayload,
        { merge: true },
      );

      setModalVerificacionOpen(false);
      mostrarMensaje("Verificación diaria guardada correctamente.");
    } catch (error) {
      console.error("Error guardando verificación:", error);
      mostrarMensaje("No fue posible guardar la verificación diaria.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const buscarHistorial = async () => {
    if (!clienteId || !fechaHistorial) return;
    setCargandoReportes(true);
    try {
      const snap = await getDocs(collection(db, "clientes", clienteId, "verificacionesMoviles", fechaHistorial, "reportes"));
      const data = snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ReporteVerificacion, "id">) }));
      data.sort((a, b) => texto(a.movilNombre).localeCompare(texto(b.movilNombre), "es"));
      setReportes(data);
    } catch (error) {
      console.error("Error buscando reportes:", error);
      setReportes([]);
      mostrarMensaje("No fue posible cargar el historial.", "error");
    } finally {
      setCargandoReportes(false);
    }
  };

  const abrirHistorial = () => {
    setFechaHistorial(HOY);
    setReportes([]);
    setReporteDetalle(null);
    setModalHistorialOpen(true);
    window.setTimeout(() => buscarHistorial(), 50);
  };

  const cerrarSesion = async () => {
    await signOut(auth);
    window.localStorage.removeItem("clienteSesion");
    router.replace("/login_users");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f5fa] flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-xl border border-slate-100 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-semibold text-slate-600">Cargando verificaciones...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5fa] text-slate-700">
      {menuOpen && <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white shadow-[0_0_35px_rgba(15,23,42,0.25)] transition-all duration-300 lg:translate-x-0 ${menuCollapsed ? "lg:w-20" : "lg:w-72"} ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className={`border-b border-white/10 ${menuCollapsed ? "px-3 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" title="Ir al inicio" className="min-w-0 flex-1">
                <img
                  src={logo}
                  alt="Marthin"
                  className={`h-12 object-contain ${menuCollapsed ? "mx-auto w-12" : "w-36 object-left"}`}
                />
              </Link>
              <button
                type="button"
                onClick={() => setMenuCollapsed((actual) => !actual)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-base font-black text-white transition hover:bg-white/20 lg:flex"
                title={menuCollapsed ? "Expandir menú" : "Encoger menú"}
                aria-label={menuCollapsed ? "Expandir menú" : "Encoger menú"}
              >
                ☰
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="ml-auto rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            {!menuCollapsed && <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>}
          </div>

          <nav className={`flex-1 overflow-y-auto py-5 text-sm font-semibold ${menuCollapsed ? "px-2" : "px-4"}`}>
            <Link
              href="/dashboard"
              title="Inicio"
              className={`flex items-center rounded-2xl px-4 py-3 transition ${menuCollapsed ? "justify-center" : "gap-3"} ${
                pathname === "/dashboard" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {menuCollapsed ? "I" : "Inicio"}
            </Link>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setConfigOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/empresa") || pathname.startsWith("/configuraciones/usuarios") || pathname.startsWith("/configuraciones/ubicaciones")
                    ? "bg-white/10 text-white"
                    : "text-white/80"
                }`}
                title="1. Configuraciones"
              >
                <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{configOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && configOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/empresa" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/empresa" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.1 Empresa</Link>
                  <Link href="/configuraciones/usuarios" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/usuarios" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.2 Usuarios y Roles</Link>
                  <Link href="/configuraciones/ubicaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/ubicaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.3 Móviles y Bodegas</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOperativaOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/autoevaluacion") || pathname.startsWith("/configuraciones/asignaciones") ? "bg-white/10 text-white" : "text-white/80"
                }`}
                title="2. Área operativa"
              >
                <span>{menuCollapsed ? "2" : "2. Área operativa"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{operativaOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && operativaOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/autoevaluacion" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/autoevaluacion" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>2.1 Autoevaluación General</Link>
                  <Link href="/configuraciones/asignaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/asignaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>2.2 Asignaciones a Móviles</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMovilesOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/verificaciones") || pathname.startsWith("/configuraciones/mantenimientos") || pathname.startsWith("/configuraciones/infracciones") ? "bg-white/10 text-white" : "text-white/80"
                }`}
                title="3. Móviles"
              >
                <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{movilesOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && movilesOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/verificaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/verificaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.1 Verificación diaria</Link>
                  <Link href="/configuraciones/mantenimientos" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/mantenimientos" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.2 Programación de Mantenimientos</Link>
                  <Link href="/configuraciones/infracciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/infracciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.3 Gestión de Infracciones</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setTareasOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${pathname.startsWith("/configuraciones/tareas") ? "bg-white/10 text-white" : "text-white/80"}`}
                title="4. Tareas"
              >
                <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{tareasOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && tareasOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/tareas" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/tareas" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>4.1 Programar tareas</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSoporteOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${pathname.startsWith("/configuraciones/soportea") ? "bg-white/10 text-white" : "text-white/80"}`}
                title="5. Soporte"
              >
                <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{soporteOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && soporteOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/soportea" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/soportea" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>5.1 Solicitar un soporte</Link>
                </div>
              )}
            </div>
          </nav>

          {!menuCollapsed && (
            <div className="border-t border-white/10 p-4 text-[11px] text-white/40">
              <p>Un producto de Famiasistir</p>
              <p>Desarrollado por Printserp SAS</p>
            </div>
          )}
        </div>
      </aside>

      <section className={menuCollapsed ? "lg:pl-20" : "lg:pl-72"}>
        <header className="sticky top-0 z-20 bg-[#f4f5fa]/90 backdrop-blur px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-4 py-3 shadow-[0_10px_30px_rgba(79,70,229,0.22)] border border-white/40 text-white">
            <button type="button" onClick={() => setMenuOpen(true)} className="rounded-xl p-2 text-white/90 hover:bg-white/15 lg:hidden" aria-label="Abrir menú">☰</button>
            <div className="hidden sm:block">
              <p className="text-[11px] font-medium text-white/70">Hola,</p>
              <h1 className="text-sm font-bold text-white line-clamp-1">{nombreHeader}</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] font-medium text-white/70">Sesión cliente</p>
                <p className="max-w-[150px] truncate text-xs font-semibold text-white sm:max-w-[240px]">{user?.email || clienteSesion?.email || "cliente"}</p>
              </div>
              <button type="button" onClick={cerrarSesion} className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25">Cerrar sesión</button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
          {mensaje && (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${tipoMensaje === "ok" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"}`}>{mensaje}</div>
          )}

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">Gestión móviles / 3.1</p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">Verificaciones Diarias</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Inspección diaria por móvil con checklist configurable, kilometraje y control de vencimientos.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={abrirHistorial} className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400">Ver historial</button>
                <button type="button" onClick={abrirConfig} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 hover:bg-amber-400">Configurar check</button>
              </div>
            </div>
            <div className="mt-5 max-w-md">
              <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">Buscar móvil</label>
              <input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre, placa, tipo..." className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white" />
            </div>
          </section>

          <section>
            {movilesFiltradas.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-lg font-black text-slate-700">No hay móviles activas</p>
                <p className="mt-2 text-sm text-slate-500">Crea o activa una móvil desde Configuraciones / Ubicaciones.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {movilesFiltradas.map((movil) => (
                  <article key={movil.id} className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_4px_22px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.10)]">
                    <div className="relative h-36 overflow-hidden bg-slate-100">
                      <img src={fotoMovil(movil)} alt={texto(movil.nombre, "Móvil")} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      <div className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${movilActivo(movil) ? "bg-emerald-500" : "bg-red-500"}`}>{estadoMovil(movil)}</div>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-1 text-base font-black text-slate-800">{texto(movil.nombre, "Móvil sin nombre")}</h3>
                      <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-400">{texto(movil.denominacion, movil.modelo, "Sin denominación")}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">{texto(movil.tipo, "Sin tipo")}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{texto(movil.placa, "Sin placa")}</span>
                      </div>
                      <p className="mt-3 text-xs font-bold text-slate-500">KM: {texto(movil.kilometrajeActual, movil.kilometrajeInicial, "Sin dato")}</p>
                      <button type="button" onClick={() => abrirVerificacion(movil)} className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500">Verificar</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {modalConfigOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-amber-500 px-5 py-4 text-white">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/80">Configuración</p>
                <h3 className="text-lg font-black">Checklist de verificación</h3>
              </div>
              <button type="button" onClick={() => setModalConfigOpen(false)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white hover:bg-white/30">Cerrar</button>
            </div>
            <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5">
              <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">Define si cada ítem se evalúa por Estado (Aplica / No aplica) o por Cumplimiento (Cumple / No cumple).</p>
              <div className="space-y-4">
                {CATEGORIAS_VERIFICACION.map((categoria) => (
                  <section key={categoria.nombre} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                    <div className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-800">{categoria.nombre}</div>
                    <div className="divide-y divide-slate-100">
                      {categoria.items.map((item) => {
                        const key = itemKey(item.codigo);
                        const value = configTemporal[key] || "cumple";
                        return (
                          <div key={key} className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_260px] sm:items-center">
                            <p className="font-bold text-slate-600">{item.codigo} - {item.descripcion}</p>
                            <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-black">
                              <button type="button" onClick={() => setConfigTemporal((actual) => ({ ...actual, [key]: "estado" }))} className={`flex-1 rounded-xl px-3 py-2 ${value === "estado" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Estado</button>
                              <button type="button" onClick={() => setConfigTemporal((actual) => ({ ...actual, [key]: "cumple" }))} className={`flex-1 rounded-xl px-3 py-2 ${value === "cumple" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Cumple</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button type="button" onClick={() => setModalConfigOpen(false)} className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-300">Cancelar</button>
              <button type="button" onClick={guardarConfiguracion} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500">Guardar configuración</button>
            </div>
          </div>
        </div>
      )}

      {modalVerificacionOpen && movilVerificando && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-2 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Verificación diaria</p>
                <h3 className="truncate text-lg font-black">{texto(movilVerificando.nombre, "Móvil sin nombre")}</h3>
                <p className="text-xs font-bold text-white/75">{texto(movilVerificando.placa, "Sin placa")} · {hoyIso()}</p>
              </div>
              <button type="button" onClick={() => setModalVerificacionOpen(false)} className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25">Cerrar</button>
            </div>
            <div className="max-h-[calc(94vh-150px)] overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-3 md:grid-cols-5">
                <Campo label="Kilometraje"><input type="number" value={kilometraje} onChange={(event) => setKilometraje(event.target.value)} placeholder="Sin kilometraje aún" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-300 focus:bg-white" /></Campo>
                <Campo label="SOAT"><input readOnly value={etiquetaDias(movilVerificando.soatExpiry)} className={`w-full rounded-2xl border px-4 py-3 text-sm font-black outline-none ${estaVencido(movilVerificando.soatExpiry) ? "border-red-200 bg-red-600 text-white animate-pulse" : "border-slate-200 bg-slate-50 text-slate-600"}`} /></Campo>
                <Campo label="Tecnomecánica"><input readOnly value={etiquetaDias(movilVerificando.tecnomecanicaExpiry)} className={`w-full rounded-2xl border px-4 py-3 text-sm font-black outline-none ${estaVencido(movilVerificando.tecnomecanicaExpiry) ? "border-red-200 bg-red-600 text-white animate-pulse" : "border-slate-200 bg-slate-50 text-slate-600"}`} /></Campo>
                <Campo label="Aceite"><input readOnly value={etiquetaDias(texto(movilVerificando.aceiteExpiry, movilVerificando.aceiteVencimiento, movilVerificando.oilExpiry))} className={`w-full rounded-2xl border px-4 py-3 text-sm font-black outline-none ${estaVencido(texto(movilVerificando.aceiteExpiry, movilVerificando.aceiteVencimiento, movilVerificando.oilExpiry)) ? "border-red-200 bg-red-600 text-white animate-pulse" : "border-slate-200 bg-slate-50 text-slate-600"}`} /></Campo>
                <Campo label="Póliza todo riesgo"><input readOnly value={etiquetaDias(movilVerificando.policyAllRiskExpiry)} className={`w-full rounded-2xl border px-4 py-3 text-sm font-black outline-none ${estaVencido(movilVerificando.policyAllRiskExpiry) ? "border-red-200 bg-red-600 text-white animate-pulse" : "border-slate-200 bg-slate-50 text-slate-600"}`} /></Campo>
              </div>

              <div className="mt-5 space-y-4">
                {CATEGORIAS_VERIFICACION.map((categoria) => (
                  <section key={categoria.nombre} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                    <div className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-800">{categoria.nombre}</div>
                    <div className="divide-y divide-slate-100">
                      {categoria.items.map((item) => {
                        const key = itemKey(item.codigo);
                        const tipo = configuracionCheck[key] || "cumple";
                        const actual = respuestas[key] || ({} as RespuestaItem);
                        const diligenciado = tipo === "estado" ? Boolean(actual.estado) : Boolean(actual.cumple);
                        return (
                          <div key={key} className={`grid gap-3 px-4 py-3 text-sm xl:grid-cols-[1.2fr_220px_220px_1fr] xl:items-center ${diligenciado ? "bg-emerald-50/50" : "bg-red-50/45"}`}>
                            <p className="font-black text-slate-700">{item.codigo} - {item.descripcion}</p>
                            <select value={actual.estado || ""} disabled={tipo !== "estado"} onChange={(event) => actualizarRespuesta(item.codigo, "estado", event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none disabled:bg-slate-100 disabled:text-slate-300">
                              <option value="">Estado</option>
                              <option value="Aplica">Aplica</option>
                              <option value="No aplica">No aplica</option>
                            </select>
                            <select value={actual.cumple || ""} disabled={tipo !== "cumple"} onChange={(event) => actualizarRespuesta(item.codigo, "cumple", event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none disabled:bg-slate-100 disabled:text-slate-300">
                              <option value="">Cumplimiento</option>
                              <option value="Cumple">Cumple</option>
                              <option value="No cumple">No cumple</option>
                            </select>
                            <input value={actual.observaciones || ""} onChange={(event) => actualizarRespuesta(item.codigo, "observaciones", event.target.value)} placeholder="Observaciones" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-indigo-300" />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button type="button" onClick={() => setModalVerificacionOpen(false)} className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-300">Cerrar</button>
              <button type="button" disabled={guardando} onClick={guardarVerificacion} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-60">{guardando ? "Guardando..." : "Guardar verificación"}</button>
            </div>
          </div>
        </div>
      )}

      {modalHistorialOpen && (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-sky-500 px-5 py-4 text-white">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Historial</p>
                <h3 className="text-lg font-black">Reportes de verificaciones diarias</h3>
              </div>
              <button type="button" onClick={() => setModalHistorialOpen(false)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white hover:bg-white/30">Cerrar</button>
            </div>
            <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <Campo label="Fecha"><input type="date" value={fechaHistorial} onChange={(event) => setFechaHistorial(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-sky-300 focus:bg-white" /></Campo>
                <button type="button" onClick={buscarHistorial} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400">Buscar</button>
              </div>

              {cargandoReportes ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">Cargando reportes...</div>
              ) : reportes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">No hay reportes para la fecha seleccionada.</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                      <tr><th className="px-4 py-3">Móvil</th><th className="px-4 py-3">Kilometraje</th><th className="px-4 py-3">Cumplimiento</th><th className="px-4 py-3 text-right">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportes.map((reporte) => (
                        <tr key={reporte.id} className="bg-white">
                          <td className="px-4 py-3"><p className="font-black text-slate-700">{reporte.movilNombre}</p><p className="text-xs font-bold text-slate-400">{reporte.placa || reporte.movilId}</p></td>
                          <td className="px-4 py-3 font-bold text-slate-600">{reporte.kilometraje || "N/A"}</td>
                          <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{reporte.porcentaje}%</span><p className="mt-1 text-[11px] font-bold text-slate-400">{reporte.completados}/{reporte.totalItems}</p></td>
                          <td className="px-4 py-3 text-right"><button type="button" onClick={() => setReporteDetalle(reporte)} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100">Ver</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reporteDetalle && (
                <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-black text-slate-800">{reporteDetalle.movilNombre}</h4>
                      <p className="text-xs font-bold text-slate-500">{reporteDetalle.fecha} · KM {reporteDetalle.kilometraje || "N/A"}</p>
                    </div>
                    <button type="button" onClick={() => setReporteDetalle(null)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-500 ring-1 ring-slate-200">Ocultar</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {CATEGORIAS_VERIFICACION.map((categoria) => (
                      <section key={categoria.nombre} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                        <div className="bg-slate-50 px-4 py-2 text-xs font-black text-slate-700">{categoria.nombre}</div>
                        <div className="divide-y divide-slate-100">
                          {categoria.items.map((item) => {
                            const data = reporteDetalle.datos?.[itemKey(item.codigo)];
                            const valor = data?.tipo === "estado" ? data.estado : data?.cumple;
                            return (
                              <div key={item.codigo} className="grid gap-2 px-4 py-2 text-xs sm:grid-cols-[1fr_160px_1fr]">
                                <p className="font-bold text-slate-600">{item.codigo} - {item.descripcion}</p>
                                <p className={`font-black ${valor ? "text-emerald-700" : "text-red-600"}`}>{valor || "Sin diligenciar"}</p>
                                <p className="font-semibold text-slate-400">{data?.observaciones || "Sin observaciones"}</p>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                    {Boolean(reporteDetalle.updatedAt) && (
  <p className="text-right text-[11px] font-bold text-slate-400">
    Actualizado: {formatDateTime(reporteDetalle.updatedAt)}
  </p>
)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
