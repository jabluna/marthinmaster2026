"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

type ClienteSesion = {
  uid?: string;
  email?: string;
  clienteId?: string;
  nit?: string;
  razonSocial?: string;
};

type FacturaCliente = {
  mes?: string;
  estado?: string;
  fechaFactura?: string;
  fechaRadicacion?: string;
  fechaPago?: string;
  factura?: string;
  valor?: number | string;
  interesesMora?: number | string;
  recibo?: string;
  pagos?: Array<{ monto?: number | string; fecha?: string; recibo?: string; medio?: string; soporteUrl?: string }>;
  seguimientos?: Array<{ tipo?: string; observaciones?: string; fecha?: string }>;
  [key: string]: any;
};

type ClienteData = {
  nit?: string;
  Nit?: string;
  razonSocial?: string;
  nombreComercial?: string;
  IPS?: string;
  fechaInicioContrato?: string;
  FechaInicioContrato?: string;
  fechaVencimientoContrato?: string;
  FechaVencimientoContrato?: string;
  estadoServicio?: string;
  EstadoServicio?: string;
  logoUrl?: string;
  representante?: string;
  Representante?: string;
  facturasMora?: number | string;
  FacturasMora?: number | string;
  facturacion?: Record<string, FacturaCliente[]>;
  tipoMembresia?: string;
  TipoMembresia?: string;
  contratoUrl?: string;
  contratoURL?: string;
  Documentos?: {
    contrato?: {
      downloadURL?: string;
      url?: string;
    };
  };
  alarmasMedicamentos?: {
    rojo?: number;
    naranja?: number;
  };
  alarmasDocumentos?: {
    rojo?: number;
    naranja?: number;
    noAprobado?: boolean;
    no_aprobado?: boolean;
    vencido?: boolean;
    noCumple?: boolean;
    no_cumple?: boolean;
  };
  [key: string]: any;
};

const getText = (...values: unknown[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "N/A";
};

const getNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizarNit = (value: string) => value.replace(/[^0-9a-zA-Z]/g, "");

const formatoMoneda = (value: unknown) => {
  const numero = Number(value || 0);

  if (!Number.isFinite(numero) || numero === 0) {
    return "$0";
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numero);
};

const estadoFacturaClase = (estado?: string) => {
  const limpio = String(estado || "").toLowerCase();

  if (limpio.includes("mora") || limpio.includes("venc")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (limpio.includes("parcial")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (limpio.includes("pag") || limpio.includes("al día") || limpio.includes("al dia")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
};

export default function EmpresaClientePage() {
  const router = useRouter();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuContraido, setMenuContraido] = useState(false);
  const [configAbierta, setConfigAbierta] = useState(true);
  const [operativaAbierta, setOperativaAbierta] = useState(false);
  const [movilesAbierta, setMovilesAbierta] = useState(false);
  const [tareasAbierta, setTareasAbierta] = useState(false);
  const [soporteAbierta, setSoporteAbierta] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardandoMedicamentos, setGuardandoMedicamentos] = useState(false);
  const [guardandoDocumentos, setGuardandoDocumentos] = useState(false);
  const [enviandoPassword, setEnviandoPassword] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error">("ok");

  const [usuarioEmail, setUsuarioEmail] = useState("");
  const [usuarioNombre, setUsuarioNombre] = useState("Usuario");
  const [clienteId, setClienteId] = useState("");
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [facturasAnio, setFacturasAnio] = useState<FacturaCliente[]>([]);
  const [mostrarModalFacturas, setMostrarModalFacturas] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [mensajeLogo, setMensajeLogo] = useState("");

  const [medRojo, setMedRojo] = useState("");
  const [medNaranja, setMedNaranja] = useState("");

  const [docRojo, setDocRojo] = useState("");
  const [docNaranja, setDocNaranja] = useState("");
  const [docNoAprobado, setDocNoAprobado] = useState(false);
  const [docVencido, setDocVencido] = useState(false);
  const [docNoCumple, setDocNoCumple] = useState(false);

  const datosEmpresa = useMemo(() => {
    const data = cliente || {};
    const nit = getText(data.nit, data.Nit, clienteId);
    const razonSocial = getText(data.razonSocial, data.nombreComercial, data.IPS);
    const fechaInicio = getText(data.fechaInicioContrato, data.FechaInicioContrato);
    const fechaVencimiento = getText(data.fechaVencimientoContrato, data.FechaVencimientoContrato);
    const estadoServicio = getText(data.estadoServicio, data.EstadoServicio, "Activo");
    const facturasMora = getText(data.facturasMora, data.FacturasMora, 0);
    const membresia = getText(data.tipoMembresia, data.TipoMembresia, "Plan no definido");
    const contrato = getText(
      data.contratoUrl,
      data.contratoURL,
      data.Documentos?.contrato?.downloadURL,
      data.Documentos?.contrato?.url,
      ""
    );

    return {
      nit,
      razonSocial,
      fechaInicio,
      fechaVencimiento,
      estadoServicio,
      facturasMora,
      membresia,
      contrato,
    };
  }, [cliente, clienteId]);

  const logo = String(cliente?.logoUrl || "/logo.png");

  const mostrarMensaje = (texto: string, tipo: "ok" | "error" = "ok") => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    window.setTimeout(() => setMensaje(""), 3800);
  };

  const cargarCliente = async (id: string) => {
    const refCliente = doc(db, "clientes", id);
    const snapCliente = await getDoc(refCliente);

    if (!snapCliente.exists()) {
      setCliente(null);
      setFacturasAnio([]);
      mostrarMensaje("No se encontró la ficha del cliente.", "error");
      return;
    }

    const data = snapCliente.data() as ClienteData;
    setCliente(data);

    const representante = getText(data.representante, data.Representante, "");
    if (representante !== "N/A") {
      setUsuarioNombre(representante);
    }

    setMedRojo(String(data.alarmasMedicamentos?.rojo ?? ""));
    setMedNaranja(String(data.alarmasMedicamentos?.naranja ?? ""));

    setDocRojo(String(data.alarmasDocumentos?.rojo ?? ""));
    setDocNaranja(String(data.alarmasDocumentos?.naranja ?? ""));
    setDocNoAprobado(Boolean(data.alarmasDocumentos?.noAprobado ?? data.alarmasDocumentos?.no_aprobado));
    setDocVencido(Boolean(data.alarmasDocumentos?.vencido));
    setDocNoCumple(Boolean(data.alarmasDocumentos?.noCumple ?? data.alarmasDocumentos?.no_cumple));

    await cargarHistorialFacturas(id, data);
  };

  const cargarHistorialFacturas = async (id: string, dataCliente?: ClienteData) => {
    const anioActual = String(new Date().getFullYear());
    const desdeCampo = dataCliente?.facturacion?.[anioActual] || dataCliente?.facturacion?.["2026"] || [];

    if (Array.isArray(desdeCampo) && desdeCampo.length > 0) {
      setFacturasAnio(desdeCampo);
      return;
    }

    try {
      const refFacturacion = doc(db, "clientes", id, "facturacion", anioActual);
      const snapFacturacion = await getDoc(refFacturacion);

      if (snapFacturacion.exists()) {
        const dataFacturacion = snapFacturacion.data();
        const facturas = Array.isArray(dataFacturacion.facturas)
          ? dataFacturacion.facturas
          : Object.values(dataFacturacion || {});

        setFacturasAnio(facturas as FacturaCliente[]);
        return;
      }

      if (anioActual !== "2026") {
        const refFacturacion2026 = doc(db, "clientes", id, "facturacion", "2026");
        const snapFacturacion2026 = await getDoc(refFacturacion2026);

        if (snapFacturacion2026.exists()) {
          const dataFacturacion = snapFacturacion2026.data();
          const facturas = Array.isArray(dataFacturacion.facturas)
            ? dataFacturacion.facturas
            : Object.values(dataFacturacion || {});

          setFacturasAnio(facturas as FacturaCliente[]);
          return;
        }
      }

      setFacturasAnio([]);
    } catch (error) {
      console.error("Error cargando historial de facturas:", error);
      setFacturasAnio(Array.isArray(desdeCampo) ? desdeCampo : []);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login_users");
        return;
      }

      try {
        setCargando(true);
        const email = user.email || "";
        setUsuarioEmail(email);
        setUsuarioNombre(user.displayName || email.split("@")[0] || "Usuario");

        const sesionRaw = typeof window !== "undefined" ? window.localStorage.getItem("clienteSesion") : null;
        const sesion = sesionRaw ? (JSON.parse(sesionRaw) as ClienteSesion) : null;
        const id = normalizarNit(String(sesion?.clienteId || sesion?.nit || ""));

        if (!id) {
          router.replace("/login_users");
          return;
        }

        setClienteId(id);
        await cargarCliente(id);
      } catch (error) {
        console.error("Error cargando empresa:", error);
        mostrarMensaje("No fue posible cargar la información de la empresa.", "error");
      } finally {
        setCargando(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const guardarAlarmasMedicamentos = async () => {
    if (!clienteId) return;

    try {
      setGuardandoMedicamentos(true);
      const refCliente = doc(db, "clientes", clienteId);

      await setDoc(
        refCliente,
        {
          alarmasMedicamentos: {
            rojo: getNumber(medRojo),
            naranja: getNumber(medNaranja),
            actualizadoAt: new Date().toISOString(),
          },
        },
        { merge: true }
      );

      await cargarCliente(clienteId);
      mostrarMensaje("Alarmas de medicamentos guardadas correctamente.", "ok");
    } catch (error) {
      console.error("Error guardando alarmas medicamentos:", error);
      mostrarMensaje("No se pudieron guardar las alarmas de medicamentos.", "error");
    } finally {
      setGuardandoMedicamentos(false);
    }
  };

  const guardarAlarmasDocumentos = async () => {
    if (!clienteId) return;

    try {
      setGuardandoDocumentos(true);
      const refCliente = doc(db, "clientes", clienteId);

      await setDoc(
        refCliente,
        {
          alarmasDocumentos: {
            rojo: getNumber(docRojo),
            naranja: getNumber(docNaranja),
            noAprobado: docNoAprobado,
            vencido: docVencido,
            noCumple: docNoCumple,
            actualizadoAt: new Date().toISOString(),
          },
        },
        { merge: true }
      );

      await cargarCliente(clienteId);
      mostrarMensaje("Alarmas de documentos guardadas correctamente.", "ok");
    } catch (error) {
      console.error("Error guardando alarmas documentos:", error);
      mostrarMensaje("No se pudieron guardar las alarmas de documentos.", "error");
    } finally {
      setGuardandoDocumentos(false);
    }
  };

  const restablecerPassword = async () => {
    if (!usuarioEmail) return;

    try {
      setEnviandoPassword(true);
      await sendPasswordResetEmail(auth, usuarioEmail);
      mostrarMensaje("Te enviamos un correo para restablecer la contraseña.", "ok");
    } catch (error) {
      console.error("Error restableciendo contraseña:", error);
      mostrarMensaje("No fue posible enviar el correo de restablecimiento.", "error");
    } finally {
      setEnviandoPassword(false);
    }
  };

  const cambiarLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !clienteId) return;

    const maxBytes = 700 * 1024;

    if (!file.type.startsWith("image/")) {
      setMensajeLogo("Selecciona una imagen válida.");
      return;
    }

    if (file.size > maxBytes) {
      setMensajeLogo("El logo es muy pesado. Máximo recomendado: 700 KB.");
      return;
    }

    try {
      setSubiendoLogo(true);
      setMensajeLogo("");

      const storageRef = ref(storage, `clientes/${clienteId}/logo/logo_cliente`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);

      await setDoc(
        doc(db, "clientes", clienteId),
        { logoUrl: url, logoActualizadoAt: new Date().toISOString() },
        { merge: true }
      );

      setCliente((actual) => ({ ...(actual || {}), logoUrl: url }));
      setMensajeLogo("Logo actualizado correctamente.");
    } catch (error) {
      console.error("Error subiendo logo:", error);
      setMensajeLogo("No fue posible actualizar el logo.");
    } finally {
      setSubiendoLogo(false);
    }
  };

  const cerrarSesion = async () => {
    await signOut(auth);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("clienteSesion");
    }
    router.replace("/login_users");
  };

  const estadoClase = (() => {
    const estado = datosEmpresa.estadoServicio.toLowerCase();
    if (estado.includes("suspend") || estado.includes("mora") || estado.includes("inactivo")) {
      return "bg-red-50 text-red-700 ring-red-200";
    }
    if (estado.includes("parcial") || estado.includes("pendiente")) {
      return "bg-amber-50 text-amber-700 ring-amber-200";
    }
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  })();

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#f5f6fb] flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white px-8 py-7 shadow-sm border border-slate-100 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Cargando empresa...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6fb] text-slate-700">
      {menuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/35 xl:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white shadow-[0_0_35px_rgba(15,23,42,0.25)] transition-all duration-300 xl:translate-x-0 ${menuContraido ? "xl:w-20" : "xl:w-72"} ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className={`border-b border-white/10 ${menuContraido ? "px-3 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" title="Ir al inicio" className="min-w-0 flex-1">
                <img
                  src={logo}
                  alt="Marthin"
                  className={`h-12 object-contain ${menuContraido ? "mx-auto w-12" : "w-36 object-left"}`}
                />
              </Link>
              <button
                type="button"
                onClick={() => setMenuContraido((actual) => !actual)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-base font-black text-white transition hover:bg-white/20 xl:flex"
                title={menuContraido ? "Expandir menú" : "Encoger menú"}
                aria-label={menuContraido ? "Expandir menú" : "Encoger menú"}
              >
                ☰
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="ml-auto rounded-xl p-2 text-white/70 hover:bg-white/10 xl:hidden"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            {!menuContraido && (
              <>
                <label className="mt-1 block cursor-pointer text-[10px] font-bold text-sky-300 hover:text-white">
                  <input type="file" accept="image/*" onChange={cambiarLogo} className="hidden" />
                  {subiendoLogo ? "Subiendo logo..." : "Cambiar logo"}
                </label>
                {mensajeLogo && <p className="mt-1 text-[10px] font-semibold leading-4 text-white/45">{mensajeLogo}</p>}
                <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>
              </>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto py-5 text-sm font-semibold ${menuContraido ? "px-2" : "px-4"}`}>
            <Link
              href="/dashboard"
              title="Inicio"
              className={`flex items-center rounded-2xl px-4 py-3 transition ${menuContraido ? "justify-center" : "gap-3"} ${
                pathname === "/dashboard" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {menuContraido ? "I" : "Inicio"}
            </Link>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setConfigAbierta((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuContraido ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/empresa") || pathname.startsWith("/configuraciones/usuarios") || pathname.startsWith("/configuraciones/ubicaciones")
                    ? "bg-white/10 text-white"
                    : "text-white/80"
                }`}
                title="1. Configuraciones"
              >
                <span>{menuContraido ? "1" : "1. Configuraciones"}</span>
                {!menuContraido && <span className="text-xs text-white/45">{configAbierta ? "▲" : "▼"}</span>}
              </button>
              {!menuContraido && configAbierta && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/empresa" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/empresa" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.1 Empresa</Link>
                  <Link href="/configuraciones/usuarios" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/usuarios" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.2 Usuarios y Roles</Link>
                  <Link href="/configuraciones/ubicaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/ubicaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.3 Móviles y Bodegas</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOperativaAbierta((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuContraido ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/autoevaluacion") || pathname.startsWith("/configuraciones/asignaciones") ? "bg-white/10 text-white" : "text-white/80"
                }`}
                title="2. Área operativa"
              >
                <span>{menuContraido ? "2" : "2. Área operativa"}</span>
                {!menuContraido && <span className="text-xs text-white/45">{operativaAbierta ? "▲" : "▼"}</span>}
              </button>
              {!menuContraido && operativaAbierta && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/autoevaluacion" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/autoevaluacion" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>2.1 Autoevaluación General</Link>
                  <Link href="/configuraciones/asignaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/asignaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>2.2 Asignaciones a Móviles</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMovilesAbierta((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuContraido ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/verificaciones") || pathname.startsWith("/configuraciones/mantenimientos") || pathname.startsWith("/configuraciones/infracciones") ? "bg-white/10 text-white" : "text-white/80"
                }`}
                title="3. Móviles"
              >
                <span>{menuContraido ? "3" : "3. Móviles"}</span>
                {!menuContraido && <span className="text-xs text-white/45">{movilesAbierta ? "▲" : "▼"}</span>}
              </button>
              {!menuContraido && movilesAbierta && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/verificaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/verificaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.1 Verificación diaria</Link>
                  <Link href="/configuraciones/mantenimientos" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/mantenimientos" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.2 Programación de Mantenimientos</Link>
                  <Link href="/configuraciones/infracciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/infracciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.3 Gestión de Infracciones</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setTareasAbierta((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuContraido ? "justify-center" : "justify-between gap-3"} ${pathname.startsWith("/configuraciones/tareas") ? "bg-white/10 text-white" : "text-white/80"}`}
                title="4. Tareas"
              >
                <span>{menuContraido ? "4" : "4. Tareas"}</span>
                {!menuContraido && <span className="text-xs text-white/45">{tareasAbierta ? "▲" : "▼"}</span>}
              </button>
              {!menuContraido && tareasAbierta && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/tareas" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/tareas" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>4.1 Programar tareas</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSoporteAbierta((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuContraido ? "justify-center" : "justify-between gap-3"} ${pathname.startsWith("/configuraciones/soportea") ? "bg-white/10 text-white" : "text-white/80"}`}
                title="5. Soporte"
              >
                <span>{menuContraido ? "5" : "5. Soporte"}</span>
                {!menuContraido && <span className="text-xs text-white/45">{soporteAbierta ? "▲" : "▼"}</span>}
              </button>
              {!menuContraido && soporteAbierta && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/soportea" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/soportea" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>5.1 Solicitar un soporte</Link>
                </div>
              )}
            </div>
          </nav>

          {!menuContraido && (
            <div className="border-t border-white/10 p-4 text-[11px] text-white/40">
              Un producto de Famiasistir
              <br />
              Desarrollado por Printserp SAS
            </div>
          )}
        </div>
      </aside>

      <section className={`transition-all duration-300 ${menuContraido ? "xl:pl-[86px]" : "xl:pl-[270px]"}`}>
        <header className="sticky top-0 z-20 bg-[#f5f6fb]/90 backdrop-blur px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-4 py-3 shadow-[0_10px_30px_rgba(79,70,229,0.22)] border border-white/40 text-white">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-xl p-2 text-white/90 hover:bg-white/15 xl:hidden"
              aria-label="Abrir menú"
            >
              ☰
            </button>

            <div className="hidden sm:block min-w-0">
              <p className="text-[11px] font-medium text-white/70">Hola,</p>
              <h1 className="text-sm font-bold text-white truncate">{usuarioNombre}</h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] font-medium text-white/70">Sesión cliente</p>
                <p className="max-w-[150px] truncate text-xs font-semibold text-white sm:max-w-[240px]">
                  {usuarioEmail || "cliente"}
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

        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">Configuraciones</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-800">Empresa</h2>
            <p className="mt-1 text-sm text-slate-500">Datos generales, alarmas y acciones de la membresía.</p>
          </div>

          {mensaje && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-semibold border ${
                tipoMensaje === "ok"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : "bg-red-50 text-red-700 border-red-100"
              }`}
            >
              {mensaje}
            </div>
          )}

          <section className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">Datos de la empresa</h3>
              <p className="text-sm text-slate-500 mt-1">Resumen principal de la ficha del cliente.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4 font-black">Razón social</th>
                    <th className="px-5 py-4 font-black">NIT</th>
                    <th className="px-5 py-4 font-black">Inicio contrato</th>
                    <th className="px-5 py-4 font-black">Vencimiento</th>
                    <th className="px-5 py-4 font-black">Estado facturación</th>
                    <th className="px-5 py-4 font-black">Facturas mora</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-5 font-bold text-slate-800">{datosEmpresa.razonSocial}</td>
                    <td className="px-5 py-5 text-slate-600">{datosEmpresa.nit}</td>
                    <td className="px-5 py-5 text-slate-600">{datosEmpresa.fechaInicio}</td>
                    <td className="px-5 py-5 text-slate-600">{datosEmpresa.fechaVencimiento}</td>
                    <td className="px-5 py-5">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${estadoClase}`}>
                        {datosEmpresa.estadoServicio}
                      </span>
                    </td>
                    <td className="px-5 py-5 font-black text-slate-800">{datosEmpresa.facturasMora}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-5 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-800">Configuraciones de alerta</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Medicamentos. Las alertas de documentos se calculan desde cada documento cargado.
                  </p>
                </div>

                <div className="p-5">
                  <h4 className="text-sm font-black text-slate-800">Alarmas para medicamentos</h4>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <label className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <span className="block text-[11px] font-black uppercase tracking-wide text-red-500">Rojo</span>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={medRojo}
                          onChange={(e) => setMedRojo(e.target.value)}
                          placeholder="5"
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        />
                        <span className="text-xs font-semibold text-slate-400">días</span>
                      </div>
                    </label>

                    <label className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <span className="block text-[11px] font-black uppercase tracking-wide text-orange-500">Naranja</span>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={medNaranja}
                          onChange={(e) => setMedNaranja(e.target.value)}
                          placeholder="10"
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        />
                        <span className="text-xs font-semibold text-slate-400">días</span>
                      </div>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={guardarAlarmasMedicamentos}
                    disabled={guardandoMedicamentos}
                    className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
                  >
                    {guardandoMedicamentos ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </article>

              <article className="hidden rounded-3xl border border-dashed border-slate-200 bg-white/60 p-5 xl:block" />
              <article className="hidden rounded-3xl border border-dashed border-slate-200 bg-white/60 p-5 xl:block" />
              <article className="hidden rounded-3xl border border-dashed border-slate-200 bg-white/60 p-5 xl:block" />
            </div>
          </section>

          <section className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">Historial de facturas</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Información registrada en clientes/{datosEmpresa.nit}/facturacion/2026.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarModalFacturas(true)}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-indigo-500"
              >
                Ver historial completo
              </button>
            </div>

            <div className="p-5 sm:p-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-black">Facturas registradas</p>
                <p className="mt-2 text-2xl font-black text-slate-800">{facturasAnio.length}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-black">Facturas en mora</p>
                <p className="mt-2 text-2xl font-black text-red-600">{datosEmpresa.facturasMora}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-black">Último registro</p>
                <p className="mt-2 text-sm font-bold text-slate-700">
                  {facturasAnio.length > 0
                    ? `${getText(facturasAnio[0]?.mes)} · ${getText(facturasAnio[0]?.estado, "Pendiente")}`
                    : "Sin registros"}
                </p>
              </div>
            </div>
          </section>

          {mostrarModalFacturas && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 px-3 py-3 sm:items-center sm:p-6">
              <div className="w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 sm:px-6 py-5">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Historial de facturas</h3>
                    <p className="mt-1 text-sm text-slate-500">Año 2026 · {facturasAnio.length} registros</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarModalFacturas(false)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-4 font-black">Mes</th>
                        <th className="px-5 py-4 font-black">Factura</th>
                        <th className="px-5 py-4 font-black">Fecha factura</th>
                        <th className="px-5 py-4 font-black">Valor</th>
                        <th className="px-5 py-4 font-black">Intereses mora</th>
                        <th className="px-5 py-4 font-black">Pagos</th>
                        <th className="px-5 py-4 font-black">Estado</th>
                        <th className="px-5 py-4 font-black">Seguimientos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasAnio.length === 0 ? (
                        <tr className="border-t border-slate-100">
                          <td colSpan={8} className="px-5 py-8 text-center text-sm font-semibold text-slate-400">
                            No hay facturas registradas para mostrar.
                          </td>
                        </tr>
                      ) : (
                        facturasAnio.map((factura, index) => {
                          const totalPagos = Array.isArray(factura.pagos)
                            ? factura.pagos.reduce((acc, pago) => acc + getNumber(pago?.monto), 0)
                            : 0;

                          return (
                            <tr key={`${factura.mes || "mes"}-${index}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                              <td className="px-5 py-5 font-black text-slate-800">{getText(factura.mes)}</td>
                              <td className="px-5 py-5 text-slate-600">{getText(factura.factura)}</td>
                              <td className="px-5 py-5 text-slate-600">{getText(factura.fechaFactura, factura.fechaRadicacion)}</td>
                              <td className="px-5 py-5 font-bold text-slate-700">{formatoMoneda(factura.valor)}</td>
                              <td className="px-5 py-5 text-slate-600">{formatoMoneda(factura.interesesMora)}</td>
                              <td className="px-5 py-5 text-slate-600">{formatoMoneda(totalPagos)}</td>
                              <td className="px-5 py-5">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${estadoFacturaClase(factura.estado)}`}>
                                  {getText(factura.estado, "Pendiente")}
                                </span>
                              </td>
                              <td className="px-5 py-5 text-slate-600">
                                {Array.isArray(factura.seguimientos) && factura.seguimientos.length > 0 ? (
                                  <div className="space-y-1">
                                    {factura.seguimientos.map((seg, segIndex) => (
                                      <p key={segIndex} className="max-w-[320px] text-xs leading-5">
                                        <strong>{getText(seg.tipo, "Seguimiento")}:</strong> {getText(seg.observaciones, seg.fecha)}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">Sin seguimiento</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <section className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">Membresía y Acciones del Cliente</h3>
            </div>

            <div className="p-5 sm:p-6 grid md:grid-cols-3 gap-5">
              <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/60">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-black">Membresía actual</p>
                <p className="mt-2 text-lg font-black text-indigo-700">{datosEmpresa.membresia}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Vencimiento: <strong>{datosEmpresa.fechaVencimiento}</strong>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/60">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-black">Documento contrato</p>
                {datosEmpresa.contrato ? (
                  <a
                    href={datosEmpresa.contrato}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex w-full justify-center rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-black text-indigo-700 hover:bg-indigo-50"
                  >
                    Ver documento contrato
                  </a>
                ) : (
                  <p className="mt-3 rounded-xl bg-white border border-slate-100 px-4 py-3 text-sm font-semibold text-slate-400">
                    Contrato no disponible
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/60">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-black">Seguridad</p>
                <button
                  type="button"
                  onClick={restablecerPassword}
                  disabled={enviandoPassword}
                  className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {enviandoPassword ? "Enviando..." : "Restablecer contraseña"}
                </button>
                <p className="mt-2 text-xs leading-5 text-slate-500">Se enviará un correo para cambiar la contraseña.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
