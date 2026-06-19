"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

type ClienteSesion = {
  uid?: string;
  email?: string;
  clienteId?: string;
  nit?: string;
  razonSocial?: string;
};

type UsuarioSesion = {
  uid?: string;
  usuarioId?: string;
  clienteId?: string;
  nit?: string;
  email?: string;
  nombres?: string;
  apellidos?: string;
  tipoFuncionario?: string;
  rol?: string;
  fotoUrl?: string;
  kilometrajeActual?: string;
  kilometrajeInicial?: string;
  soatExpiry?: string;
  tecnomecanicaExpiry?: string;
  policyAllRiskExpiry?: string;
  aceiteExpiry?: string;
  aceiteVencimiento?: string;
  oilExpiry?: string;
};

type ClienteData = {
  razonSocial?: string;
  nombreComercial?: string;
  logoUrl?: string;
  representante?: string;
  Representante?: string;
  [key: string]: unknown;
};

type UsuarioCliente = {
  id: string;
  uidAuth?: string;
  nombres: string;
  apellidos: string;
  email: string;
  tipoFuncionario: string;
  rol: string;
  estado: string;
  fotoUrl?: string;
  clienteId: string;
};

type MovilAsignada = {
  id: string;
  nombre: string;
  placa: string;
  tipo: string;
  modelo?: string;
  denominacion?: string;
  estado?: string;
  fotoUrl?: string;
  kilometrajeActual?: string;
  kilometrajeInicial?: string;
  soatExpiry?: string;
  tecnomecanicaExpiry?: string;
  policyAllRiskExpiry?: string;
  aceiteExpiry?: string;
  aceiteVencimiento?: string;
  oilExpiry?: string;
};

type AsignacionBodegaMovil = {
  id: string;
  codigoBarras: string;
  codigoPrincipal: string;
  categoria: string;
  producto: string;
  tipo: string;
  productoId: string;
  asociadoId?: string;
  gestionado: boolean;
  codigoEscaneado?: string;
  fechaGestion?: unknown;
  usado?: boolean;
  motivoUso?: string;
  fechaUso?: unknown;
};

type CategoriaAutoevaluacion = {
  categoria: string;
  totalItems: number;
  diligenciados: number;
  porcentaje: number;
  productos: AsignacionBodegaMovil[];
};

type PersonalAsignadoMovil = {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  tipoFuncionario: string;
  rol: string;
  estado: string;
  fotoUrl?: string;
};

type PanelActivo = "alertas" | "tareas" | "autoevaluacion" | "verificacion";

type PuntoMapa = { lat: number; lng: number };

type MotivoAlertaUsuario = {
  id: string;
  categoria: string;
  item: string;
  codigo: string;
  estado: string;
  observacion: string;
  motivo: string;
  fecha: string;
};

type AlertaMovilUsuario = {
  id: string;
  tipo: string;
  categoria: string;
  movilId: string;
  movilNombre: string;
  placa: string;
  mensaje: string;
  totalItems: number;
  diligenciados: number;
  pendientes: number;
  porcentaje: number;
  categoriasPendientes: Array<{
    categoria: string;
    totalItems: number;
    diligenciados: number;
    pendientes: number;
    porcentaje: number;
  }>;
  motivos?: MotivoAlertaUsuario[];
  clase?: "autoevaluacion" | "verificacion" | "movil" | "tarea" | "infraccion";
  fecha?: string;
  activo?: boolean;
  updatedAt?: unknown;
};

type TipoCheck = "estado" | "cumple";

type VerificacionItem = {
  codigo: string;
  descripcion: string;
};

type CategoriaVerificacion = {
  nombre: string;
  items: VerificacionItem[];
};

type RespuestaVerificacion = {
  codigo: string;
  descripcion: string;
  tipo: TipoCheck;
  estado?: string;
  cumple?: string;
  observaciones?: string;
};

type ConfiguracionCheck = Record<string, TipoCheck>;

type MovilVerificacionData = MovilAsignada & {
  kilometrajeActual?: string;
  kilometrajeInicial?: string;
  soatExpiry?: string;
  tecnomecanicaExpiry?: string;
  policyAllRiskExpiry?: string;
  aceiteExpiry?: string;
  aceiteVencimiento?: string;
  oilExpiry?: string;
};

type ArchivoMantenimiento = {
  nombre?: string;
  url?: string;
  path?: string;
  tipo?: string;
  autor?: string;
  autorId?: string;
  fecha?: string;
};

type ChatMantenimiento = {
  id: string;
  autor: string;
  rol: "admin" | "operario";
  mensaje: string;
  fecha: string;
};

type MantenimientoUsuario = {
  id: string;
  movilId: string;
  movilNombre: string;
  placa?: string;
  kilometraje?: string;
  fecha: string;
  coordinador?: string;
  tipoMantenimiento: "preventivo" | "correctivo" | string;
  sistema: string;
  tareas?: Record<string, string>;
  fallaReportada?: string;
  frecuenciaKm?: string;
  diasAlerta?: string;
  asignadoA: string;
  asignadoNombre?: string;
  programarServicioCon?: string;
  proveedorNombre?: string;
  novedadesConductor?: string;
  estadoGestion?: "resuelto" | "incompleto" | "sin realizar" | "programado" | string;
  fechaGestion?: string;
  tareaRealizada?: string;
  observacionesAdmin?: string;
  numeroFactura?: string;
  comprobanteUrl?: string;
  fotos?: ArchivoMantenimiento[];
  fotosOperario?: ArchivoMantenimiento[];
  chatMantenimiento?: ChatMantenimiento[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

type PrioridadTareaUsuario = "inmediato" | "alta" | "media" | "baja" | string;
type EstadoTareaUsuario = "pendiente" | "realizado" | "no realizado" | "incompleto" | string;

type ChatTareaUsuario = {
  id: string;
  autor: string;
  autorId?: string;
  rol: "admin" | "operario" | "sistema";
  mensaje: string;
  fecha?: unknown;
};

type TareaProgramadaUsuario = {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  tipoFuncionario: string;
  rol: string;
  descripcion: string;
  prioridad: PrioridadTareaUsuario;
  fechaCreacion: string;
  fechaMaxima: string;
  estadoFinal: EstadoTareaUsuario;
  observaciones: string;
  creadoPorId?: string;
  creadoPorNombre?: string;
  chatTarea?: ChatTareaUsuario[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DEFAULT_LOGO = "/logo.png";
const MAPS_SCRIPT_ID = "google-maps-dashboard-user-script";
const MAPS_SRC =
  "https://maps.googleapis.com/maps/api/js?key=AIzaSyAVp1ZPKd_HkrlwO5hD6njsn6h_reqaCEw&callback=initAllMaps&libraries=places";

const HOY = new Date().toISOString().slice(0, 10);

const CATEGORIAS_VERIFICACION: CategoriaVerificacion[] = [
  { nombre: "Estado de Presentación (1)", items: [{ codigo: "1.3", descripcion: "Latas" }, { codigo: "1.4", descripcion: "Pintura" }] },
  { nombre: "Estado de Comodidad (2)", items: [{ codigo: "2.1", descripcion: "Aire Acondicionado" }, { codigo: "2.2", descripcion: "Silletería (Anclaje, estado)" }, { codigo: "2.3", descripcion: "Encendedor" }, { codigo: "2.4", descripcion: "Luz Interior o de techo" }] },
  { nombre: "Niveles y perdidas de líquidos (3)", items: [{ codigo: "3.1", descripcion: "Nivel de Aceite de motor" }, { codigo: "3.2", descripcion: "Nivel de liquido de frenos" }, { codigo: "3.3", descripcion: "Nivel de agua del radiador" }, { codigo: "3.4", descripcion: "Nivel de agua de la batería" }, { codigo: "3.5", descripcion: "Nivel de aceite hidráulico" }, { codigo: "3.6", descripcion: "Fugas de A.C.P.M" }, { codigo: "3.7", descripcion: "Fugas de Agua" }, { codigo: "3.8", descripcion: "Fugas de Aceite de transmisión" }, { codigo: "3.9", descripcion: "Fuga aceite de caja" }, { codigo: "3.10", descripcion: "Fugas de líquidos de frenos" }] },
  { nombre: "Tablero de Control (4)", items: [{ codigo: "4.1", descripcion: "Instrumentos" }, { codigo: "4.2", descripcion: "Luces de Tablero" }, { codigo: "4.3", descripcion: "Nivel de Combustible" }, { codigo: "4.4", descripcion: "Odómetro" }, { codigo: "4.5", descripcion: "Pito" }, { codigo: "4.6", descripcion: "Tacómetro" }, { codigo: "4.7", descripcion: "Velocímetro" }, { codigo: "4.8", descripcion: "Indicador de Aceite" }, { codigo: "4.9", descripcion: "Indicador de Temperatura" }] },
  { nombre: "Seguridad Pasiva (5)", items: [{ codigo: "5.1", descripcion: "Cinturones de Seguridad" }, { codigo: "5.2", descripcion: "Airbags" }, { codigo: "5.3", descripcion: "Chasis y carrocería" }, { codigo: "5.4", descripcion: "Cristales (Vidrios)" }, { codigo: "5.5", descripcion: "Apoyacabezas" }, { codigo: "5.6", descripcion: "Estado Espejos" }, { codigo: "5.6A", descripcion: "Espejo Lateral Derecho" }, { codigo: "5.6B", descripcion: "Espejo Lateral Izquierdo" }, { codigo: "5.6C", descripcion: "Espejo Retrovisor" }] },
  { nombre: "Seguridad Activa (6)", items: [{ codigo: "6.1", descripcion: "Estado de la Dirección" }, { codigo: "6.2", descripcion: "Estado Suspensión Delantera" }, { codigo: "6.2.1", descripcion: "Amortiguadores (Delantera)" }, { codigo: "6.3", descripcion: "Estado suspensión Trasera" }, { codigo: "6.3.1", descripcion: "Amortiguadores (Trasera)" }, { codigo: "6.4", descripcion: "Estado Parabrisas" }, { codigo: "6.4A", descripcion: "Vidrio Frontal" }, { codigo: "6.4B", descripcion: "Limpiabrisas Derecho" }, { codigo: "6.4C", descripcion: "Limpiabrisas Izquierdo" }, { codigo: "6.4D", descripcion: "Lavaparabrisas" }, { codigo: "6.5", descripcion: "Estado de Luces" }, { codigo: "6.5.1", descripcion: "Luces Medias" }, { codigo: "6.5.2", descripcion: "Luces Altas" }, { codigo: "6.5.3", descripcion: "Luces Bajas" }, { codigo: "6.5.4", descripcion: "Direccional Izquie. Delant." }, { codigo: "6.5.5", descripcion: "Direccional Derec. Delant." }, { codigo: "6.5.6", descripcion: "Direccional Izquie. Trasera" }, { codigo: "6.5.7", descripcion: "Direccional Derec. Trasera" }, { codigo: "6.5.8", descripcion: "Luces de Parqueo" }, { codigo: "6.5.9", descripcion: "Luz Freno" }, { codigo: "6.5.10", descripcion: "Luz Reverso" }, { codigo: "6.5.11", descripcion: "L. Antiniebla Exploradoras" }, { codigo: "6.6", descripcion: "Estado Llantas (Labrado, Presión)" }, { codigo: "6.6.1", descripcion: "Delantera Derecha" }, { codigo: "6.6.2", descripcion: "Delantera Izquierda" }, { codigo: "6.6.3", descripcion: "Trasera Derecha" }, { codigo: "6.6.4", descripcion: "Trasera Izquierda" }, { codigo: "6.6.5", descripcion: "Repuesto" }, { codigo: "6.6.6", descripcion: "Presión aire llanta" }, { codigo: "6.6.7", descripcion: "Rines" }, { codigo: "6.7", descripcion: "Frenos" }, { codigo: "6.7.1", descripcion: "Estado de los Frenos" }, { codigo: "6.7.2", descripcion: "Freno de Mano" }, { codigo: "6.7.3", descripcion: "Pastillas" }] },
  { nombre: "Otros (7)", items: [{ codigo: "7.1", descripcion: "Instalaciones eléctricas" }, { codigo: "7.2", descripcion: "Clutch" }, { codigo: "7.3", descripcion: "Exosto" }, { codigo: "7.4", descripcion: "Alarma Sonora de Reversa" }, { codigo: "7.5", descripcion: "Salto de cambios" }, { codigo: "7.6", descripcion: "Cambios suaves" }, { codigo: "7.7", descripcion: "Guaya del acelerador" }, { codigo: "7.8", descripcion: "Sistema de embrague" }, { codigo: "7.9", descripcion: "Encendido" }, { codigo: "7.10", descripcion: "Sincronización" }, { codigo: "7.11", descripcion: "Placas" }] },
  { nombre: "Equipo de Carretera (8)", items: [{ codigo: "8.1", descripcion: "Gato con capacidad" }, { codigo: "8.3", descripcion: "2 tacos para bloquear" }, { codigo: "8.4", descripcion: "2 señales triangulares" }, { codigo: "8.5", descripcion: "Guantes de lona" }, { codigo: "8.6", descripcion: "Cruceta" }, { codigo: "8.7", descripcion: "Cable de iniciar" }, { codigo: "8.9", descripcion: "2 conos reflectivos" }, { codigo: "8.10", descripcion: "Linterna recargable" }, { codigo: "8.11", descripcion: "Caja de herramientas" }] },
];

function itemKey(codigo: string) {
  return codigo.replace(/\./g, "_");
}

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
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

function limpiarId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140);
}

const normalizarTexto = (value: unknown, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const normalizarCorreo = (value: unknown) =>
  normalizarTexto(value).toLowerCase();

const calcularPorcentaje = (total: number, diligenciados: number) => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((diligenciados / total) * 100)));
};

function formatearFecha(value: unknown) {
  if (!value) return "";
  try {
    if (typeof value === "string") {
      const fecha = new Date(value);
      return Number.isNaN(fecha.getTime())
        ? value
        : fecha.toLocaleString("es-CO", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
    }

    if (typeof value === "object" && value !== null) {
      const posibleTimestamp = value as {
        seconds?: number;
        toDate?: () => Date;
      };
      const fecha =
        typeof posibleTimestamp.toDate === "function"
          ? posibleTimestamp.toDate()
          : typeof posibleTimestamp.seconds === "number"
            ? new Date(posibleTimestamp.seconds * 1000)
            : null;

      if (fecha && !Number.isNaN(fecha.getTime())) {
        return fecha.toLocaleString("es-CO", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
  } catch {
    return "";
  }

  return "";
}

function leerLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function extraerFotoMovil(data: Record<string, unknown>) {
  if (typeof data.fotoUrl === "string" && data.fotoUrl.trim())
    return data.fotoUrl;
  if (typeof data.imagenUrl === "string" && data.imagenUrl.trim())
    return data.imagenUrl;

  const fotos = data.fotos;
  if (Array.isArray(fotos)) {
    for (const item of fotos) {
      if (typeof item === "string" && item.trim()) return item;
      if (item && typeof item === "object") {
        const url = (item as any).url || (item as any).downloadURL;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }

  if (fotos && typeof fotos === "object") {
    for (const item of Object.values(fotos as Record<string, any>)) {
      if (typeof item === "string" && item.trim()) return item;
      if (item && typeof item === "object") {
        const url = item.url || item.downloadURL;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }

  return "";
}

async function buscarUsuarioOperativo(
  firebaseUser: User,
): Promise<UsuarioCliente | null> {
  const emailAuth = normalizarCorreo(firebaseUser.email || "");
  const consultas = [
    query(
      collectionGroup(db, "usuarios"),
      where("uidAuth", "==", firebaseUser.uid),
      limit(1),
    ),
    query(
      collectionGroup(db, "usuarios"),
      where("email", "==", emailAuth),
      limit(1),
    ),
  ];

  for (const consulta of consultas) {
    const snap = await getDocs(consulta);
    if (!snap.empty) {
      const documento = snap.docs[0];
      const clienteDoc = documento.ref.parent.parent;
      const clienteId = clienteDoc?.id || "";
      const data = documento.data() as Record<string, unknown>;
      const estado = normalizarTexto(data.estado, "ACTIVO").toUpperCase();
      if (estado !== "ACTIVO") return null;

      return {
        id: documento.id,
        uidAuth: normalizarTexto(data.uidAuth, firebaseUser.uid),
        nombres: normalizarTexto(data.nombres, "Usuario"),
        apellidos: normalizarTexto(data.apellidos, ""),
        email: normalizarCorreo(data.email || firebaseUser.email || ""),
        tipoFuncionario: normalizarTexto(data.tipoFuncionario, "Sin tipo"),
        rol: normalizarTexto(data.rol, "Sin rol"),
        estado,
        fotoUrl: normalizarTexto(data.fotoUrl, ""),
        clienteId,
      };
    }
  }

  return null;
}

export default function DashboardUserPage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const videoScannerRef = useRef<HTMLVideoElement | null>(null);
  const streamScannerRef = useRef<MediaStream | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const ubicacionWatchRef = useRef<number | null>(null);

  const [cargando, setCargando] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [usuario, setUsuario] = useState<UsuarioCliente | null>(null);
  const [movilesAsignadas, setMovilesAsignadas] = useState<MovilAsignada[]>([]);
  const [movilActivaId, setMovilActivaId] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [panelActivo, setPanelActivo] = useState<PanelActivo>("alertas");
  const [modalAutoevaluacionOpen, setModalAutoevaluacionOpen] = useState(false);
  const [categoriasAutoevaluacion, setCategoriasAutoevaluacion] = useState<
    CategoriaAutoevaluacion[]
  >([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(false);
  const [personalAsignado, setPersonalAsignado] = useState<
    PersonalAsignadoMovil[]
  >([]);
  const [modalAsignadosCategoria, setModalAsignadosCategoria] =
    useState<CategoriaAutoevaluacion | null>(null);
  const [productoEscaneo, setProductoEscaneo] =
    useState<AsignacionBodegaMovil | null>(null);
  const [scannerManual, setScannerManual] = useState("");
  const [scannerError, setScannerError] = useState("");
  const [guardandoEscaneo, setGuardandoEscaneo] = useState(false);
  const [guardandoDevolucion, setGuardandoDevolucion] = useState("");
  const [productoUso, setProductoUso] = useState<AsignacionBodegaMovil | null>(
    null,
  );
  const [motivoUso, setMotivoUso] = useState("");
  const [guardandoUso, setGuardandoUso] = useState(false);
  const [ubicacionUsuario, setUbicacionUsuario] = useState<PuntoMapa | null>(
    null,
  );
  const [ubicacionMensaje, setUbicacionMensaje] = useState("");
  const [ubicacionActiva, setUbicacionActiva] = useState(false);
  const [ultimaActualizacionUbicacion, setUltimaActualizacionUbicacion] =
    useState("");
  const [alertasMovilUsuario, setAlertasMovilUsuario] = useState<
    AlertaMovilUsuario[]
  >([]);
  const [cargandoAlertasUsuario, setCargandoAlertasUsuario] = useState(false);
  const [alertaMovilDetalle, setAlertaMovilDetalle] =
    useState<AlertaMovilUsuario | null>(null);
  const [configuracionCheck, setConfiguracionCheck] = useState<ConfiguracionCheck>({});
  const [movilVerificacionData, setMovilVerificacionData] =
    useState<MovilVerificacionData | null>(null);
  const [kilometrajeVerificacion, setKilometrajeVerificacion] = useState("");
  const [respuestasVerificacion, setRespuestasVerificacion] = useState<
    Record<string, RespuestaVerificacion>
  >({});
  const [guardandoVerificacion, setGuardandoVerificacion] = useState(false);
  const [mantenimientosUsuario, setMantenimientosUsuario] = useState<MantenimientoUsuario[]>([]);
  const [cargandoMantenimientosUsuario, setCargandoMantenimientosUsuario] = useState(false);
  const [mantenimientoDetalle, setMantenimientoDetalle] = useState<MantenimientoUsuario | null>(null);
  const [mensajeMantenimiento, setMensajeMantenimiento] = useState("");
  const [guardandoMensajeMantenimiento, setGuardandoMensajeMantenimiento] = useState(false);
  const [subiendoFotoMantenimiento, setSubiendoFotoMantenimiento] = useState(false);
  const [tareasProgramadasUsuario, setTareasProgramadasUsuario] = useState<TareaProgramadaUsuario[]>([]);
  const [cargandoTareasProgramadasUsuario, setCargandoTareasProgramadasUsuario] = useState(false);
  const [tareaProgramadaDetalle, setTareaProgramadaDetalle] = useState<TareaProgramadaUsuario | null>(null);
  const [mensajeTareaProgramada, setMensajeTareaProgramada] = useState("");
  const [guardandoMensajeTareaProgramada, setGuardandoMensajeTareaProgramada] = useState(false);
  const [alertasTareasProgramadasUsuario, setAlertasTareasProgramadasUsuario] = useState<AlertaMovilUsuario[]>([]);
  const [alertasInfraccionesUsuario, setAlertasInfraccionesUsuario] = useState<AlertaMovilUsuario[]>([]);

  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);
  const movilActiva = useMemo(
    () =>
      movilesAsignadas.find((movil) => movil.id === movilActivaId) ||
      movilesAsignadas[0] ||
      null,
    [movilesAsignadas, movilActivaId],
  );

  const nombreCompleto = useMemo(() => {
    const nombre =
      `${usuario?.nombres || ""} ${usuario?.apellidos || ""}`.trim();
    return nombre || user?.displayName || user?.email || "Usuario";
  }, [usuario, user]);

  const progresoGeneralAutoevaluacion = useMemo(() => {
    const total = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.totalItems,
      0,
    );
    const diligenciados = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.diligenciados,
      0,
    );
    return calcularPorcentaje(total, diligenciados);
  }, [categoriasAutoevaluacion]);

  const resumenAutoevaluacion = useMemo(() => {
    const total = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.totalItems,
      0,
    );
    const diligenciados = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.diligenciados,
      0,
    );
    return { total, diligenciados };
  }, [categoriasAutoevaluacion]);

  const totalChecksVerificacion = useMemo(
    () =>
      CATEGORIAS_VERIFICACION.reduce(
        (acumulado, categoria) => acumulado + categoria.items.length,
        0,
      ),
    [],
  );

  const resumenVerificacion = useMemo(() => {
    let completados = 0;
    CATEGORIAS_VERIFICACION.forEach((categoria) => {
      categoria.items.forEach((item) => {
        const key = itemKey(item.codigo);
        const tipo = configuracionCheck[key] || "cumple";
        const respuesta = respuestasVerificacion[key];
        if (tipo === "estado" ? Boolean(respuesta?.estado) : Boolean(respuesta?.cumple)) {
          completados += 1;
        }
      });
    });

    return {
      total: totalChecksVerificacion,
      completados,
      pendientes: Math.max(totalChecksVerificacion - completados, 0),
      porcentaje: calcularPorcentaje(totalChecksVerificacion, completados),
    };
  }, [configuracionCheck, respuestasVerificacion, totalChecksVerificacion]);

  const alertasActivasMovilUsuario = useMemo(
    () =>
      [...alertasMovilUsuario, ...alertasTareasProgramadasUsuario, ...alertasInfraccionesUsuario].filter(
        (alerta, index, lista) =>
          alerta.activo !== false &&
          lista.findIndex((item) => item.id === alerta.id) === index,
      ),
    [alertasMovilUsuario, alertasTareasProgramadasUsuario, alertasInfraccionesUsuario],
  );

  const mantenimientosActivosUsuario = useMemo(() => {
    return mantenimientosUsuario.filter((item) => {
      const estado = normalizarTexto(
        item.estadoGestion ||
          (item as any).estado ||
          (item as any).estadoMantenimiento ||
          "programado",
        "programado",
      )
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return estado !== "resuelto";
    });
  }, [mantenimientosUsuario]);



  const tareasProgramadasActivasUsuario = useMemo(() => {
    return tareasProgramadasUsuario.filter((item) => {
      const estado = normalizarTexto(item.estadoFinal, "pendiente")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return estado !== "realizado";
    });
  }, [tareasProgramadasUsuario]);

  const tareaProgramadaDetalleActual = useMemo(() => {
    if (!tareaProgramadaDetalle) return null;
    return (
      tareasProgramadasUsuario.find((item) => item.id === tareaProgramadaDetalle.id) ||
      tareaProgramadaDetalle
    );
  }, [tareaProgramadaDetalle, tareasProgramadasUsuario]);

  const estadoTareaClase = (estado?: string) => {
    const valor = normalizarTexto(estado, "pendiente").toLowerCase();
    if (valor === "realizado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (valor === "incompleto") return "border-amber-200 bg-amber-50 text-amber-700";
    if (valor === "no realizado") return "border-red-200 bg-red-50 text-red-700";
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  };

  const prioridadTareaClase = (prioridad?: string) => {
    const valor = normalizarTexto(prioridad, "media").toLowerCase();
    if (valor === "inmediato") return "border-red-200 bg-red-50 text-red-700";
    if (valor === "alta") return "border-orange-200 bg-orange-50 text-orange-700";
    if (valor === "baja") return "border-slate-200 bg-slate-50 text-slate-600";
    return "border-sky-200 bg-sky-50 text-sky-700";
  };

  const mantenimientoDetalleActual = useMemo(() => {
    if (!mantenimientoDetalle) return null;
    return (
      mantenimientosUsuario.find((item) => item.id === mantenimientoDetalle.id) ||
      mantenimientoDetalle
    );
  }, [mantenimientoDetalle, mantenimientosUsuario]);

  const fotosMantenimiento = (item?: MantenimientoUsuario | null) => [
    ...((Array.isArray(item?.fotos) ? item?.fotos : []) || []),
    ...((Array.isArray(item?.fotosOperario) ? item?.fotosOperario : []) || []),
  ];

  const estadoMantenimientoClase = (estado?: string) => {
    const valor = normalizarTexto(estado, "programado").toLowerCase();
    if (valor === "resuelto") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (valor === "incompleto") return "border-amber-200 bg-amber-50 text-amber-700";
    if (valor === "sin realizar") return "border-red-200 bg-red-50 text-red-700";
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  };

  const descripcionMantenimiento = (item: MantenimientoUsuario) => {
    if (item.tipoMantenimiento === "correctivo") {
      return normalizarTexto(item.fallaReportada, "Sin falla reportada.");
    }
    const tareas = Object.values(item.tareas || {}).filter(Boolean);
    return tareas.length ? tareas.join(", ") : "Sin tareas preventivas seleccionadas.";
  };

  const gruposAlertasMovilUsuario = useMemo(() => {
    const grupos = [
      {
        id: "tarea",
        titulo: "Tareas programadas",
        descripcion: "Tareas asignadas pendientes, incompletas o no realizadas.",
        color: "sky",
        alertas: alertasActivasMovilUsuario.filter((alerta) => alerta.clase === "tarea"),
      },
      {
        id: "verificacion",
        titulo: "Verificación diaria",
        descripcion: "Checklist diario, pendientes, no aplica y no cumple.",
        color: "amber",
        alertas: alertasActivasMovilUsuario.filter((alerta) => alerta.clase === "verificacion"),
      },
      {
        id: "autoevaluacion",
        titulo: "Autoevaluación de móvil",
        descripcion: "Elementos normativos pendientes por gestionar.",
        color: "indigo",
        alertas: alertasActivasMovilUsuario.filter((alerta) => alerta.clase === "autoevaluacion"),
      },
      {
        id: "infraccion",
        titulo: "Infracciones",
        descripcion: "Infracciones activas asignadas al conductor.",
        color: "rose",
        alertas: alertasActivasMovilUsuario.filter((alerta) => alerta.clase === "infraccion"),
      },
      {
        id: "movil",
        titulo: "Documentos / vencimientos",
        descripcion: "Vencimientos o novedades propias de la móvil.",
        color: "rose",
        alertas: alertasActivasMovilUsuario.filter(
          (alerta) =>
            alerta.clase !== "verificacion" &&
            alerta.clase !== "autoevaluacion" &&
            alerta.clase !== "tarea" &&
            alerta.clase !== "infraccion",
        ),
      },
    ];

    return grupos.filter((grupo) => grupo.alertas.length > 0);
  }, [alertasActivasMovilUsuario]);

  const estiloGrupoAlerta = (color: string) => {
    if (color === "sky") {
      return {
        contenedor: "border-sky-100 bg-sky-50/45",
        titulo: "text-sky-700",
        badge: "bg-sky-100 text-sky-700",
        boton: "border-sky-100 hover:bg-sky-50",
        chip: "bg-sky-50 text-sky-700",
        barra: "bg-sky-500",
      };
    }

    if (color === "amber") {
      return {
        contenedor: "border-amber-100 bg-amber-50/45",
        titulo: "text-amber-700",
        badge: "bg-amber-100 text-amber-700",
        boton: "border-amber-100 hover:bg-amber-50",
        chip: "bg-amber-50 text-amber-700",
        barra: "bg-amber-500",
      };
    }

    if (color === "indigo") {
      return {
        contenedor: "border-indigo-100 bg-indigo-50/45",
        titulo: "text-indigo-700",
        badge: "bg-indigo-100 text-indigo-700",
        boton: "border-indigo-100 hover:bg-indigo-50",
        chip: "bg-indigo-50 text-indigo-700",
        barra: "bg-indigo-500",
      };
    }

    return {
      contenedor: "border-rose-100 bg-rose-50/45",
      titulo: "text-rose-700",
      badge: "bg-rose-100 text-rose-700",
      boton: "border-rose-100 hover:bg-rose-50",
      chip: "bg-rose-50 text-rose-700",
      barra: "bg-rose-500",
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/login_users");
        return;
      }

      setUser(firebaseUser);
      setCargando(true);
      setMensaje("");

      try {
        let usuarioEncontrado: UsuarioCliente | null = null;
        const sesionUsuario = leerLocal<UsuarioSesion>("usuarioSesion");
        const sesionCliente = leerLocal<ClienteSesion>("clienteSesion");
        const idClienteSesion =
          sesionUsuario?.clienteId ||
          sesionUsuario?.nit ||
          sesionCliente?.clienteId ||
          sesionCliente?.nit ||
          "";
        const idUsuarioSesion = sesionUsuario?.usuarioId || firebaseUser.uid;

        if (idClienteSesion && idUsuarioSesion) {
          const snapUsuario = await getDoc(
            doc(db, "clientes", idClienteSesion, "usuarios", idUsuarioSesion),
          );
          if (snapUsuario.exists()) {
            const data = snapUsuario.data() as Record<string, unknown>;
            usuarioEncontrado = {
              id: snapUsuario.id,
              uidAuth: normalizarTexto(data.uidAuth, firebaseUser.uid),
              nombres: normalizarTexto(data.nombres, "Usuario"),
              apellidos: normalizarTexto(data.apellidos, ""),
              email: normalizarCorreo(data.email || firebaseUser.email || ""),
              tipoFuncionario: normalizarTexto(
                data.tipoFuncionario,
                "Sin tipo",
              ),
              rol: normalizarTexto(data.rol, "Sin rol"),
              estado: normalizarTexto(data.estado, "ACTIVO").toUpperCase(),
              fotoUrl: normalizarTexto(data.fotoUrl, ""),
              clienteId: idClienteSesion,
            };
          }
        }

        if (!usuarioEncontrado)
          usuarioEncontrado = await buscarUsuarioOperativo(firebaseUser);

        if (!usuarioEncontrado || usuarioEncontrado.estado !== "ACTIVO") {
          await signOut(auth).catch(() => null);
          window.localStorage.removeItem("usuarioSesion");
          setMensaje(
            "Usuario sin acceso operativo activo. Contacta al administrador.",
          );
          router.replace("/login_users");
          return;
        }

        setUsuario(usuarioEncontrado);
        window.localStorage.setItem(
          "usuarioSesion",
          JSON.stringify({
            uid: firebaseUser.uid,
            usuarioId: usuarioEncontrado.id,
            clienteId: usuarioEncontrado.clienteId,
            nit: usuarioEncontrado.clienteId,
            email: usuarioEncontrado.email,
            nombres: usuarioEncontrado.nombres,
            apellidos: usuarioEncontrado.apellidos,
            tipoFuncionario: usuarioEncontrado.tipoFuncionario,
            rol: usuarioEncontrado.rol,
            fotoUrl: usuarioEncontrado.fotoUrl || "",
          }),
        );

        const snapCliente = await getDoc(
          doc(db, "clientes", usuarioEncontrado.clienteId),
        );
        if (snapCliente.exists()) setCliente(snapCliente.data() as ClienteData);

        const movilesSnap = await getDocs(
          collection(db, "clientes", usuarioEncontrado.clienteId, "moviles"),
        );
        const asignadas: MovilAsignada[] = [];

        for (const movilDoc of movilesSnap.docs) {
          const personalRef = doc(
            db,
            "clientes",
            usuarioEncontrado.clienteId,
            "moviles",
            movilDoc.id,
            "PERSONAL_ASIGNADO",
            usuarioEncontrado.id,
          );
          const personalSnap = await getDoc(personalRef);

          if (personalSnap.exists()) {
            const movilData = movilDoc.data() as Record<string, unknown>;
            asignadas.push({
              id: movilDoc.id,
              nombre: normalizarTexto(
                movilData.nombre || movilData.movilNombre,
                normalizarTexto(
                  personalSnap.data().movilNombre,
                  "Móvil asignada",
                ),
              ),
              placa: normalizarTexto(movilData.placa, "Sin placa"),
              tipo: normalizarTexto(movilData.tipo, "Sin tipo"),
              modelo: normalizarTexto(movilData.modelo, ""),
              denominacion: normalizarTexto(movilData.denominacion, ""),
              estado: normalizarTexto(
                movilData.estado || movilData.status,
                "Activo",
              ),
              fotoUrl: extraerFotoMovil(movilData),
              kilometrajeActual: normalizarTexto(movilData.kilometrajeActual, ""),
              kilometrajeInicial: normalizarTexto(movilData.kilometrajeInicial, ""),
              soatExpiry: normalizarTexto(movilData.soatExpiry, ""),
              tecnomecanicaExpiry: normalizarTexto(movilData.tecnomecanicaExpiry, ""),
              policyAllRiskExpiry: normalizarTexto(movilData.policyAllRiskExpiry, ""),
              aceiteExpiry: normalizarTexto(movilData.aceiteExpiry, ""),
              aceiteVencimiento: normalizarTexto(movilData.aceiteVencimiento, ""),
              oilExpiry: normalizarTexto(movilData.oilExpiry, ""),
            });
          }
        }

        asignadas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setMovilesAsignadas(asignadas);
        setMovilActivaId((actual) => actual || asignadas[0]?.id || "");
      } catch (error) {
        console.error("Error cargando dashboard de usuario:", error);
        setMensaje("No fue posible cargar las asignaciones del usuario.");
      } finally {
        setCargando(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!usuario?.clienteId || !movilActiva?.id) {
      setCategoriasAutoevaluacion([]);
      setCargandoCategorias(false);
      return;
    }

    setCargandoCategorias(true);
    let activo = true;
    let unsubscribeAsignaciones: (() => void) | null = null;

    const cargarCategoriasBase = async () => {
      try {
        const refBase = collection(
          db,
          "clientes",
          usuario.clienteId,
          "AUTOEVALUACION_GENERAL",
        );
        const snapBase = await getDocs(
          query(refBase, orderBy("categoria", "asc")),
        );

        const productosNormativosPorCategoria = new Map<string, Set<string>>();
        snapBase.docs.forEach((documento) => {
          const data = documento.data() as Record<string, unknown>;
          const categoria = normalizarTexto(data.categoria, "Sin categoría");
          const producto = normalizarTexto(
            data.producto || documento.id,
            documento.id,
          );
          const setCategoria =
            productosNormativosPorCategoria.get(categoria) || new Set<string>();
          setCategoria.add(producto);
          productosNormativosPorCategoria.set(categoria, setCategoria);
        });

        const categoriasBase = Array.from(
          productosNormativosPorCategoria.keys(),
        ).sort((a, b) => a.localeCompare(b, "es"));

        const refAsignaciones = collection(
          db,
          "clientes",
          usuario.clienteId,
          "moviles",
          movilActiva.id,
          "ASIGNACIONES_BODEGA",
        );

        unsubscribeAsignaciones = onSnapshot(
          refAsignaciones,
          (snapshot) => {
            if (!activo) return;

            const asignaciones = snapshot.docs.map((documento) => {
              const data = documento.data() as Record<string, unknown>;
              return {
                id: documento.id,
                codigoBarras: normalizarTexto(
                  data.codigoBarras || documento.id,
                  documento.id,
                ),
                codigoPrincipal: normalizarTexto(data.codigoPrincipal, ""),
                categoria: normalizarTexto(data.categoria, "Sin categoría"),
                producto: normalizarTexto(data.producto, "Sin producto"),
                tipo: normalizarTexto(data.tipo, "-"),
                productoId: normalizarTexto(data.productoId, ""),
                asociadoId: normalizarTexto(data.asociadoId, ""),
                gestionado: Boolean(
                  data.gestionado ||
                  data.diligenciado ||
                  data.estadoGestion === "diligenciado",
                ),
                codigoEscaneado: normalizarTexto(
                  data.codigoEscaneado || data.codigoLeido || "",
                  "",
                ),
                fechaGestion: data.fechaGestion,
                usado: Boolean(data.usado || data.estadoUso === "usado"),
                motivoUso: normalizarTexto(data.motivoUso, ""),
                fechaUso: data.fechaUso,
              } as AsignacionBodegaMovil;
            });

            const agrupadas = new Map<string, AsignacionBodegaMovil[]>();
            asignaciones.forEach((item) => {
              const lista = agrupadas.get(item.categoria) || [];
              lista.push(item);
              agrupadas.set(item.categoria, lista);
            });

            const nombresCategorias = Array.from(
              new Set<string>([
                ...categoriasBase,
                ...Array.from(agrupadas.keys()),
              ]),
            ).sort((a, b) => a.localeCompare(b, "es"));

            const categorias = nombresCategorias.map((categoria) => {
              const productos = (agrupadas.get(categoria) || []).sort((a, b) =>
                a.producto.localeCompare(b.producto, "es"),
              );
              const productosBase =
                productosNormativosPorCategoria.get(categoria);
              const productosNormativos =
                productosBase ||
                new Set<string>(productos.map((item) => item.producto));
              const totalItems = productosNormativos.size;
              const productosDiligenciados = new Set<string>();
              productos.forEach((item) => {
                if (item.gestionado) {
                  productosDiligenciados.add(item.producto);
                }
              });
              const diligenciados = Array.from(productosDiligenciados).filter(
                (producto) => productosNormativos.has(producto),
              ).length;

              return {
                categoria,
                totalItems,
                diligenciados,
                productos,
                porcentaje: calcularPorcentaje(totalItems, diligenciados),
              } as CategoriaAutoevaluacion;
            });

            setCategoriasAutoevaluacion(categorias);
            setCargandoCategorias(false);
          },
          (error) => {
            console.error("Error cargando asignaciones de bodega:", error);
            if (!activo) return;
            setCategoriasAutoevaluacion(
              categoriasBase.map((categoria) => {
                const totalItems =
                  productosNormativosPorCategoria.get(categoria)?.size || 0;
                return {
                  categoria,
                  totalItems,
                  diligenciados: 0,
                  productos: [],
                  porcentaje: 0,
                };
              }),
            );
            setCargandoCategorias(false);
          },
        );
      } catch (error) {
        console.error(
          "Error cargando categorías base de autoevaluación:",
          error,
        );
        if (activo) {
          setCategoriasAutoevaluacion([]);
          setCargandoCategorias(false);
        }
      }
    };

    cargarCategoriasBase();

    return () => {
      activo = false;
      if (unsubscribeAsignaciones) unsubscribeAsignaciones();
    };
  }, [usuario?.clienteId, movilActiva?.id]);

  useEffect(() => {
    if (!usuario?.clienteId || !movilActiva?.id) {
      setPersonalAsignado([]);
      return;
    }

    const refPersonal = collection(
      db,
      "clientes",
      usuario.clienteId,
      "moviles",
      movilActiva.id,
      "PERSONAL_ASIGNADO",
    );
    const unsubscribe = onSnapshot(refPersonal, (snapshot) => {
      const data = snapshot.docs.map((documento) => {
        const item = documento.data() as Record<string, unknown>;
        return {
          id: documento.id,
          nombres: normalizarTexto(item.nombres, ""),
          apellidos: normalizarTexto(item.apellidos, ""),
          email: normalizarTexto(item.email, ""),
          tipoFuncionario: normalizarTexto(item.tipoFuncionario, "Sin tipo"),
          rol: normalizarTexto(item.rol, "Sin rol"),
          estado: normalizarTexto(item.estado, "ACTIVO"),
          fotoUrl: normalizarTexto(item.fotoUrl, ""),
        } as PersonalAsignadoMovil;
      });
      data.sort((a, b) =>
        `${a.nombres} ${a.apellidos}`.localeCompare(
          `${b.nombres} ${b.apellidos}`,
          "es",
        ),
      );
      setPersonalAsignado(data);
    });

    return () => unsubscribe();
  }, [usuario?.clienteId, movilActiva?.id]);

  useEffect(() => {
    if (!usuario?.clienteId || !movilActiva?.id) return;
    if (cargandoCategorias) return;

    const total = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.totalItems,
      0,
    );
    const diligenciados = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.diligenciados,
      0,
    );
    const pendientes = Math.max(total - diligenciados, 0);
    const detalleCategorias = categoriasAutoevaluacion
      .filter((item) => item.totalItems > item.diligenciados)
      .map((item) => ({
        categoria: item.categoria,
        totalItems: item.totalItems,
        diligenciados: item.diligenciados,
        pendientes: Math.max(item.totalItems - item.diligenciados, 0),
        porcentaje: item.porcentaje,
      }));

    const idAlerta = `moviles_autoevaluacion_${movilActiva.id}`;

    setDoc(
      doc(db, "clientes", usuario.clienteId, "alertas", idAlerta),
      {
        activo: pendientes > 0,
        tipo: "moviles_autoevaluacion",
        categoria: "moviles",
        movilId: movilActiva.id,
        movilNombre: movilActiva.nombre,
        placa: movilActiva.placa || "",
        totalItems: total,
        diligenciados,
        pendientes,
        porcentaje: calcularPorcentaje(total, diligenciados),
        mensaje:
          pendientes > 0
            ? `Móvil ${movilActiva.nombre} con ${pendientes} ítem(s) normativo(s) pendientes por diligenciar.`
            : `Móvil ${movilActiva.nombre} con autoevaluación completa.`,
        categoriasPendientes: detalleCategorias,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch((error) =>
      console.error(
        "Error sincronizando alerta de autoevaluación móvil:",
        error,
      ),
    );
  }, [
    usuario?.clienteId,
    movilActiva?.id,
    movilActiva?.nombre,
    movilActiva?.placa,
    categoriasAutoevaluacion,
    cargandoCategorias,
  ]);


  useEffect(() => {
    if (!usuario?.clienteId) {
      setConfiguracionCheck({});
      return;
    }

    const refConfig = doc(
      db,
      "clientes",
      usuario.clienteId,
      "configuracionVerificaciones",
      "checklistDiario",
    );

    const unsubscribe = onSnapshot(refConfig, (snapshot) => {
      const data = snapshot.exists() ? (snapshot.data().items || {}) : {};
      setConfiguracionCheck(data as ConfiguracionCheck);
    });

    return () => unsubscribe();
  }, [usuario?.clienteId]);

  useEffect(() => {
    if (!usuario?.clienteId || !movilActiva?.id) {
      setMovilVerificacionData(null);
      setKilometrajeVerificacion("");
      setRespuestasVerificacion({});
      return;
    }

    let activo = true;

    const cargarVerificacionDelDia = async () => {
      const fecha = hoyIso();
      let movilCompleta = { ...movilActiva } as MovilVerificacionData;

      try {
        const snapMovil = await getDoc(
          doc(db, "clientes", usuario.clienteId, "moviles", movilActiva.id),
        );

        if (snapMovil.exists()) {
          movilCompleta = {
            ...movilCompleta,
            ...(snapMovil.data() as Record<string, unknown>),
            id: movilActiva.id,
            nombre: normalizarTexto(
              (snapMovil.data() as Record<string, unknown>).nombre || movilActiva.nombre,
              movilActiva.nombre,
            ),
            placa: normalizarTexto(
              (snapMovil.data() as Record<string, unknown>).placa || movilActiva.placa,
              movilActiva.placa,
            ),
            tipo: normalizarTexto(
              (snapMovil.data() as Record<string, unknown>).tipo || movilActiva.tipo,
              movilActiva.tipo,
            ),
            fotoUrl: extraerFotoMovil(snapMovil.data() as Record<string, unknown>) || movilActiva.fotoUrl,
          } as MovilVerificacionData;
        }
      } catch (error) {
        console.error("Error cargando datos completos de la móvil:", error);
      }

      if (!activo) return;

      setMovilVerificacionData(movilCompleta);
      setKilometrajeVerificacion(
        normalizarTexto(
          movilCompleta.kilometrajeActual || movilCompleta.kilometrajeInicial,
          "",
        ),
      );
      setRespuestasVerificacion({});

      try {
        const snapReporte = await getDoc(
          doc(
            db,
            "clientes",
            usuario.clienteId,
            "verificacionesMoviles",
            fecha,
            "reportes",
            movilActiva.id,
          ),
        );

        if (!activo) return;

        if (snapReporte.exists()) {
          const data = snapReporte.data() as Record<string, unknown>;
          const datos = (data.datos || {}) as Record<string, RespuestaVerificacion>;

          setRespuestasVerificacion(datos);
          setKilometrajeVerificacion(
            normalizarTexto(
              data.kilometraje || movilCompleta.kilometrajeActual || movilCompleta.kilometrajeInicial,
              "",
            ),
          );
        }
      } catch (error) {
        console.error("Error cargando verificación diaria existente:", error);
      }
    };

    cargarVerificacionDelDia();

    return () => {
      activo = false;
    };
  }, [usuario?.clienteId, movilActiva?.id]);

  useEffect(() => {
    if (!usuario?.clienteId || !movilActiva?.id) {
      setAlertasMovilUsuario([]);
      setCargandoAlertasUsuario(false);
      return;
    }

    setCargandoAlertasUsuario(true);
    const refAlertas = collection(db, "clientes", usuario.clienteId, "alertas");
    const refVerificaciones = collection(
      db,
      "clientes",
      usuario.clienteId,
      "alertas",
      "verificaciones_diarias",
      "vehiculos",
      movilActiva.id,
      "fechas",
    );

    let alertasRaiz: AlertaMovilUsuario[] = [];
    let alertasVerificacion: AlertaMovilUsuario[] = [];
    let raizLista = false;
    let verificacionLista = false;

    const normalizarMotivosVerificacion = (value: unknown): MotivoAlertaUsuario[] => {
      if (!value) return [];

      const mapear = (item: unknown, index: number): MotivoAlertaUsuario | null => {
        if (typeof item === "string") {
          return {
            id: `motivo-${index}`,
            categoria: "Verificación diaria",
            item: "Ítem",
            codigo: "",
            estado: "Alerta",
            observacion: item,
            motivo: item,
            fecha: "",
          };
        }

        if (!item || typeof item !== "object") return null;

        const data = item as Record<string, unknown>;
        const estado = normalizarTexto(
          data.estado || data.valor || data.respuesta || data.cumplimiento,
          "Alerta",
        );
        const observacion = normalizarTexto(
          data.observacion || data.observaciones || data.comentario || data.detalle || "",
          "",
        );
        const itemNombre = normalizarTexto(
          data.item || data.descripcion || data.nombre || data.pregunta,
          "Ítem",
        );
        const motivo = normalizarTexto(
          data.motivo || data.mensaje || observacion,
          observacion ? `${itemNombre}: ${observacion}` : `${itemNombre} marcado como ${estado}.`,
        );

        return {
          id: normalizarTexto(data.id || data.codigo || data.itemId, `motivo-${index}`),
          categoria: normalizarTexto(data.categoria || data.grupo || data.seccion, "Verificación diaria"),
          item: itemNombre,
          codigo: normalizarTexto(data.codigo || data.codigoItem || data.itemCodigo, ""),
          estado,
          observacion,
          motivo,
          fecha: normalizarTexto(data.fecha || data.fechaVerificacion || data.createdAt || data.updatedAt, ""),
        };
      };

      if (Array.isArray(value)) {
        return value
          .map((item, index) => mapear(item, index))
          .filter((item): item is MotivoAlertaUsuario => Boolean(item));
      }

      if (typeof value === "object" && value !== null) {
        return Object.entries(value as Record<string, unknown>)
          .map(([key, item], index) => {
            const motivo = mapear(item, index);
            return motivo ? { ...motivo, id: motivo.id || key } : null;
          })
          .filter((item): item is MotivoAlertaUsuario => Boolean(item));
      }

      return [];
    };

    const publicar = () => {
      if (!raizLista || !verificacionLista) return;
      const combinadas = [...alertasRaiz, ...alertasVerificacion].filter(
        (alerta, index, lista) =>
          lista.findIndex((item) => item.id === alerta.id) === index,
      );
      combinadas.sort((a, b) => {
        const ordenA = a.clase === "verificacion" ? 0 : 1;
        const ordenB = b.clase === "verificacion" ? 0 : 1;
        return ordenA - ordenB || b.pendientes - a.pendientes;
      });
      setAlertasMovilUsuario(combinadas);
      setCargandoAlertasUsuario(false);
    };

    const unsubscribeRaiz = onSnapshot(
      refAlertas,
      (snapshot) => {
        alertasRaiz = snapshot.docs
          .map((documento) => {
            const item = documento.data() as Record<string, unknown>;
            const tipo = normalizarTexto(item.tipo, "").toLowerCase();
            const movilId = normalizarTexto(item.movilId || item.idMovil || item.vehiculoId, "");
            const categoria = normalizarTexto(item.categoria, "");

            const esAutoevaluacionMovil =
              movilId === movilActiva.id &&
              (tipo.includes("moviles_autoevaluacion") ||
                tipo.includes("movil_autoevaluacion") ||
                tipo.includes("autoevaluacion") ||
                categoria.toLowerCase().includes("moviles"));

            if (!esAutoevaluacionMovil) return null;

            const categoriasPendientesRaw = Array.isArray(item.categoriasPendientes)
              ? item.categoriasPendientes
              : [];

            return {
              id: documento.id,
              activo: item.activo !== false,
              clase: "autoevaluacion",
              tipo: normalizarTexto(item.tipo, "moviles_autoevaluacion"),
              categoria: normalizarTexto(item.categoria, "moviles"),
              movilId,
              movilNombre: normalizarTexto(item.movilNombre, movilActiva.nombre),
              placa: normalizarTexto(item.placa, movilActiva.placa || ""),
              mensaje: normalizarTexto(item.mensaje, "Alerta de autoevaluación móvil."),
              totalItems: Number(item.totalItems || 0),
              diligenciados: Number(item.diligenciados || 0),
              pendientes: Number(item.pendientes || 0),
              porcentaje: Number(item.porcentaje || 0),
              categoriasPendientes: categoriasPendientesRaw.map((categoriaItem) => {
                const categoriaData = categoriaItem as Record<string, unknown>;
                return {
                  categoria: normalizarTexto(categoriaData.categoria, "Sin categoría"),
                  totalItems: Number(categoriaData.totalItems || 0),
                  diligenciados: Number(categoriaData.diligenciados || 0),
                  pendientes: Number(categoriaData.pendientes || 0),
                  porcentaje: Number(categoriaData.porcentaje || 0),
                };
              }),
              updatedAt: item.updatedAt || item.actualizadoAt || item.fechaAlerta,
            } as AlertaMovilUsuario;
          })
          .filter(Boolean) as AlertaMovilUsuario[];

        raizLista = true;
        publicar();
      },
      (error) => {
        console.error("Error cargando alertas de la móvil:", error);
        alertasRaiz = [];
        raizLista = true;
        publicar();
      },
    );

    const unsubscribeVerificaciones = onSnapshot(
      refVerificaciones,
      (snapshot) => {
        alertasVerificacion = snapshot.docs
          .map((documento) => {
            const item = documento.data() as Record<string, unknown>;
            if (item.activo === false) return null;

            const motivos = [
              ...normalizarMotivosVerificacion(item.motivos),
              ...normalizarMotivosVerificacion(item.motivosDetalle),
              ...normalizarMotivosVerificacion(item.itemsPendientes),
              ...normalizarMotivosVerificacion(item.itemsNoAplica),
              ...normalizarMotivosVerificacion(item.itemsNoCumple),
            ];

            const totalItems = Number(item.totalItems || item.totalChecks || 0);
            const diligenciados = Number(item.diligenciados || item.respondidos || 0);
            const pendientes = Number(
              item.pendientes || Math.max(totalItems - diligenciados, 0),
            );
            const porcentaje =
              totalItems > 0
                ? calcularPorcentaje(totalItems, diligenciados)
                : Number(item.porcentaje || 0);

            return {
              id: `verificacion_${documento.id}`,
              activo: item.activo !== false,
              clase: "verificacion",
              tipo: "verificaciones_diarias",
              categoria: "verificaciones móviles",
              movilId: normalizarTexto(item.movilId, movilActiva.id),
              movilNombre: normalizarTexto(item.movilNombre || item.nombreMovil, movilActiva.nombre),
              placa: normalizarTexto(item.placa, movilActiva.placa || ""),
              fecha: normalizarTexto(item.fecha || item.fechaVerificacion || documento.id, documento.id),
              mensaje: normalizarTexto(
                item.mensaje,
                pendientes > 0
                  ? `Móvil ${movilActiva.nombre} con verificación diaria incompleta: ${diligenciados}/${totalItems}.`
                  : "Móvil con novedades en la verificación diaria.",
              ),
              totalItems,
              diligenciados,
              pendientes,
              porcentaje,
              categoriasPendientes: [],
              motivos,
              updatedAt: item.updatedAt || item.actualizadoAt || item.fechaGeneracion,
            } as AlertaMovilUsuario;
          })
          .filter(Boolean) as AlertaMovilUsuario[];

        verificacionLista = true;
        publicar();
      },
      (error) => {
        console.error("Error cargando alertas de verificación diaria:", error);
        alertasVerificacion = [];
        verificacionLista = true;
        publicar();
      },
    );

    return () => {
      unsubscribeRaiz();
      unsubscribeVerificaciones();
    };
  }, [usuario?.clienteId, movilActiva?.id, movilActiva?.nombre, movilActiva?.placa]);


  useEffect(() => {
    if (!usuario?.clienteId || !usuario?.id) {
      setMantenimientosUsuario([]);
      setCargandoMantenimientosUsuario(false);
      return;
    }

    setCargandoMantenimientosUsuario(true);
    const refMantenimientos = collection(
      db,
      "clientes",
      usuario.clienteId,
      "mantenimientosVehiculares",
    );

    const unsubscribe = onSnapshot(
      refMantenimientos,
      (snapshot) => {
        const data = snapshot.docs
          .map((documento) => ({
            id: documento.id,
            ...(documento.data() as Omit<MantenimientoUsuario, "id">),
          }))
          .filter((item) => {
            const asignado = normalizarTexto(item.asignadoA, "");
            const asignadoNombre = normalizarTexto(item.asignadoNombre, "").toLowerCase();
            return (
              asignado === usuario.id ||
              asignado === usuario.uidAuth ||
              asignado === usuario.email ||
              asignadoNombre.includes(nombreCompleto.toLowerCase())
            );
          })
          .sort((a, b) => normalizarTexto(b.fecha).localeCompare(normalizarTexto(a.fecha), "es"));

        setMantenimientosUsuario(data);
        setCargandoMantenimientosUsuario(false);
      },
      (error) => {
        console.error("Error cargando mantenimientos asignados:", error);
        setMantenimientosUsuario([]);
        setCargandoMantenimientosUsuario(false);
      },
    );

    return () => unsubscribe();
  }, [usuario?.clienteId, usuario?.id, usuario?.uidAuth, usuario?.email, nombreCompleto]);



  useEffect(() => {
    if (!usuario?.clienteId || !usuario?.id) {
      setTareasProgramadasUsuario([]);
      setCargandoTareasProgramadasUsuario(false);
      return;
    }

    setCargandoTareasProgramadasUsuario(true);
    const refTareas = collection(db, "clientes", usuario.clienteId, "programacionTareas");

    const unsubscribe = onSnapshot(
      refTareas,
      async (snapshot) => {
        const data = snapshot.docs
          .map((documento) => ({
            id: documento.id,
            ...(documento.data() as Omit<TareaProgramadaUsuario, "id">),
          }))
          .filter((item) => {
            const asignado = normalizarTexto(item.usuarioId, "");
            const email = normalizarCorreo(item.usuarioEmail);
            const nombre = normalizarTexto(item.usuarioNombre, "").toLowerCase();
            return (
              asignado === usuario.id ||
              asignado === usuario.uidAuth ||
              email === normalizarCorreo(usuario.email) ||
              nombre.includes(nombreCompleto.toLowerCase())
            );
          })
          .sort((a, b) => {
            const prioridadOrden: Record<string, number> = { inmediato: 0, alta: 1, media: 2, baja: 3 };
            const estadoOrden: Record<string, number> = { pendiente: 0, incompleto: 1, "no realizado": 2, realizado: 3 };
            const estadoA = normalizarTexto(a.estadoFinal, "pendiente").toLowerCase();
            const estadoB = normalizarTexto(b.estadoFinal, "pendiente").toLowerCase();
            const prioridadA = normalizarTexto(a.prioridad, "media").toLowerCase();
            const prioridadB = normalizarTexto(b.prioridad, "media").toLowerCase();
            return (estadoOrden[estadoA] ?? 9) - (estadoOrden[estadoB] ?? 9) || (prioridadOrden[prioridadA] ?? 9) - (prioridadOrden[prioridadB] ?? 9) || normalizarTexto(a.fechaMaxima).localeCompare(normalizarTexto(b.fechaMaxima));
          });

        setTareasProgramadasUsuario(data);
        setCargandoTareasProgramadasUsuario(false);

        await Promise.all(
          data.map(async (tarea) => {
            const estado = normalizarTexto(tarea.estadoFinal, "pendiente").toLowerCase();
            const activa = estado !== "realizado";
            const mensaje = activa
              ? `Tarea pendiente para ${nombreCompleto}: ${normalizarTexto(tarea.descripcion, "Sin descripción")}.`
              : `Tarea realizada por ${nombreCompleto}.`;

            return setDoc(
              doc(
                db,
                "clientes",
                usuario.clienteId,
                "alertas",
                "tareas_programadas",
                "usuarios",
                usuario.id,
                "tareas",
                tarea.id,
              ),
              {
                activo: activa,
                tipo: "tareas_programadas",
                categoria: "tareas",
                tareaId: tarea.id,
                usuarioId: usuario.id,
                usuarioNombre: nombreCompleto,
                usuarioEmail: usuario.email || "",
                descripcion: normalizarTexto(tarea.descripcion, "Sin descripción"),
                prioridad: normalizarTexto(tarea.prioridad, "media"),
                fechaMaxima: normalizarTexto(tarea.fechaMaxima, ""),
                estadoFinal: normalizarTexto(tarea.estadoFinal, "pendiente"),
                observaciones: normalizarTexto(tarea.observaciones, ""),
                mensaje,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          }),
        );
      },
      (error) => {
        console.error("Error cargando tareas programadas:", error);
        setTareasProgramadasUsuario([]);
        setCargandoTareasProgramadasUsuario(false);
      },
    );

    return () => unsubscribe();
  }, [usuario?.clienteId, usuario?.id, usuario?.uidAuth, usuario?.email, nombreCompleto]);

  useEffect(() => {
    if (!usuario?.clienteId || !usuario?.id) {
      setAlertasTareasProgramadasUsuario([]);
      return;
    }

    const refAlertasTareas = collection(
      db,
      "clientes",
      usuario.clienteId,
      "alertas",
      "tareas_programadas",
      "usuarios",
      usuario.id,
      "tareas",
    );

    const unsubscribe = onSnapshot(
      refAlertasTareas,
      (snapshot) => {
        const alertas = snapshot.docs
          .map((documento) => {
            const item = documento.data() as Record<string, unknown>;
            if (item.activo === false) return null;

            const descripcion = normalizarTexto(item.descripcion, "Tarea pendiente");
            const estado = normalizarTexto(item.estadoFinal, "pendiente");
            const prioridad = normalizarTexto(item.prioridad, "media");
            const fechaMaxima = normalizarTexto(item.fechaMaxima, "");
            const observaciones = normalizarTexto(item.observaciones, "");

            return {
              id: `tarea_${documento.id}`,
              activo: item.activo !== false,
              clase: "tarea",
              tipo: "tareas_programadas",
              categoria: "tareas",
              movilId: "",
              movilNombre: "Tareas",
              placa: "",
              fecha: fechaMaxima,
              mensaje: normalizarTexto(item.mensaje, `Tarea ${estado}: ${descripcion}`),
              totalItems: 1,
              diligenciados: estado === "realizado" ? 1 : 0,
              pendientes: estado === "realizado" ? 0 : 1,
              porcentaje: estado === "realizado" ? 100 : 0,
              categoriasPendientes: [],
              motivos: [
                {
                  id: documento.id,
                  categoria: `Prioridad ${prioridad}`,
                  item: descripcion,
                  codigo: fechaMaxima,
                  estado,
                  observacion: observaciones,
                  motivo: observaciones || `Fecha máxima: ${fechaMaxima || "sin fecha"}`,
                  fecha: fechaMaxima,
                },
              ],
              updatedAt: item.updatedAt || item.actualizadoAt,
            } as AlertaMovilUsuario;
          })
          .filter(Boolean) as AlertaMovilUsuario[];

        setAlertasTareasProgramadasUsuario(alertas);
      },
      (error) => {
        console.error("Error cargando alertas de tareas programadas:", error);
        setAlertasTareasProgramadasUsuario([]);
      },
    );

    return () => unsubscribe();
  }, [usuario?.clienteId, usuario?.id]);


  useEffect(() => {
    if (!usuario?.clienteId || !usuario?.id) {
      setAlertasInfraccionesUsuario([]);
      return;
    }

    const conductorIds = Array.from(
      new Set([usuario.id, usuario.uidAuth].filter(Boolean) as string[]),
    );

    if (conductorIds.length === 0) {
      setAlertasInfraccionesUsuario([]);
      return;
    }

    const acumuladas = new Map<string, AlertaMovilUsuario[]>();

    const publicar = () => {
      const combinadas = Array.from(acumuladas.values())
        .flat()
        .filter(
          (alerta, index, lista) =>
            lista.findIndex((item) => item.id === alerta.id) === index,
        )
        .sort((a, b) => normalizarTexto(b.fecha).localeCompare(normalizarTexto(a.fecha), "es"));

      setAlertasInfraccionesUsuario(combinadas);
    };

    const unsubscribes = conductorIds.map((conductorId) => {
      const refInfracciones = collection(
        db,
        "clientes",
        usuario.clienteId,
        "alertas",
        "infracciones",
        "conductores",
        conductorId,
        "registros",
      );

      return onSnapshot(
        refInfracciones,
        (snapshot) => {
          const alertas = snapshot.docs
            .map((documento) => {
              const item = documento.data() as Record<string, unknown>;
              if (item.activo === false) return null;

              const estado = normalizarTexto(item.estado, "avisado");
              const infraccion = normalizarTexto(item.infraccion, "Infracción sin descripción");
              const fecha = normalizarTexto(item.fecha, "");
              const observaciones = normalizarTexto(item.observaciones, "");
              const mensajeAlerta = normalizarTexto(
                item.mensaje,
                `Infracción ${estado}: ${infraccion}`,
              );

              return {
                id: `infraccion_${documento.id}`,
                activo: item.activo !== false,
                clase: "infraccion",
                tipo: "infracciones",
                categoria: "infracciones",
                movilId: "",
                movilNombre: "Infracciones",
                placa: "",
                fecha,
                mensaje: mensajeAlerta,
                totalItems: 1,
                diligenciados: 0,
                pendientes: 1,
                porcentaje: 0,
                categoriasPendientes: [],
                motivos: [
                  {
                    id: documento.id,
                    categoria: "Infracción",
                    item: infraccion,
                    codigo: fecha,
                    estado,
                    observacion: observaciones,
                    motivo: observaciones || mensajeAlerta,
                    fecha,
                  },
                ],
                updatedAt: item.updatedAt || item.fechaGeneracion,
              } as AlertaMovilUsuario;
            })
            .filter(Boolean) as AlertaMovilUsuario[];

          acumuladas.set(conductorId, alertas);
          publicar();
        },
        (error) => {
          console.error("Error cargando alertas de infracciones del conductor:", error);
          acumuladas.set(conductorId, []);
          publicar();
        },
      );
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [usuario?.clienteId, usuario?.id, usuario?.uidAuth]);


  useEffect(() => {
    if (!modalAutoevaluacionOpen || !movilActiva || !mapContainerRef.current)
      return;

    const inicializarMapa = () => {
      const googleMaps = (window as any).google?.maps;
      if (!googleMaps || !mapContainerRef.current) return;
      const centro = ubicacionUsuario || { lat: 4.710989, lng: -74.072092 };

      if (!mapRef.current) {
        mapRef.current = new googleMaps.Map(mapContainerRef.current, {
          center: centro,
          zoom: ubicacionUsuario ? 16 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
      } else {
        mapRef.current.setCenter(centro);
        mapRef.current.setZoom(ubicacionUsuario ? 16 : 12);
      }

      if (!markerRef.current) {
        markerRef.current = new googleMaps.Marker({
          position: centro,
          map: mapRef.current,
          title: movilActiva.nombre,
        });
      } else {
        markerRef.current.setPosition(centro);
        markerRef.current.setTitle(movilActiva.nombre);
      }
    };

    (window as any).initAllMaps = inicializarMapa;

    if ((window as any).google?.maps) {
      window.setTimeout(inicializarMapa, 80);
      return;
    }

    const existente = document.getElementById(
      MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existente) {
      existente.addEventListener("load", inicializarMapa, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = MAPS_SRC;
    document.body.appendChild(script);
  }, [modalAutoevaluacionOpen, movilActiva, ubicacionUsuario]);

  const guardarUbicacionMovil = async (punto: PuntoMapa) => {
    if (!usuario?.clienteId || !movilActiva?.id) return;

    const actualizada = new Date().toISOString();
    setUbicacionUsuario(punto);
    setUbicacionActiva(true);
    setUltimaActualizacionUbicacion(actualizada);

    const payloadUbicacion = {
      lat: punto.lat,
      lng: punto.lng,
      latitude: punto.lat,
      longitude: punto.lng,
      actualizadaAt: actualizada,
      updatedAt: actualizada,
      usuarioId: usuario.id,
      usuarioNombre: nombreCompleto,
    };

    try {
      await setDoc(
        doc(db, "clientes", usuario.clienteId, "moviles", movilActiva.id),
        {
          ubicacionActual: payloadUbicacion,
          ubicacionActualizadaAt: actualizada,
          ultimaUbicacionLat: punto.lat,
          ultimaUbicacionLng: punto.lng,
          ultimaUbicacionUsuarioId: usuario.id,
          ultimaUbicacionUsuarioNombre: nombreCompleto,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error guardando ubicación de la móvil:", error);
      setUbicacionMensaje("No fue posible guardar la ubicación de la móvil.");
    }
  };

  useEffect(() => {
    if (!usuario?.clienteId || !movilActiva?.id) {
      if (
        ubicacionWatchRef.current !== null &&
        typeof navigator !== "undefined"
      ) {
        navigator.geolocation?.clearWatch(ubicacionWatchRef.current);
        ubicacionWatchRef.current = null;
      }
      setUbicacionActiva(false);
      setUbicacionUsuario(null);
      setUltimaActualizacionUbicacion("");
      return;
    }

    const refMovil = doc(
      db,
      "clientes",
      usuario.clienteId,
      "moviles",
      movilActiva.id,
    );
    const unsubscribe = onSnapshot(refMovil, (snapshot) => {
      const data = snapshot.data() as Record<string, any> | undefined;
      const ubicacion = data?.ubicacionActual;
      const lat = Number(
        ubicacion?.lat ?? ubicacion?.latitude ?? data?.ultimaUbicacionLat,
      );
      const lng = Number(
        ubicacion?.lng ?? ubicacion?.longitude ?? data?.ultimaUbicacionLng,
      );

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setUbicacionUsuario({ lat, lng });
        setUbicacionActiva(true);
        setUltimaActualizacionUbicacion(
          normalizarTexto(
            ubicacion?.actualizadaAt ||
              ubicacion?.updatedAt ||
              data?.ubicacionActualizadaAt ||
              "",
            "",
          ),
        );
      }
    });

    if (!navigator.geolocation) {
      setUbicacionActiva(false);
      setUbicacionMensaje("Este navegador no permite obtener ubicación.");
      return () => unsubscribe();
    }

    setUbicacionMensaje(
      "Activa la ubicación para poder realizar la autoevaluación.",
    );

    if (ubicacionWatchRef.current !== null) {
      navigator.geolocation.clearWatch(ubicacionWatchRef.current);
      ubicacionWatchRef.current = null;
    }

    ubicacionWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const punto = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        guardarUbicacionMovil(punto);
        setUbicacionMensaje("Ubicación activa y actualizada.");
      },
      () => {
        setUbicacionActiva(false);
        setUbicacionMensaje(
          "La ubicación es obligatoria. Actívala en el navegador para realizar la autoevaluación.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 8000 },
    );

    return () => {
      unsubscribe();
      if (ubicacionWatchRef.current !== null) {
        navigator.geolocation.clearWatch(ubicacionWatchRef.current);
        ubicacionWatchRef.current = null;
      }
    };
  }, [usuario?.clienteId, usuario?.id, movilActiva?.id, nombreCompleto]);

  const pedirUbicacion = () => {
    setUbicacionMensaje("");
    if (!navigator.geolocation) {
      setUbicacionActiva(false);
      setUbicacionMensaje("Este navegador no permite obtener ubicación.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const punto = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        guardarUbicacionMovil(punto);
        setUbicacionMensaje("Ubicación marcada y guardada en la móvil.");
      },
      () => {
        setUbicacionActiva(false);
        setUbicacionMensaje(
          "No fue posible obtener la ubicación. Revisa permisos del navegador.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    if (!productoEscaneo) return;

    let activo = true;
    let intervalo: number | undefined;

    const iniciarScanner = async () => {
      setScannerError("");
      setScannerManual(productoEscaneo.codigoEscaneado || "");

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setScannerError(
            "Este navegador no permite abrir la cámara. Digita el código manualmente.",
          );
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        streamScannerRef.current = stream;

        if (videoScannerRef.current) {
          videoScannerRef.current.srcObject = stream;
          await videoScannerRef.current.play();
        }

        const Detector = (window as any).BarcodeDetector;
        if (!Detector) {
          setScannerError(
            "La cámara está abierta, pero este navegador no soporta lectura automática. Digita el código manualmente.",
          );
          return;
        }

        const detector = new Detector({
          formats: [
            "code_128",
            "code_39",
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "qr_code",
          ],
        });

        intervalo = window.setInterval(async () => {
          if (!activo || !videoScannerRef.current) return;

          try {
            const codigos = await detector.detect(videoScannerRef.current);
            const valor = codigos?.[0]?.rawValue;
            if (valor) {
              setScannerManual(String(valor));
              await guardarEscaneoProducto(String(valor));
            }
          } catch {
            // Se ignoran intentos fallidos mientras la cámara enfoca.
          }
        }, 700);
      } catch (error) {
        console.error("Error abriendo cámara:", error);
        setScannerError(
          "No fue posible abrir la cámara. Digita el código manualmente.",
        );
      }
    };

    iniciarScanner();

    return () => {
      activo = false;
      if (intervalo) window.clearInterval(intervalo);
      streamScannerRef.current?.getTracks().forEach((track) => track.stop());
      streamScannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoEscaneo?.id]);

  const cerrarScanner = () => {
    streamScannerRef.current?.getTracks().forEach((track) => track.stop());
    streamScannerRef.current = null;
    setProductoEscaneo(null);
    setScannerManual("");
    setScannerError("");
  };

  const abrirEscaneoProducto = (producto: AsignacionBodegaMovil) => {
    if (!ubicacionActiva || !ubicacionUsuario) {
      setUbicacionMensaje(
        "Activa la ubicación para poder realizar la autoevaluación.",
      );
      return;
    }
    setProductoEscaneo(producto);
  };

  const guardarEscaneoProducto = async (codigoLeidoParam?: string) => {
    if (
      !usuario?.clienteId ||
      !movilActiva?.id ||
      !productoEscaneo ||
      guardandoEscaneo
    )
      return;

    if (!ubicacionActiva || !ubicacionUsuario) {
      setScannerError(
        "La ubicación es obligatoria. Actívala antes de guardar la autoevaluación.",
      );
      return;
    }

    const codigoLeido = String(codigoLeidoParam || scannerManual || "").trim();
    const codigoOrigen = String(productoEscaneo.codigoBarras || "").trim();

    if (!codigoLeido) {
      setScannerError("Escanea o digita un código válido.");
      return;
    }

    if (codigoLeido !== codigoOrigen) {
      setScannerError(
        `El código leído (${codigoLeido}) no coincide con el código asignado (${codigoOrigen}).`,
      );
      return;
    }

    const idAsignacion =
      productoEscaneo.id ||
      limpiarId(productoEscaneo.codigoBarras) ||
      limpiarId(codigoLeido);

    setGuardandoEscaneo(true);
    setScannerError("");

    try {
      await setDoc(
        doc(
          db,
          "clientes",
          usuario.clienteId,
          "moviles",
          movilActiva.id,
          "ASIGNACIONES_BODEGA",
          idAsignacion,
        ),
        {
          codigoEscaneado: codigoLeido,
          codigoLeido,
          gestionado: true,
          diligenciado: true,
          estadoGestion: "diligenciado",
          gestionadoPorId: usuario.id,
          gestionadoPorNombre: nombreCompleto,
          ubicacionGestion: ubicacionUsuario,
          fechaGestion: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setCategoriasAutoevaluacion((actual) =>
        actual.map((categoria) => {
          const productos = categoria.productos.map((producto) =>
            producto.id === idAsignacion ||
            producto.codigoBarras === productoEscaneo.codigoBarras
              ? { ...producto, gestionado: true, codigoEscaneado: codigoLeido }
              : producto,
          );

          const diligenciados = Math.min(
            categoria.totalItems,
            new Set(
              productos
                .filter((producto) => producto.gestionado)
                .map((producto) => producto.producto),
            ).size,
          );
          return {
            ...categoria,
            productos,
            totalItems: categoria.totalItems,
            diligenciados,
            porcentaje: calcularPorcentaje(categoria.totalItems, diligenciados),
          };
        }),
      );

      setModalAsignadosCategoria((actual) => {
        if (!actual) return actual;
        const productos = actual.productos.map((producto) =>
          producto.id === idAsignacion ||
          producto.codigoBarras === productoEscaneo.codigoBarras
            ? { ...producto, gestionado: true, codigoEscaneado: codigoLeido }
            : producto,
        );
        const diligenciados = Math.min(
          actual.totalItems,
          new Set(
            productos
              .filter((producto) => producto.gestionado)
              .map((producto) => producto.producto),
          ).size,
        );
        return {
          ...actual,
          productos,
          totalItems: actual.totalItems,
          diligenciados,
          porcentaje: calcularPorcentaje(actual.totalItems, diligenciados),
        };
      });

      cerrarScanner();
    } catch (error) {
      console.error("Error guardando lectura de código:", error);
      setScannerError("No fue posible guardar el código. Intenta nuevamente.");
    } finally {
      setGuardandoEscaneo(false);
    }
  };

  const abrirGestionUso = (producto: AsignacionBodegaMovil) => {
    if (!ubicacionActiva || !ubicacionUsuario) {
      setUbicacionMensaje(
        "Activa la ubicación para poder registrar gestión de uso.",
      );
      return;
    }
    setProductoUso(producto);
    setMotivoUso(producto.motivoUso || "");
  };

  const registrarUsoProducto = async () => {
    if (!usuario?.clienteId || !movilActiva?.id || !productoUso || guardandoUso)
      return;

    if (!ubicacionActiva || !ubicacionUsuario) {
      setMensaje("Activa la ubicación para poder registrar el uso del ítem.");
      return;
    }

    const motivo = motivoUso.trim();
    if (!motivo) {
      setMensaje("Digita el motivo de uso del ítem.");
      return;
    }

    const idAsignacion = productoUso.id || limpiarId(productoUso.codigoBarras);
    if (!idAsignacion) return;

    setGuardandoUso(true);
    try {
      const payloadUso = {
        usado: true,
        estadoUso: "usado",
        motivoUso: motivo,
        usadoPorId: usuario.id,
        usadoPorNombre: nombreCompleto,
        movilId: movilActiva.id,
        movilNombre: movilActiva.nombre,
        ubicacionUso: ubicacionUsuario,
        fechaUso: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(
          db,
          "clientes",
          usuario.clienteId,
          "moviles",
          movilActiva.id,
          "ASIGNACIONES_BODEGA",
          idAsignacion,
        ),
        payloadUso,
        { merge: true },
      );

      if (productoUso.productoId && productoUso.asociadoId) {
        await setDoc(
          doc(
            db,
            "clientes",
            usuario.clienteId,
            "AUTOEVALUACION_GENERAL",
            productoUso.productoId,
            "asociados",
            productoUso.asociadoId,
          ),
          {
            ...payloadUso,
            codigoBarras: productoUso.codigoBarras,
            categoria: productoUso.categoria,
            producto: productoUso.producto,
            tipo: productoUso.tipo,
          },
          { merge: true },
        );
      }

      setCategoriasAutoevaluacion((actual) =>
        actual.map((categoria) => ({
          ...categoria,
          productos: categoria.productos.map((producto) =>
            producto.id === idAsignacion ||
            producto.codigoBarras === productoUso.codigoBarras
              ? { ...producto, usado: true, motivoUso: motivo }
              : producto,
          ),
        })),
      );

      setModalAsignadosCategoria((actual) => {
        if (!actual) return actual;
        return {
          ...actual,
          productos: actual.productos.map((producto) =>
            producto.id === idAsignacion ||
            producto.codigoBarras === productoUso.codigoBarras
              ? { ...producto, usado: true, motivoUso: motivo }
              : producto,
          ),
        };
      });

      setProductoUso(null);
      setMotivoUso("");
      setMensaje("Ítem marcado como usado correctamente.");
    } catch (error) {
      console.error("Error registrando uso del producto:", error);
      setMensaje("No fue posible registrar el uso del ítem.");
    } finally {
      setGuardandoUso(false);
    }
  };

  const devolverProductoABodega = async (producto: AsignacionBodegaMovil) => {
    if (!usuario?.clienteId || !movilActiva?.id || guardandoDevolucion) return;

    const confirmar = window.confirm(
      `¿Devolver ${producto.producto} (${producto.codigoBarras}) a bodega principal?`,
    );
    if (!confirmar) return;

    const idAsignacion = producto.id || limpiarId(producto.codigoBarras);
    if (!idAsignacion) return;

    setGuardandoDevolucion(idAsignacion);
    try {
      await setDoc(
        doc(
          db,
          "clientes",
          usuario.clienteId,
          "moviles",
          movilActiva.id,
          "DEVOLUCIONES_BODEGA",
          idAsignacion,
        ),
        {
          ...producto,
          devuelto: true,
          devueltoPorId: usuario.id,
          devueltoPorNombre: nombreCompleto,
          movilId: movilActiva.id,
          movilNombre: movilActiva.nombre,
          ubicacionDevolucion: ubicacionUsuario || null,
          fechaDevolucion: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await deleteDoc(
        doc(
          db,
          "clientes",
          usuario.clienteId,
          "moviles",
          movilActiva.id,
          "ASIGNACIONES_BODEGA",
          idAsignacion,
        ),
      );

      setCategoriasAutoevaluacion((actual) =>
        actual.map((categoria) => {
          const productos = categoria.productos.filter(
            (item) =>
              item.id !== idAsignacion &&
              item.codigoBarras !== producto.codigoBarras,
          );
          const diligenciados = Math.min(
            categoria.totalItems,
            new Set(
              productos
                .filter((item) => item.gestionado)
                .map((item) => item.producto),
            ).size,
          );
          return {
            ...categoria,
            productos,
            totalItems: categoria.totalItems,
            diligenciados,
            porcentaje: calcularPorcentaje(categoria.totalItems, diligenciados),
          };
        }),
      );

      setModalAsignadosCategoria((actual) => {
        if (!actual) return actual;
        const productos = actual.productos.filter(
          (item) =>
            item.id !== idAsignacion &&
            item.codigoBarras !== producto.codigoBarras,
        );
        const diligenciados = Math.min(
          actual.totalItems,
          new Set(
            productos
              .filter((item) => item.gestionado)
              .map((item) => item.producto),
          ).size,
        );
        return {
          ...actual,
          productos,
          totalItems: actual.totalItems,
          diligenciados,
          porcentaje: calcularPorcentaje(actual.totalItems, diligenciados),
        };
      });
    } catch (error) {
      console.error("Error devolviendo producto a bodega:", error);
      setMensaje("No fue posible devolver el ítem a bodega principal.");
    } finally {
      setGuardandoDevolucion("");
    }
  };


  const actualizarRespuestaVerificacion = (
    codigo: string,
    campo: "estado" | "cumple" | "observaciones",
    value: string,
  ) => {
    const key = itemKey(codigo);
    const item = CATEGORIAS_VERIFICACION.flatMap((categoria) => categoria.items).find(
      (actual) => actual.codigo === codigo,
    );
    const tipo = configuracionCheck[key] || "cumple";

    setRespuestasVerificacion((actual) => ({
      ...actual,
      [key]: {
  ...(actual[key] || {}),
  codigo,
  descripcion: item?.descripcion || "",
  tipo,
},
    }));
  };

  const guardarVerificacionDiaria = async () => {
    if (!usuario?.clienteId || !movilActiva?.id || guardandoVerificacion) return;

    if (!ubicacionActiva || !ubicacionUsuario) {
      setMensaje("Activa la ubicación para poder guardar la verificación diaria.");
      return;
    }

    setGuardandoVerificacion(true);

    try {
      const fecha = hoyIso();
      const datos: Record<string, RespuestaVerificacion> = {};
      let completados = 0;
      const itemsPendientes: MotivoAlertaUsuario[] = [];
      const itemsNoCumple: MotivoAlertaUsuario[] = [];
      const itemsNoAplica: MotivoAlertaUsuario[] = [];

      CATEGORIAS_VERIFICACION.forEach((categoria) => {
        categoria.items.forEach((item) => {
          const key = itemKey(item.codigo);
          const tipo = configuracionCheck[key] || "cumple";
          const actual = respuestasVerificacion[key] || ({} as RespuestaVerificacion);
          const estado = tipo === "estado" ? normalizarTexto(actual.estado, "") : "";
          const cumple = tipo === "cumple" ? normalizarTexto(actual.cumple, "") : "";
          const observacion = normalizarTexto(actual.observaciones, "");
          const diligenciado = tipo === "estado" ? Boolean(estado) : Boolean(cumple);

          if (diligenciado) completados += 1;

          datos[key] = {
            codigo: item.codigo,
            descripcion: item.descripcion,
            tipo,
            estado,
            cumple,
            observaciones: observacion,
          };

          if (!diligenciado) {
            itemsPendientes.push({
              id: `${key}_pendiente`,
              categoria: categoria.nombre,
              codigo: item.codigo,
              item: item.descripcion,
              estado: "Pendiente",
              observacion: "",
              motivo: "Ítem sin diligenciar en la verificación diaria.",
              fecha,
            });
          }

          if (tipo === "estado" && estado.toLowerCase() === "no aplica" && observacion) {
            itemsNoAplica.push({
              id: `${key}_no_aplica`,
              categoria: categoria.nombre,
              codigo: item.codigo,
              item: item.descripcion,
              estado: "No aplica",
              observacion,
              motivo: "Ítem marcado como No aplica por el operario.",
              fecha,
            });
          }

          if (tipo === "cumple" && cumple.toLowerCase() === "no cumple" && observacion) {
            itemsNoCumple.push({
              id: `${key}_no_cumple`,
              categoria: categoria.nombre,
              codigo: item.codigo,
              item: item.descripcion,
              estado: "No cumple",
              observacion,
              motivo: "Ítem marcado como No cumple por el operario.",
              fecha,
            });
          }
        });
      });

      const pendientes = Math.max(totalChecksVerificacion - completados, 0);
      const porcentaje = calcularPorcentaje(totalChecksVerificacion, completados);
      const totalNovedades = itemsNoCumple.length + itemsNoAplica.length;
      const alertaActiva = pendientes > 0 || totalNovedades > 0;

      const payloadReporte = {
        movilId: movilActiva.id,
        movilNombre: movilActiva.nombre,
        placa: movilActiva.placa || "",
        fecha,
        kilometraje: kilometrajeVerificacion.trim(),
        datos,
        completados,
        totalItems: totalChecksVerificacion,
        porcentaje,
        ubicacionGestion: ubicacionUsuario,
        gestionadoPorId: usuario.id,
        gestionadoPorNombre: nombreCompleto,
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(
          db,
          "clientes",
          usuario.clienteId,
          "verificacionesMoviles",
          fecha,
          "reportes",
          movilActiva.id,
        ),
        payloadReporte,
        { merge: true },
      );

      await setDoc(
        doc(db, "clientes", usuario.clienteId, "moviles", movilActiva.id),
        {
          kilometrajeActual: kilometrajeVerificacion.trim(),
          ultimaVerificacionDiaria: fecha,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      const payloadAlerta = {
        activo: alertaActiva,
        tipo: "verificaciones_diarias",
        categoria: "verificaciones móviles",
        movilId: movilActiva.id,
        movilNombre: movilActiva.nombre,
        nombreMovil: movilActiva.nombre,
        placa: movilActiva.placa || "",
        fecha,
        fechaVerificacion: fecha,
        totalItems: totalChecksVerificacion,
        totalChecks: totalChecksVerificacion,
        diligenciados: completados,
        respondidos: completados,
        pendientes,
        porcentaje,
        totalNovedades,
        itemsPendientes,
        itemsNoCumple,
        itemsNoAplica,
        motivos: [...itemsPendientes, ...itemsNoCumple, ...itemsNoAplica],
        motivosDetalle: [...itemsPendientes, ...itemsNoCumple, ...itemsNoAplica],
        ultimaFecha: fecha,
        mensaje: alertaActiva
          ? pendientes > 0
            ? `Móvil ${movilActiva.nombre} con verificación diaria incompleta: ${completados}/${totalChecksVerificacion}.`
            : `Móvil ${movilActiva.nombre} con novedades en la verificación diaria.`
          : `Móvil ${movilActiva.nombre} con verificación diaria completa y sin novedades.`,
        updatedAt: serverTimestamp(),
        fechaGeneracion: serverTimestamp(),
      };

      await setDoc(
        doc(
          db,
          "clientes",
          usuario.clienteId,
          "alertas",
          "verificaciones_diarias",
          "vehiculos",
          movilActiva.id,
          "fechas",
          fecha,
        ),
        payloadAlerta,
        { merge: true },
      );

      setMensaje("Verificación diaria guardada correctamente.");
      setPanelActivo("alertas");
    } catch (error) {
      console.error("Error guardando verificación diaria:", error);
      setMensaje("No fue posible guardar la verificación diaria.");
    } finally {
      setGuardandoVerificacion(false);
    }
  };

  const cambiarEstadoTareaProgramada = async (tarea: TareaProgramadaUsuario, estado: "realizado" | "no realizado" | "incompleto") => {
    if (!usuario?.clienteId) return;
    try {
      await setDoc(
        doc(db, "clientes", usuario.clienteId, "programacionTareas", tarea.id),
        { estadoFinal: estado, fechaEstado: new Date().toISOString(), actualizadoPorId: usuario.id, actualizadoPorNombre: nombreCompleto, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setMensaje(`Tarea marcada como ${estado}.`);
    } catch (error) {
      console.error("Error actualizando tarea programada:", error);
      setMensaje("No fue posible actualizar la tarea.");
    }
  };

  const enviarMensajeTareaProgramada = async () => {
    if (!usuario?.clienteId || !tareaProgramadaDetalleActual || !mensajeTareaProgramada.trim() || guardandoMensajeTareaProgramada) return;
    setGuardandoMensajeTareaProgramada(true);
    try {
      const nuevoMensaje: ChatTareaUsuario = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        autor: nombreCompleto,
        autorId: usuario.id,
        rol: "operario",
        mensaje: mensajeTareaProgramada.trim(),
        fecha: new Date().toISOString(),
      };
      const chatActual = Array.isArray(tareaProgramadaDetalleActual.chatTarea)
        ? tareaProgramadaDetalleActual.chatTarea
        : [];
      await setDoc(
        doc(db, "clientes", usuario.clienteId, "programacionTareas", tareaProgramadaDetalleActual.id),
        {
          chatTarea: [...chatActual, nuevoMensaje],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMensajeTareaProgramada("");
    } catch (error) {
      console.error("Error enviando mensaje de tarea:", error);
      setMensaje("No fue posible enviar el mensaje de la tarea.");
    } finally {
      setGuardandoMensajeTareaProgramada(false);
    }
  };

  const enviarMensajeMantenimiento = async () => {
    if (!usuario?.clienteId || !mantenimientoDetalleActual || !mensajeMantenimiento.trim() || guardandoMensajeMantenimiento) return;
    setGuardandoMensajeMantenimiento(true);
    try {
      const nuevoMensaje: ChatMantenimiento = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        autor: nombreCompleto,
        rol: "operario",
        mensaje: mensajeMantenimiento.trim(),
        fecha: new Date().toISOString(),
      };
      const chatActual = Array.isArray(mantenimientoDetalleActual.chatMantenimiento)
        ? mantenimientoDetalleActual.chatMantenimiento
        : [];
      await setDoc(
        doc(db, "clientes", usuario.clienteId, "mantenimientosVehiculares", mantenimientoDetalleActual.id),
        {
          chatMantenimiento: [...chatActual, nuevoMensaje],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMensajeMantenimiento("");
    } catch (error) {
      console.error("Error enviando mensaje de mantenimiento:", error);
      setMensaje("No fue posible enviar el mensaje del mantenimiento.");
    } finally {
      setGuardandoMensajeMantenimiento(false);
    }
  };

  const subirFotoMantenimientoOperario = async (file?: File | null) => {
    if (!usuario?.clienteId || !mantenimientoDetalleActual || !file || subiendoFotoMantenimiento) return;
    if (!file.type.startsWith("image/")) {
      setMensaje("Selecciona una imagen válida.");
      return;
    }

    setSubiendoFotoMantenimiento(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `clientes/${usuario.clienteId}/mantenimientosVehiculares/${mantenimientoDetalleActual.id}/fotosOperario/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      const nuevaFoto: ArchivoMantenimiento = {
        nombre: file.name,
        url,
        path,
        tipo: file.type,
        autor: nombreCompleto,
        autorId: usuario.id,
        fecha: new Date().toISOString(),
      };
      const fotosActuales = Array.isArray(mantenimientoDetalleActual.fotosOperario)
        ? mantenimientoDetalleActual.fotosOperario
        : [];
      await setDoc(
        doc(db, "clientes", usuario.clienteId, "mantenimientosVehiculares", mantenimientoDetalleActual.id),
        {
          fotosOperario: [...fotosActuales, nuevaFoto],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMensaje("Foto de mantenimiento agregada correctamente.");
    } catch (error) {
      console.error("Error subiendo foto del mantenimiento:", error);
      setMensaje("No fue posible subir la foto del mantenimiento.");
    } finally {
      setSubiendoFotoMantenimiento(false);
    }
  };

  const cerrarSesion = async () => {
    await signOut(auth);
    window.localStorage.removeItem("usuarioSesion");
    router.replace("/login_users");
  };

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#f4f5fb] grid place-items-center px-4">
        <div className="rounded-3xl bg-white px-8 py-7 text-center shadow-xl border border-slate-100">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-black text-slate-600">
            Cargando dashboard...
          </p>
        </div>
      </main>
    );
  }

  const BotonPanel = ({
    panel,
    texto,
    count,
  }: {
    panel: PanelActivo;
    texto: string;
    count?: number;
  }) => {
    const activo = panelActivo === panel;
    return (
      <button
        type="button"
        onClick={() => {
          if (panel === "autoevaluacion") {
            setModalAutoevaluacionOpen(true);
            return;
          }
          setPanelActivo(panel);
        }}
        className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
          activo
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        }`}
      >
        <span>{texto}</span>
        {typeof count === "number" && (
          <span className={`min-w-7 rounded-full px-2 py-0.5 text-center text-[11px] font-black ${
            activo
              ? "bg-white/20 text-white"
              : count > 0
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-500"
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  const BadgeMenu = ({ count, activo }: { count: number; activo: boolean }) => (
    <span
      className={`ml-auto inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black ${
        activo
          ? "bg-white/20 text-white"
          : count > 0
            ? "bg-red-100 text-red-700"
            : "bg-slate-100 text-slate-500"
      }`}
    >
      {count}
    </span>
  );

  const pendientesAutoevaluacion = Math.max(
    resumenAutoevaluacion.total - resumenAutoevaluacion.diligenciados,
    0,
  );

  const totalAlertasBadge = alertasActivasMovilUsuario.length;
  const totalTareasBadge = tareasProgramadasActivasUsuario.length + mantenimientosActivosUsuario.length;

  return (
    <main className="min-h-screen bg-[#f4f5fb] text-slate-800">
      {menuAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 shadow-sm transition lg:translate-x-0 ${menuAbierto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Image
                  src={logo}
                  alt="Logo"
                  width={130}
                  height={70}
                  className="object-contain"
                />
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Portal móvil
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
              >
                ✕
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 text-sm font-bold space-y-2">
            {movilesAsignadas.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setPanelActivo("alertas")}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${panelActivo === "alertas" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>Mis alertas</span>
                  <BadgeMenu count={totalAlertasBadge} activo={panelActivo === "alertas"} />
                </button>
                <button
                  type="button"
                  onClick={() => setPanelActivo("tareas")}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${panelActivo === "tareas" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>Mis tareas</span>
                  <BadgeMenu count={totalTareasBadge} activo={panelActivo === "tareas"} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalAutoevaluacionOpen(true)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${panelActivo === "autoevaluacion" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>Autoevaluación de móvil</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelActivo("verificacion")}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${panelActivo === "verificacion" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <span>Verificación diaria</span>
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Sin ítems de menú disponibles.
              </div>
            )}
          </nav>

          <div className="p-4 text-[11px] text-slate-400">
            Un producto de Famiasistir
            <br />
            Desarrollado por Printserp SAS
          </div>
        </div>
      </aside>

      <section className="lg:pl-72">
        <header className="sticky top-0 z-20 px-4 py-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-[#5b35f5] via-[#7c2df2] to-[#25a7f0] px-4 py-4 text-white shadow-xl shadow-indigo-500/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMenuAbierto(true)}
                className="lg:hidden rounded-xl bg-white/15 px-3 py-2"
                aria-label="Abrir menú"
              >
                ☰
              </button>

              {usuario?.fotoUrl ? (
                <img
                  src={usuario.fotoUrl}
                  alt={nombreCompleto}
                  className="h-11 w-11 rounded-full object-cover border border-white/30"
                />
              ) : (
                <div className="h-11 w-11 rounded-full bg-white/20 grid place-items-center font-black">
                  {nombreCompleto.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs opacity-80">Hola,</p>
                <h1 className="truncate text-sm sm:text-base font-black">
                  {nombreCompleto}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs opacity-70">Rol</p>
                <p className="text-xs font-bold">{usuario?.rol || "Sin rol"}</p>
              </div>
              <button
                type="button"
                onClick={cerrarSesion}
                className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold hover:bg-white/25"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        <div className="px-4 pb-10 sm:px-6 lg:px-8">
          {mensaje && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
              {mensaje}
            </div>
          )}

          <section className="mb-4 rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-500 font-black">
              Dashboard móvil
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1 text-sm leading-5">
                <p>
                  <span className="font-black text-slate-700">Usuario:</span>{" "}
                  <span className="font-semibold text-slate-600">
                    {nombreCompleto}
                  </span>{" "}
                  <span className="text-xs text-slate-400">
                    ({usuario?.email})
                  </span>
                </p>
                <p>
                  <span className="font-black text-slate-700">Rol:</span>{" "}
                  <span className="font-semibold text-slate-600">
                    {usuario?.rol || "Sin rol"}
                  </span>{" "}
                  <span className="text-xs text-slate-400">
                    · {usuario?.tipoFuncionario || "Sin tipo de funcionario"}
                  </span>
                </p>
                <p>
                  <span className="font-black text-slate-700">Móvil:</span>{" "}
                  <span className="font-semibold text-slate-600">
                    {movilActiva ? movilActiva.nombre : "Sin asignaciones"}
                  </span>
                </p>
              </div>

              {movilActiva && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2 sm:min-w-[320px]">
                  {movilActiva.fotoUrl ? (
                    <img
                      src={movilActiva.fotoUrl}
                      alt={movilActiva.nombre}
                      className="h-16 w-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-16 w-20 rounded-xl bg-slate-200 grid place-items-center text-[10px] font-black text-slate-500">
                      Sin foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-800">
                      {movilActiva.nombre}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                        {movilActiva.tipo}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-600">
                        {movilActiva.placa}
                      </span>
                    </div>
                    {movilesAsignadas.length > 1 && (
                      <select
                        value={movilActivaId}
                        onChange={(event) =>
                          setMovilActivaId(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                      >
                        {movilesAsignadas.map((movil) => (
                          <option key={movil.id} value={movil.id}>
                            {movil.nombre}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {movilesAsignadas.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <BotonPanel panel="alertas" texto="Mis alertas" count={totalAlertasBadge} />
              <BotonPanel panel="tareas" texto="Mis tareas" count={totalTareasBadge} />
              <BotonPanel
                panel="autoevaluacion"
                texto="Autoevaluación de móvil"
              />
              <BotonPanel panel="verificacion" texto="Verificación diaria" />
            </div>
          )}

          {movilesAsignadas.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-amber-50 text-2xl grid place-items-center">
                ⚠️
              </div>
              <h3 className="text-xl font-black text-slate-800">
                Sin asignaciones
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Tu usuario aún no tiene una móvil asignada. Cuando el
                administrador te asigne una móvil, aparecerán las opciones del
                dashboard.
              </p>
            </section>
          ) : panelActivo === "alertas" ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                    Mis alertas
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-800">
                    Alertas de {movilActiva?.nombre || "mi móvil"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Solo se muestran las alertas relacionadas con la móvil asignada.
                  </p>
                </div>
                <div className="rounded-2xl bg-rose-50 px-4 py-2 text-center">
                  <p className="text-xl font-black text-rose-600">
                    {alertasActivasMovilUsuario.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wide text-rose-600/80">
                    Activas
                  </p>
                </div>
              </div>

              <div className="mt-5">
                {cargandoAlertasUsuario ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-black text-slate-400">
                    Cargando alertas de la móvil...
                  </div>
                ) : alertasActivasMovilUsuario.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-6 text-center">
                    <p className="text-base font-black text-emerald-700">
                      Sin alertas activas
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-600">
                      La móvil no tiene alertas pendientes.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {gruposAlertasMovilUsuario.map((grupo) => {
                      const estilo = estiloGrupoAlerta(grupo.color);
                      return (
                        <section
                          key={grupo.id}
                          className={`rounded-3xl border p-3 sm:p-4 ${estilo.contenedor}`}
                        >
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className={`text-sm font-black ${estilo.titulo}`}>
                                {grupo.titulo}
                              </h3>
                              <p className="mt-0.5 text-xs font-bold text-slate-500">
                                {grupo.descripcion}
                              </p>
                            </div>
                            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${estilo.badge}`}>
                              {grupo.alertas.length} alerta(s)
                            </span>
                          </div>

                          <div className="grid gap-3">
                            {grupo.alertas.map((alerta) => (
                              <button
                                key={alerta.id}
                                type="button"
                                onClick={() => setAlertaMovilDetalle(alerta)}
                                className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition ${estilo.boton}`}
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-800">
                                      {alerta.movilNombre}
                                      {alerta.fecha ? ` · ${alerta.fecha}` : ""}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-500">
                                      {alerta.mensaje}
                                    </p>
                                    {formatearFecha(alerta.updatedAt) && (
                                      <p className="mt-1 text-[11px] font-bold text-slate-400">
                                        Actualizada: {formatearFecha(alerta.updatedAt)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${estilo.chip}`}>
                                      Pendientes: {alerta.pendientes}
                                    </span>
                                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                                      {alerta.porcentaje}%
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full transition-all ${estilo.barra}`}
                                    style={{ width: `${Math.max(alerta.porcentaje, 4)}%` }}
                                  />
                                </div>
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ) : panelActivo === "tareas" ? (
            <section className="space-y-5">
              <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-sky-600">
                      Mis tareas
                    </p>
                    <h2 className="mt-1 text-lg font-black text-slate-800">
                      Tareas programadas
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Tareas asignadas directamente por el administrador.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-4 py-2 text-center ring-1 ring-sky-100">
                    <p className="text-xl font-black text-sky-700">
                      {tareasProgramadasActivasUsuario.length}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wide text-sky-600/80">
                      Pendientes
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                <section className="rounded-3xl border border-sky-100 bg-sky-50/45 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-sky-600">Tareas programadas</p>
                      <h3 className="text-sm font-black text-slate-800">Asignadas directamente a tu usuario</h3>
                    </div>
                    <span className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-sky-700 ring-1 ring-sky-100">
                      {tareasProgramadasActivasUsuario.length}
                    </span>
                  </div>

                  <div className="mt-3">
                    {cargandoTareasProgramadasUsuario ? (
                      <div className="rounded-2xl border border-dashed border-sky-100 bg-white/70 px-4 py-6 text-center text-xs font-black text-sky-500">
                        Cargando tareas programadas...
                      </div>
                    ) : tareasProgramadasActivasUsuario.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-6 text-center text-xs font-black text-emerald-600">
                        No tienes tareas programadas pendientes.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {tareasProgramadasActivasUsuario.map((tarea) => (
                          <article key={tarea.id} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-sm font-black text-slate-800">{tarea.descripcion}</p>
                                <p className="mt-1 text-xs font-bold text-slate-400">Fecha máxima: {tarea.fechaMaxima || "Sin fecha"}</p>
                              </div>
                              <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoTareaClase(tarea.estadoFinal)}`}>
                                {normalizarTexto(tarea.estadoFinal, "pendiente")}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${prioridadTareaClase(tarea.prioridad)}`}>
                                {normalizarTexto(tarea.prioridad, "media")}
                              </span>
                              {tarea.observaciones && (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">Con observación</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setTareaProgramadaDetalle(tarea);
                                setMensajeTareaProgramada("");
                              }}
                              className="mt-4 w-full rounded-2xl bg-sky-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500"
                            >
                              Ver seguimiento
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
                </div>
              </section>

              <section className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">Mantenimientos</p>
                    <h2 className="mt-1 text-lg font-black text-slate-800">Mantenimientos asignados</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Seguimiento de mantenimientos programados para tu usuario.</p>
                  </div>
                  <div className="rounded-2xl bg-indigo-50 px-4 py-2 text-center ring-1 ring-indigo-100">
                    <p className="text-xl font-black text-indigo-700">{mantenimientosActivosUsuario.length}</p>
                    <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600/80">Activos</p>
                  </div>
                </div>

                <div className="mt-5">
                {cargandoMantenimientosUsuario ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-black text-slate-400">
                    Cargando mantenimientos asignados...
                  </div>
                ) : mantenimientosActivosUsuario.length === 0 ? (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-8 text-center">
                    <p className="text-sm font-black text-emerald-700">
                      Sin mantenimientos asignados
                    </p>
                    <p className="mt-1 text-xs font-bold text-emerald-600">
                      Cuando el administrador te programe uno, aparecerá aquí.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {mantenimientosActivosUsuario.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-800">
                              {item.movilNombre || movilActiva?.nombre || "Móvil"}
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-slate-400">
                              {item.fecha || "Sin fecha"} · {item.placa || item.movilId || "Sin placa"}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoMantenimientoClase(item.estadoGestion)}`}>
                            {normalizarTexto(item.estadoGestion, "programado")}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase text-indigo-700">
                            {item.tipoMantenimiento || "Tipo"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600">
                            {item.sistema || "Sistema"}
                          </span>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black text-sky-700">
                            Fotos: {fotosMantenimiento(item).length}
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                          {descripcionMantenimiento(item)}
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            setMantenimientoDetalle(item);
                            setMensajeMantenimiento("");
                          }}
                          className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                        >
                          Ver seguimiento
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </section>
          ) : panelActivo === "verificacion" ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">
                    Verificación diaria
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-800">
                    {movilActiva?.nombre || "Móvil asignada"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Diligencia el checklist diario de la móvil asignada.
                  </p>
                </div>
                <div className="rounded-2xl bg-indigo-50 px-4 py-2 text-center">
                  <p className="text-xl font-black text-indigo-700">
                    {resumenVerificacion.porcentaje}%
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600/80">
                    Avance
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Kilometraje
                  </span>
                  <input
                    type="number"
                    value={kilometrajeVerificacion}
                    onChange={(event) => setKilometrajeVerificacion(event.target.value)}
                    placeholder="Kilometraje"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-300 focus:bg-white"
                  />
                </label>
                {[
                  { label: "SOAT", fecha: movilVerificacionData?.soatExpiry },
                  {
                    label: "Tecnomecánica",
                    fecha: movilVerificacionData?.tecnomecanicaExpiry,
                  },
                  {
                    label: "Aceite",
                    fecha:
                      movilVerificacionData?.aceiteExpiry ||
                      movilVerificacionData?.aceiteVencimiento ||
                      movilVerificacionData?.oilExpiry,
                  },
                  {
                    label: "Póliza todo riesgo",
                    fecha: movilVerificacionData?.policyAllRiskExpiry,
                  },
                ].map((item) => (
                  <label key={item.label} className="block">
                    <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                      {item.label}
                    </span>
                    <input
                      readOnly
                      value={etiquetaDias(String(item.fecha || ""))}
                      className={`w-full rounded-2xl border px-4 py-3 text-sm font-black outline-none ${
                        estaVencido(String(item.fecha || ""))
                          ? "border-red-200 bg-red-600 text-white animate-pulse"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    />
                  </label>
                ))}
              </div>

              {!ubicacionActiva || !ubicacionUsuario ? (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                  Debes activar la ubicación para guardar la verificación diaria.
                </div>
              ) : null}

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.max(resumenVerificacion.porcentaje, 4)}%` }}
                />
              </div>

              <div className="mt-5 space-y-4">
                {CATEGORIAS_VERIFICACION.map((categoria) => (
                  <section
                    key={categoria.nombre}
                    className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"
                  >
                    <div className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-800">
                      {categoria.nombre}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {categoria.items.map((item) => {
                        const key = itemKey(item.codigo);
                        const tipo = configuracionCheck[key] || "cumple";
                        const actual = respuestasVerificacion[key] || ({} as RespuestaVerificacion);
                        const diligenciado = tipo === "estado" ? Boolean(actual.estado) : Boolean(actual.cumple);

                        return (
                          <div
                            key={key}
                            className={`grid gap-3 px-4 py-3 text-sm xl:grid-cols-[1.2fr_220px_220px_1fr] xl:items-center ${
                              diligenciado ? "bg-emerald-50/50" : "bg-red-50/45"
                            }`}
                          >
                            <p className="font-black text-slate-700">
                              {item.codigo} - {item.descripcion}
                            </p>
                            <select
                              value={actual.estado || ""}
                              disabled={tipo !== "estado"}
                              onChange={(event) =>
                                actualizarRespuestaVerificacion(item.codigo, "estado", event.target.value)
                              }
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none disabled:bg-slate-100 disabled:text-slate-300"
                            >
                              <option value="">Estado</option>
                              <option value="Aplica">Aplica</option>
                              <option value="No aplica">No aplica</option>
                            </select>
                            <select
                              value={actual.cumple || ""}
                              disabled={tipo !== "cumple"}
                              onChange={(event) =>
                                actualizarRespuestaVerificacion(item.codigo, "cumple", event.target.value)
                              }
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none disabled:bg-slate-100 disabled:text-slate-300"
                            >
                              <option value="">Cumplimiento</option>
                              <option value="Cumple">Cumple</option>
                              <option value="No cumple">No cumple</option>
                            </select>
                            <input
                              value={actual.observaciones || ""}
                              onChange={(event) =>
                                actualizarRespuestaVerificacion(item.codigo, "observaciones", event.target.value)
                              }
                              placeholder="Observaciones"
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-indigo-300"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="sticky bottom-0 mt-5 flex justify-end gap-3 rounded-2xl border border-slate-100 bg-white/95 p-3 shadow-lg backdrop-blur">
                <button
                  type="button"
                  onClick={() => setRespuestasVerificacion({})}
                  className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-300"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  disabled={guardandoVerificacion || !ubicacionActiva || !ubicacionUsuario}
                  onClick={guardarVerificacionDiaria}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardandoVerificacion ? "Guardando..." : "Guardar verificación"}
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-800">
                Dashboard móvil
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Selecciona Mis alertas, Mis tareas, Autoevaluación de móvil o Verificación diaria.
              </p>
            </section>
          )}
        </div>
      </section>

      {modalAutoevaluacionOpen && movilActiva && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-3 sm:p-5">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Autoevaluación de móvil
                </p>
                <h3 className="mt-1 truncate text-lg font-black">
                  {movilActiva.nombre}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/75">
                  Total ítems: {resumenAutoevaluacion.total} · Diligenciados:{" "}
                  {resumenAutoevaluacion.diligenciados} ·{" "}
                  {progresoGeneralAutoevaluacion}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAutoevaluacionOpen(false)}
                className="w-fit rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
              <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
                <aside className="space-y-4 xl:order-1">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
                        ¿Dónde está?
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${ubicacionActiva ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                      >
                        {ubicacionActiva
                          ? "Ubicación activa"
                          : "Ubicación obligatoria"}
                      </span>
                    </div>
                    <div
                      ref={mapContainerRef}
                      className="mt-3 h-60 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    />
                    {ubicacionUsuario && (
                      <p className="mt-2 text-[11px] font-black text-slate-500">
                        {ubicacionUsuario.lat.toFixed(6)},{" "}
                        {ubicacionUsuario.lng.toFixed(6)}
                      </p>
                    )}
                    {ultimaActualizacionUbicacion && (
                      <p className="mt-1 text-[11px] font-bold text-slate-400">
                        Última actualización:{" "}
                        {new Date(ultimaActualizacionUbicacion).toLocaleString(
                          "es-CO",
                        )}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={pedirUbicacion}
                      className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white hover:bg-slate-700"
                    >
                      {ubicacionActiva
                        ? "Actualizar mi ubicación"
                        : "Activar ubicación obligatoria"}
                    </button>
                    {ubicacionMensaje && (
                      <p
                        className={`mt-2 text-xs font-bold ${ubicacionActiva ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {ubicacionMensaje}
                      </p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
                      Personal asignado
                    </h3>
                    {personalAsignado.length === 0 ? (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-bold text-slate-400">
                        Sin personal asignado
                      </div>
                    ) : (
                      <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                        {personalAsignado.map((personal) => (
                          <div
                            key={personal.id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                          >
                            {personal.fotoUrl ? (
                              <img
                                src={personal.fotoUrl}
                                alt={personal.nombres}
                                className="h-11 w-11 rounded-full object-cover"
                              />
                            ) : (
                              <div className="grid h-11 w-11 place-items-center rounded-full bg-sky-100 text-sm font-black text-sky-700">
                                {(personal.nombres || personal.email || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-700">
                                {personal.nombres} {personal.apellidos}
                              </p>
                              <p className="truncate text-xs font-bold text-slate-400">
                                {personal.tipoFuncionario}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:order-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                        Categorías
                      </p>
                      <h2 className="mt-1 text-lg font-black text-slate-800">
                        Autoevaluación asignada
                      </h2>
                    </div>
                    <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                      {progresoGeneralAutoevaluacion}%
                    </span>
                  </div>

                  <div className="mt-4 h-5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="flex h-full items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white transition-all"
                      style={{ width: `${progresoGeneralAutoevaluacion}%` }}
                    >
                      {progresoGeneralAutoevaluacion}%
                    </div>
                  </div>

                  {cargandoCategorias ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                      Cargando categorías...
                    </div>
                  ) : categoriasAutoevaluacion.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                      Sin categorías de autoevaluación.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {categoriasAutoevaluacion.map((item) => (
                        <article
                          key={item.categoria}
                          className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="line-clamp-2 text-sm font-black text-slate-700">
                              {item.categoria}
                            </h3>
                            <span className="shrink-0 text-xs font-black text-slate-400">
                              {item.porcentaje}%
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-bold text-slate-400">
                            Total ítems: {item.totalItems}
                          </p>
                          <p className="text-xs font-bold text-slate-400">
                            Diligenciados: {item.diligenciados}
                          </p>
                          <button
                            type="button"
                            onClick={() => setModalAsignadosCategoria(item)}
                            className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-sm ring-1 ring-indigo-100 transition hover:bg-indigo-50 disabled:opacity-50"
                            disabled={item.productos.length === 0}
                          >
                            Ver asignados ({item.productos.length})
                          </button>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${item.porcentaje}%` }}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalAsignadosCategoria && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-2 sm:p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 bg-indigo-600 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">
                  Productos asignados
                </p>
                <h3 className="truncate text-base font-black leading-tight">
                  {modalAsignadosCategoria.categoria}
                </h3>
                <p className="text-[11px] font-bold text-white/80">
                  Total: {modalAsignadosCategoria.totalItems} · Diligenciados:{" "}
                  {modalAsignadosCategoria.diligenciados}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAsignadosCategoria(null)}
                className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(92vh-74px)] overflow-y-auto p-3 sm:p-4">
              {modalAsignadosCategoria.productos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-black text-slate-400">
                  Esta categoría aún no tiene productos asignados para esta
                  móvil.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                  {modalAsignadosCategoria.productos.map((producto) => (
                    <div
                      key={producto.id || producto.codigoBarras}
                      className="grid gap-2 px-3 py-3 text-xs sm:grid-cols-[1.25fr_0.9fr_0.9fr_0.8fr] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-700">
                          {producto.producto}
                        </p>
                        <p className="truncate text-[11px] font-bold text-slate-400">
                          {producto.tipo}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:block">
                        <p className="text-[10px] font-black uppercase text-slate-400 sm:hidden">
                          Asignado
                        </p>
                        <p className="font-black text-slate-500">
                          {producto.codigoBarras}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:block">
                        <p className="text-[10px] font-black uppercase text-slate-400 sm:hidden">
                          Leído
                        </p>
                        <p className="font-black text-slate-500">
                          {producto.codigoEscaneado || "Sin lectura"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${producto.gestionado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {producto.gestionado ? "Gestionado" : "Pendiente"}
                        </span>
                        {producto.usado && (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                            Usado
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => abrirEscaneoProducto(producto)}
                          disabled={!ubicacionActiva || !ubicacionUsuario}
                          className={`rounded-xl px-3 py-2 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${producto.gestionado ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-indigo-600 text-white"}`}
                        >
                          {!ubicacionActiva || !ubicacionUsuario
                            ? "Ubicación"
                            : producto.gestionado
                              ? "Releer"
                              : "Escanear"}
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirGestionUso(producto)}
                          disabled={
                            !ubicacionActiva ||
                            !ubicacionUsuario ||
                            producto.usado
                          }
                          className="rounded-xl bg-orange-50 px-3 py-2 text-[11px] font-black text-orange-700 ring-1 ring-orange-100 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {producto.usado ? "Usado" : "Gestión"}
                        </button>
                        <button
                          type="button"
                          onClick={() => devolverProductoABodega(producto)}
                          disabled={
                            guardandoDevolucion ===
                            (producto.id || limpiarId(producto.codigoBarras))
                          }
                          className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {guardandoDevolucion ===
                          (producto.id || limpiarId(producto.codigoBarras))
                            ? "..."
                            : "Devolver"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {alertaMovilDetalle && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 p-3 sm:p-5">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-rose-600 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Detalle de alerta
                </p>
                <h3 className="mt-1 truncate text-lg font-black">
                  {alertaMovilDetalle.movilNombre}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/75">
                  {alertaMovilDetalle.placa || "Sin placa"} · {alertaMovilDetalle.pendientes} pendiente(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertaMovilDetalle(null)}
                className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {alertaMovilDetalle.mensaje}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Total
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800">
                    {alertaMovilDetalle.totalItems}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase text-emerald-500">
                    Diligenciados
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-700">
                    {alertaMovilDetalle.diligenciados}
                  </p>
                </div>
                <div className="rounded-2xl bg-rose-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase text-rose-500">
                    Pendientes
                  </p>
                  <p className="mt-1 text-xl font-black text-rose-700">
                    {alertaMovilDetalle.pendientes}
                  </p>
                </div>
              </div>

              {alertaMovilDetalle.clase === "verificacion" || alertaMovilDetalle.clase === "infraccion" || alertaMovilDetalle.clase === "tarea" ? (
                <>
                  <h4 className="mt-5 text-sm font-black uppercase tracking-wide text-slate-600">
                    {alertaMovilDetalle.clase === "infraccion"
                      ? "Detalle de la infracción"
                      : alertaMovilDetalle.clase === "tarea"
                        ? "Detalle de la tarea"
                        : "Motivos de la verificación"}
                  </h4>

                  {!alertaMovilDetalle.motivos || alertaMovilDetalle.motivos.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                      No hay motivos detallados registrados.
                    </div>
                  ) : (
                    <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                      {alertaMovilDetalle.motivos.map((motivo, index) => (
                        <div
                          key={`${motivo.id}-${index}`}
                          className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]"
                        >
                          <div>
                            <p className="font-black text-slate-800">
                              {motivo.item}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              {motivo.categoria} · {motivo.codigo || "Sin código"}
                            </p>
                            <p className="mt-2 text-xs font-bold text-slate-600">
                              {motivo.motivo}
                            </p>
                            {motivo.observacion && (
                              <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                                {motivo.observacion}
                              </p>
                            )}
                          </div>
                          <span
                            className={`h-fit rounded-full px-3 py-1 text-xs font-black ${
                              motivo.estado.toLowerCase().includes("no cumple")
                                ? "bg-red-50 text-red-700"
                                : motivo.estado.toLowerCase().includes("no aplica")
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-50 text-slate-600"
                            }`}
                          >
                            {motivo.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h4 className="mt-5 text-sm font-black uppercase tracking-wide text-slate-600">
                    Categorías con pendientes
                  </h4>

                  {alertaMovilDetalle.categoriasPendientes.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                      No hay categorías pendientes registradas.
                    </div>
                  ) : (
                    <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                      {alertaMovilDetalle.categoriasPendientes.map((categoria) => (
                        <div
                          key={categoria.categoria}
                          className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]"
                        >
                          <div>
                            <p className="font-black text-slate-800">
                              {categoria.categoria}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              Total: {categoria.totalItems} · Diligenciados: {categoria.diligenciados} · Pendientes: {categoria.pendientes}
                            </p>
                          </div>
                          <span className="h-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                            {categoria.porcentaje}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {(alertaMovilDetalle.clase === "verificacion" || alertaMovilDetalle.clase === "autoevaluacion") && (
                <button
                  type="button"
                  onClick={() => {
                    setAlertaMovilDetalle(null);
                    if (alertaMovilDetalle.clase === "verificacion") {
                      setPanelActivo("verificacion");
                    } else {
                      setModalAutoevaluacionOpen(true);
                    }
                  }}
                  className="mt-5 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
                >
                  {alertaMovilDetalle.clase === "verificacion"
                    ? "Abrir verificación diaria"
                    : "Abrir autoevaluación"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {productoUso && (
        <div className="fixed inset-0 z-[105] grid place-items-center bg-slate-950/70 p-3 sm:p-5">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-orange-600 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Gestión de uso
                </p>
                <h3 className="mt-1 truncate text-lg font-black">
                  {productoUso.producto}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/75">
                  Código: {productoUso.codigoBarras}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProductoUso(null);
                  setMotivoUso("");
                }}
                className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                Marca este ítem como usado cuando salga de servicio o se
                consuma. Quedará registrado en la asignación y en la
                autoevaluación general.
              </div>

              <label className="mt-5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Motivo de uso
              </label>
              <textarea
                value={motivoUso}
                onChange={(event) => setMotivoUso(event.target.value)}
                placeholder="Ejemplo: Se usó en atención del paciente / material consumido / elemento dado de baja..."
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-orange-300"
              />

              <button
                type="button"
                onClick={registrarUsoProducto}
                disabled={guardandoUso}
                className="mt-4 w-full rounded-2xl bg-orange-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoUso ? "Guardando..." : "Guardar gestión de uso"}
              </button>
            </div>
          </div>
        </div>
      )}


      {tareaProgramadaDetalleActual && (
        <div className="fixed inset-0 z-[96] grid place-items-center bg-slate-950/60 p-3 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-sky-600 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Seguimiento de tarea</p>
                <h3 className="truncate text-lg font-black">{tareaProgramadaDetalleActual.descripcion}</h3>
                <p className="text-xs font-bold text-white/75">Fecha máxima: {tareaProgramadaDetalleActual.fechaMaxima || "Sin fecha"}</p>
              </div>
              <button
                type="button"
                onClick={() => setTareaProgramadaDetalle(null)}
                className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(94vh-86px)] overflow-y-auto p-4 sm:p-5">
              <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoTareaClase(tareaProgramadaDetalleActual.estadoFinal)}`}>
                    {normalizarTexto(tareaProgramadaDetalleActual.estadoFinal, "pendiente")}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${prioridadTareaClase(tareaProgramadaDetalleActual.prioridad)}`}>
                    {normalizarTexto(tareaProgramadaDetalleActual.prioridad, "media")}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">
                    Creada: {tareaProgramadaDetalleActual.fechaCreacion || "Sin fecha"}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Descripción</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                    {tareaProgramadaDetalleActual.descripcion}
                  </p>
                </div>

                {tareaProgramadaDetalleActual.observaciones && (
                  <div className="mt-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <p className="text-[11px] font-black uppercase tracking-wide text-amber-600">Observaciones</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-amber-700">
                      {tareaProgramadaDetalleActual.observaciones}
                    </p>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Estado final</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    El estado final lo define el administrador. Desde aquí solo puedes enviar seguimiento y observaciones.
                  </p>
                </div>
              </section>

              <section className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Comunicación</p>
                    <h4 className="text-sm font-black text-slate-800">Chat de seguimiento</h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">
                    {(tareaProgramadaDetalleActual.chatTarea || []).length} mensaje(s)
                  </span>
                </div>

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                  {(tareaProgramadaDetalleActual.chatTarea || []).length === 0 ? (
                    <p className="py-6 text-center text-xs font-bold text-slate-400">Sin mensajes todavía.</p>
                  ) : (
                    (tareaProgramadaDetalleActual.chatTarea || []).map((chat, index) => (
                      <div key={chat.id || index} className={`rounded-2xl px-3 py-2 ${chat.rol === "operario" ? "bg-sky-50 text-sky-800" : "bg-slate-50 text-slate-700"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black">{chat.autor || (chat.rol === "admin" ? "Admin" : "Operario")}</p>
                          <p className="text-[10px] font-bold opacity-60">{formatearFecha(chat.fecha)}</p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5">{chat.mensaje}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={mensajeTareaProgramada}
                    onChange={(event) => setMensajeTareaProgramada(event.target.value)}
                    placeholder="Escribe un mensaje para el administrador..."
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-sky-300"
                  />
                  <button
                    type="button"
                    onClick={enviarMensajeTareaProgramada}
                    disabled={guardandoMensajeTareaProgramada || !mensajeTareaProgramada.trim()}
                    className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500 disabled:opacity-60"
                  >
                    {guardandoMensajeTareaProgramada ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {mantenimientoDetalleActual && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/60 p-3 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Seguimiento de mantenimiento
                </p>
                <h3 className="truncate text-lg font-black">
                  {mantenimientoDetalleActual.movilNombre || movilActiva?.nombre || "Móvil"}
                </h3>
                <p className="text-xs font-bold text-white/75">
                  {mantenimientoDetalleActual.fecha || "Sin fecha"} · {mantenimientoDetalleActual.tipoMantenimiento}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMantenimientoDetalle(null)}
                className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(94vh-86px)] overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoMantenimientoClase(mantenimientoDetalleActual.estadoGestion)}`}>
                      {normalizarTexto(mantenimientoDetalleActual.estadoGestion, "programado")}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase text-indigo-700">
                      {mantenimientoDetalleActual.tipoMantenimiento}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-600 ring-1 ring-slate-200">
                      {mantenimientoDetalleActual.sistema}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs font-bold text-slate-600 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Kilometraje</p>
                      <p className="mt-1 text-sm font-black text-slate-700">{mantenimientoDetalleActual.kilometraje || "N/A"}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Proveedor</p>
                      <p className="mt-1 text-sm font-black text-slate-700">{mantenimientoDetalleActual.proveedorNombre || "N/A"}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Coordinador</p>
                      <p className="mt-1 text-sm font-black text-slate-700">{mantenimientoDetalleActual.coordinador || "N/A"}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Frecuencia / alerta</p>
                      <p className="mt-1 text-sm font-black text-slate-700">
                        {mantenimientoDetalleActual.frecuenciaKm || "N/A"} km · {mantenimientoDetalleActual.diasAlerta || "N/A"} días
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Detalle</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                      {descripcionMantenimiento(mantenimientoDetalleActual)}
                    </p>
                  </div>

                  {mantenimientoDetalleActual.observacionesAdmin && (
                    <div className="mt-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                      <p className="text-[11px] font-black uppercase tracking-wide text-amber-600">Observaciones admin</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-amber-700">
                        {mantenimientoDetalleActual.observacionesAdmin}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Fotos</p>
                      <h4 className="text-sm font-black text-slate-800">Evidencia del operario</h4>
                    </div>
                    <label className="cursor-pointer rounded-2xl bg-sky-500 px-3 py-2 text-xs font-black text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400">
                      {subiendoFotoMantenimiento ? "Subiendo..." : "Agregar foto"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={subiendoFotoMantenimiento}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          event.target.value = "";
                          subirFotoMantenimientoOperario(file);
                        }}
                      />
                    </label>
                  </div>

                  {fotosMantenimiento(mantenimientoDetalleActual).length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs font-bold text-slate-400">
                      Sin fotos cargadas.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {fotosMantenimiento(mantenimientoDetalleActual).map((foto, index) => (
                        <a
                          key={`${foto.url || foto.path || index}_${index}`}
                          href={foto.url}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
                        >
                          <img src={foto.url} alt={foto.nombre || "Foto mantenimiento"} className="h-28 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Comunicación</p>
                    <h4 className="text-sm font-black text-slate-800">Chat de seguimiento</h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">
                    {(mantenimientoDetalleActual.chatMantenimiento || []).length} mensaje(s)
                  </span>
                </div>

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                  {(mantenimientoDetalleActual.chatMantenimiento || []).length === 0 ? (
                    <p className="py-6 text-center text-xs font-bold text-slate-400">
                      Sin mensajes todavía.
                    </p>
                  ) : (
                    (mantenimientoDetalleActual.chatMantenimiento || []).map((chat, index) => (
                      <div
                        key={chat.id || index}
                        className={`rounded-2xl px-3 py-2 ${chat.rol === "operario" ? "bg-indigo-50 text-indigo-800" : "bg-slate-50 text-slate-700"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black">{chat.autor || (chat.rol === "admin" ? "Admin" : "Operario")}</p>
                          <p className="text-[10px] font-bold opacity-60">{formatearFecha(chat.fecha)}</p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5">{chat.mensaje}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={mensajeMantenimiento}
                    onChange={(event) => setMensajeMantenimiento(event.target.value)}
                    placeholder="Escribe un mensaje para el administrador..."
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
                  />
                  <button
                    type="button"
                    onClick={enviarMensajeMantenimiento}
                    disabled={guardandoMensajeMantenimiento || !mensajeMantenimiento.trim()}
                    className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-60"
                  >
                    {guardandoMensajeMantenimiento ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {productoEscaneo && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/70 p-3 sm:p-5">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-900 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/60">
                  Escanear code bar
                </p>
                <h3 className="mt-1 truncate text-lg font-black">
                  {productoEscaneo.producto}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/70">
                  Código asignado: {productoEscaneo.codigoBarras}
                </p>
                <p className="mt-1 text-xs font-bold text-amber-200">
                  El código leído debe coincidir exactamente con el asignado.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarScanner}
                className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5">
              {(!ubicacionActiva || !ubicacionUsuario) && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                  La ubicación está inactiva. Cierra este modal y marca tu
                  ubicación antes de continuar.
                </div>
              )}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
                <video
                  ref={videoScannerRef}
                  className="h-72 w-full object-cover"
                  muted
                  playsInline
                />
              </div>

              {scannerError && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                  {scannerError}
                </div>
              )}

              <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Ingreso manual
                </label>
                <input
                  value={scannerManual}
                  onChange={(event) => setScannerManual(event.target.value)}
                  placeholder={`Digita exactamente: ${productoEscaneo.codigoBarras}`}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
                />
                <button
                  type="button"
                  onClick={() => guardarEscaneoProducto()}
                  disabled={guardandoEscaneo}
                  className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardandoEscaneo
                    ? "Guardando..."
                    : "Guardar como gestionado"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
