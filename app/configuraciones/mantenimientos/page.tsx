"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

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

type Movil = {
  id: string;
  nombre?: string;
  denominacion?: string;
  placa?: string;
  modelo?: string;
  kilometrajeInicial?: string;
  kilometrajeActual?: string;
  tipo?: string;
  estado?: string;
  status?: string;
  fotos?: ArchivoGuardado[] | string[];
  fotoUrl?: string;
  imagenUrl?: string;
  [key: string]: unknown;
};

type UsuarioOperativo = {
  id: string;
  nombres?: string;
  apellidos?: string;
  email?: string;
  tipoFuncionario?: string;
  rol?: string;
  estado?: string;
  fotoUrl?: string;
  [key: string]: unknown;
};

type Proveedor = {
  id: string;
  nombreComercial: string;
  razonSocial: string;
  nit: string;
  telefono: string;
  email: string;
  direccion: string;
  tipoPago: string;
  numeroCuenta: string;
  tipoConvenio: string;
  servicios: {
    preventivo: boolean;
    correctivo: boolean;
  };
  rutUrl?: string;
  certificacionUrl?: string;
  contratoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type TipoMantenimiento = "" | "preventivo" | "correctivo";
type SistemaMantenimiento =
  | ""
  | "electrico"
  | "suspension"
  | "lubricacion"
  | "frenos"
  | "transmision"
  | "enfriamiento"
  | "pintura";

type ChatMantenimiento = {
  id: string;
  autor: string;
  rol: "admin" | "operario" | "sistema";
  mensaje: string;
  fecha?: unknown;
};

type Mantenimiento = {
  id: string;
  movilId: string;
  movilNombre: string;
  placa?: string;
  kilometraje: string;
  fecha: string;
  coordinador: string;
  tipoMantenimiento: "preventivo" | "correctivo";
  sistema: SistemaMantenimiento;
  tareas: Record<string, string>;
  fallaReportada: string;
  frecuenciaKm: string;
  diasAlerta: string;
  asignadoA: string;
  asignadoNombre: string;
  programarServicioCon: string;
  proveedorNombre: string;
  novedadesConductor: string;
  estadoGestion?: string;
  fechaGestion?: string;
  tareaRealizada?: string;
  observacionesAdmin?: string;
  numeroFactura?: string;
  comprobanteUrl?: string;
  fotos?: ArchivoGuardado[];
  fotosOperario?: ArchivoGuardado[];
  chatMantenimiento?: ChatMantenimiento[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DEFAULT_LOGO = "/logo.png";
const DEFAULT_MOVIL_IMAGE =
  "data:image/svg+xml,%3Csvg width='600' height='360' viewBox='0 0 600 360' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='600' height='360' rx='36' fill='%23F1F5F9'/%3E%3Cpath d='M149 215h302l-28-72c-5-13-18-22-32-22H209c-14 0-27 9-32 22l-28 72Z' fill='%23CBD5E1'/%3E%3Cpath d='M181 215h238v37H181v-37Z' fill='%2394A3B8'/%3E%3Ccircle cx='221' cy='260' r='28' fill='%23475569'/%3E%3Ccircle cx='379' cy='260' r='28' fill='%23475569'/%3E%3Crect x='234' y='139' width='132' height='48' rx='10' fill='%23E2E8F0'/%3E%3Cpath d='M292 150h16v12h12v16h-12v12h-16v-12h-12v-16h12v-12Z' fill='%234F46E5'/%3E%3Ctext x='300' y='323' text-anchor='middle' font-family='Arial' font-size='22' font-weight='700' fill='%2364758B'%3ESin foto%3C/text%3E%3C/svg%3E";

const HOY = new Date().toISOString().slice(0, 10);

const SISTEMAS = [
  { id: "electrico", nombre: "Eléctrico" },
  { id: "suspension", nombre: "Suspensión" },
  { id: "lubricacion", nombre: "Lubricación" },
  { id: "frenos", nombre: "Frenos" },
  { id: "transmision", nombre: "Transmisión" },
  { id: "enfriamiento", nombre: "Enfriamiento" },
  { id: "pintura", nombre: "Pintura" },
] as const;

const TAREAS_PREVENTIVAS: Record<string, Array<{ id: string; texto: string }>> = {
  electrico: [
    { id: "t_elec_1", texto: "Batería: verificar corrosión, sujeción y nivel de fluido en cada vaso" },
    { id: "t_elec_2", texto: "Fusibles: localizar caja, identificar sistemas y reemplazar si están quemados" },
    { id: "t_elec_3", texto: "Alternador: inspeccionar tensión de la correa, ruidos y conectores" },
    { id: "t_elec_4", texto: "Relés o disyuntores: comprobar funcionamiento" },
    { id: "t_elec_5", texto: "Cargas de batería: verificar voltaje de carga y regulación" },
    { id: "t_elec_6", texto: "Corriente alterna/continua: revisar inversor, conexiones y extensiones 110v" },
  ],
  suspension: [
    { id: "t_susp_1", texto: "Verificar estado de amortiguadores, resortes, juntas y guardapolvos" },
    { id: "t_susp_2", texto: "Revisar fugas de aceite en amortiguadores" },
    { id: "t_susp_3", texto: "Revisar engrase del chasis" },
    { id: "t_susp_4", texto: "Verificar desgaste irregular de neumáticos" },
    { id: "t_susp_5", texto: "Revisar reportes de inclinación excesiva al frenar" },
    { id: "t_susp_6", texto: "Revisar reportes de ruidos fuertes al andar" },
    { id: "t_susp_7", texto: "Verificar recuperación de estabilidad después de baches" },
    { id: "t_susp_8", texto: "Realizar cambio de llantas" },
  ],
  lubricacion: [
    { id: "t_lub_1", texto: "Cambiar aceite según recomendaciones del fabricante" },
    { id: "t_lub_2", texto: "Revisar fugas de aceite" },
    { id: "t_lub_3", texto: "Aplicar grasa en cada grasera de suspensión y dirección" },
    { id: "t_lub_4", texto: "Reponer o cambiar líquido de frenos" },
  ],
};

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

function limpiarUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => limpiarUndefined(item)).filter((item) => item !== undefined) as T;
  }
  if (value && typeof value === "object") {
    const limpio: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === undefined) return;
      limpio[key] = limpiarUndefined(item);
    });
    return limpio as T;
  }
  return value;
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

function nombreUsuario(usuario: UsuarioOperativo) {
  return `${texto(usuario.nombres)} ${texto(usuario.apellidos)}`.trim() || texto(usuario.email, "Usuario");
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
    if (value instanceof Timestamp) return value.toDate().toLocaleString("es-CO");
    if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as any).toDate === "function") {
      return (value as any).toDate().toLocaleString("es-CO");
    }
    if (typeof value === "object" && value !== null && "seconds" in value) {
      return new Date(Number((value as any).seconds) * 1000).toLocaleString("es-CO");
    }
    if (typeof value === "object") return "";
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

function inputBase(extra = "") {
  return `w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white ${extra}`;
}

const proveedorInicial: Proveedor = {
  id: "",
  nombreComercial: "",
  razonSocial: "",
  nit: "",
  telefono: "",
  email: "",
  direccion: "",
  tipoPago: "",
  numeroCuenta: "",
  tipoConvenio: "",
  servicios: { preventivo: false, correctivo: false },
};

export default function MantenimientosPage() {
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
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error">("ok");

  const [moviles, setMoviles] = useState<Movil[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOperativo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [movilId, setMovilId] = useState("");
  const [kilometraje, setKilometraje] = useState("");
  const [fecha, setFecha] = useState(HOY);
  const [coordinador, setCoordinador] = useState("");
  const [tipoMantenimiento, setTipoMantenimiento] = useState<TipoMantenimiento>("");
  const [sistema, setSistema] = useState<SistemaMantenimiento>("");
  const [tareasSeleccionadas, setTareasSeleccionadas] = useState<Record<string, string>>({});
  const [fallaReportada, setFallaReportada] = useState("");
  const [frecuenciaKm, setFrecuenciaKm] = useState("");
  const [diasAlerta, setDiasAlerta] = useState("");
  const [asignadoA, setAsignadoA] = useState("");
  const [programarServicioCon, setProgramarServicioCon] = useState("");
  const [novedadesConductor, setNovedadesConductor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mantenimientoEditandoId, setMantenimientoEditandoId] = useState("");

  const [modalProveedores, setModalProveedores] = useState(false);
  const [proveedorEditandoId, setProveedorEditandoId] = useState("");
  const [proveedorForm, setProveedorForm] = useState<Proveedor>(proveedorInicial);
  const [rutFile, setRutFile] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);

  const [modalHistorial, setModalHistorial] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(HOY.slice(0, 8) + "01");
  const [fechaFin, setFechaFin] = useState(HOY);
  const [todoPeriodo, setTodoPeriodo] = useState(false);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [detalleHistorial, setDetalleHistorial] = useState<Mantenimiento | null>(null);
  const [mensajeChat, setMensajeChat] = useState("");
  const [guardandoChat, setGuardandoChat] = useState(false);
  const [subiendoFotoDetalle, setSubiendoFotoDetalle] = useState(false);

  const HISTORIAL_POR_PAGINA = 8;
  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);

  const nombreHeader = useMemo(() => {
    return texto(cliente?.representante, cliente?.Representante, user?.displayName, clienteSesion?.razonSocial, cliente?.razonSocial, cliente?.nombreComercial, "Usuario");
  }, [cliente, clienteSesion, user]);

  const movilesActivas = useMemo(() => moviles.filter(movilActivo), [moviles]);
  const movilSeleccionada = useMemo(() => moviles.find((item) => item.id === movilId) || null, [moviles, movilId]);

  const proveedoresFiltrados = useMemo(() => {
    if (!tipoMantenimiento) return proveedores;
    return proveedores.filter((item) => {
      if (tipoMantenimiento === "preventivo") return item.servicios?.preventivo || !item.servicios;
      if (tipoMantenimiento === "correctivo") return item.servicios?.correctivo || !item.servicios;
      return true;
    });
  }, [proveedores, tipoMantenimiento]);

  const tareasVisibles = useMemo(() => {
    if (tipoMantenimiento !== "preventivo" || !sistema) return [];
    if (sistema === "electrico") return TAREAS_PREVENTIVAS.electrico;
    if (["suspension", "transmision", "enfriamiento", "pintura"].includes(sistema)) return TAREAS_PREVENTIVAS.suspension;
    if (["lubricacion", "frenos"].includes(sistema)) return TAREAS_PREVENTIVAS.lubricacion;
    return [];
  }, [tipoMantenimiento, sistema]);

  const detalleHistorialActual = useMemo(() => {
    if (!detalleHistorial) return null;
    return mantenimientos.find((item) => item.id === detalleHistorial.id) || detalleHistorial;
  }, [detalleHistorial, mantenimientos]);

  const estadoGestionClase = (estado?: string) => {
    const valor = texto(estado, "sin realizar").toLowerCase();
    if (valor.includes("resuelto")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (valor.includes("incompleto")) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-red-50 text-red-700 border-red-100";
  };

  const fotosMantenimiento = (item?: Mantenimiento | null) => [
    ...((item?.fotos || []) as ArchivoGuardado[]),
    ...((item?.fotosOperario || []) as ArchivoGuardado[]),
  ].filter((foto) => foto?.url);

  const descripcionMantenimiento = (item: Mantenimiento) => {
    if (item.tipoMantenimiento === "correctivo") {
      return texto(item.fallaReportada, "Sin falla reportada.");
    }
    const tareas = Object.values(item.tareas || {}).filter(Boolean);
    return tareas.length ? tareas.join("\n") : "Sin tareas programadas.";
  };

  const mantenimientosFiltrados = useMemo(() => {
    const textoBusqueda = busquedaHistorial.trim().toLowerCase();
    return mantenimientos
      .filter((item) => {
        if (todoPeriodo) return true;
        if (fechaInicio && item.fecha < fechaInicio) return false;
        if (fechaFin && item.fecha > fechaFin) return false;
        return true;
      })
      .filter((item) => {
        if (!textoBusqueda) return true;
        return [item.movilNombre, item.placa, item.tipoMantenimiento, item.sistema, item.proveedorNombre, item.asignadoNombre, item.fallaReportada]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);
      })
      .sort((a, b) => `${b.fecha}`.localeCompare(`${a.fecha}`));
  }, [mantenimientos, fechaInicio, fechaFin, todoPeriodo, busquedaHistorial]);

  const totalPaginasHistorial = Math.max(1, Math.ceil(mantenimientosFiltrados.length / HISTORIAL_POR_PAGINA));
  const mantenimientosPaginados = useMemo(() => {
    const inicio = (paginaHistorial - 1) * HISTORIAL_POR_PAGINA;
    return mantenimientosFiltrados.slice(inicio, inicio + HISTORIAL_POR_PAGINA);
  }, [mantenimientosFiltrados, paginaHistorial]);

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
    const unsubMoviles = onSnapshot(collection(db, "clientes", clienteId, "moviles"), (snapshot) => {
      const data: Movil[] = snapshot.docs.map((item) => ({
  id: item.id,
  ...(item.data() as Omit<Movil, "id">),
}));

data.sort((a, b) =>
  texto(a.nombre).localeCompare(texto(b.nombre), "es"),
);

setMoviles(data);
    });

    const unsubUsuarios = onSnapshot(collection(db, "clientes", clienteId, "usuarios"), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<UsuarioOperativo, "id">) }));
      data.sort((a, b) => nombreUsuario(a).localeCompare(nombreUsuario(b), "es"));
      setUsuarios(data);
    });

    const unsubProveedores = onSnapshot(collection(db, "clientes", clienteId, "proveedoresMantenimiento"), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Proveedor, "id">) }));
      data.sort((a, b) => a.nombreComercial.localeCompare(b.nombreComercial, "es"));
      setProveedores(data);
    });

    const unsubMantenimientos = onSnapshot(query(collection(db, "clientes", clienteId, "mantenimientosVehiculares"), orderBy("fecha", "desc")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Mantenimiento, "id">) }));
      setMantenimientos(data);
    });

    return () => {
      unsubMoviles();
      unsubUsuarios();
      unsubProveedores();
      unsubMantenimientos();
    };
  }, [clienteId]);

  useEffect(() => {
    if (!movilSeleccionada) return;
    setKilometraje(texto(movilSeleccionada.kilometrajeActual, movilSeleccionada.kilometrajeInicial, kilometraje));
  }, [movilSeleccionada]);

  useEffect(() => {
    setPaginaHistorial(1);
  }, [busquedaHistorial, fechaInicio, fechaFin, todoPeriodo]);

  useEffect(() => {
    if (paginaHistorial > totalPaginasHistorial) setPaginaHistorial(totalPaginasHistorial);
  }, [paginaHistorial, totalPaginasHistorial]);

  const limpiarFormulario = () => {
    setMovilId("");
    setKilometraje("");
    setFecha(HOY);
    setCoordinador("");
    setTipoMantenimiento("");
    setSistema("");
    setTareasSeleccionadas({});
    setFallaReportada("");
    setFrecuenciaKm("");
    setDiasAlerta("");
    setAsignadoA("");
    setProgramarServicioCon("");
    setNovedadesConductor("");
    setMantenimientoEditandoId("");
  };

  const editarMantenimiento = (mantenimiento: Mantenimiento) => {
    setMantenimientoEditandoId(mantenimiento.id);
    setMovilId(mantenimiento.movilId || "");
    setKilometraje(texto(mantenimiento.kilometraje));
    setFecha(texto(mantenimiento.fecha, HOY));
    setCoordinador(texto(mantenimiento.coordinador));
    setTipoMantenimiento(mantenimiento.tipoMantenimiento || "");
    setSistema(mantenimiento.sistema || "");
    setTareasSeleccionadas(mantenimiento.tareas || {});
    setFallaReportada(texto(mantenimiento.fallaReportada));
    setFrecuenciaKm(texto(mantenimiento.frecuenciaKm));
    setDiasAlerta(texto(mantenimiento.diasAlerta));
    setAsignadoA(texto(mantenimiento.asignadoA));
    setProgramarServicioCon(texto(mantenimiento.programarServicioCon));
    setNovedadesConductor(texto(mantenimiento.novedadesConductor));
    setModalHistorial(false);
    setDetalleHistorial(null);
    mostrarMensaje("Orden cargada para edición.");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
  };

  const eliminarMantenimiento = async (mantenimiento: Mantenimiento) => {
    if (!clienteId) return;
    const confirmar = window.confirm(`¿Eliminar definitivamente el mantenimiento de ${mantenimiento.movilNombre || "la móvil"} del ${mantenimiento.fecha || "sin fecha"}?`);
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "clientes", clienteId, "mantenimientosVehiculares", mantenimiento.id));
      if (detalleHistorial?.id === mantenimiento.id) setDetalleHistorial(null);
      if (mantenimientoEditandoId === mantenimiento.id) limpiarFormulario();
      mostrarMensaje("Mantenimiento eliminado correctamente.");
    } catch (error) {
      console.error("Error eliminando mantenimiento:", error);
      mostrarMensaje("No fue posible eliminar el mantenimiento.", "error");
    }
  };


  const actualizarEstadoGestion = async (mantenimiento: Mantenimiento, estado: "resuelto" | "incompleto" | "sin realizar") => {
    if (!clienteId) return;
    try {
      await setDoc(
        doc(db, "clientes", clienteId, "mantenimientosVehiculares", mantenimiento.id),
        {
          estadoGestion: estado,
          fechaGestion: estado === "sin realizar" ? mantenimiento.fechaGestion || "" : new Date().toISOString().slice(0, 10),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      mostrarMensaje(`Mantenimiento marcado como ${estado}.`);
    } catch (error) {
      console.error("Error actualizando estado:", error);
      mostrarMensaje("No fue posible actualizar el estado.", "error");
    }
  };

  const enviarMensajeChat = async (mantenimiento: Mantenimiento) => {
    if (!clienteId || !mensajeChat.trim() || guardandoChat) return;
    setGuardandoChat(true);
    try {
      const nuevoMensaje: ChatMantenimiento = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        autor: nombreHeader,
        rol: "admin",
        mensaje: mensajeChat.trim(),
        fecha: new Date().toISOString(),
      };
      const chatActual = Array.isArray(mantenimiento.chatMantenimiento) ? mantenimiento.chatMantenimiento : [];
      await setDoc(
        doc(db, "clientes", clienteId, "mantenimientosVehiculares", mantenimiento.id),
        {
          chatMantenimiento: [...chatActual, nuevoMensaje],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMensajeChat("");
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      mostrarMensaje("No fue posible enviar el mensaje.", "error");
    } finally {
      setGuardandoChat(false);
    }
  };

  const subirFotoDetalle = async (mantenimiento: Mantenimiento, file?: File | null) => {
    if (!clienteId || !file || subiendoFotoDetalle) return;
    if (!file.type.startsWith("image/")) {
      mostrarMensaje("Selecciona una imagen válida.", "error");
      return;
    }
    setSubiendoFotoDetalle(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `clientes/${clienteId}/mantenimientosVehiculares/${mantenimiento.id}/fotos/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      const nuevaFoto: ArchivoGuardado = { nombre: file.name, url, path, tipo: file.type };
      const fotosActuales = Array.isArray(mantenimiento.fotos) ? mantenimiento.fotos : [];
      await setDoc(
        doc(db, "clientes", clienteId, "mantenimientosVehiculares", mantenimiento.id),
        {
          fotos: [...fotosActuales, nuevaFoto],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      mostrarMensaje("Foto agregada correctamente.");
    } catch (error) {
      console.error("Error subiendo foto:", error);
      mostrarMensaje("No fue posible subir la foto.", "error");
    } finally {
      setSubiendoFotoDetalle(false);
    }
  };

  const guardarMantenimiento = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clienteId || guardando) return;
    if (!movilSeleccionada || !kilometraje || !fecha || !coordinador.trim() || !tipoMantenimiento || !sistema || !asignadoA) {
      mostrarMensaje("Completa los campos obligatorios del mantenimiento.", "error");
      return;
    }
    if (tipoMantenimiento === "correctivo" && !fallaReportada.trim()) {
      mostrarMensaje("Para mantenimiento correctivo debes describir la falla reportada.", "error");
      return;
    }
    if (tipoMantenimiento === "preventivo" && Object.keys(tareasSeleccionadas).length === 0) {
      mostrarMensaje("Selecciona al menos una tarea preventiva.", "error");
      return;
    }

    setGuardando(true);
    try {
      const conductor = usuarios.find((item) => item.id === asignadoA);
      const proveedor = proveedores.find((item) => item.id === programarServicioCon);
      const payload = {
        movilId: movilSeleccionada.id,
        movilNombre: texto(movilSeleccionada.nombre, "Móvil sin nombre"),
        placa: texto(movilSeleccionada.placa),
        kilometraje: kilometraje.trim(),
        fecha,
        coordinador: coordinador.trim(),
        tipoMantenimiento: tipoMantenimiento as "preventivo" | "correctivo",
        sistema,
        tareas: tareasSeleccionadas,
        fallaReportada: fallaReportada.trim(),
        frecuenciaKm: frecuenciaKm.trim(),
        diasAlerta: diasAlerta.trim(),
        asignadoA,
        asignadoNombre: conductor ? nombreUsuario(conductor) : "",
        programarServicioCon,
        proveedorNombre: proveedor?.nombreComercial || "",
        novedadesConductor: novedadesConductor.trim(),
        estadoGestion: mantenimientoEditandoId
          ? mantenimientos.find((item) => item.id === mantenimientoEditandoId)?.estadoGestion || "programado"
          : "programado",
        createdAt: mantenimientoEditandoId
          ? mantenimientos.find((item) => item.id === mantenimientoEditandoId)?.createdAt || serverTimestamp()
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (mantenimientoEditandoId) {
        await setDoc(
          doc(db, "clientes", clienteId, "mantenimientosVehiculares", mantenimientoEditandoId),
          limpiarUndefined(payload),
          { merge: true },
        );
      } else {
        await addDoc(collection(db, "clientes", clienteId, "mantenimientosVehiculares"), limpiarUndefined(payload));
      }
      await setDoc(doc(db, "clientes", clienteId, "moviles", movilSeleccionada.id), { kilometrajeActual: kilometraje.trim(), ultimoMantenimientoFecha: fecha, updatedAt: serverTimestamp() }, { merge: true });
      limpiarFormulario();
      mostrarMensaje(mantenimientoEditandoId ? "Mantenimiento actualizado correctamente." : "Mantenimiento guardado correctamente.");
    } catch (error) {
      console.error("Error guardando mantenimiento:", error);
      mostrarMensaje("No fue posible guardar el mantenimiento.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const abrirProveedorNuevo = () => {
    setProveedorEditandoId("");
    setProveedorForm(proveedorInicial);
    setRutFile(null);
    setCertFile(null);
    setContratoFile(null);
  };

  const abrirProveedorEditar = (proveedor: Proveedor) => {
    setProveedorEditandoId(proveedor.id);
    setProveedorForm({ ...proveedor });
    setRutFile(null);
    setCertFile(null);
    setContratoFile(null);
  };

  const subirArchivoProveedor = async (proveedorId: string, tipo: string, file: File | null) => {
    if (!file || !clienteId) return "";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `clientes/${clienteId}/proveedoresMantenimiento/${proveedorId}/${tipo}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  };

  const guardarProveedor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clienteId || guardandoProveedor) return;
    if (!proveedorForm.nombreComercial.trim()) {
      mostrarMensaje("El nombre comercial del proveedor es obligatorio.", "error");
      return;
    }

    setGuardandoProveedor(true);
    try {
      const refProveedor = proveedorEditandoId
        ? doc(db, "clientes", clienteId, "proveedoresMantenimiento", proveedorEditandoId)
        : doc(collection(db, "clientes", clienteId, "proveedoresMantenimiento"));
      const proveedorId = refProveedor.id;
      const [rutUrl, certificacionUrl, contratoUrl] = await Promise.all([
        subirArchivoProveedor(proveedorId, "rut", rutFile),
        subirArchivoProveedor(proveedorId, "certificacion", certFile),
        subirArchivoProveedor(proveedorId, "contrato", contratoFile),
      ]);

      await setDoc(
        refProveedor,
        limpiarUndefined({
          nombreComercial: proveedorForm.nombreComercial.trim(),
          razonSocial: proveedorForm.razonSocial.trim(),
          nit: proveedorForm.nit.trim(),
          telefono: proveedorForm.telefono.trim(),
          email: proveedorForm.email.trim(),
          direccion: proveedorForm.direccion.trim(),
          tipoPago: proveedorForm.tipoPago,
          numeroCuenta: proveedorForm.numeroCuenta.trim(),
          tipoConvenio: proveedorForm.tipoConvenio,
          servicios: proveedorForm.servicios,
          rutUrl: rutUrl || proveedorForm.rutUrl || "",
          certificacionUrl: certificacionUrl || proveedorForm.certificacionUrl || "",
          contratoUrl: contratoUrl || proveedorForm.contratoUrl || "",
          updatedAt: serverTimestamp(),
          createdAt: proveedorEditandoId ? proveedorForm.createdAt : serverTimestamp(),
        }),
        { merge: true },
      );
      abrirProveedorNuevo();
      mostrarMensaje("Proveedor guardado correctamente.");
    } catch (error) {
      console.error("Error guardando proveedor:", error);
      mostrarMensaje("No fue posible guardar el proveedor.", "error");
    } finally {
      setGuardandoProveedor(false);
    }
  };

  const eliminarProveedor = async (proveedor: Proveedor) => {
    if (!clienteId) return;
    const confirmar = window.confirm(`¿Eliminar proveedor ${proveedor.nombreComercial}?`);
    if (!confirmar) return;
    try {
      await deleteDoc(doc(db, "clientes", clienteId, "proveedoresMantenimiento", proveedor.id));
      mostrarMensaje("Proveedor eliminado correctamente.");
    } catch (error) {
      console.error("Error eliminando proveedor:", error);
      mostrarMensaje("No fue posible eliminar el proveedor.", "error");
    }
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
          <p className="text-sm font-semibold text-slate-600">Cargando mantenimientos...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5fa] text-slate-700">
      {menuOpen && <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white shadow-[0_0_35px_rgba(15,23,42,0.25)] transition-all duration-300 lg:translate-x-0 ${menuCollapsed ? "lg:w-20" : "lg:w-72"} ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div className={`border-b border-white/10 ${menuCollapsed ? "px-3 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" title="Ir al inicio" className="min-w-0 flex-1">
                <img src={logo} alt="Marthin" className={`h-12 object-contain ${menuCollapsed ? "mx-auto w-12" : "w-36 object-left"}`} />
              </Link>
              <button type="button" onClick={() => setMenuCollapsed((actual) => !actual)} className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-base font-black text-white transition hover:bg-white/20 lg:flex" title={menuCollapsed ? "Expandir menú" : "Encoger menú"} aria-label={menuCollapsed ? "Expandir menú" : "Encoger menú"}>☰</button>
              <button type="button" onClick={() => setMenuOpen(false)} className="ml-auto rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Cerrar">✕</button>
            </div>
            {!menuCollapsed && <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>}
          </div>

          <nav className={`flex-1 overflow-y-auto py-5 ${menuCollapsed ? "px-2" : "px-4"}`}>
            <Link href="/dashboard" title="Inicio" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-bold transition ${menuCollapsed ? "justify-center" : "gap-3"} ${pathname === "/dashboard" ? "bg-white text-indigo-700 shadow-lg shadow-black/20" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "I" : "Inicio"}</Link>

            <div className="mt-4">
              <button type="button" onClick={() => setConfigOpen((actual) => !actual)} className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="1. Configuraciones" aria-expanded={configOpen}><span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>{!menuCollapsed && <span className="text-xs text-white/45">{configOpen ? "▲" : "▼"}</span>}</button>
              {configOpen && <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                <Link href="/configuraciones/empresa" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/empresa" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.1" : "1.1 Empresa"}</Link>
                <Link href="/configuraciones/usuarios" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/usuarios" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.2" : "1.2 Usuarios y Roles"}</Link>
                <Link href="/configuraciones/ubicaciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/ubicaciones" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.3" : "1.3 Móviles y Bodegas"}</Link>
              </div>}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setOperativaOpen((actual) => !actual)} className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="2. Área operativa" aria-expanded={operativaOpen}><span>{menuCollapsed ? "2" : "2. Área operativa"}</span>{!menuCollapsed && <span className="text-xs text-white/45">{operativaOpen ? "▲" : "▼"}</span>}</button>
              {operativaOpen && <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                <Link href="/configuraciones/autoevaluacion" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/autoevaluacion" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.1" : "2.1 Autoevaluación General"}</Link>
                <Link href="/configuraciones/asignaciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/asignaciones" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.2" : "2.2 Asignaciones a Móviles"}</Link>
              </div>}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setMovilesOpen((actual) => !actual)} className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="3. Móviles" aria-expanded={movilesOpen}><span>{menuCollapsed ? "3" : "3. Móviles"}</span>{!menuCollapsed && <span className="text-xs text-white/45">{movilesOpen ? "▲" : "▼"}</span>}</button>
              {movilesOpen && <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                <Link href="/configuraciones/verificaciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/verificaciones" ? "bg-amber-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.1" : "3.1 Verificación diaria"}</Link>
                <Link href="/configuraciones/mantenimientos" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/mantenimientos" ? "bg-amber-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.2" : "3.2 Programación de Mantenimientos"}</Link>
                <Link href="/configuraciones/infracciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/infracciones" ? "bg-amber-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.3" : "3.3 Gestión de Infracciones"}</Link>
              </div>}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setTareasOpen((actual) => !actual)} className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="4. Tareas" aria-expanded={tareasOpen}><span>{menuCollapsed ? "4" : "4. Tareas"}</span>{!menuCollapsed && <span className="text-xs text-white/45">{tareasOpen ? "▲" : "▼"}</span>}</button>
              {tareasOpen && <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1"><Link href="/configuraciones/tareas" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/tareas" ? "bg-emerald-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "4.1" : "4.1 Programar tareas"}</Link></div>}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setSoporteOpen((actual) => !actual)} className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="5. Soporte" aria-expanded={soporteOpen}><span>{menuCollapsed ? "5" : "5. Soporte"}</span>{!menuCollapsed && <span className="text-xs text-white/45">{soporteOpen ? "▲" : "▼"}</span>}</button>
              {soporteOpen && <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1"><Link href="/configuraciones/soporte" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/soporte" ? "bg-sky-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "5.1" : "5.1 Solicitar un soporte"}</Link></div>}
            </div>
          </nav>

          {!menuCollapsed && <div className="border-t border-white/10 p-4 text-[11px] text-white/45"><p>Un producto de Famiasistir</p><p>Desarrollado por Printserp SAS</p></div>}
        </div>
      </aside>

      <section className={menuCollapsed ? "lg:pl-20" : "lg:pl-72"}>
        <header className="sticky top-0 z-20 bg-[#f4f5fa]/90 backdrop-blur px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-4 py-3 shadow-[0_10px_30px_rgba(79,70,229,0.22)] border border-white/40 text-white">
            <button type="button" onClick={() => setMenuOpen(true)} className="rounded-xl p-2 text-white/90 hover:bg-white/15 lg:hidden" aria-label="Abrir menú">☰</button>
            <div className="hidden sm:block"><p className="text-[11px] font-medium text-white/70">Hola,</p><h1 className="text-sm font-bold text-white line-clamp-1">{nombreHeader}</h1></div>
            <div className="ml-auto flex items-center gap-3"><div className="text-right"><p className="text-[11px] font-medium text-white/70">Sesión cliente</p><p className="max-w-[150px] truncate text-xs font-semibold text-white sm:max-w-[240px]">{user?.email || clienteSesion?.email || "cliente"}</p></div><button type="button" onClick={cerrarSesion} className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25">Cerrar sesión</button></div>
          </div>
        </header>

        <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
          {mensaje && <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${tipoMensaje === "ok" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"}`}>{mensaje}</div>}

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">Gestión móviles / 3.2</p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">Gestión de mantenimientos</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Programa mantenimientos preventivos o correctivos, asigna conductor y proveedor, y consulta el historial.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setModalHistorial(true)} className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400">Historial</button>
                <button type="button" onClick={() => { abrirProveedorNuevo(); setModalProveedores(true); }} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500">Gestionar proveedores</button>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <aside className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">Móvil seleccionada</p>
              {movilSeleccionada ? (
                <div className="mt-3 overflow-hidden rounded-3xl border border-slate-100 bg-slate-50">
                  <img src={fotoMovil(movilSeleccionada)} alt={texto(movilSeleccionada.nombre, "Móvil")} className="h-44 w-full object-cover" />
                  <div className="p-4">
                    <h3 className="text-lg font-black text-slate-800">{texto(movilSeleccionada.nombre, "Móvil sin nombre")}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">{texto(movilSeleccionada.denominacion, movilSeleccionada.modelo, "Sin denominación")}</p>
                    <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700">{texto(movilSeleccionada.tipo, "Sin tipo")}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{texto(movilSeleccionada.placa, "Sin placa")}</span></div>
                    <p className="mt-3 text-xs font-black text-slate-500">KM actual: {texto(movilSeleccionada.kilometrajeActual, movilSeleccionada.kilometrajeInicial, "Sin dato")}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Selecciona una móvil para iniciar.</div>
              )}
            </aside>

            <form onSubmit={guardarMantenimiento} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
              {mantenimientoEditandoId && (
                <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
                  Editando orden de mantenimiento. Puedes modificar los datos y guardar los cambios.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-4">
                <Campo label="Móvil"><select value={movilId} onChange={(event) => setMovilId(event.target.value)} className={inputBase()} required><option value="">Seleccione móvil</option>{movilesActivas.map((movil) => <option key={movil.id} value={movil.id}>{texto(movil.nombre, "Móvil")} · {texto(movil.placa)}</option>)}</select></Campo>
                <Campo label="Kilometraje"><input type="number" value={kilometraje} onChange={(event) => setKilometraje(event.target.value)} className={inputBase()} placeholder="Ingrese kilometraje" required /></Campo>
                <Campo label="Fecha"><input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className={inputBase()} required /></Campo>
                <Campo label="Coordinador"><input value={coordinador} onChange={(event) => setCoordinador(event.target.value)} className={inputBase()} placeholder="Nombre del coordinador" required /></Campo>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Campo label="Tipo de mantenimiento"><select value={tipoMantenimiento} onChange={(event) => { setTipoMantenimiento(event.target.value as TipoMantenimiento); setTareasSeleccionadas({}); setFallaReportada(""); setProgramarServicioCon(""); }} className={inputBase()} required><option value="">Seleccione</option><option value="correctivo">Correctivo</option><option value="preventivo">Preventivo</option></select></Campo>
                <Campo label="Sistema afectado"><select value={sistema} onChange={(event) => { setSistema(event.target.value as SistemaMantenimiento); setTareasSeleccionadas({}); }} className={inputBase()} required><option value="">Seleccione</option>{SISTEMAS.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></Campo>
              </div>

              {tipoMantenimiento === "preventivo" && (
                <section className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <p className="text-sm font-black text-slate-800">Tareas a realizar</p>
                  {tareasVisibles.length === 0 ? <p className="mt-2 text-xs font-bold text-slate-500">Selecciona un sistema afectado para ver las tareas.</p> : <div className="mt-3 grid gap-2 md:grid-cols-2">{tareasVisibles.map((tarea) => <label key={tarea.id} className="flex gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm"><input type="checkbox" checked={Boolean(tareasSeleccionadas[tarea.id])} onChange={(event) => setTareasSeleccionadas((actual) => { const nuevo = { ...actual }; if (event.target.checked) nuevo[tarea.id] = tarea.texto; else delete nuevo[tarea.id]; return nuevo; })} className="mt-0.5" /> <span>{tarea.texto}</span></label>)}</div>}
                </section>
              )}

              {tipoMantenimiento === "correctivo" && (
                <div className="mt-5"><Campo label="Falla reportada"><textarea value={fallaReportada} onChange={(event) => setFallaReportada(event.target.value)} rows={4} className={inputBase()} placeholder="Describe la falla detalladamente" required /></Campo></div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <Campo label="Frecuencia KM"><input type="number" value={frecuenciaKm} onChange={(event) => setFrecuenciaKm(event.target.value)} className={inputBase()} placeholder="Ej: 5000" /></Campo>
                <Campo label="Días alerta"><input type="number" value={diasAlerta} onChange={(event) => setDiasAlerta(event.target.value)} className={inputBase()} placeholder="Ej: 90" /></Campo>
                <div className="md:col-span-2"><Campo label="Asignado a conductor"><select value={asignadoA} onChange={(event) => setAsignadoA(event.target.value)} className={inputBase()} required><option value="">Seleccione conductor</option>{usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{nombreUsuario(usuario)} · {texto(usuario.tipoFuncionario, "Sin tipo")}</option>)}</select></Campo></div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Campo label="Programar servicio con proveedor"><select value={programarServicioCon} onChange={(event) => setProgramarServicioCon(event.target.value)} className={inputBase()}><option value="">Ninguno</option>{proveedoresFiltrados.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.nombreComercial}</option>)}</select></Campo>
                <Campo label="Novedades adicionales"><input value={novedadesConductor} onChange={(event) => setNovedadesConductor(event.target.value)} className={inputBase()} placeholder="Opcional" /></Campo>
              </div>

              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={limpiarFormulario} className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-300">{mantenimientoEditandoId ? "Cancelar edición" : "Limpiar"}</button><button type="submit" disabled={guardando} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-60">{guardando ? "Guardando..." : mantenimientoEditandoId ? "Actualizar mantenimiento" : "Guardar mantenimiento"}</button></div>
            </form>
          </section>
        </div>
      </section>

      {modalProveedores && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-emerald-600 px-5 py-4 text-white">
              <div><p className="text-[11px] font-black uppercase tracking-widest text-white/75">Proveedores</p><h3 className="text-lg font-black">Gestión de proveedores</h3></div>
              <button type="button" onClick={() => setModalProveedores(false)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white hover:bg-white/30">Cerrar</button>
            </div>
            <div className="grid max-h-[calc(94vh-82px)] gap-5 overflow-y-auto p-5 xl:grid-cols-[1fr_1.1fr]">
              <form onSubmit={guardarProveedor} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <h4 className="text-base font-black text-slate-800">{proveedorEditandoId ? "Editando proveedor" : "Nuevo proveedor"}</h4>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Campo label="Nombre comercial"><input value={proveedorForm.nombreComercial} onChange={(event) => setProveedorForm((a) => ({ ...a, nombreComercial: event.target.value }))} className={inputBase("bg-white")} required /></Campo>
                  <Campo label="Razón social"><input value={proveedorForm.razonSocial} onChange={(event) => setProveedorForm((a) => ({ ...a, razonSocial: event.target.value }))} className={inputBase("bg-white")} /></Campo>
                  <Campo label="NIT"><input value={proveedorForm.nit} onChange={(event) => setProveedorForm((a) => ({ ...a, nit: event.target.value }))} className={inputBase("bg-white")} /></Campo>
                  <Campo label="Teléfono"><input value={proveedorForm.telefono} onChange={(event) => setProveedorForm((a) => ({ ...a, telefono: event.target.value }))} className={inputBase("bg-white")} /></Campo>
                  <Campo label="Email"><input type="email" value={proveedorForm.email} onChange={(event) => setProveedorForm((a) => ({ ...a, email: event.target.value }))} className={inputBase("bg-white")} /></Campo>
                  <Campo label="Dirección"><input value={proveedorForm.direccion} onChange={(event) => setProveedorForm((a) => ({ ...a, direccion: event.target.value }))} className={inputBase("bg-white")} /></Campo>
                  <Campo label="Pago electrónico"><select value={proveedorForm.tipoPago} onChange={(event) => setProveedorForm((a) => ({ ...a, tipoPago: event.target.value, numeroCuenta: event.target.value === "Efectivo" ? "" : a.numeroCuenta }))} className={inputBase("bg-white")}><option value="">Seleccione</option><option value="Daviplata">Daviplata</option><option value="Nequi">Nequi</option><option value="Tranfiya">Tranfiya</option><option value="Cuenta Bancaria">Cuenta Bancaria</option><option value="Efectivo">Efectivo</option></select></Campo>
                  <Campo label="Número cuenta / teléfono"><input disabled={!proveedorForm.tipoPago || proveedorForm.tipoPago === "Efectivo"} value={proveedorForm.numeroCuenta} onChange={(event) => setProveedorForm((a) => ({ ...a, numeroCuenta: event.target.value }))} className={inputBase("bg-white disabled:bg-slate-100 disabled:text-slate-300")} /></Campo>
                  <Campo label="Vínculo"><select value={proveedorForm.tipoConvenio} onChange={(event) => setProveedorForm((a) => ({ ...a, tipoConvenio: event.target.value }))} className={inputBase("bg-white")}><option value="">Seleccione</option><option value="Convenio">Convenio</option><option value="Evento">Evento</option></select></Campo>
                  <div className="rounded-2xl bg-white p-3"><p className="text-[11px] font-black uppercase text-slate-500">Servicios</p><div className="mt-2 flex gap-3 text-xs font-bold text-slate-600"><label><input type="checkbox" checked={proveedorForm.servicios.preventivo} onChange={(e) => setProveedorForm((a) => ({ ...a, servicios: { ...a.servicios, preventivo: e.target.checked } }))} /> Preventivo</label><label><input type="checkbox" checked={proveedorForm.servicios.correctivo} onChange={(e) => setProveedorForm((a) => ({ ...a, servicios: { ...a.servicios, correctivo: e.target.checked } }))} /> Correctivo</label></div></div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Campo label="RUT PDF"><input type="file" accept=".pdf" onChange={(e) => setRutFile(e.target.files?.[0] || null)} className="text-xs font-bold" />{proveedorForm.rutUrl && <a href={proveedorForm.rutUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-black text-indigo-600">Ver RUT actual</a>}</Campo>
                  <Campo label="Certificación bancaria"><input type="file" accept=".pdf" onChange={(e) => setCertFile(e.target.files?.[0] || null)} className="text-xs font-bold" />{proveedorForm.certificacionUrl && <a href={proveedorForm.certificacionUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-black text-indigo-600">Ver certificación</a>}</Campo>
                  <Campo label="Contrato"><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setContratoFile(e.target.files?.[0] || null)} className="text-xs font-bold" />{proveedorForm.contratoUrl && <a href={proveedorForm.contratoUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-black text-indigo-600">Ver contrato</a>}</Campo>
                </div>
                <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={abrirProveedorNuevo} className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-black text-slate-600">Cancelar</button><button type="submit" disabled={guardandoProveedor} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{guardandoProveedor ? "Guardando..." : "Guardar proveedor"}</button></div>
              </form>

              <section className="rounded-3xl border border-slate-100 bg-white p-4">
                <h4 className="text-base font-black text-slate-800">Lista de proveedores</h4>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-3">Proveedor</th><th className="px-3 py-3">NIT</th><th className="px-3 py-3">Servicios</th><th className="px-3 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{proveedores.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-xs font-bold text-slate-400">Sin proveedores registrados.</td></tr> : proveedores.map((proveedor) => <tr key={proveedor.id}><td className="px-3 py-3"><p className="font-black text-slate-700">{proveedor.nombreComercial}</p><p className="text-xs font-bold text-slate-400">{proveedor.telefono || proveedor.email || "Sin contacto"}</p></td><td className="px-3 py-3 text-xs font-bold text-slate-500">{proveedor.nit || "N/A"}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{proveedor.servicios?.preventivo && <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">Preventivo</span>}{proveedor.servicios?.correctivo && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">Correctivo</span>}</div></td><td className="px-3 py-3 text-right"><button type="button" onClick={() => abrirProveedorEditar(proveedor)} className="mr-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">Editar</button><button type="button" onClick={() => eliminarProveedor(proveedor)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Eliminar</button></td></tr>)}</tbody></table>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {modalHistorial && (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-sky-500 px-5 py-4 text-white"><div><p className="text-[11px] font-black uppercase tracking-widest text-white/75">Historial</p><h3 className="text-lg font-black">Mantenimientos vehiculares</h3></div><button type="button" onClick={() => setModalHistorial(false)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white hover:bg-white/30">Cerrar</button></div>
            <div className="max-h-[calc(94vh-82px)] overflow-y-auto p-5">
              <div className="grid gap-3 lg:grid-cols-[180px_180px_170px_1fr] lg:items-end"><Campo label="Fecha inicio"><input disabled={todoPeriodo} type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputBase("disabled:bg-slate-100")} /></Campo><Campo label="Fecha fin"><input disabled={todoPeriodo} type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={inputBase("disabled:bg-slate-100")} /></Campo><label className="flex h-[46px] items-center gap-2 rounded-2xl bg-slate-50 px-3 text-sm font-bold text-slate-600"><input type="checkbox" checked={todoPeriodo} onChange={(e) => setTodoPeriodo(e.target.checked)} /> Todo periodo</label><Campo label="Buscar"><input value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} placeholder="Móvil, proveedor, conductor..." className={inputBase()} /></Campo></div>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Móvil</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Sistema</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Fotos</th><th className="px-3 py-3">Detalles</th><th className="px-3 py-3">Proveedor</th><th className="px-3 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{mantenimientosPaginados.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-xs font-bold text-slate-400">Sin mantenimientos para el filtro seleccionado.</td></tr> : mantenimientosPaginados.map((item) => <tr key={item.id}><td className="px-3 py-3 text-xs font-bold text-slate-500">{item.fecha}</td><td className="px-3 py-3"><p className="font-black text-slate-700">{item.movilNombre}</p><p className="text-xs font-bold text-slate-400">{item.placa || item.movilId}</p></td><td className="px-3 py-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${item.tipoMantenimiento === "preventivo" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"}`}>{item.tipoMantenimiento}</span></td><td className="px-3 py-3 text-xs font-bold text-slate-500">{SISTEMAS.find((s) => s.id === item.sistema)?.nombre || item.sistema}</td><td className="px-3 py-3"><span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoGestionClase(item.estadoGestion)}`}>{texto(item.estadoGestion, "sin realizar")}</span></td><td className="px-3 py-3"><span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black text-sky-700">{fotosMantenimiento(item).length}</span></td><td className="px-3 py-3 max-w-xs"><p className="line-clamp-2 text-xs font-semibold text-slate-500">{descripcionMantenimiento(item)}</p></td><td className="px-3 py-3 text-xs font-bold text-slate-500">{item.proveedorNombre || "N/A"}</td><td className="px-3 py-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setDetalleHistorial(item); setMensajeChat(""); }} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Ver</button><button type="button" onClick={() => editarMantenimiento(item)} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">Editar</button><button type="button" onClick={() => eliminarMantenimiento(item)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Eliminar</button></div></td></tr>)}</tbody></table></div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-400"><span>Mostrando {mantenimientosPaginados.length} de {mantenimientosFiltrados.length}</span><div className="flex gap-2"><button type="button" disabled={paginaHistorial <= 1} onClick={() => setPaginaHistorial((p) => Math.max(1, p - 1))} className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50">Anterior</button><span className="px-2 py-2">{paginaHistorial}/{totalPaginasHistorial}</span><button type="button" disabled={paginaHistorial >= totalPaginasHistorial} onClick={() => setPaginaHistorial((p) => Math.min(totalPaginasHistorial, p + 1))} className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50">Siguiente</button></div></div>
            </div>
          </div>
        </div>
      )}

      {detalleHistorialActual && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/75">Detalle de mantenimiento</p>
                <h3 className="text-lg font-black">{detalleHistorialActual.movilNombre}</h3>
                <p className="text-xs font-bold text-white/70">{detalleHistorialActual.placa || detalleHistorialActual.movilId}</p>
              </div>
              <button type="button" onClick={() => setDetalleHistorial(null)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white">Cerrar</button>
            </div>

            <div className="max-h-[calc(94vh-82px)] overflow-y-auto p-5 text-sm font-semibold text-slate-600">
              <div className="grid gap-3 md:grid-cols-2">
                <p><b>Fecha solicitud:</b> {detalleHistorialActual.fecha}</p>
                <p><b>Fecha gestión:</b> {detalleHistorialActual.fechaGestion || "N/A"}</p>
                <p><b>Tipo:</b> {detalleHistorialActual.tipoMantenimiento}</p>
                <p><b>Sistema:</b> {SISTEMAS.find((s) => s.id === detalleHistorialActual.sistema)?.nombre || detalleHistorialActual.sistema}</p>
                <p><b>Proveedor:</b> {detalleHistorialActual.proveedorNombre || "N/A"}</p>
                <p><b>Asignado a:</b> {detalleHistorialActual.asignadoNombre || "N/A"}</p>
                <p><b>N° factura:</b> {detalleHistorialActual.numeroFactura || "N/A"}</p>
                <p><b>Guardado:</b> {formatDateTime(detalleHistorialActual.createdAt) || "N/A"}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-black text-slate-800">Estado de gestión</p>
                  <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoGestionClase(detalleHistorialActual.estadoGestion)}`}>
                    {texto(detalleHistorialActual.estadoGestion, "sin realizar")}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => actualizarEstadoGestion(detalleHistorialActual, "resuelto")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500">Resuelto</button>
                  <button type="button" onClick={() => actualizarEstadoGestion(detalleHistorialActual, "incompleto")} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-400">Incompleto</button>
                  <button type="button" onClick={() => actualizarEstadoGestion(detalleHistorialActual, "sin realizar")} className="rounded-xl bg-red-500 px-4 py-2 text-xs font-black text-white hover:bg-red-400">Sin realizar</button>
                  <button type="button" onClick={() => editarMantenimiento(detalleHistorialActual)} className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-black text-white hover:bg-sky-400">Editar</button>
                  <button type="button" onClick={() => eliminarMantenimiento(detalleHistorialActual)} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700">Eliminar</button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="font-black text-slate-800">Detalles</p>
                <p className="mt-2 whitespace-pre-wrap text-slate-600">{descripcionMantenimiento(detalleHistorialActual)}</p>
                {detalleHistorialActual.tareaRealizada && <p className="mt-3"><b>Tarea realizada:</b> {detalleHistorialActual.tareaRealizada}</p>}
                {detalleHistorialActual.observacionesAdmin && <p className="mt-3"><b>Observaciones admin:</b> {detalleHistorialActual.observacionesAdmin}</p>}
                {detalleHistorialActual.comprobanteUrl && <a href={detalleHistorialActual.comprobanteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Ver comprobante</a>}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-800">Fotos del mantenimiento</p>
                    <label className="cursor-pointer rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700 hover:bg-sky-100">
                      {subiendoFotoDetalle ? "Subiendo..." : "Agregar foto"}
                      <input type="file" accept="image/*" className="hidden" disabled={subiendoFotoDetalle} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; subirFotoDetalle(detalleHistorialActual, file); }} />
                    </label>
                  </div>
                  {fotosMantenimiento(detalleHistorialActual).length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs font-bold text-slate-400">Sin fotos cargadas.</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {fotosMantenimiento(detalleHistorialActual).map((foto, index) => (
                        <a key={`${foto.url}-${index}`} href={foto.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                          <img src={foto.url} alt={foto.nombre || `Foto ${index + 1}`} className="h-28 w-full object-cover transition group-hover:scale-105" />
                          <p className="truncate px-2 py-1 text-[10px] font-bold text-slate-500">{foto.nombre || `Foto ${index + 1}`}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="font-black text-slate-800">Comunicación admin / operario</p>
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
                    {(detalleHistorialActual.chatMantenimiento || []).length === 0 ? (
                      <p className="py-6 text-center text-xs font-bold text-slate-400">Sin mensajes todavía.</p>
                    ) : (
                      (detalleHistorialActual.chatMantenimiento || []).map((chat, index) => (
                        <div key={chat.id || index} className={`rounded-2xl px-3 py-2 ${chat.rol === "admin" ? "bg-indigo-50 text-indigo-800" : "bg-white text-slate-700"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black">{chat.autor || (chat.rol === "admin" ? "Admin" : "Operario")}</p>
                            <p className="text-[10px] font-bold opacity-60">{formatDateTime(chat.fecha)}</p>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-5">{chat.mensaje}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input value={mensajeChat} onChange={(event) => setMensajeChat(event.target.value)} placeholder="Escribir mensaje..." className={inputBase()} />
                    <button type="button" disabled={guardandoChat || !mensajeChat.trim()} onClick={() => enviarMensajeChat(detalleHistorialActual)} className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Enviar</button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
