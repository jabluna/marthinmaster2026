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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
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

type PrioridadTarea = "inmediato" | "alta" | "media" | "baja";
type EstadoTarea = "pendiente" | "realizado" | "no realizado" | "incompleto";

type ChatTarea = {
  id: string;
  autor: string;
  autorId?: string;
  rol: "admin" | "operario" | "sistema";
  mensaje: string;
  fecha?: unknown;
};

type TareaPersonal = {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  tipoFuncionario: string;
  rol: string;
  descripcion: string;
  prioridad: PrioridadTarea;
  fechaCreacion: string;
  fechaMaxima: string;
  estadoFinal: EstadoTarea;
  observaciones: string;
  creadoPorId?: string;
  creadoPorNombre?: string;
  chatTarea?: ChatTarea[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DEFAULT_LOGO = "/logo.png";
const HOY = new Date().toISOString().slice(0, 10);
const TAREAS_POR_PAGINA = 8;

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

function nombreUsuario(usuario: UsuarioOperativo) {
  return `${texto(usuario.nombres)} ${texto(usuario.apellidos)}`.trim() || texto(usuario.email, "Usuario");
}

function usuarioActivo(usuario: UsuarioOperativo) {
  const estado = texto(usuario.estado, "ACTIVO")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return estado === "activo" || estado === "active";
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

function diasRestantes(fecha: string) {
  if (!fecha) return null;
  const hoy = new Date();
  const fin = new Date(`${fecha}T00:00:00`);
  hoy.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);
  return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
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

export default function ProgramacionTareasPage() {
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
  const [movilesOpen, setMovilesOpen] = useState(false);
  const [tareasOpen, setTareasOpen] = useState(true);
  const [soporteOpen, setSoporteOpen] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error">("ok");

  const [usuarios, setUsuarios] = useState<UsuarioOperativo[]>([]);
  const [tareas, setTareas] = useState<TareaPersonal[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadTarea>("media");
  const [fechaMaxima, setFechaMaxima] = useState(HOY);
  const [estadoFinal, setEstadoFinal] = useState<EstadoTarea>("pendiente");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [tareaEditandoId, setTareaEditandoId] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoTarea>("todos");
  const [filtroPrioridad, setFiltroPrioridad] = useState<"todos" | PrioridadTarea>("todos");
  const [pagina, setPagina] = useState(1);
  const [detalleTarea, setDetalleTarea] = useState<TareaPersonal | null>(null);
  const [mensajeChat, setMensajeChat] = useState("");
  const [guardandoChat, setGuardandoChat] = useState(false);

  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);

  const nombreHeader = useMemo(() => {
    return texto(cliente?.representante, cliente?.Representante, user?.displayName, clienteSesion?.razonSocial, cliente?.razonSocial, cliente?.nombreComercial, "Usuario");
  }, [cliente, clienteSesion, user]);

  const usuariosActivos = useMemo(() => usuarios.filter(usuarioActivo), [usuarios]);
  const usuarioSeleccionado = useMemo(() => usuarios.find((item) => item.id === usuarioId) || null, [usuarios, usuarioId]);

  const resumen = useMemo(() => {
    const pendientes = tareas.filter((item) => item.estadoFinal === "pendiente").length;
    const realizadas = tareas.filter((item) => item.estadoFinal === "realizado").length;
    const incompletas = tareas.filter((item) => item.estadoFinal === "incompleto").length;
    const noRealizadas = tareas.filter((item) => item.estadoFinal === "no realizado").length;
    return { pendientes, realizadas, incompletas, noRealizadas, total: tareas.length };
  }, [tareas]);

  const tareasFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    return tareas
      .filter((item) => (filtroEstado === "todos" ? true : item.estadoFinal === filtroEstado))
      .filter((item) => (filtroPrioridad === "todos" ? true : item.prioridad === filtroPrioridad))
      .filter((item) => {
        if (!textoBusqueda) return true;
        return [item.usuarioNombre, item.usuarioEmail, item.tipoFuncionario, item.rol, item.descripcion, item.prioridad, item.estadoFinal, item.observaciones]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);
      })
      .sort((a, b) => {
        const ordenPrioridad: Record<PrioridadTarea, number> = { inmediato: 0, alta: 1, media: 2, baja: 3 };
        const ordenEstado = (estado: EstadoTarea) => (estado === "pendiente" ? 0 : estado === "incompleto" ? 1 : estado === "no realizado" ? 2 : 3);
        return ordenEstado(a.estadoFinal) - ordenEstado(b.estadoFinal) || ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad] || a.fechaMaxima.localeCompare(b.fechaMaxima);
      });
  }, [tareas, busqueda, filtroEstado, filtroPrioridad]);

  const totalPaginas = Math.max(1, Math.ceil(tareasFiltradas.length / TAREAS_POR_PAGINA));
  const tareasPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * TAREAS_POR_PAGINA;
    return tareasFiltradas.slice(inicio, inicio + TAREAS_POR_PAGINA);
  }, [tareasFiltradas, pagina]);

  const detalleTareaActual = useMemo(() => {
    if (!detalleTarea) return null;
    return tareas.find((item) => item.id === detalleTarea.id) || detalleTarea;
  }, [detalleTarea, tareas]);

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

    const unsubUsuarios = onSnapshot(collection(db, "clientes", clienteId, "usuarios"), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<UsuarioOperativo, "id">) }));
      data.sort((a, b) => nombreUsuario(a).localeCompare(nombreUsuario(b), "es"));
      setUsuarios(data);
    });

    const unsubTareas = onSnapshot(query(collection(db, "clientes", clienteId, "programacionTareas"), orderBy("fechaMaxima", "asc")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<TareaPersonal, "id">) }));
      setTareas(data);
    });

    return () => {
      unsubUsuarios();
      unsubTareas();
    };
  }, [clienteId]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado, filtroPrioridad]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const limpiarFormulario = () => {
    setUsuarioId("");
    setDescripcion("");
    setPrioridad("media");
    setFechaMaxima(HOY);
    setEstadoFinal("pendiente");
    setObservaciones("");
    setTareaEditandoId("");
  };

  const guardarTarea = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clienteId || guardando) return;
    if (!usuarioSeleccionado || !descripcion.trim() || !fechaMaxima) {
      mostrarMensaje("Selecciona un usuario, describe la tarea y define fecha máxima.", "error");
      return;
    }

    setGuardando(true);
    try {
      const refTarea = tareaEditandoId
        ? doc(db, "clientes", clienteId, "programacionTareas", tareaEditandoId)
        : doc(collection(db, "clientes", clienteId, "programacionTareas"));

      await setDoc(
        refTarea,
        limpiarUndefined({
          usuarioId: usuarioSeleccionado.id,
          usuarioNombre: nombreUsuario(usuarioSeleccionado),
          usuarioEmail: texto(usuarioSeleccionado.email),
          tipoFuncionario: texto(usuarioSeleccionado.tipoFuncionario, "Sin tipo"),
          rol: texto(usuarioSeleccionado.rol, "Sin rol"),
          descripcion: descripcion.trim(),
          prioridad,
          fechaCreacion: tareaEditandoId ? undefined : HOY,
          fechaMaxima,
          estadoFinal,
          observaciones: observaciones.trim(),
          creadoPorId: user?.uid || "",
          creadoPorNombre: nombreHeader,
          updatedAt: serverTimestamp(),
          createdAt: tareaEditandoId ? undefined : serverTimestamp(),
        }),
        { merge: true },
      );

      limpiarFormulario();
      mostrarMensaje(tareaEditandoId ? "Tarea actualizada correctamente." : "Tarea programada correctamente.");
    } catch (error) {
      console.error("Error guardando tarea:", error);
      mostrarMensaje("No fue posible guardar la tarea.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const editarTarea = (tarea: TareaPersonal) => {
    setTareaEditandoId(tarea.id);
    setUsuarioId(tarea.usuarioId);
    setDescripcion(tarea.descripcion || "");
    setPrioridad(tarea.prioridad || "media");
    setFechaMaxima(tarea.fechaMaxima || HOY);
    setEstadoFinal(tarea.estadoFinal || "pendiente");
    setObservaciones(tarea.observaciones || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminarTarea = async (tarea: TareaPersonal) => {
    if (!clienteId) return;
    const confirmar = window.confirm(`¿Eliminar la tarea asignada a ${tarea.usuarioNombre}?`);
    if (!confirmar) return;
    try {
      await deleteDoc(doc(db, "clientes", clienteId, "programacionTareas", tarea.id));
      if (detalleTarea?.id === tarea.id) setDetalleTarea(null);
      mostrarMensaje("Tarea eliminada correctamente.");
    } catch (error) {
      console.error("Error eliminando tarea:", error);
      mostrarMensaje("No fue posible eliminar la tarea.", "error");
    }
  };

  const cambiarEstadoTarea = async (tarea: TareaPersonal, estado: EstadoTarea) => {
    if (!clienteId) return;
    try {
      await setDoc(
        doc(db, "clientes", clienteId, "programacionTareas", tarea.id),
        { estadoFinal: estado, fechaEstado: new Date().toISOString(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      mostrarMensaje(`Tarea marcada como ${estado}.`);
    } catch (error) {
      console.error("Error actualizando estado:", error);
      mostrarMensaje("No fue posible actualizar el estado.", "error");
    }
  };

  const enviarMensajeChat = async (tarea: TareaPersonal) => {
    if (!clienteId || !mensajeChat.trim() || guardandoChat) return;
    setGuardandoChat(true);
    try {
      const nuevoMensaje: ChatTarea = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        autor: nombreHeader,
        autorId: user?.uid || "",
        rol: "admin",
        mensaje: mensajeChat.trim(),
        fecha: new Date().toISOString(),
      };
      const chatActual = Array.isArray(tarea.chatTarea) ? tarea.chatTarea : [];
      await setDoc(
        doc(db, "clientes", clienteId, "programacionTareas", tarea.id),
        { chatTarea: [...chatActual, nuevoMensaje], updatedAt: serverTimestamp() },
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

  const cerrarSesion = async () => {
    await signOut(auth);
    window.localStorage.removeItem("clienteSesion");
    router.replace("/login_users");
  };

  const prioridadClase = (value: PrioridadTarea) => {
    if (value === "inmediato") return "bg-red-50 text-red-700 border-red-100";
    if (value === "alta") return "bg-orange-50 text-orange-700 border-orange-100";
    if (value === "media") return "bg-sky-50 text-sky-700 border-sky-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  };

  const estadoClase = (value: EstadoTarea) => {
    if (value === "realizado") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (value === "incompleto") return "bg-amber-50 text-amber-700 border-amber-100";
    if (value === "no realizado") return "bg-red-50 text-red-700 border-red-100";
    return "bg-indigo-50 text-indigo-700 border-indigo-100";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f5fa] flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-xl border border-slate-100 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-semibold text-slate-600">Cargando programación de tareas...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5fa] text-slate-700">
      {menuOpen && <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-slate-950 shadow-2xl transition-all duration-300 lg:translate-x-0 ${menuCollapsed ? "lg:w-20" : "lg:w-72"} ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col">
          <div className={`border-b border-white/10 ${menuCollapsed ? "px-3 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="min-w-0 flex-1" title="Inicio">
                <img src={logo} alt="Marthin" className={`h-12 object-contain ${menuCollapsed ? "mx-auto w-12" : "w-36 object-left"}`} />
              </Link>
              <button type="button" onClick={() => setMenuCollapsed((actual) => !actual)} className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-base font-black text-white transition hover:bg-white/20 lg:flex" title={menuCollapsed ? "Expandir menú" : "Encoger menú"} aria-label={menuCollapsed ? "Expandir menú" : "Encoger menú"}>☰</button>
              <button type="button" onClick={() => setMenuOpen(false)} className="ml-auto rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Cerrar">✕</button>
            </div>
            {!menuCollapsed && <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>}
          </div>

          <nav className={`flex-1 overflow-y-auto py-5 ${menuCollapsed ? "px-2" : "px-4"}`}>
            <Link href="/dashboard" title="Inicio" className={`flex items-center rounded-xl px-4 py-3 text-sm font-bold transition ${menuCollapsed ? "justify-center" : "gap-3"} ${pathname === "/dashboard" ? "bg-white text-slate-950 shadow-lg shadow-white/10" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "I" : "Inicio"}</Link>

            <div className="mt-6">
              <button type="button" onClick={() => setConfigOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="1. Configuraciones" aria-expanded={configOpen}>
                <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{configOpen ? "▲" : "▼"}</span>}
              </button>
              {configOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/empresa" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/empresa" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.1" : "1.1 Empresa"}</Link>
                  <Link href="/configuraciones/usuarios" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/usuarios" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.2" : "1.2 Usuarios y Roles"}</Link>
                  <Link href="/configuraciones/ubicaciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/ubicaciones" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.3" : "1.3 Móviles y Bodegas"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setOperativaOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="2. Área Operativa" aria-expanded={operativaOpen}>
                <span>{menuCollapsed ? "2" : "2. Área Operativa"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{operativaOpen ? "▲" : "▼"}</span>}
              </button>
              {operativaOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/autoevaluacion" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/autoevaluacion" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.1" : "2.1 Autoevaluación General"}</Link>
                  <Link href="/configuraciones/asignaciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/asignaciones" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.2" : "2.2 Asignaciones a Móviles"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setMovilesOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="3. Móviles" aria-expanded={movilesOpen}>
                <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{movilesOpen ? "▲" : "▼"}</span>}
              </button>
              {movilesOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/verificaciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/verificaciones" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.1" : "3.1 Verificación diaria"}</Link>
                  <Link href="/configuraciones/mantenimientos" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/mantenimientos" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.2" : "3.2 Programación de Mantenimientos"}</Link>
                  <Link href="/configuraciones/infracciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/infracciones" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.3" : "3.3 Gestión de Infracciones"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setTareasOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="4. Tareas" aria-expanded={tareasOpen}>
                <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{tareasOpen ? "▲" : "▼"}</span>}
              </button>
              {tareasOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/tareas" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${(pathname === "/configuraciones/tareas" || pathname === "/configuraciones/programacionTareas") ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "4.1" : "4.1 Programación de tareas"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button type="button" onClick={() => setSoporteOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="5. Soporte" aria-expanded={soporteOpen}>
                <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{soporteOpen ? "▲" : "▼"}</span>}
              </button>
              {soporteOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/soporte" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/soporte" ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "5.1" : "5.1 Solicitar soporte"}</Link>
                </div>
              )}
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
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">Tareas / 4.1</p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">Programación de tareas</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Crea tareas para el personal, define prioridad, fecha máxima, estado final y seguimiento.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-center"><p className="text-lg font-black text-indigo-700">{resumen.pendientes}</p><p className="text-[10px] font-black uppercase text-indigo-500">Pendientes</p></div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center"><p className="text-lg font-black text-emerald-700">{resumen.realizadas}</p><p className="text-[10px] font-black uppercase text-emerald-500">Realizadas</p></div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center"><p className="text-lg font-black text-amber-700">{resumen.incompletas}</p><p className="text-[10px] font-black uppercase text-amber-500">Incompletas</p></div>
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-center"><p className="text-lg font-black text-red-700">{resumen.noRealizadas}</p><p className="text-[10px] font-black uppercase text-red-500">No realizadas</p></div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <form onSubmit={guardarTarea} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">{tareaEditandoId ? "Editar tarea" : "Nueva tarea"}</p><h3 className="mt-1 text-xl font-black text-slate-800">Asignar al personal</h3></div>
                {tareaEditandoId && <button type="button" onClick={limpiarFormulario} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">Cancelar</button>}
              </div>

              <div className="mt-5 space-y-4">
                <Campo label="Usuario asignado"><select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className={inputBase()} required><option value="">Seleccione usuario</option>{usuariosActivos.map((usuario) => <option key={usuario.id} value={usuario.id}>{nombreUsuario(usuario)} · {texto(usuario.tipoFuncionario, "Sin tipo")}</option>)}</select></Campo>
                <Campo label="Descripción de la tarea"><textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5} className={inputBase()} placeholder="Describe claramente la tarea" required /></Campo>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Prioridad"><select value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadTarea)} className={inputBase()}><option value="inmediato">Inmediato</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></Campo>
                  <Campo label="Fecha máxima"><input type="date" value={fechaMaxima} onChange={(e) => setFechaMaxima(e.target.value)} className={inputBase()} required /></Campo>
                </div>
                <Campo label="Estado final"><select value={estadoFinal} onChange={(e) => setEstadoFinal(e.target.value as EstadoTarea)} className={inputBase()}><option value="pendiente">Pendiente</option><option value="realizado">Realizado</option><option value="no realizado">No realizado</option><option value="incompleto">Incompleto</option></select></Campo>
                <Campo label="Observaciones"><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} className={inputBase()} placeholder="Observaciones internas o iniciales" /></Campo>
              </div>

              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={limpiarFormulario} className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-300">Limpiar</button><button type="submit" disabled={guardando} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-60">{guardando ? "Guardando..." : tareaEditandoId ? "Actualizar tarea" : "Guardar tarea"}</button></div>
            </form>

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div><p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">Listado</p><h3 className="mt-1 text-xl font-black text-slate-800">Tareas programadas</h3></div>
                <div className="grid gap-2 sm:grid-cols-3 lg:w-[620px]">
                  <Campo label="Buscar"><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={inputBase()} placeholder="Usuario, tarea..." /></Campo>
                  <Campo label="Estado"><select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as any)} className={inputBase()}><option value="todos">Todos</option><option value="pendiente">Pendiente</option><option value="realizado">Realizado</option><option value="no realizado">No realizado</option><option value="incompleto">Incompleto</option></select></Campo>
                  <Campo label="Prioridad"><select value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value as any)} className={inputBase()}><option value="todos">Todas</option><option value="inmediato">Inmediato</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></Campo>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr><th className="px-3 py-3">Usuario</th><th className="px-3 py-3">Tarea</th><th className="px-3 py-3">Prioridad</th><th className="px-3 py-3">Fecha máxima</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Chat</th><th className="px-3 py-3 text-right">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tareasPaginadas.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-10 text-center text-xs font-bold text-slate-400">Sin tareas para los filtros seleccionados.</td></tr>
                    ) : tareasPaginadas.map((tarea) => {
                      const dias = diasRestantes(tarea.fechaMaxima);
                      return (
                        <tr key={tarea.id} className="align-top">
                          <td className="px-3 py-3"><p className="font-black text-slate-700">{tarea.usuarioNombre}</p><p className="text-xs font-bold text-slate-400">{tarea.tipoFuncionario || tarea.usuarioEmail}</p></td>
                          <td className="px-3 py-3 max-w-sm"><p className="line-clamp-2 text-xs font-semibold text-slate-500">{tarea.descripcion}</p>{tarea.observaciones && <p className="mt-1 line-clamp-1 text-[11px] font-bold text-slate-400">Obs: {tarea.observaciones}</p>}</td>
                          <td className="px-3 py-3"><span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${prioridadClase(tarea.prioridad)}`}>{tarea.prioridad}</span></td>
                          <td className="px-3 py-3 text-xs font-bold text-slate-500">{tarea.fechaMaxima}<br />{dias !== null && <span className={dias < 0 ? "text-red-600" : dias <= 2 ? "text-amber-600" : "text-slate-400"}>{dias < 0 ? `Vencida hace ${Math.abs(dias)} día(s)` : dias === 0 ? "Vence hoy" : `${dias} día(s)`}</span>}</td>
                          <td className="px-3 py-3"><span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoClase(tarea.estadoFinal)}`}>{tarea.estadoFinal}</span></td>
                          <td className="px-3 py-3"><span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black text-sky-700">{Array.isArray(tarea.chatTarea) ? tarea.chatTarea.length : 0}</span></td>
                          <td className="px-3 py-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setDetalleTarea(tarea); setMensajeChat(""); }} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Ver</button><button type="button" onClick={() => editarTarea(tarea)} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">Editar</button><button type="button" onClick={() => eliminarTarea(tarea)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Eliminar</button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-400"><span>Mostrando {tareasPaginadas.length} de {tareasFiltradas.length}</span><div className="flex gap-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50">Anterior</button><span className="px-2 py-2">{pagina}/{totalPaginas}</span><button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50">Siguiente</button></div></div>
            </section>
          </section>
        </div>
      </section>

      {detalleTareaActual && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white">
              <div><p className="text-[11px] font-black uppercase tracking-widest text-white/75">Detalle de tarea</p><h3 className="text-lg font-black">{detalleTareaActual.usuarioNombre}</h3><p className="text-xs font-bold text-white/70">{detalleTareaActual.tipoFuncionario} · {detalleTareaActual.fechaMaxima}</p></div>
              <button type="button" onClick={() => setDetalleTarea(null)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white">Cerrar</button>
            </div>
            <div className="max-h-[calc(94vh-82px)] overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 text-sm font-semibold text-slate-600">
                    <p><b>Usuario:</b> {detalleTareaActual.usuarioNombre}</p>
                    <p><b>Email:</b> {detalleTareaActual.usuarioEmail || "N/A"}</p>
                    <p><b>Fecha máxima:</b> {detalleTareaActual.fechaMaxima}</p>
                    <p><b>Creado por:</b> {detalleTareaActual.creadoPorNombre || "Admin"}</p>
                    <p><b>Prioridad:</b> <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${prioridadClase(detalleTareaActual.prioridad)}`}>{detalleTareaActual.prioridad}</span></p>
                    <p><b>Estado:</b> <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoClase(detalleTareaActual.estadoFinal)}`}>{detalleTareaActual.estadoFinal}</span></p>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-4"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Descripción</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">{detalleTareaActual.descripcion}</p></div>
                  <div className="mt-3 rounded-2xl bg-white p-4"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Observaciones</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">{detalleTareaActual.observaciones || "Sin observaciones."}</p></div>
                </section>

                <section className="rounded-3xl border border-slate-100 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Estado final</p>
                  <div className="mt-3 grid gap-2">
                    {(["realizado", "incompleto", "no realizado", "pendiente"] as EstadoTarea[]).map((estado) => (
                      <button key={estado} type="button" onClick={() => cambiarEstadoTarea(detalleTareaActual, estado)} className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase ${detalleTareaActual.estadoFinal === estado ? estadoClase(estado) : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>{estado}</button>
                    ))}
                  </div>
                </section>
              </div>

              <section className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">Seguimiento</p><h4 className="text-base font-black text-slate-800">Mini chat</h4></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-700">{Array.isArray(detalleTareaActual.chatTarea) ? detalleTareaActual.chatTarea.length : 0} mensajes</span></div>
                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-white p-3">
                  {(!Array.isArray(detalleTareaActual.chatTarea) || detalleTareaActual.chatTarea.length === 0) ? <p className="py-8 text-center text-xs font-bold text-slate-400">Sin mensajes de seguimiento.</p> : detalleTareaActual.chatTarea.map((chat) => <div key={chat.id} className={`max-w-[86%] rounded-2xl px-3 py-2 text-xs font-semibold ${chat.rol === "admin" ? "ml-auto bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}><p className="font-black">{chat.autor}</p><p className="mt-1 whitespace-pre-wrap">{chat.mensaje}</p><p className={`mt-1 text-[10px] ${chat.rol === "admin" ? "text-white/70" : "text-slate-400"}`}>{formatDateTime(chat.fecha)}</p></div>)}
                </div>
                <div className="mt-3 flex gap-2"><input value={mensajeChat} onChange={(e) => setMensajeChat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensajeChat(detalleTareaActual); } }} placeholder="Escribir mensaje..." className={inputBase("bg-white")} /><button type="button" disabled={guardandoChat || !mensajeChat.trim()} onClick={() => enviarMensajeChat(detalleTareaActual)} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Enviar</button></div>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
