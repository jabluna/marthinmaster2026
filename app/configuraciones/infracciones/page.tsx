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

type EstadoInfraccion = "solucionado" | "avisado" | "en proceso";

type Infraccion = {
  id: string;
  conductorId: string;
  nombreCompleto: string;
  email: string;
  infraccion: string;
  fecha: string;
  estado: EstadoInfraccion;
  observaciones?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DEFAULT_LOGO = "/logo.png";
const HOY = new Date().toISOString().slice(0, 10);
const FILAS_POR_PAGINA = 10;

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

function normalizarTexto(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function nombreUsuario(usuario: UsuarioOperativo) {
  return `${texto(usuario.nombres)} ${texto(usuario.apellidos)}`.trim() || texto(usuario.email, "Usuario");
}

function usuarioActivo(usuario: UsuarioOperativo) {
  const estado = normalizarTexto(texto(usuario.estado, "ACTIVO"));
  return estado === "activo" || estado === "active";
}

function esConductor(usuario: UsuarioOperativo) {
  const cargo = normalizarTexto(`${texto(usuario.tipoFuncionario)} ${texto(usuario.rol)}`);
  return cargo.includes("conductor") || cargo.includes("ambulancia") || cargo.includes("operador");
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

function estadoClase(estado: EstadoInfraccion) {
  if (estado === "solucionado") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (estado === "avisado") return "border-red-100 bg-red-50 text-red-700";
  return "border-amber-100 bg-amber-50 text-amber-700";
}

function filaEstadoClase(estado: EstadoInfraccion) {
  if (estado === "solucionado") return "bg-emerald-50/45 hover:bg-emerald-50";
  if (estado === "avisado") return "bg-red-50/45 hover:bg-red-50";
  return "bg-amber-50/45 hover:bg-amber-50";
}

export default function InfraccionesPage() {
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

  const [usuarios, setUsuarios] = useState<UsuarioOperativo[]>([]);
  const [infracciones, setInfracciones] = useState<Infraccion[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [infraccionEditandoId, setInfraccionEditandoId] = useState("");
  const [conductorId, setConductorId] = useState("");
  const [infraccionTexto, setInfraccionTexto] = useState("");
  const [fecha, setFecha] = useState(HOY);
  const [estado, setEstado] = useState<EstadoInfraccion>("avisado");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoInfraccion>("todos");
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState<Infraccion | null>(null);

  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);

  const nombreHeader = useMemo(() => {
    return texto(cliente?.representante, cliente?.Representante, user?.displayName, clienteSesion?.razonSocial, cliente?.razonSocial, cliente?.nombreComercial, "Usuario");
  }, [cliente, clienteSesion, user]);

  const conductores = useMemo(() => {
    const filtrados = usuarios.filter((usuario) => usuarioActivo(usuario) && esConductor(usuario));
    return filtrados.length > 0 ? filtrados : usuarios.filter(usuarioActivo);
  }, [usuarios]);

  const conductorSeleccionado = useMemo(() => conductores.find((item) => item.id === conductorId) || null, [conductores, conductorId]);

  const resumen = useMemo(() => {
    const solucionadas = infracciones.filter((item) => item.estado === "solucionado").length;
    const avisadas = infracciones.filter((item) => item.estado === "avisado").length;
    const enProceso = infracciones.filter((item) => item.estado === "en proceso").length;
    return { solucionadas, avisadas, enProceso, total: infracciones.length };
  }, [infracciones]);

  const infraccionesFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    return infracciones
      .filter((item) => (filtroEstado === "todos" ? true : item.estado === filtroEstado))
      .filter((item) => {
        if (!textoBusqueda) return true;
        return [item.nombreCompleto, item.email, item.infraccion, item.fecha, item.estado, item.observaciones]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);
      })
      .sort((a, b) => `${b.fecha}`.localeCompare(`${a.fecha}`));
  }, [infracciones, busqueda, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(infraccionesFiltradas.length / FILAS_POR_PAGINA));
  const infraccionesPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * FILAS_POR_PAGINA;
    return infraccionesFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [infraccionesFiltradas, pagina]);

  const mostrarMensaje = (textoMensaje: string, tipo: "ok" | "error" = "ok") => {
    setMensaje(textoMensaje);
    setTipoMensaje(tipo);
    window.setTimeout(() => setMensaje(""), 4200);
  };


  const actualizarResumenAlertaConductor = async (
    conductorIdActual: string,
    infraccionIdExcluida = "",
    incluirActualActiva = false,
    conductorNombreActual = "",
    conductorEmailActual = "",
  ) => {
    if (!clienteId || !conductorIdActual) return;

    const otrasActivas = infracciones.filter(
      (item) =>
        item.conductorId === conductorIdActual &&
        item.id !== infraccionIdExcluida &&
        item.estado !== "solucionado",
    );
    const totalActivas = otrasActivas.length + (incluirActualActiva ? 1 : 0);
    const ultima = otrasActivas[0];

    await setDoc(
      doc(db, "clientes", clienteId, "alertas", "infracciones"),
      {
        tipo: "grupo_alertas",
        categoria: "infracciones",
        nombre: "Infracciones",
        descripcion: "Alertas agrupadas por conductor e infracción.",
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
        "infracciones",
        "conductores",
        conductorIdActual,
      ),
      {
        activo: totalActivas > 0,
        tipo: "infracciones",
        conductorId: conductorIdActual,
        conductorNombre: conductorNombreActual || ultima?.nombreCompleto || "Conductor",
        nombreCompleto: conductorNombreActual || ultima?.nombreCompleto || "Conductor",
        email: conductorEmailActual || ultima?.email || "",
        totalActivas,
        mensaje:
          totalActivas > 0
            ? `${conductorNombreActual || ultima?.nombreCompleto || "Conductor"} tiene ${totalActivas} infracción(es) pendiente(s).`
            : `${conductorNombreActual || ultima?.nombreCompleto || "Conductor"} no tiene infracciones activas.`,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const sincronizarAlertaInfraccion = async (
    infraccionId: string,
    payload: Omit<Infraccion, "id">,
    conductorAnteriorId = "",
  ) => {
    if (!clienteId || !infraccionId) return;

    const alertaActiva = payload.estado !== "solucionado";

    if (conductorAnteriorId && conductorAnteriorId !== payload.conductorId) {
      await deleteDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "alertas",
          "infracciones",
          "conductores",
          conductorAnteriorId,
          "registros",
          infraccionId,
        ),
      ).catch(() => undefined);
      await actualizarResumenAlertaConductor(conductorAnteriorId, infraccionId, false);
    }

    await setDoc(
      doc(db, "clientes", clienteId, "infracciones", infraccionId),
      {
        alertaActiva,
        alertaTipo: "infracciones",
        alertaActualizadaAt: serverTimestamp(),
      },
      { merge: true },
    );

    if (!alertaActiva) {
      await deleteDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "alertas",
          "infracciones",
          "conductores",
          payload.conductorId,
          "registros",
          infraccionId,
        ),
      ).catch(() => undefined);
      await actualizarResumenAlertaConductor(
        payload.conductorId,
        infraccionId,
        false,
        payload.nombreCompleto,
        payload.email,
      );
      return;
    }

    const alertaPayload = {
      activo: true,
      tipo: "infracciones",
      categoria: "infracciones",
      infraccionId,
      conductorId: payload.conductorId,
      conductorNombre: payload.nombreCompleto,
      nombreCompleto: payload.nombreCompleto,
      email: payload.email,
      infraccion: payload.infraccion,
      fecha: payload.fecha,
      estado: payload.estado,
      observaciones: payload.observaciones || "",
      mensaje: `${payload.nombreCompleto} tiene una infracción en estado ${payload.estado}.`,
      updatedAt: serverTimestamp(),
      fechaGeneracion: serverTimestamp(),
    };

    await setDoc(
      doc(
        db,
        "clientes",
        clienteId,
        "alertas",
        "infracciones",
        "conductores",
        payload.conductorId,
        "registros",
        infraccionId,
      ),
      alertaPayload,
      { merge: true },
    );

    await actualizarResumenAlertaConductor(
      payload.conductorId,
      infraccionId,
      true,
      payload.nombreCompleto,
      payload.email,
    );
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

    const unsubInfracciones = onSnapshot(query(collection(db, "clientes", clienteId, "infracciones"), orderBy("fecha", "desc")), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Infraccion, "id">) }));
      setInfracciones(data);
    });

    return () => {
      unsubUsuarios();
      unsubInfracciones();
    };
  }, [clienteId]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroEstado]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const limpiarFormulario = () => {
    setInfraccionEditandoId("");
    setConductorId("");
    setInfraccionTexto("");
    setFecha(HOY);
    setEstado("avisado");
    setObservaciones("");
  };

  const abrirNuevo = () => {
    limpiarFormulario();
    setModalOpen(true);
  };

  const editarInfraccion = (infraccion: Infraccion) => {
    setInfraccionEditandoId(infraccion.id);
    setConductorId(infraccion.conductorId || "");
    setInfraccionTexto(infraccion.infraccion || "");
    setFecha(infraccion.fecha || HOY);
    setEstado(infraccion.estado || "avisado");
    setObservaciones(infraccion.observaciones || "");
    setModalOpen(true);
  };

  const guardarInfraccion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clienteId || guardando) return;
    if (!conductorSeleccionado || !infraccionTexto.trim() || !fecha) {
      mostrarMensaje("Completa conductor, infracción y fecha.", "error");
      return;
    }

    setGuardando(true);
    try {
      const refInfraccion = infraccionEditandoId
        ? doc(db, "clientes", clienteId, "infracciones", infraccionEditandoId)
        : doc(collection(db, "clientes", clienteId, "infracciones"));

      const payloadInfraccion = {
        conductorId: conductorSeleccionado.id,
        nombreCompleto: nombreUsuario(conductorSeleccionado),
        email: texto(conductorSeleccionado.email),
        infraccion: infraccionTexto.trim(),
        fecha,
        estado,
        observaciones: observaciones.trim(),
        updatedAt: serverTimestamp(),
        ...(infraccionEditandoId ? {} : { createdAt: serverTimestamp() }),
      };

      await setDoc(refInfraccion, payloadInfraccion, { merge: true });

      const conductorAnteriorId = infraccionEditandoId
        ? infracciones.find((item) => item.id === infraccionEditandoId)?.conductorId || ""
        : "";

      await sincronizarAlertaInfraccion(
        refInfraccion.id,
        {
          id: refInfraccion.id,
          ...payloadInfraccion,
        } as Infraccion,
        conductorAnteriorId,
      );

      limpiarFormulario();
      setModalOpen(false);
      mostrarMensaje(infraccionEditandoId ? "Infracción actualizada correctamente." : "Infracción guardada correctamente.");
    } catch (error) {
      console.error("Error guardando infracción:", error);
      mostrarMensaje("No fue posible guardar la infracción.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarInfraccion = async (infraccion: Infraccion) => {
    if (!clienteId) return;
    const confirmar = window.confirm(`¿Eliminar la infracción de ${infraccion.nombreCompleto}?`);
    if (!confirmar) return;
    try {
      await deleteDoc(doc(db, "clientes", clienteId, "infracciones", infraccion.id));
      await deleteDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "alertas",
          "infracciones",
          "conductores",
          infraccion.conductorId,
          "registros",
          infraccion.id,
        ),
      ).catch(() => undefined);
      await actualizarResumenAlertaConductor(infraccion.conductorId, infraccion.id, false, infraccion.nombreCompleto, infraccion.email);
      if (detalle?.id === infraccion.id) setDetalle(null);
      mostrarMensaje("Infracción eliminada correctamente.");
    } catch (error) {
      console.error("Error eliminando infracción:", error);
      mostrarMensaje("No fue posible eliminar la infracción.", "error");
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
          <p className="text-sm font-semibold text-slate-600">Cargando infracciones...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5fa] text-slate-700">
      {menuOpen && <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-900/45 lg:hidden" />}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-[#151f32] text-white shadow-2xl transition-all duration-300 lg:translate-x-0 ${menuCollapsed ? "lg:w-20" : "lg:w-72"} ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col">
          <div className={`${menuCollapsed ? "px-3 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="min-w-0 flex-1" title="Ir al inicio">
                <img src={logo} alt="Marthin" className={`h-12 object-contain ${menuCollapsed ? "mx-auto w-12" : "w-36 object-left"}`} />
              </Link>
              <button type="button" onClick={() => setMenuCollapsed((actual) => !actual)} className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-base font-black text-white transition hover:bg-white/15 lg:flex" title={menuCollapsed ? "Expandir menú" : "Encoger menú"} aria-label={menuCollapsed ? "Expandir menú" : "Encoger menú"}>☰</button>
              <button type="button" onClick={() => setMenuOpen(false)} className="ml-auto rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Cerrar">✕</button>
            </div>
            {!menuCollapsed && <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>}
          </div>

          <nav className={`flex-1 overflow-y-auto py-4 ${menuCollapsed ? "px-2" : "px-4"}`}>
            <Link href="/dashboard" title="Inicio" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "gap-3"} ${pathname === "/dashboard" ? "bg-white text-[#151f32] shadow-lg" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "I" : "Inicio"}</Link>

            <div className="mt-4">
              <button type="button" onClick={() => setConfigOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="1. Configuraciones" aria-expanded={configOpen}>
                <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                {!menuCollapsed && <span className="text-xs text-white/40">{configOpen ? "▲" : "▼"}</span>}
              </button>
              {configOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/empresa" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/empresa" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.1" : "1.1 Empresa"}</Link>
                  <Link href="/configuraciones/usuarios" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/usuarios" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.2" : "1.2 Usuarios y Roles"}</Link>
                  <Link href="/configuraciones/ubicaciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/ubicaciones" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.3" : "1.3 Móviles y Bodegas"}</Link>
                </div>
              )}
            </div>

            <div className="mt-2">
              <button type="button" onClick={() => setOperativaOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="2. Área Operativa" aria-expanded={operativaOpen}>
                <span>{menuCollapsed ? "2" : "2. Área Operativa"}</span>
                {!menuCollapsed && <span className="text-xs text-white/40">{operativaOpen ? "▲" : "▼"}</span>}
              </button>
              {operativaOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/autoevaluacion" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/autoevaluacion" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.1" : "2.1 Autoevaluación General"}</Link>
                  <Link href="/configuraciones/asignaciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/asignaciones" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.2" : "2.2 Asignaciones a Móviles"}</Link>
                </div>
              )}
            </div>

            <div className="mt-2">
              <button type="button" onClick={() => setMovilesOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="3. Móviles" aria-expanded={movilesOpen}>
                <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                {!menuCollapsed && <span className="text-xs text-white/40">{movilesOpen ? "▲" : "▼"}</span>}
              </button>
              {movilesOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/verificaciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/verificaciones" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.1" : "3.1 Verificación diaria"}</Link>
                  <Link href="/configuraciones/mantenimientos" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/mantenimientos" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.2" : "3.2 Programación de Mantenimientos"}</Link>
                  <Link href="/configuraciones/infracciones" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/infracciones" ? "bg-white text-[#151f32] shadow-lg" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.3" : "3.3 Gestión de Infracciones"}</Link>
                </div>
              )}
            </div>

            <div className="mt-2">
              <button type="button" onClick={() => setTareasOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="4. Tareas" aria-expanded={tareasOpen}>
                <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                {!menuCollapsed && <span className="text-xs text-white/40">{tareasOpen ? "▲" : "▼"}</span>}
              </button>
              {tareasOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/tareas" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/tareas" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "4.1" : "4.1 Programar tareas"}</Link>
                </div>
              )}
            </div>

            <div className="mt-2">
              <button type="button" onClick={() => setSoporteOpen((actual) => !actual)} className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`} title="5. Soporte" aria-expanded={soporteOpen}>
                <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                {!menuCollapsed && <span className="text-xs text-white/40">{soporteOpen ? "▲" : "▼"}</span>}
              </button>
              {soporteOpen && (
                <div className="mt-2 space-y-1">
                  <Link href="/configuraciones/soportea" className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/soportea" ? "bg-white text-[#151f32]" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "5.1" : "5.1 Solicitar un soporte"}</Link>
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
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">Móviles / 3.3</p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">Gestión de Infracciones</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Registra infracciones por conductor, controla su estado y conserva el historial para seguimiento administrativo.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-lg font-black text-slate-700">{resumen.total}</p><p className="text-[10px] font-black uppercase text-slate-500">Total</p></div>
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-center"><p className="text-lg font-black text-red-700">{resumen.avisadas}</p><p className="text-[10px] font-black uppercase text-red-500">Avisadas</p></div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center"><p className="text-lg font-black text-amber-700">{resumen.enProceso}</p><p className="text-[10px] font-black uppercase text-amber-500">En proceso</p></div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center"><p className="text-lg font-black text-emerald-700">{resumen.solucionadas}</p><p className="text-[10px] font-black uppercase text-emerald-500">Solucionadas</p></div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
                <Campo label="Buscar"><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={inputBase()} placeholder="Conductor, email, infracción..." /></Campo>
                <Campo label="Estado"><select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as any)} className={inputBase()}><option value="todos">Todos</option><option value="avisado">Avisado</option><option value="en proceso">En proceso</option><option value="solucionado">Solucionado</option></select></Campo>
              </div>
              <button type="button" onClick={abrirNuevo} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500">Gestión de Infracciones</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Conductor</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Infracción</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {infraccionesPaginadas.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-xs font-bold text-slate-400">Sin infracciones registradas.</td></tr>
                  ) : infraccionesPaginadas.map((item) => (
                    <tr key={item.id} className={`align-top transition ${filaEstadoClase(item.estado)}`}>
                      <td className="px-4 py-3"><p className="font-black text-slate-700">{item.nombreCompleto}</p></td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{item.email || "N/A"}</td>
                      <td className="px-4 py-3 max-w-md"><p className="line-clamp-2 font-semibold text-slate-600">{item.infraccion}</p>{item.observaciones && <p className="mt-1 line-clamp-1 text-[11px] font-bold text-slate-400">Obs: {item.observaciones}</p>}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{item.fecha}</td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoClase(item.estado)}`}>{item.estado}</span></td>
                      <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => setDetalle(item)} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Ver</button><button type="button" onClick={() => editarInfraccion(item)} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">Editar</button><button type="button" onClick={() => eliminarInfraccion(item)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Eliminar</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-400">
              <span>Mostrando {infraccionesPaginadas.length} de {infraccionesFiltradas.length}</span>
              <div className="flex items-center gap-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50">Anterior</button><span>{pagina}/{totalPaginas}</span><button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50">Siguiente</button></div>
            </div>
          </section>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white">
              <div><p className="text-[11px] font-black uppercase tracking-widest text-white/75">Registrar / editar</p><h3 className="text-lg font-black">Infracción</h3></div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white">Cerrar</button>
            </div>
            <form onSubmit={guardarInfraccion} className="max-h-[calc(94vh-82px)] overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Conductor"><select value={conductorId} onChange={(e) => setConductorId(e.target.value)} className={inputBase()} required><option value="">Seleccione un conductor</option>{conductores.map((usuario) => <option key={usuario.id} value={usuario.id}>{nombreUsuario(usuario)} · {texto(usuario.tipoFuncionario, usuario.rol, "Sin cargo")}</option>)}</select></Campo>
                <Campo label="Email"><input value={texto(conductorSeleccionado?.email)} readOnly className={inputBase("bg-slate-100 text-slate-400")} /></Campo>
                <div className="sm:col-span-2"><Campo label="Infracción detectada"><input value={infraccionTexto} onChange={(e) => setInfraccionTexto(e.target.value)} className={inputBase()} placeholder="Ingrese la infracción" required /></Campo></div>
                <Campo label="Fecha de infracción"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputBase()} required /></Campo>
                <Campo label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value as EstadoInfraccion)} className={inputBase()} required><option value="solucionado">Solucionado</option><option value="avisado">Avisado</option><option value="en proceso">En proceso</option></select></Campo>
                <div className="sm:col-span-2"><Campo label="Observaciones"><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={4} className={inputBase()} placeholder="Observaciones opcionales" /></Campo></div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-300">Cerrar</button>
                <button type="submit" disabled={guardando} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-60">{guardando ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-3 sm:p-5">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 bg-sky-500 px-5 py-4 text-white">
              <div><p className="text-[11px] font-black uppercase tracking-widest text-white/75">Detalle</p><h3 className="text-lg font-black">{detalle.nombreCompleto}</h3></div>
              <button type="button" onClick={() => setDetalle(null)} className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white">Cerrar</button>
            </div>
            <div className="p-5">
              <div className="grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                <p><b>Email:</b> {detalle.email || "N/A"}</p>
                <p><b>Fecha:</b> {detalle.fecha}</p>
                <p><b>Estado:</b> <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoClase(detalle.estado)}`}>{detalle.estado}</span></p>
                <p><b>Creado:</b> {formatDateTime(detalle.createdAt) || "N/A"}</p>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Infracción</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-700">{detalle.infraccion}</p></div>
              <div className="mt-3 rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Observaciones</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-700">{detalle.observaciones || "Sin observaciones."}</p></div>
              <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { editarInfraccion(detalle); setDetalle(null); }} className="rounded-xl bg-sky-50 px-4 py-2 text-xs font-black text-sky-700">Editar</button><button type="button" onClick={() => eliminarInfraccion(detalle)} className="rounded-xl bg-red-50 px-4 py-2 text-xs font-black text-red-700">Eliminar</button></div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
