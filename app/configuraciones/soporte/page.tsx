"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
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

type ArchivoSoporte = {
  nombre: string;
  url: string;
  path: string;
  tipo: string;
};

type TipoSoporte = "tecnico" | "administrativo";
type PrioridadSoporte = "baja" | "media" | "alta" | "critica";
type EstadoSoporte = "abierto" | "en proceso" | "resuelto" | "cerrado";

type SolicitudSoporte = {
  id: string;
  tipo: TipoSoporte;
  asunto: string;
  descripcion: string;
  prioridad: PrioridadSoporte;
  estado: EstadoSoporte;
  modulo: string;
  solicitanteId: string;
  solicitanteNombre: string;
  solicitanteEmail: string;
  clienteId: string;
  clienteNombre: string;
  archivos?: ArchivoSoporte[];
  respuesta?: string;
  destino?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  fechaSolicitud?: string;
  fechaSolicitudTexto?: string;
};

type DatosContactoSoporte = {
  whatsapp?: string;
  whatsappSoporte?: string;
  numeroWhatsapp?: string;
  correoAdmin?: string;
  emailAdmin?: string;
  correoAdministrativo?: string;
  emailAdministrativo?: string;
  correoTecnico?: string;
  emailTecnico?: string;
};

const DEFAULT_LOGO = "/logo.png";
const SOPORTES_POR_PAGINA = 8;

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

function obtenerFecha(value: unknown): Date | null {
  if (!value) return null;

  try {
    if (value instanceof Timestamp) return value.toDate();

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "object" && value !== null) {
      const data = value as {
        seconds?: number;
        nanoseconds?: number;
        _seconds?: number;
        toDate?: () => Date;
      };

      if (typeof data.toDate === "function") {
        const fecha = data.toDate();
        return Number.isNaN(fecha.getTime()) ? null : fecha;
      }

      const seconds =
        typeof data.seconds === "number" ? data.seconds : data._seconds;
      if (typeof seconds === "number" && Number.isFinite(seconds)) {
        const fecha = new Date(seconds * 1000);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
      }

      return null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      const fecha = new Date(value);
      return Number.isNaN(fecha.getTime()) ? null : fecha;
    }

    if (typeof value === "string") {
      const limpia = value.trim();
      if (!limpia) return null;

      const fecha = new Date(limpia);
      return Number.isNaN(fecha.getTime()) ? null : fecha;
    }
  } catch {
    return null;
  }

  return null;
}

function formatDateTime(value: unknown) {
  const fecha = obtenerFecha(value);
  if (!fecha) return "Sin fecha";

  return fecha.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fechaOrdenable(...values: unknown[]) {
  for (const value of values) {
    const fecha = obtenerFecha(value);
    if (fecha) return fecha.getTime();
  }
  return 0;
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function inputBase(extra = "") {
  return `w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white ${extra}`;
}

function normalizarWhatsApp(value?: string) {
  const numero = String(value || "").replace(/[^0-9]/g, "");
  if (!numero) return "";
  if (numero.startsWith("57") || numero.length > 10) return numero;
  return `57${numero}`;
}

function limpiarUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => limpiarUndefined(item))
      .filter((item) => item !== undefined) as T;
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

export default function SoportePage() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [clienteSesion, setClienteSesion] = useState<ClienteSesion | null>(
    null,
  );
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [operativaOpen, setOperativaOpen] = useState(false);
  const [movilesOpen, setMovilesOpen] = useState(false);
  const [tareasOpen, setTareasOpen] = useState(false);
  const [soporteOpen, setSoporteOpen] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error">("ok");

  const [tipoSoporte, setTipoSoporte] = useState<TipoSoporte>("tecnico");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [modulo, setModulo] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadSoporte>("media");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);

  const [solicitudes, setSolicitudes] = useState<SolicitudSoporte[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoSoporte>("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoSoporte>(
    "todos",
  );
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState<SolicitudSoporte | null>(null);
  const [datosContactoSoporte, setDatosContactoSoporte] =
    useState<DatosContactoSoporte>({});

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

  const nombreCliente = useMemo(() => {
    return texto(
      cliente?.razonSocial,
      cliente?.nombreComercial,
      clienteSesion?.razonSocial,
      "Cliente",
    );
  }, [cliente, clienteSesion]);

  const whatsappSoporte = useMemo(() => {
    return normalizarWhatsApp(
      texto(
        datosContactoSoporte.whatsapp,
        datosContactoSoporte.whatsappSoporte,
        datosContactoSoporte.numeroWhatsapp,
      ),
    );
  }, [datosContactoSoporte]);

  const correoAdminSoporte = useMemo(() => {
    return texto(
      datosContactoSoporte.correoAdmin,
      datosContactoSoporte.emailAdmin,
      datosContactoSoporte.correoAdministrativo,
      datosContactoSoporte.emailAdministrativo,
    );
  }, [datosContactoSoporte]);

  const correoTecnicoSoporte = useMemo(() => {
    return texto(
      datosContactoSoporte.correoTecnico,
      datosContactoSoporte.emailTecnico,
    );
  }, [datosContactoSoporte]);

  const mostrarMensaje = (
    textoMensaje: string,
    tipo: "ok" | "error" = "ok",
  ) => {
    setMensaje(textoMensaje);
    setTipoMensaje(tipo);
    window.setTimeout(() => setMensaje(""), 4500);
  };

  const solicitudesFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    return solicitudes
      .filter((item) =>
        filtroTipo === "todos" ? true : item.tipo === filtroTipo,
      )
      .filter((item) =>
        filtroEstado === "todos" ? true : item.estado === filtroEstado,
      )
      .filter((item) => {
        if (!textoBusqueda) return true;
        return [
          item.asunto,
          item.descripcion,
          item.modulo,
          item.estado,
          item.prioridad,
          item.tipo,
          item.solicitanteNombre,
          item.solicitanteEmail,
        ]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);
      })
      .sort(
        (a, b) =>
          fechaOrdenable(b.fechaSolicitud, b.createdAt) -
          fechaOrdenable(a.fechaSolicitud, a.createdAt),
      );
  }, [solicitudes, busqueda, filtroTipo, filtroEstado]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(solicitudesFiltradas.length / SOPORTES_POR_PAGINA),
  );
  const solicitudesPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * SOPORTES_POR_PAGINA;
    return solicitudesFiltradas.slice(inicio, inicio + SOPORTES_POR_PAGINA);
  }, [solicitudesFiltradas, pagina]);

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
    const refSoportes = query(
      collection(db, "clientes", clienteId, "soportes"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(refSoportes, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<SolicitudSoporte, "id">),
      }));
      setSolicitudes(data);
    });
    return () => unsubscribe();
  }, [clienteId]);

  useEffect(() => {
    const refDatosSoporte = doc(db, "configuracionGlobal", "soporte");
    const unsubscribe = onSnapshot(
      refDatosSoporte,
      (snapshot) => {
        setDatosContactoSoporte(
          snapshot.exists() ? (snapshot.data() as DatosContactoSoporte) : {},
        );
      },
      (error) => {
        console.error("Error cargando datos de contacto de soporte:", error);
        setDatosContactoSoporte({});
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filtroTipo, filtroEstado]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const subirArchivos = async (soporteId: string) => {
    if (!clienteId || archivos.length === 0) return [] as ArchivoSoporte[];

    const subidos = await Promise.all(
      archivos.map(async (file) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `clientes/${clienteId}/soportes/${soporteId}/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file, { contentType: file.type });
        const url = await getDownloadURL(storageRef);
        return {
          nombre: file.name,
          url,
          path,
          tipo: file.type,
        } as ArchivoSoporte;
      }),
    );

    return subidos;
  };

  const limpiarFormulario = () => {
    setTipoSoporte("tecnico");
    setAsunto("");
    setDescripcion("");
    setModulo("");
    setPrioridad("media");
    setArchivos([]);
  };

  const guardarSoporte = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clienteId || guardando) return;
    if (!asunto.trim() || !descripcion.trim()) {
      mostrarMensaje("El asunto y la descripción son obligatorios.", "error");
      return;
    }

    setGuardando(true);
    try {
      const refSoporte = doc(collection(db, "clientes", clienteId, "soportes"));
      const archivosSubidos = await subirArchivos(refSoporte.id);
      const destino =
        tipoSoporte === "tecnico"
          ? "soporte_tecnico"
          : "soporte_administrativo";
      const fechaSolicitud = new Date();

      const payload = limpiarUndefined({
        tipo: tipoSoporte,
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        prioridad,
        estado: "abierto" as EstadoSoporte,
        modulo: modulo.trim(),
        solicitanteId: user?.uid || "",
        solicitanteNombre: nombreHeader,
        solicitanteEmail: user?.email || clienteSesion?.email || "",
        clienteId,
        clienteNombre: nombreCliente,
        destino,
        archivos: archivosSubidos,
        fechaSolicitud: fechaSolicitud.toISOString(),
        fechaSolicitudTexto: fechaSolicitud.toLocaleString("es-CO", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(refSoporte, payload);

      await addDoc(collection(db, "soportesGlobal", destino, "solicitudes"), {
        ...payload,
        soporteIdCliente: refSoporte.id,
        clienteId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      limpiarFormulario();
      mostrarMensaje("Solicitud de soporte enviada correctamente.");
    } catch (error) {
      console.error("Error guardando soporte:", error);
      mostrarMensaje("No fue posible enviar la solicitud de soporte.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = async () => {
    await signOut(auth);
    window.localStorage.removeItem("clienteSesion");
    window.localStorage.removeItem("usuarioSesion");
    router.replace("/login_users");
  };

  const prioridadClase = (value: string) => {
    if (value === "critica") return "border-red-200 bg-red-50 text-red-700";
    if (value === "alta")
      return "border-orange-200 bg-orange-50 text-orange-700";
    if (value === "media") return "border-sky-200 bg-sky-50 text-sky-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  };

  const estadoClase = (value: string) => {
    if (value === "resuelto" || value === "cerrado")
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (value === "en proceso")
      return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f5fa] flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-xl border border-slate-100 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-semibold text-slate-600">
            Cargando soporte...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5fa] text-slate-700">
      {menuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#121826] text-white shadow-[0_0_30px_rgba(15,23,42,0.20)] transition-all duration-300 lg:translate-x-0 ${menuCollapsed ? "lg:w-20" : "lg:w-72"} ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div
            className={`${menuCollapsed ? "px-3 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}
          >
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="min-w-0 flex-1" title="Inicio">
                <img
                  src={logo}
                  alt="Marthin"
                  className={`h-12 object-contain ${menuCollapsed ? "mx-auto w-12" : "w-36 object-left"}`}
                />
              </Link>
              <button
                type="button"
                onClick={() => setMenuCollapsed((actual) => !actual)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-base font-black text-white transition hover:bg-white/15 lg:flex"
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
            {!menuCollapsed && (
              <p className="mt-2 text-[11px] font-medium text-white/45">
                Portal clientes
              </p>
            )}
          </div>

          <nav
            className={`flex-1 overflow-y-auto py-5 ${menuCollapsed ? "px-2" : "px-4"}`}
          >
            <Link
              href="/dashboard"
              title="Inicio"
              className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "gap-3"} ${pathname === "/dashboard" ? "bg-white text-slate-900 shadow-lg" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
            >
              {menuCollapsed ? "I" : "Inicio"}
            </Link>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setConfigOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="1. Configuraciones"
                aria-expanded={configOpen}
              >
                <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                {!menuCollapsed && (
                  <span className="text-xs text-white/40">
                    {configOpen ? "▲" : "▼"}
                  </span>
                )}
              </button>
              {configOpen && (
                <div className="mt-2 space-y-1">
                  <Link
                    href="/configuraciones/empresa"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/empresa" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "1.1" : "1.1 Empresa"}
                  </Link>
                  <Link
                    href="/configuraciones/usuarios"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/usuarios" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "1.2" : "1.2 Usuarios y Roles"}
                  </Link>
                  <Link
                    href="/configuraciones/ubicaciones"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/ubicaciones" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "1.3" : "1.3 Móviles y Bodegas"}
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setOperativaOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="2. Área Operativa"
                aria-expanded={operativaOpen}
              >
                <span>{menuCollapsed ? "2" : "2. Área Operativa"}</span>
                {!menuCollapsed && (
                  <span className="text-xs text-white/40">
                    {operativaOpen ? "▲" : "▼"}
                  </span>
                )}
              </button>
              {operativaOpen && (
                <div className="mt-2 space-y-1">
                  <Link
                    href="/configuraciones/autoevaluacion"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/autoevaluacion" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "2.1" : "2.1 Autoevaluación General"}
                  </Link>
                  <Link
                    href="/configuraciones/asignaciones"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/asignaciones" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "2.2" : "2.2 Asignaciones a Móviles"}
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setMovilesOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="3. Móviles"
                aria-expanded={movilesOpen}
              >
                <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                {!menuCollapsed && (
                  <span className="text-xs text-white/40">
                    {movilesOpen ? "▲" : "▼"}
                  </span>
                )}
              </button>
              {movilesOpen && (
                <div className="mt-2 space-y-1">
                  <Link
                    href="/configuraciones/verificaciones"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/verificaciones" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "3.1" : "3.1 Verificación diaria"}
                  </Link>
                  <Link
                    href="/configuraciones/mantenimientos"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/mantenimientos" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed
                      ? "3.2"
                      : "3.2 Programación de Mantenimientos"}
                  </Link>
                  <Link
                    href="/configuraciones/infracciones"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/infracciones" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "3.3" : "3.3 Gestión de Infracciones"}
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setTareasOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="4. Tareas"
                aria-expanded={tareasOpen}
              >
                <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                {!menuCollapsed && (
                  <span className="text-xs text-white/40">
                    {tareasOpen ? "▲" : "▼"}
                  </span>
                )}
              </button>
              {tareasOpen && (
                <div className="mt-2 space-y-1">
                  <Link
                    href="/configuraciones/tareas"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/tareas" ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "4.1" : "4.1 Programar tareas"}
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setSoporteOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="5. Soporte"
                aria-expanded={soporteOpen}
              >
                <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                {!menuCollapsed && (
                  <span className="text-xs text-white/40">
                    {soporteOpen ? "▲" : "▼"}
                  </span>
                )}
              </button>
              {soporteOpen && (
                <div className="mt-2 space-y-1">
                  <Link
                    href="/configuraciones/soporte"
                    className={`flex items-center rounded-xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/soporte" ? "bg-white text-slate-900 shadow-lg" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                  >
                    {menuCollapsed ? "5.1" : "5.1 Solicitar un soporte"}
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {!menuCollapsed && (
            <div className="border-t border-white/10 p-4 text-[11px] text-white/45">
              <p>Un producto de Famiasistir</p>
              <p>Desarrollado por Printserp SAS</p>
            </div>
          )}
        </div>
      </aside>

      <section className={menuCollapsed ? "lg:pl-20" : "lg:pl-72"}>
        <header className="sticky top-0 z-20 bg-[#f4f5fa]/90 backdrop-blur px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-4 py-3 shadow-[0_10px_30px_rgba(79,70,229,0.22)] border border-white/40 text-white">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-xl p-2 text-white/90 hover:bg-white/15 lg:hidden"
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <div className="hidden sm:block">
              <p className="text-[11px] font-medium text-white/70">Hola,</p>
              <h1 className="text-sm font-bold text-white line-clamp-1">
                {nombreHeader}
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] font-medium text-white/70">
                  Sesión cliente
                </p>
                <p className="max-w-[150px] truncate text-xs font-semibold text-white sm:max-w-[240px]">
                  {user?.email || clienteSesion?.email || "cliente"}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarSesion}
                className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
          {mensaje && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${tipoMensaje === "ok" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"}`}
            >
              {mensaje}
            </div>
          )}

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Soporte / 5.1
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">
                  Solicitar soporte
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Registra solicitudes técnicas cuando haya errores, bugs o
                  fallas de plataforma. Usa soporte administrativo para dudas de
                  manejo, solicitudes operativas o peticiones sobre clientes y
                  configuración.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-[520px]">
                <div className="rounded-2xl bg-indigo-50 px-4 py-3">
                  <p className="text-xs font-black text-indigo-700">
                    Soporte administrativo
                  </p>
                  <p className="mt-1 break-all text-[11px] font-bold text-indigo-500">
                    {correoAdminSoporte ||
                      "Correo administrativo no configurado"}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-black text-emerald-700">
                    WhatsApp soporte
                  </p>
                  {whatsappSoporte ? (
                    <a
                      href={`https://wa.me/${whatsappSoporte}?text=${encodeURIComponent(`Hola, necesito soporte para ${nombreCliente}.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500"
                    >
                      Abrir WhatsApp
                    </a>
                  ) : (
                    <p className="mt-1 text-[11px] font-bold text-emerald-500">
                      WhatsApp no configurado
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <form
              onSubmit={guardarSoporte}
              className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]"
            >
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Nueva solicitud
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-800">
                  Crear soporte
                </h3>
              </div>
              <div className="mt-5 space-y-4">
                <Campo label="Tipo de soporte">
                  <select
                    value={tipoSoporte}
                    onChange={(e) =>
                      setTipoSoporte(e.target.value as TipoSoporte)
                    }
                    className={inputBase()}
                  >
                    <option value="tecnico">Técnico</option>
                    <option value="administrativo">Administrativo</option>
                  </select>
                </Campo>
                <Campo label="Módulo o página">
                  <input
                    value={modulo}
                    onChange={(e) => setModulo(e.target.value)}
                    className={inputBase()}
                    placeholder="Ej: verificaciones, usuarios, dashboard..."
                  />
                </Campo>
                <Campo label="Asunto">
                  <input
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    className={inputBase()}
                    placeholder="Resumen corto"
                    required
                  />
                </Campo>
                <Campo label="Descripción">
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={6}
                    className={inputBase()}
                    placeholder="Describe qué pasa, pasos para reproducirlo o la petición administrativa"
                    required
                  />
                </Campo>
                <Campo label="Prioridad">
                  <select
                    value={prioridad}
                    onChange={(e) =>
                      setPrioridad(e.target.value as PrioridadSoporte)
                    }
                    className={inputBase()}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </Campo>
                <Campo label="Evidencias">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) =>
                      setArchivos(Array.from(e.target.files || []))
                    }
                    className="w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500"
                  />
                  {archivos.length > 0 && (
                    <p className="mt-2 text-xs font-bold text-slate-400">
                      {archivos.length} archivo(s) seleccionado(s)
                    </p>
                  )}
                </Campo>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-300"
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-60"
                >
                  {guardando ? "Enviando..." : "Enviar soporte"}
                </button>
              </div>
            </form>

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                    Historial
                  </p>
                  <h3 className="mt-1 text-xl font-black text-slate-800">
                    Solicitudes realizadas
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:w-[620px]">
                  <Campo label="Buscar">
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className={inputBase()}
                      placeholder="Asunto, módulo..."
                    />
                  </Campo>
                  <Campo label="Tipo">
                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value as any)}
                      className={inputBase()}
                    >
                      <option value="todos">Todos</option>
                      <option value="tecnico">Técnico</option>
                      <option value="administrativo">Administrativo</option>
                    </select>
                  </Campo>
                  <Campo label="Estado">
                    <select
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value as any)}
                      className={inputBase()}
                    >
                      <option value="todos">Todos</option>
                      <option value="abierto">Abierto</option>
                      <option value="en proceso">En proceso</option>
                      <option value="resuelto">Resuelto</option>
                      <option value="cerrado">Cerrado</option>
                    </select>
                  </Campo>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-3">Solicitud</th>
                      <th className="px-3 py-3">Tipo</th>
                      <th className="px-3 py-3">Prioridad</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {solicitudesPaginadas.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-10 text-center text-xs font-bold text-slate-400"
                        >
                          Sin solicitudes para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      solicitudesPaginadas.map((item) => (
                        <tr key={item.id} className="align-top">
                          <td className="px-3 py-3">
                            <p className="font-black text-slate-700">
                              {item.asunto}
                            </p>
                            <p className="line-clamp-1 text-xs font-bold text-slate-400">
                              {item.modulo || "Sin módulo"}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-600">
                              {item.tipo}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${prioridadClase(item.prioridad)}`}
                            >
                              {item.prioridad}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${estadoClase(item.estado)}`}
                            >
                              {item.estado}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-bold text-slate-500">
                            {formatDateTime(
                              item.fechaSolicitud || item.createdAt,
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setDetalle(item)}
                              className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-400">
                <span>
                  Mostrando {solicitudesPaginadas.length} de{" "}
                  {solicitudesFiltradas.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="px-2 py-2">
                    {pagina}/{totalPaginas}
                  </span>
                  <button
                    type="button"
                    disabled={pagina >= totalPaginas}
                    onClick={() =>
                      setPagina((p) => Math.min(totalPaginas, p + 1))
                    }
                    className="rounded-xl bg-slate-100 px-3 py-2 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>
          </section>
        </div>
      </section>

      {detalle && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/75">
                  Detalle de soporte
                </p>
                <h3 className="text-lg font-black">{detalle.asunto}</h3>
                <p className="text-xs font-bold text-white/70">
                  {detalle.tipo} · {detalle.estado}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black text-white hover:bg-white/30"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                <section className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Descripción
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">
                    {detalle.descripcion}
                  </p>
                  {detalle.respuesta && (
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">
                        Respuesta
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-600">
                        {detalle.respuesta}
                      </p>
                    </div>
                  )}
                </section>
                <section className="rounded-3xl border border-slate-100 bg-white p-4 text-sm font-semibold text-slate-600">
                  <p>
                    <b>Cliente:</b> {detalle.clienteNombre}
                  </p>
                  <p className="mt-2">
                    <b>Solicitante:</b> {detalle.solicitanteNombre}
                  </p>
                  <p className="mt-2">
                    <b>Email:</b> {detalle.solicitanteEmail}
                  </p>
                  <p className="mt-2">
                    <b>Módulo:</b> {detalle.modulo || "N/A"}
                  </p>
                  <p className="mt-2">
                    <b>Destino:</b> {detalle.destino}
                  </p>
                  <p className="mt-2">
                    <b>Creado:</b>{" "}
                    {formatDateTime(
                      detalle.fechaSolicitud || detalle.createdAt,
                    )}
                  </p>
                </section>
              </div>
              <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Archivos adjuntos
                </p>
                {!detalle.archivos || detalle.archivos.length === 0 ? (
                  <p className="mt-3 text-xs font-bold text-slate-400">
                    Sin archivos adjuntos.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {detalle.archivos.map((archivo, index) => (
                      <a
                        key={`${archivo.path}-${index}`}
                        href={archivo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                      >
                        {archivo.nombre}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
