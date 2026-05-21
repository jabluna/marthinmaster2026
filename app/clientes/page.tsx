"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useRouter } from "next/navigation";

type EstadoServicio = "Activo" | "Inactivo" | "Suspendido";
type TipoMembresia = "BASICA" | "PREMIUN";
type TabKey = "datos" | "documentos" | "facturacion" | "alertas";

type PermisosStaff = {
  verClientes: boolean;
  verPanelStaff: boolean;
  crearClientes: boolean;
  editarDatosPrincipales: boolean;
  editarDocumentos: boolean;
  verFacturacion: boolean;
  editarFacturacionFechaFactura: boolean;
  editarFacturacionFechaRadicacion: boolean;
  editarFacturacionValor: boolean;
  editarFacturacionEstado: boolean;
  editarFacturacionFechaPago: boolean;
  editarFacturacionMedio: boolean;
  gestionarPagos: boolean;
  verAlertasCartera: boolean;
  enviarCorreosCliente: boolean;
  enviarCorreosCartera: boolean;
};

type DocumentoCliente = {
  nombre: string;
  estado: "Pendiente" | "Cargado" | "Aprobado" | "Rechazado";
  url?: string;
  fechaCarga?: string;
};

type SeguimientoCartera = {
  tipo: string;
  fecha: string;
  observaciones?: string;
  obs?: string;
};

type AbonoFactura = {
  fecha?: string;
  recibo?: string;
  monto?: number;
  medio?: string;
  soporteUrl?: string;
  soporteNombre?: string;
};

type FacturaMes = {
  mes: string;
  factura?: string;
  fechaFactura?: string;
  fechaRadicacion?: string;
  valor?: number;
  estado?:
    | "Pendiente"
    | "Creada"
    | "Radicada"
    | "Mora"
    | "Pagado"
    | "Parcial"
    | "Anticipado"
    | "Anulado";
  fechaPago?: string;
  medio?: string;
  observacion?: string;
  seguimientos?: SeguimientoCartera[] | Record<string, SeguimientoCartera>;
  pagos?: AbonoFactura[];
  interesesMora?: number;
  anticipo?: {
    id?: string;
    fecha?: string;
    recibo?: string;
    valor?: number;
    valorTotal?: number;
    valorPorMes?: number;
    observacion?: string;
    mesesCubiertos?: string[];
    sourceMonth?: number;
    targetMonth?: number;
    recibosPorMes?: Array<{
      month: number;
      monthLabel: string;
      recibo?: string;
      valor?: number;
      fecha?: string;
    }>;
  };
};

type Cliente = {
  id: string;
  fecha?: string;
  asesor?: string;
  fechaDocumento?: string;
  fechaInicioContrato?: string;
  fechaVencimientoContrato?: string;
  numeroContrato?: string;
  tipoMembresia: TipoMembresia;
  fechaInstalacion?: string;
  codigoHabilitacion?: string;
  nit: string;
  razonSocial: string;
  numeroVehiculos?: string;
  sigla?: string;
  representante?: string;
  direccion?: string;
  ciudad: string;
  departamento?: string;
  correoElectronico: string;
  telefono1: string;
  telefono2?: string;
  correoFacturacion?: string;
  telefonoTesoreria?: string;
  nombreEncargadoPagos?: string;
  valorContratado?: string;
  descuentos?: string;
  descuentoMeses?: string;
  usuariosSistema?: string;
  estadoServicio: EstadoServicio;
  reqPersonalizacion: "NO" | "SI";
  detallePersonalizacion?: string;
  estadoCotizacion?: string;
  fechaEntregaPers?: string;
  cotizacionUrl?: string;
  documentos: Record<string, DocumentoCliente>;
  facturacion: Record<string, FacturaMes[]>;
  facturasMora?: number;
  cumplimientoDocumental?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const documentTypes = [
  { id: "contrato", name: "CONTRATO" },
  { id: "rut", name: "RUT" },
  { id: "camaraComercio", name: "CÁMARA DE COMERCIO" },
  { id: "cedulaRepresentante", name: "CÉDULA REPRESENTANTE" },
  { id: "copiaDelRep", name: "COPIA DEL REPS" },
  { id: "copiaResponsabilidad", name: "COPIA DE RESPONSABILIDAD" },
];

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const permisosAdmin: PermisosStaff = {
  verClientes: true,
  verPanelStaff: true,
  crearClientes: true,
  editarDatosPrincipales: true,
  editarDocumentos: true,
  verFacturacion: true,
  editarFacturacionFechaFactura: true,
  editarFacturacionFechaRadicacion: true,
  editarFacturacionValor: true,
  editarFacturacionEstado: true,
  editarFacturacionFechaPago: true,
  editarFacturacionMedio: true,
  gestionarPagos: true,
  verAlertasCartera: true,
  enviarCorreosCliente: true,
  enviarCorreosCartera: true,
};

const permisosVer: PermisosStaff = {
  verClientes: true,
  verPanelStaff: false,
  crearClientes: false,
  editarDatosPrincipales: false,
  editarDocumentos: false,
  verFacturacion: true,
  editarFacturacionFechaFactura: false,
  editarFacturacionFechaRadicacion: false,
  editarFacturacionValor: false,
  editarFacturacionEstado: false,
  editarFacturacionFechaPago: false,
  editarFacturacionMedio: false,
  gestionarPagos: false,
  verAlertasCartera: true,
  enviarCorreosCliente: false,
  enviarCorreosCartera: false,
};

const normalizarPermisos = (rol?: string, permisos?: Partial<PermisosStaff>): PermisosStaff => {
  if (rol === "admin") return { ...permisosAdmin, ...(permisos || {}) };
  return { ...permisosVer, ...(permisos || {}) };
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyDocuments = () =>
  documentTypes.reduce<Record<string, DocumentoCliente>>((acc, item) => {
    acc[item.id] = { nombre: item.name, estado: "Pendiente" };
    return acc;
  }, {});

const emptyBilling = () => {
  const year = String(new Date().getFullYear());
  return {
    [year]: months.map((mes) => ({
      mes,
      estado: "Pendiente" as FacturaMes["estado"],
    })),
  };
};

const emptyCliente = (): Cliente => ({
  id: "",
  fecha: today(),
  asesor: "",
  fechaDocumento: "",
  fechaInicioContrato: "",
  fechaVencimientoContrato: "",
  numeroContrato: "",
  tipoMembresia: "BASICA",
  fechaInstalacion: "",
  codigoHabilitacion: "",
  nit: "",
  razonSocial: "",
  numeroVehiculos: "",
  sigla: "",
  representante: "",
  direccion: "",
  ciudad: "",
  departamento: "",
  correoElectronico: "",
  telefono1: "",
  telefono2: "",
  correoFacturacion: "",
  telefonoTesoreria: "",
  nombreEncargadoPagos: "",
  valorContratado: "",
  descuentos: "",
  descuentoMeses: "",
  usuariosSistema: "",
  estadoServicio: "Activo",
  reqPersonalizacion: "NO",
  detallePersonalizacion: "",
  estadoCotizacion: "Cotizando",
  fechaEntregaPers: "",
  cotizacionUrl: "",
  documentos: emptyDocuments(),
  facturacion: emptyBilling(),
  facturasMora: 0,
  cumplimientoDocumental: 0,
});

const sanitizeNit = (value: string) =>
  value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();

const formatMoney = (value?: number | string) => {
  const numberValue = Number(value || 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numberValue);
};

const normalizarSeguimientos = (
  value?: FacturaMes["seguimientos"],
): SeguimientoCartera[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return Object.values(value);
};

const diasVencidosFactura = (fechaRadicacion?: string, diasMora = 30) => {
  if (!fechaRadicacion) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(`${fechaRadicacion}T00:00:00`);
  limite.setDate(limite.getDate() + diasMora);
  if (hoy <= limite) return 0;
  return Math.floor((hoy.getTime() - limite.getTime()) / 86400000);
};

export default function ClientesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [saludo, setSaludo] = useState("Usuario");
  const [rolStaff, setRolStaff] = useState("");
  const [permisosStaff, setPermisosStaff] = useState<PermisosStaff>(permisosVer);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteActual, setClienteActual] = useState<Cliente>(emptyCliente());
  const [tab, setTab] = useState<TabKey>("datos");
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [billingYear, setBillingYear] = useState(
    String(new Date().getFullYear()),
  );
  const [diasMora, setDiasMora] = useState(30);
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUsuario(user);

      try {
        const staffSnap = await getDoc(
          doc(db, "staff", user.phoneNumber || user.uid),
        );

        if (!staffSnap.exists()) {
          alert("Acceso denegado.");
          await signOut(auth);
          router.replace("/login");
          return;
        }

        const staff = staffSnap.data();
        const rol = String(staff.rol || "ver");
        const permisos = normalizarPermisos(rol, staff.permisos || {});

        if (!permisos.verClientes) {
          alert("No tienes permisos para ingresar a clientes.");
          await signOut(auth);
          router.replace("/login");
          return;
        }

        setRolStaff(rol);
        setPermisosStaff(permisos);
        setSaludo(
          staff.nombre ||
            staff.nombres ||
            staff.usuario ||
            user.phoneNumber ||
            "Usuario",
        );
      } catch (error) {
        console.error("Error validando permisos:", error);
        alert("Error validando permisos de usuario.");
        await signOut(auth);
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "clientes"), (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        ...emptyCliente(),
        ...item.data(),
        id: item.id,
      })) as Cliente[];

      setClientes(
        data.sort((a, b) =>
          (a.razonSocial || "").localeCompare(b.razonSocial || ""),
        ),
      );
    });

    return () => unsubscribe();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;

    return clientes.filter((cliente) =>
      [
        cliente.razonSocial,
        cliente.nit,
        cliente.ciudad,
        cliente.departamento,
        cliente.tipoMembresia,
        cliente.estadoServicio,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [clientes, busqueda]);

  const stats = useMemo(() => {
    const activos = clientes.filter(
      (c) => c.estadoServicio === "Activo",
    ).length;
    const suspendidos = clientes.filter(
      (c) => c.estadoServicio === "Suspendido",
    ).length;
    const mora = clientes.reduce(
      (total, c) => total + Number(c.facturasMora || 0),
      0,
    );

    return { total: clientes.length, activos, suspendidos, mora };
  }, [clientes]);

  const documentosAprobados = useMemo(() => {
    const docs = Object.values(clienteActual.documentos || {});
    if (!docs.length) return 0;
    return Math.round(
      (docs.filter((docu) => docu.estado === "Aprobado").length / docs.length) *
        100,
    );
  }, [clienteActual.documentos]);

  const billingRows = useMemo(() => {
    return (
      clienteActual.facturacion?.[billingYear] ||
      months.map((mes) => ({ mes, estado: "Pendiente" as const }))
    );
  }, [clienteActual.facturacion, billingYear]);

  const tabsDisponibles = useMemo(() => {
    return [
      { key: "datos" as TabKey, label: "Datos Principales", visible: true },
      { key: "documentos" as TabKey, label: "Documentos", visible: true },
      { key: "facturacion" as TabKey, label: "Facturación", visible: permisosStaff.verFacturacion },
      { key: "alertas" as TabKey, label: "Alertas de Cartera", visible: permisosStaff.verAlertasCartera },
    ].filter((item) => item.visible);
  }, [permisosStaff.verFacturacion, permisosStaff.verAlertasCartera]);

  useEffect(() => {
    if (tab === "facturacion" && !permisosStaff.verFacturacion) setTab("datos");
    if (tab === "alertas" && !permisosStaff.verAlertasCartera) setTab("datos");
  }, [tab, permisosStaff.verFacturacion, permisosStaff.verAlertasCartera]);

  const puedeGuardarCliente =
    rolStaff === "admin" ||
    permisosStaff.editarDatosPrincipales ||
    permisosStaff.editarDocumentos ||
    permisosStaff.editarFacturacionFechaFactura ||
    permisosStaff.editarFacturacionFechaRadicacion ||
    permisosStaff.editarFacturacionValor ||
    permisosStaff.editarFacturacionEstado ||
    permisosStaff.editarFacturacionFechaPago ||
    permisosStaff.editarFacturacionMedio ||
    permisosStaff.gestionarPagos;

  const solicitarCerrarModal = () => {
    if (cambiosSinGuardar) {
      const confirmar = window.confirm(
        "No ha guardado cambios. Si cierra, se perderá la información modificada. ¿Desea cerrar de todos modos?",
      );
      if (!confirmar) return;
    }

    setCambiosSinGuardar(false);
    setModalAbierto(false);
  };

  const openNuevoCliente = () => {
    setClienteActual(emptyCliente());
    setTab("datos");
    setMensaje("");
    setCambiosSinGuardar(false);
    setModalAbierto(true);
  };

  const openEditarCliente = (cliente: Cliente) => {
    setClienteActual({
      ...emptyCliente(),
      ...cliente,
      documentos: { ...emptyDocuments(), ...(cliente.documentos || {}) },
      facturacion: cliente.facturacion || emptyBilling(),
    });
    setBillingYear(String(new Date().getFullYear()));
    setTab("datos");
    setMensaje("");
    setCambiosSinGuardar(false);
    setModalAbierto(true);
  };

  const updateCliente = <K extends keyof Cliente>(
    field: K,
    value: Cliente[K],
  ) => {
    setCambiosSinGuardar(true);
    setClienteActual((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateDocumento = (id: string, patch: Partial<DocumentoCliente>) => {
    setCambiosSinGuardar(true);
    setClienteActual((prev) => ({
      ...prev,
      documentos: {
        ...prev.documentos,
        [id]: {
          ...(prev.documentos?.[id] || {
            nombre: documentTypes.find((d) => d.id === id)?.name || id,
            estado: "Pendiente",
          }),
          ...patch,
        },
      },
    }));
  };

  const updateFactura = (index: number, patch: Partial<FacturaMes>) => {
    setCambiosSinGuardar(true);
    setClienteActual((prev) => {
      const actualYearRows =
        prev.facturacion?.[billingYear] ||
        months.map((mes) => ({ mes, estado: "Pendiente" as const }));
      const updatedRows = actualYearRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      );

      return {
        ...prev,
        facturacion: {
          ...(prev.facturacion || {}),
          [billingYear]: updatedRows,
        },
      };
    });
  };

  const subirDocumento = async (id: string, file?: File) => {
    if (!file) return;

    const nitId = sanitizeNit(clienteActual.nit);
    if (!nitId) {
      setMensaje(
        "Primero ingresa el NIT del cliente antes de cargar documentos.",
      );
      return;
    }

    setSubiendo(id);

    try {
      const path = `clientes/${nitId}/documentos/${id}-${Date.now()}-${file.name}`;
      const storageReference = storageRef(storage, path);
      await uploadBytes(storageReference, file);
      const url = await getDownloadURL(storageReference);
      updateDocumento(id, {
        estado: "Cargado",
        url,
        fechaCarga: today(),
      });
      setMensaje("Documento cargado. Recuerda guardar el cliente.");
    } catch (error) {
      console.error(error);
      setMensaje("No fue posible cargar el documento.");
    } finally {
      setSubiendo("");
    }
  };

  const subirCotizacion = async (file?: File) => {
    if (!file) return;

    const nitId = sanitizeNit(clienteActual.nit);
    if (!nitId) {
      setMensaje("Primero ingresa el NIT antes de cargar la cotización.");
      return;
    }

    setSubiendo("cotizacion");

    try {
      const path = `clientes/${nitId}/personalizacion/cotizacion-${Date.now()}-${file.name}`;
      const storageReference = storageRef(storage, path);
      await uploadBytes(storageReference, file);
      const url = await getDownloadURL(storageReference);
      updateCliente("cotizacionUrl", url);
      setMensaje("Cotización cargada. Recuerda guardar el cliente.");
    } catch (error) {
      console.error(error);
      setMensaje("No fue posible cargar la cotización.");
    } finally {
      setSubiendo("");
    }
  };

  const guardarCliente = async () => {
    const nitId = sanitizeNit(clienteActual.nit);

    if (!nitId) {
      setMensaje(
        "El NIT es obligatorio. Si tiene dígito de verificación, escríbelo unido sin guion.",
      );
      setTab("datos");
      return;
    }

    if (
      !clienteActual.razonSocial.trim() ||
      !clienteActual.ciudad.trim() ||
      !clienteActual.correoElectronico.trim() ||
      !clienteActual.telefono1.trim()
    ) {
      setMensaje(
        "Completa los campos obligatorios: razón social, ciudad, correo y teléfono.",
      );
      setTab("datos");
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      const payload: Cliente & {
        resumen: Record<string, unknown>;
        datosCliente: Record<string, unknown>;
      } = {
        ...clienteActual,
        id: nitId,
        nit: nitId,
        cumplimientoDocumental: documentosAprobados,
        facturasMora: calcularFacturasMora(clienteActual.facturacion),
        resumen: {
          nit: nitId,
          razonSocial: clienteActual.razonSocial,
          ciudad: clienteActual.ciudad,
          estadoServicio: clienteActual.estadoServicio,
          tipoMembresia: clienteActual.tipoMembresia,
          correoElectronico: clienteActual.correoElectronico,
          telefono1: clienteActual.telefono1,
          cumplimientoDocumental: documentosAprobados,
          facturasMora: calcularFacturasMora(clienteActual.facturacion),
        },
        datosCliente: {
          contrato: {
            fecha: clienteActual.fecha,
            asesor: clienteActual.asesor,
            fechaDocumento: clienteActual.fechaDocumento,
            fechaInicioContrato: clienteActual.fechaInicioContrato,
            fechaVencimientoContrato: clienteActual.fechaVencimientoContrato,
            numeroContrato: clienteActual.numeroContrato,
            tipoMembresia: clienteActual.tipoMembresia,
            fechaInstalacion: clienteActual.fechaInstalacion,
            codigoHabilitacion: clienteActual.codigoHabilitacion,
          },
          empresa: {
            nit: nitId,
            razonSocial: clienteActual.razonSocial,
            sigla: clienteActual.sigla,
            representante: clienteActual.representante,
            direccion: clienteActual.direccion,
            ciudad: clienteActual.ciudad,
            departamento: clienteActual.departamento,
            correoElectronico: clienteActual.correoElectronico,
            telefono1: clienteActual.telefono1,
            telefono2: clienteActual.telefono2,
            numeroVehiculos: clienteActual.numeroVehiculos,
          },
          cartera: {
            correoFacturacion: clienteActual.correoFacturacion,
            telefonoTesoreria: clienteActual.telefonoTesoreria,
            nombreEncargadoPagos: clienteActual.nombreEncargadoPagos,
            valorContratado: clienteActual.valorContratado,
            descuentos: clienteActual.descuentos,
            descuentoMeses: clienteActual.descuentoMeses,
            usuariosSistema: clienteActual.usuariosSistema,
          },
          personalizacion: {
            reqPersonalizacion: clienteActual.reqPersonalizacion,
            detallePersonalizacion: clienteActual.detallePersonalizacion,
            estadoCotizacion: clienteActual.estadoCotizacion,
            fechaEntregaPers: clienteActual.fechaEntregaPers,
            cotizacionUrl: clienteActual.cotizacionUrl,
          },
        },
        updatedAt: serverTimestamp(),
        createdAt: clienteActual.createdAt || serverTimestamp(),
      };

      await setDoc(doc(db, "clientes", nitId), payload, { merge: true });
      setClienteActual(payload);
      setMensaje("Cliente guardado correctamente en Firestore.");
      setTimeout(() => setModalAbierto(false), 650);
    } catch (error) {
      console.error(error);
      setMensaje("No fue posible guardar el cliente.");
    } finally {
      setGuardando(false);
    }
  };

  const calcularFacturasMora = (facturacion?: Record<string, FacturaMes[]>) => {
    if (!facturacion) return 0;

    return Object.values(facturacion)
      .flat()
      .filter((row) => row.estado === "Mora" || row.estado === "Parcial")
      .length;
  };

  const cerrarSesion = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const estadoStyles: Record<EstadoServicio, string> = {
    Activo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Inactivo: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    Suspendido: "bg-red-500/15 text-red-300 border-red-500/30",
  };

  return (
    <main className="dashboard-light min-h-screen bg-slate-100 text-slate-900">
      <style jsx global>{`
        .dashboard-light {
          background: linear-gradient(
            135deg,
            #f8fafc 0%,
            #eef4ff 45%,
            #ffffff 100%
          ) !important;
          color: #0f172a !important;
        }
        .dashboard-light [class*="bg-white/"] {
          background-color: #ffffff !important;
        }
        .dashboard-light [class*="bg-black/"] {
          background-color: #ffffff !important;
        }
        .dashboard-light [class*="border-white/"] {
          border-color: rgba(15, 23, 42, 0.12) !important;
        }
        .dashboard-light [class*="text-white"] {
          color: #0f172a !important;
        }
        .dashboard-light [class*="text-slate-300"],
        .dashboard-light [class*="text-slate-500"],
        .dashboard-light [class*="text-slate-500"] {
          color: #475569 !important;
        }
        .dashboard-light input,
        .dashboard-light select,
        .dashboard-light textarea {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border-color: rgba(15, 23, 42, 0.16) !important;
        }
        .dashboard-light input::placeholder,
        .dashboard-light textarea::placeholder {
          color: #94a3b8 !important;
        }
        .dashboard-light table thead {
          background-color: #f1f5f9 !important;
        }
        .dashboard-light table tbody tr:hover {
          background-color: rgba(59, 130, 246, 0.06) !important;
        }
        .dashboard-light .divide-y > :not([hidden]) ~ :not([hidden]) {
          border-color: rgba(15, 23, 42, 0.09) !important;
        }
        .dashboard-light .shadow-2xl {
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.1) !important;
        }
        .dashboard-light .backdrop-blur-xl {
          backdrop-filter: none !important;
        }
        .dashboard-light header,
        .dashboard-light article,
        .dashboard-light section.rounded-3xl {
          background-color: #ffffff !important;
        }
        .dashboard-light button[class*="bg-white/"] {
          background-color: #f8fafc !important;
        }
        .dashboard-light button {
          position: relative;
          z-index: 2;
        }
        .dashboard-light .bg-blue-600 {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }
        .dashboard-light .bg-emerald-600 {
          background-color: #059669 !important;
          color: #ffffff !important;
        }
        .dashboard-light .text-amber-200 {
          color: #92400e !important;
        }
        .dashboard-light .force-white,
        .dashboard-light .force-white *,
        .dashboard-light button.force-white,
        .dashboard-light span.force-white {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }
        .dashboard-light button.force-white.bg-red-600,
        .dashboard-light .force-white.bg-red-600 {
          background-color: #dc2626 !important;
        }
        .dashboard-light button.force-white.bg-slate-900,
        .dashboard-light .force-white.bg-slate-900 {
          background-color: #0f172a !important;
        }
        .dashboard-light label {
          color: #334155 !important;
          font-weight: 600 !important;
        }
        .dashboard-light label span {
          color: #334155 !important;
          font-weight: 700 !important;
        }
        .dashboard-light input,
        .dashboard-light select,
        .dashboard-light textarea {
          color: #0f172a !important;
          background-color: #ffffff !important;
          font-weight: 500 !important;
        }
        .dashboard-light input::placeholder,
        .dashboard-light textarea::placeholder {
          color: #94a3b8 !important;
        }
        @keyframes pulse-yellow-soft {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
          }
        }
        @keyframes pulse-red-soft {
          0% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
          }
        }
        .factura-pendiente-crear {
          background: #fffbeb !important;
          border-color: #f59e0b !important;
          animation: pulse-yellow-soft 1.8s infinite;
        }
        .fecha-faltante-intermitente {
          background: #fffbeb !important;
          border-color: #f59e0b !important;
          animation: pulse-yellow-soft 1.8s infinite;
        }
        .estado-mora {
          animation: pulse-red-soft 1.8s infinite;
        }
      `}</style>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
              <Image
                src="/logo.png"
                alt="Marthin"
                width={46}
                height={46}
                className="h-11 w-11 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">
                Sistema Máster Marthin
              </p>
              <h1 className="text-2xl font-black">Gestión de Clientes</h1>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300">
              Hola, <span className="font-bold text-white">{saludo}</span>
            </div>
            {permisosStaff.verPanelStaff && (
              <button
                onClick={() => router.push("/staff")}
                className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-400/20"
              >
                Usuarios Staff
              </button>
            )}
            <button
              onClick={cerrarSesion}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard
            label="Clientes registrados"
            value={stats.total}
            helper="Base actual en Firestore"
          />
          <StatCard
            label="Activos"
            value={stats.activos}
            helper="Con servicio habilitado"
            tone="emerald"
          />
          <StatCard
            label="Suspendidos"
            value={stats.suspendidos}
            helper="Bloqueo administrativo"
            tone="red"
          />
          <StatCard
            label="Facturas en mora"
            value={stats.mora}
            helper="Mora o pago parcial"
            tone="amber"
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black">Clientes</h2>
              <p className="mt-1 text-sm text-slate-300">
                Crea, edita y controla datos, documentos, facturación y alertas
                de cartera.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por nombre, NIT, ciudad..."
                className="min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 sm:min-w-[320px]"
              />
              {permisosStaff.crearClientes && (
                <button
                  onClick={openNuevoCliente}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
                >
                  + Registrar Nuevo Cliente
                </button>
              )}
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-white/10 lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/10 text-xs uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-4 py-4">Razón Social</th>
                  <th className="px-4 py-4">NIT</th>
                  <th className="px-4 py-4">Ciudad</th>
                  <th className="px-4 py-4">Estado</th>
                  <th className="px-4 py-4">Membresía</th>
                  <th className="px-4 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {clientesFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No hay clientes registrados.
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className="transition hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-4">
                        <div className="font-bold text-white">
                          {cliente.razonSocial}
                        </div>
                        <div className="text-xs text-slate-500">
                          {cliente.correoElectronico}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-slate-300">
                        {cliente.nit}
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {cliente.ciudad}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${Number(cliente.facturasMora || 0) > 0 ? "border-red-300 bg-red-600 text-white" : estadoStyles[cliente.estadoServicio || "Activo"]}`}
                        >
                          {Number(cliente.facturasMora || 0) > 0 ? "En mora" : cliente.estadoServicio}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {cliente.tipoMembresia}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => openEditarCliente(cliente)}
                          className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                        >
                          Ver / Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {clientesFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-slate-500">
                No hay clientes registrados.
              </div>
            ) : (
              clientesFiltrados.map((cliente) => (
                <article
                  key={cliente.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{cliente.razonSocial}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        NIT {cliente.nit}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${estadoStyles[cliente.estadoServicio || "Activo"]}`}
                    >
                      {cliente.estadoServicio}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Ciudad</p>
                      <p className="font-bold">{cliente.ciudad}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">
                        Membresía
                      </p>
                      <p className="font-bold">{cliente.tipoMembresia}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openEditarCliente(cliente)}
                    className="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                  >
                    Ver / Editar
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-3 py-4 backdrop-blur">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">
                    Formulario de Contratación
                  </p>
                  <h2 className="text-2xl font-black">
                    {clienteActual.id
                      ? clienteActual.razonSocial || "Editar cliente"
                      : "Registrar Nuevo Cliente"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    El cliente se guarda en Firestore en{" "}
                    <span className="font-mono text-blue-700">
                      clientes/{sanitizeNit(clienteActual.nit) || "NIT"}
                    </span>
                    .
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={solicitarCerrarModal}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={guardarCliente}
                    disabled={guardando || !puedeGuardarCliente}
                    className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {guardando ? "Guardando..." : "Guardar Cliente"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <MiniPanel
                  label="Facturas en mora"
                  value={calcularFacturasMora(clienteActual.facturacion)}
                  tone="red"
                />
                <MiniPanel
                  label="Cumplimiento documental"
                  value={`${documentosAprobados}%`}
                  tone="emerald"
                />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Estado del Servicio
                  </label>
                  <select
                    value={clienteActual.estadoServicio}
                    onChange={(event) =>
                      updateCliente(
                        "estadoServicio",
                        event.target.value as EstadoServicio,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-400"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Suspendido">Suspendido</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {tabsDisponibles.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-bold transition ${
                      tab === key
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {label}
                      {key === "alertas" && calcularFacturasMora(clienteActual.facturacion) > 0 && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
                          {calcularFacturasMora(clienteActual.facturacion)}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {mensaje && (
                <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                  {mensaje}
                </div>
              )}

              {tab === "datos" && (
                <DatosTab
                  cliente={clienteActual}
                  updateCliente={updateCliente}
                  subirCotizacion={subirCotizacion}
                  subiendo={subiendo}
                  permisos={permisosStaff}
                />
              )}

              {tab === "documentos" && (
                <DocumentosTab
                  cliente={clienteActual}
                  updateDocumento={updateDocumento}
                  subirDocumento={subirDocumento}
                  subiendo={subiendo}
                  permisos={permisosStaff}
                />
              )}

              {tab === "facturacion" && permisosStaff.verFacturacion && (
                <FacturacionTab
                  billingYear={billingYear}
                  setBillingYear={setBillingYear}
                  rows={billingRows}
                  updateFactura={updateFactura}
                  diasMora={diasMora}
                  setDiasMora={setDiasMora}
                  clienteNit={clienteActual.nit}
                  cliente={clienteActual}
                  permisos={permisosStaff}
                />
              )}

              {tab === "alertas" && permisosStaff.verAlertasCartera && (
                <AlertasTab
                  cliente={clienteActual}
                  rows={billingRows}
                  billingYear={billingYear}
                  diasMora={diasMora}
                  updateFactura={updateFactura}
                  setMensaje={setMensaje}
                  permisos={permisosStaff}
                />
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
              <button
                onClick={solicitarCerrarModal}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar / Cerrar
              </button>
              <button
                onClick={guardarCliente}
                disabled={guardando}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  helper: string;
  tone?: "blue" | "emerald" | "red" | "amber";
}) {
  const toneClass = {
    blue: "text-blue-700",
    emerald: "text-emerald-300",
    red: "text-red-300",
    amber: "text-amber-300",
  }[tone];

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-4xl font-black ${toneClass}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </article>
  );
}

function MiniPanel({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "red" | "emerald";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-black ${tone === "red" ? "text-red-500" : "text-emerald-500"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-900">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-700 outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20";

function DatosTab({
  cliente,
  updateCliente,
  subirCotizacion,
  subiendo,
  permisos,
}: {
  cliente: Cliente;
  updateCliente: <K extends keyof Cliente>(field: K, value: Cliente[K]) => void;
  subirCotizacion: (file?: File) => void;
  subiendo: string;
  permisos: PermisosStaff;
}) {
  const puedeEditarDatos = permisos.editarDatosPrincipales;
  const disabledDatos = !puedeEditarDatos;

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
        <h3 className="mb-5 text-lg font-black">Datos del contrato</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Fecha">
            <input
              type="date"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.fecha || ""}
              onChange={(e) => updateCliente("fecha", e.target.value)}
            />
          </Field>
          <Field label="Asesor">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.asesor || ""}
              onChange={(e) => updateCliente("asesor", e.target.value)}
            />
          </Field>
          <Field label="Número de Contrato">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.numeroContrato || ""}
              onChange={(e) => updateCliente("numeroContrato", e.target.value)}
            />
          </Field>
          <Field label="Fecha Documento">
            <input
              type="date"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.fechaDocumento || ""}
              onChange={(e) => updateCliente("fechaDocumento", e.target.value)}
            />
          </Field>
          <Field label="Fecha Inicio Contrato">
            <input
              type="date"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.fechaInicioContrato || ""}
              onChange={(e) =>
                updateCliente("fechaInicioContrato", e.target.value)
              }
            />
          </Field>
          <Field label="Fecha Vencimiento Contrato">
            <input
              type="date"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.fechaVencimientoContrato || ""}
              onChange={(e) =>
                updateCliente("fechaVencimientoContrato", e.target.value)
              }
            />
          </Field>
          <Field label="Tipo Membresía">
            <select
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.tipoMembresia}
              onChange={(e) =>
                updateCliente("tipoMembresia", e.target.value as TipoMembresia)
              }
            >
              <option value="BASICA">Básica</option>
              <option value="PREMIUN">Premium</option>
            </select>
          </Field>
          <Field label="Fecha Instalación">
            <input
              type="date"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.fechaInstalacion || ""}
              onChange={(e) =>
                updateCliente("fechaInstalacion", e.target.value)
              }
            />
          </Field>
          <Field label="Código Habilitación">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.codigoHabilitacion || ""}
              onChange={(e) =>
                updateCliente("codigoHabilitacion", e.target.value)
              }
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
        <h3 className="mb-5 text-lg font-black">
          Datos principales del cliente
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="NIT" required>
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.nit}
              onChange={(e) =>
                updateCliente("nit", sanitizeNit(e.target.value))
              }
              placeholder="Sin guion. Ej: 9001234561"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Razón Social" required>
              <input
                className={inputClass}
              disabled={disabledDatos}
                value={cliente.razonSocial}
                onChange={(e) =>
                  updateCliente("razonSocial", e.target.value.toUpperCase())
                }
              />
            </Field>
          </div>
          <Field label="Sigla">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.sigla || ""}
              onChange={(e) =>
                updateCliente("sigla", e.target.value.toUpperCase())
              }
            />
          </Field>
          <Field label="Representante Legal">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.representante || ""}
              onChange={(e) => updateCliente("representante", e.target.value)}
            />
          </Field>
          <Field label="Dirección">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.direccion || ""}
              onChange={(e) => updateCliente("direccion", e.target.value)}
            />
          </Field>
          <Field label="Ciudad" required>
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.ciudad}
              onChange={(e) => updateCliente("ciudad", e.target.value)}
            />
          </Field>
          <Field label="Departamento">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.departamento || ""}
              onChange={(e) => updateCliente("departamento", e.target.value)}
            />
          </Field>
          <Field label="Correo Electrónico" required>
            <input
              type="email"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.correoElectronico}
              onChange={(e) =>
                updateCliente("correoElectronico", e.target.value)
              }
            />
          </Field>
          <Field label="Teléfono 1" required>
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.telefono1}
              onChange={(e) => updateCliente("telefono1", e.target.value)}
            />
          </Field>
          <Field label="Teléfono 2">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.telefono2 || ""}
              onChange={(e) => updateCliente("telefono2", e.target.value)}
            />
          </Field>
          <Field label="N° Vehículos">
            <input
              type="number"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.numeroVehiculos || ""}
              onChange={(e) => updateCliente("numeroVehiculos", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
        <h3 className="mb-5 text-lg font-black">Facturación y pagos</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Correo Facturación">
            <input
              type="email"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.correoFacturacion || ""}
              onChange={(e) =>
                updateCliente("correoFacturacion", e.target.value)
              }
            />
          </Field>
          <Field label="Teléfono Tesorería">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.telefonoTesoreria || ""}
              onChange={(e) =>
                updateCliente("telefonoTesoreria", e.target.value)
              }
            />
          </Field>
          <Field label="Encargado Pagos">
            <input
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.nombreEncargadoPagos || ""}
              onChange={(e) =>
                updateCliente("nombreEncargadoPagos", e.target.value)
              }
            />
          </Field>
          <Field label="Usuarios Sistema">
            <input
              type="number"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.usuariosSistema || ""}
              onChange={(e) => updateCliente("usuariosSistema", e.target.value)}
            />
          </Field>
          <Field label="Valor Contratado">
            <input
              type="number"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.valorContratado || ""}
              onChange={(e) => updateCliente("valorContratado", e.target.value)}
            />
          </Field>
          <Field label="Descuentos">
            <input
              type="number"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.descuentos || ""}
              onChange={(e) => updateCliente("descuentos", e.target.value)}
            />
          </Field>
          <Field label="Descuento por Meses">
            <input
              type="number"
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.descuentoMeses || ""}
              onChange={(e) => updateCliente("descuentoMeses", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
        <h3 className="mb-5 text-lg font-black">
          Soporte Técnico y Personalización
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="¿Requiere Personalización?">
            <select
              className={inputClass}
              disabled={disabledDatos}
              value={cliente.reqPersonalizacion}
              onChange={(e) =>
                updateCliente(
                  "reqPersonalizacion",
                  e.target.value as "NO" | "SI",
                )
              }
            >
              <option value="NO">NO</option>
              <option value="SI">SI</option>
            </select>
          </Field>

          {cliente.reqPersonalizacion === "SI" && (
            <>
              <Field label="Estado de Cotización">
                <select
                  className={inputClass}
              disabled={disabledDatos}
                  value={cliente.estadoCotizacion || "Cotizando"}
                  onChange={(e) =>
                    updateCliente("estadoCotizacion", e.target.value)
                  }
                >
                  <option value="Cotizando">Cotizando</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </Field>
              <Field label="Fecha Entrega Estimada">
                <input
                  type="date"
                  className={inputClass}
              disabled={disabledDatos}
                  value={cliente.fechaEntregaPers || ""}
                  onChange={(e) =>
                    updateCliente("fechaEntregaPers", e.target.value)
                  }
                />
              </Field>
              <Field label="Cotización">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className={inputClass}
              disabled={disabledDatos}
                  onChange={(e) => subirCotizacion(e.target.files?.[0])}
                />
              </Field>
              <div className="md:col-span-4">
                <Field label="Descripción de Personalización">
                  <textarea
                    className={`${inputClass} min-h-28`}
                    disabled={disabledDatos}
                    value={cliente.detallePersonalizacion || ""}
                    onChange={(e) =>
                      updateCliente("detallePersonalizacion", e.target.value)
                    }
                  />
                </Field>
                <div className="mt-3 flex items-center gap-3">
                  {subiendo === "cotizacion" && (
                    <span className="text-sm text-blue-700">
                      Subiendo cotización...
                    </span>
                  )}
                  {cliente.cotizacionUrl && (
                    <a
                      href={cliente.cotizacionUrl}
                      target="_blank"
                      className="text-sm font-bold text-blue-700 underline"
                    >
                      Ver cotización cargada
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function DocumentosTab({
  cliente,
  updateDocumento,
  subirDocumento,
  subiendo,
  permisos,
}: {
  cliente: Cliente;
  updateDocumento: (id: string, patch: Partial<DocumentoCliente>) => void;
  subirDocumento: (id: string, file?: File) => void;
  subiendo: string;
  permisos: PermisosStaff;
}) {
  const puedeEditarDocumentos = permisos.editarDocumentos;
  const docs = documentTypes.map((docu) => ({
    ...docu,
    data: cliente.documentos?.[docu.id] || {
      nombre: docu.name,
      estado: "Pendiente" as const,
    },
  }));

  const aprobado = docs.filter(
    (docu) => docu.data.estado === "Aprobado",
  ).length;
  const porcentaje = Math.round((aprobado / docs.length) * 100);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
      <div className="mb-5">
        <h3 className="text-lg font-black">Documentos legales</h3>
        <p className="mt-1 text-sm text-slate-500">
          Carga documentos y marca como aprobado para sumar al cumplimiento
          documental.
        </p>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-bold text-emerald-300">
          {porcentaje}% Cumplimiento
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {docs.map((docu) => (
          <article
            key={docu.id}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="font-black">{docu.name}</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Estado:{" "}
                  <span className="font-bold text-white">
                    {docu.data.estado}
                  </span>
                </p>
              </div>

              {docu.data.url && (
                <a
                  href={docu.data.url}
                  target="_blank"
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-white/20"
                >
                  Ver archivo
                </a>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                type="file"
                accept=".pdf,image/*"
                className={inputClass}
                disabled={!puedeEditarDocumentos}
                onChange={(event) => {
                  if (puedeEditarDocumentos) subirDocumento(docu.id, event.target.files?.[0]);
                }}
              />
              <select
                className={inputClass}
                disabled={!puedeEditarDocumentos}
                value={docu.data.estado}
                onChange={(event) =>
                  puedeEditarDocumentos && updateDocumento(docu.id, {
                    estado: event.target.value as DocumentoCliente["estado"],
                  })
                }
              >
                <option value="Pendiente">Pendiente</option>
                <option value="Cargado">Cargado</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Rechazado">Rechazado</option>
              </select>
            </div>

            {subiendo === docu.id && (
              <p className="mt-3 text-sm font-bold text-blue-700">
                Subiendo documento...
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function FacturacionTab({
  billingYear,
  setBillingYear,
  rows,
  updateFactura,
  diasMora,
  setDiasMora,
  clienteNit,
  cliente,
  permisos,
}: {
  billingYear: string;
  setBillingYear: (year: string) => void;
  rows: FacturaMes[];
  updateFactura: (index: number, patch: Partial<FacturaMes>) => void;
  diasMora: number;
  setDiasMora: (value: number) => void;
  clienteNit: string;
  cliente: Cliente;
  permisos: PermisosStaff;
}) {
  const years = Array.from({ length: 16 }, (_, i) =>
    String(new Date().getFullYear() + 5 - i),
  );
  const [pagoModalIndex, setPagoModalIndex] = useState<number | null>(null);
  const [resumenModalIndex, setResumenModalIndex] = useState<number | null>(null);
  const [reciboModalIndex, setReciboModalIndex] = useState<number | null>(null);
  const [anticipoIndex, setAnticipoIndex] = useState<number | null>(null);
  const [soporteAbono, setSoporteAbono] = useState<File | null>(null);
  const [subiendoSoporte, setSubiendoSoporte] = useState(false);
  const [nuevoAbono, setNuevoAbono] = useState<AbonoFactura>({
    fecha: today(),
    recibo: "",
    monto: 0,
    medio: "",
  });
  const [nuevoAnticipo, setNuevoAnticipo] = useState({
    fecha: today(),
    recibo: "",
    valor: 0,
    observacion: "Pago anticipado de mensualidades",
    mesesCubiertos: [] as string[],
  });

  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const puedeEditarNumeroFechaFactura = permisos.editarFacturacionFechaFactura;
  const puedeEditarFechaRadicacion = permisos.editarFacturacionFechaRadicacion;
  const puedeEditarValorFactura = permisos.editarFacturacionValor;
  const puedeEditarEstadoFactura = permisos.editarFacturacionEstado;
  const puedeEditarFechaPago = permisos.editarFacturacionFechaPago;
  const puedeEditarMedio = permisos.editarFacturacionMedio;
  const puedeGestionarPagos = permisos.gestionarPagos;
  const puedeEditarAlgunaFacturacion =
    puedeEditarNumeroFechaFactura ||
    puedeEditarFechaRadicacion ||
    puedeEditarValorFactura ||
    puedeEditarEstadoFactura ||
    puedeEditarFechaPago ||
    puedeEditarMedio ||
    puedeGestionarPagos;

  const isCurrentBillingMonth = (index: number) =>
    Number(billingYear) === currentYear && index === currentMonthIndex;
  const isPastBillingMonth = (index: number) =>
    Number(billingYear) < currentYear ||
    (Number(billingYear) === currentYear && index < currentMonthIndex);
  const isFutureBillingMonth = (index: number) =>
    Number(billingYear) > currentYear ||
    (Number(billingYear) === currentYear && index > currentMonthIndex);

  const totalPagado = (row: FacturaMes) =>
    (row.pagos || []).reduce(
      (total, pago) => total + Number(pago.monto || 0),
      0,
    );
  const totalFactura = (row: FacturaMes) =>
    Number(row.valor || 0) + Number(row.interesesMora || 0);
  const saldoFactura = (row: FacturaMes) =>
    Math.max(totalFactura(row) - totalPagado(row), 0);

  const daysBetween = (from?: string) => {
    if (!from) return 0;
    const start = new Date(`${from}T00:00:00`);
    const now = new Date();
    if (Number.isNaN(start.getTime())) return 0;
    return Math.floor((now.getTime() - start.getTime()) / 86400000);
  };

  const rowRequiresFactura = (row: FacturaMes, index: number) =>
    isCurrentBillingMonth(index) && !row.factura;
  const rowRequiresDates = (row: FacturaMes, index: number) =>
    isCurrentBillingMonth(index) &&
    !!row.factura &&
    (!row.fechaFactura || !row.fechaRadicacion);
  const rowIsMora = (row: FacturaMes) =>
    row.estado === "Mora" ||
    (!!row.fechaRadicacion &&
      saldoFactura(row) > 0 &&
      daysBetween(row.fechaRadicacion) > diasMora);

  const updateEstadoAutomatico = (
    index: number,
    patch: Partial<FacturaMes>,
  ) => {
    const current = {
      ...(rows[index] || { mes: months[index] }),
      ...patch,
    } as FacturaMes;
    const saldo = saldoFactura(current);
    const total = totalFactura(current);

    let estado = current.estado || "Pendiente";
    if (current.estado !== "Anulado") {
      if (total > 0 && saldo <= 0 && (current.pagos || []).length)
        estado = "Pagado";
      else if (total > 0 && (current.pagos || []).length && saldo > 0)
        estado = "Parcial";
      else if (
        current.fechaRadicacion &&
        saldo > 0 &&
        daysBetween(current.fechaRadicacion) > diasMora
      )
        estado = "Mora";
      else if (current.fechaRadicacion) estado = "Radicada";
      else if (current.factura || current.fechaFactura || current.valor)
        estado = "Creada";
      else estado = "Pendiente";
    }

    updateFactura(index, { ...patch, estado: estado as FacturaMes["estado"] });
  };

  const agregarAbono = async () => {
    if (pagoModalIndex === null) return;
    const row = rows[pagoModalIndex];
    const monto = Number(nuevoAbono.monto || 0);
    if (!monto || monto <= 0) return;

    let soporteUrl = nuevoAbono.soporteUrl || "";
    let soporteNombre = nuevoAbono.soporteNombre || "";

    if (soporteAbono) {
      const nitId = sanitizeNit(clienteNit);
      if (!nitId) {
        alert("Primero guarde o ingrese el NIT del cliente para cargar soportes.");
        return;
      }

      setSubiendoSoporte(true);
      try {
        const safeMonth = row.mes.replace(/[^0-9A-Za-zÁÉÍÓÚáéíóúñÑ_-]/g, "_");
        const path = `clientes/${nitId}/facturacion/${billingYear}/${safeMonth}/soportes/${Date.now()}-${soporteAbono.name}`;
        const storageReference = storageRef(storage, path);
        await uploadBytes(storageReference, soporteAbono);
        soporteUrl = await getDownloadURL(storageReference);
        soporteNombre = soporteAbono.name;
      } catch (error) {
        console.error(error);
        alert("No fue posible cargar el soporte del abono.");
        setSubiendoSoporte(false);
        return;
      } finally {
        setSubiendoSoporte(false);
      }
    }

    const pagos = [
      ...(row.pagos || []),
      { ...nuevoAbono, monto, soporteUrl, soporteNombre },
    ];
    const fechaPago = nuevoAbono.fecha || today();
    updateEstadoAutomatico(pagoModalIndex, { pagos, fechaPago });
    setNuevoAbono({ fecha: today(), recibo: "", monto: 0, medio: "" });
    setSoporteAbono(null);
  };

  const eliminarAbono = (paymentIndex: number) => {
    if (pagoModalIndex === null) return;
    const row = rows[pagoModalIndex];
    const pagos = (row.pagos || []).filter((_, idx) => idx !== paymentIndex);
    updateEstadoAutomatico(pagoModalIndex, { pagos });
  };

  const abrirModalAnticipo = (sourceIndex: number) => {
    const row = rows[sourceIndex];
    setAnticipoIndex(sourceIndex);
    setNuevoAnticipo({
      fecha: today(),
      recibo: row.anticipo?.recibo || "",
      valor: Number(row.anticipo?.valorTotal || row.anticipo?.valor || row.valor || 0),
      observacion: row.anticipo?.observacion || "Pago anticipado de membresía",
      mesesCubiertos: (row.anticipo?.mesesCubiertos || []).filter(
        (mes) => months.indexOf(mes) > sourceIndex,
      ),
    });
  };

  const incrementarRecibo = (base: string, offset: number) => {
    const limpio = (base || '').trim();
    if (!limpio) return `RCA-${String(Date.now()).slice(-6)}-${offset + 1}`;
    const match = limpio.match(/^(.*?)(\d+)$/);
    if (!match) return offset === 0 ? limpio : `${limpio}-${offset + 1}`;
    const prefix = match[1];
    const numero = match[2];
    return `${prefix}${String(Number(numero) + offset).padStart(numero.length, '0')}`;
  };

  const guardarAnticipo = () => {
    if (anticipoIndex === null) return;
    const valorTotal = Number(nuevoAnticipo.valor || 0);
    if (!nuevoAnticipo.fecha) {
      alert("La fecha del recibo es obligatoria.");
      return;
    }
    if (!valorTotal || valorTotal <= 0) {
      alert("El valor anticipado debe ser mayor a cero.");
      return;
    }
    if (!nuevoAnticipo.mesesCubiertos.length) {
      alert("Seleccione al menos un mes a cubrir.");
      return;
    }

    const sourceMonthName = rows[anticipoIndex].mes;
    const selectedMonthNames = nuevoAnticipo.mesesCubiertos;
    const mesesCubiertos = [sourceMonthName, ...selectedMonthNames];
    const valorPorMes = Math.round((valorTotal / mesesCubiertos.length) * 100) / 100;
    const anticipoId = `ANT-${Date.now()}`;
    const recibosPorMes = mesesCubiertos.map((mes, idx) => {
      const monthIndex = months.indexOf(mes);
      return {
        month: monthIndex + 1,
        monthLabel: `${mes} ${billingYear}`,
        recibo: incrementarRecibo(nuevoAnticipo.recibo, idx),
        valor: valorPorMes,
        fecha: nuevoAnticipo.fecha,
      };
    });

    mesesCubiertos.forEach((mes) => {
      const targetIndex = months.indexOf(mes);
      if (targetIndex < 0) return;
      const reciboMes = recibosPorMes.find((rec) => rec.month === targetIndex + 1);
      const baseAnticipo = {
        id: anticipoId,
        fecha: nuevoAnticipo.fecha,
        recibo: reciboMes?.recibo || nuevoAnticipo.recibo,
        valor: valorPorMes,
        valorTotal,
        valorPorMes,
        observacion: nuevoAnticipo.observacion,
        mesesCubiertos,
        sourceMonth: anticipoIndex + 1,
        targetMonth: targetIndex + 1,
        recibosPorMes,
      };

      if (targetIndex === anticipoIndex) {
        updateFactura(targetIndex, {
          estado: "Pagado",
          valor: valorPorMes,
          fechaPago: nuevoAnticipo.fecha,
          medio: "Anticipado",
          anticipo: baseAnticipo,
          pagos: [
            ...(rows[targetIndex].pagos || []),
            {
              fecha: nuevoAnticipo.fecha,
              recibo: reciboMes?.recibo || nuevoAnticipo.recibo,
              monto: valorPorMes,
              medio: "Anticipado",
            },
          ],
        });
      } else {
        updateFactura(targetIndex, {
          estado: "Anticipado",
          valor: rows[targetIndex].valor || valorPorMes,
          fechaPago: nuevoAnticipo.fecha,
          medio: "Anticipado",
          anticipo: baseAnticipo,
        });
      }
    });

    setAnticipoIndex(null);
  };

  const estadoClass = (estado?: FacturaMes["estado"]) => {
    switch (estado) {
      case "Creada":
        return "bg-blue-600 text-white border-blue-600";
      case "Radicada":
        return "bg-violet-600 text-white border-violet-600";
      case "Mora":
        return "bg-red-600 text-white border-red-600 estado-mora";
      case "Pagado":
        return "bg-emerald-600 text-white border-emerald-600";
      case "Parcial":
        return "bg-amber-300 text-slate-900 border-amber-300";
      case "Anticipado":
        return "bg-orange-500 text-white border-orange-500";
      case "Anulado":
        return "bg-slate-500 text-white border-slate-500";
      default:
        return "bg-white text-slate-900 border-slate-200";
    }
  };

  const selectedPagoRow = pagoModalIndex !== null ? rows[pagoModalIndex] : null;
  const selectedResumenRow = resumenModalIndex !== null ? rows[resumenModalIndex] : null;
  const selectedReciboRow = reciboModalIndex !== null ? rows[reciboModalIndex] : null;
  const selectedAnticipoRow = anticipoIndex !== null ? rows[anticipoIndex] : null;
  const mesesDisponiblesAnticipo = anticipoIndex !== null
    ? rows.map((row, idx) => ({ row, idx })).filter(({ idx }) => idx > anticipoIndex)
    : [];
  const valorAnticipoPorMes =
    anticipoIndex !== null
      ? Number(nuevoAnticipo.valor || 0) /
        Math.max(1, nuevoAnticipo.mesesCubiertos.length + 1)
      : 0;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50">
        <div className="rounded-t-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white">
          Facturación de Personalización
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-4">
          <Field label="Valor Personalización">
            <input type="number" className={inputClass} placeholder="0.00" disabled={!puedeEditarValorFactura} />
          </Field>
          <Field label="Fecha Facturación">
            <input type="date" className={inputClass} disabled={!puedeEditarNumeroFechaFactura} />
          </Field>
          <Field label="Estado Pago">
            <select className={inputClass} defaultValue="Pendiente" disabled={!puedeEditarEstadoFactura}>
              <option value="Pendiente">Pendiente</option>
              <option value="Pagado">Pagado</option>
              <option value="Anulado">Anulado</option>
            </select>
          </Field>
          <div className="flex items-end text-sm text-slate-500">
            Este cobro es independiente a la mensualidad.
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-black">Días para Mora:</label>
          <input
            type="number"
            className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none"
            value={diasMora}
            disabled={!puedeEditarEstadoFactura}
            onChange={(event) => setDiasMora(Number(event.target.value || 0))}
          />
          <span className="text-xs text-slate-500">
            Días posteriores a la radicación.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-black">Año Fiscal:</label>
          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none"
            value={billingYear}
            onChange={(e) => setBillingYear(e.target.value)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-3 text-sm italic text-slate-500">
        Solo el mes actual permite crear o editar factura, fechas, valor y
        pagos. Meses antiguos quedan bloqueados; meses futuros permiten
        registrar pago anticipado.
      </p>

      <div className="overflow-visible rounded-2xl border border-slate-200">
        <table className="w-full table-fixed text-left text-[11px] xl:text-xs">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-2 py-2">Mes</th>
              <th className="px-2 py-2">N° Factura</th>
              <th className="px-2 py-2">Fecha Factura</th>
              <th className="px-2 py-2">Fecha Radicación</th>
              <th className="px-2 py-2">Valor Factura</th>
              <th className="px-2 py-2">Pagos y Abonos</th>
              <th className="px-2 py-2">Estado</th>
              <th className="px-2 py-2">Fecha Último Pago</th>
              <th className="px-2 py-2">Medio</th>
              <th className="px-2 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const current = isCurrentBillingMonth(index);
              const future = isFutureBillingMonth(index);
              const past = isPastBillingMonth(index);
              const locked = !current;
              const total = totalFactura(row);
              const pagado = totalPagado(row);
              const saldo = saldoFactura(row);
              const faltaFactura = rowRequiresFactura(row, index);
              const faltanFechas = rowRequiresDates(row, index);
              const mora = rowIsMora(row);
              const estado =
                mora && row.estado !== "Pagado" && row.estado !== "Anulado"
                  ? "Mora"
                  : row.estado;

              return (
                <tr
                  key={`${billingYear}-${row.mes}`}
                  className={
                    past
                      ? "bg-slate-50"
                      : future
                        ? "bg-slate-50/70"
                        : "bg-white"
                  }
                >
                  <td className="px-2 py-2 font-black text-slate-800">
                    {row.mes}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${faltaFactura ? "factura-pendiente-crear" : "border-slate-200 bg-white"}`}
                      value={row.factura || ""}
                      disabled={locked || !puedeEditarNumeroFechaFactura}
                      placeholder={current ? "N° factura" : ""}
                      onChange={(e) =>
                        updateEstadoAutomatico(index, {
                          factura: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${faltanFechas && !row.fechaFactura ? "fecha-faltante-intermitente" : "border-slate-200 bg-white"}`}
                      value={row.fechaFactura || ""}
                      disabled={locked || !puedeEditarNumeroFechaFactura}
                      onChange={(e) =>
                        updateEstadoAutomatico(index, {
                          fechaFactura: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${faltanFechas && !row.fechaRadicacion ? "fecha-faltante-intermitente" : "border-slate-200 bg-white"}`}
                      value={row.fechaRadicacion || ""}
                      disabled={locked || !puedeEditarFechaRadicacion}
                      onChange={(e) =>
                        updateEstadoAutomatico(index, {
                          fechaRadicacion: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      value={row.valor || ""}
                      disabled={locked || !puedeEditarValorFactura}
                      onChange={(e) =>
                        updateEstadoAutomatico(index, {
                          valor: Number(e.target.value || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex w-full flex-col gap-1">
                      <button
                        type="button"
                        disabled={!current || !total || !puedeGestionarPagos}
                        onClick={() => puedeGestionarPagos && setPagoModalIndex(index)}
                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Gestionar
                      </button>
                      <span className="text-xs text-slate-500">
                        Pagado: {formatMoney(pagado)} · Saldo:{" "}
                        {formatMoney(saldo)}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className={`w-full rounded-xl border px-3 py-2 text-sm font-black outline-none ${estadoClass(estado)}`}
                      value={estado || "Pendiente"}
                      disabled={past || !puedeEditarEstadoFactura}
                      onChange={(e) => {
                        const nextEstado = e.target
                          .value as FacturaMes["estado"];
                        if (nextEstado === "Anticipado") {
                          abrirModalAnticipo(index);
                          return;
                        }

                        if (future) return;

                        updateFactura(index, {
                          estado: nextEstado,
                        });
                      }}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Creada">Creada</option>
                      <option value="Radicada">Radicada</option>
                      <option value="Mora">Mora</option>
                      <option value="Pagado">Pagado</option>
                      <option value="Parcial">Parcial</option>
                      <option value="Anticipado">Pago Anticipado</option>
                      <option value="Anulado">Anulado</option>
                    </select>
                    {mora && (
                      <div className="mt-1 text-xs font-bold text-red-600">
                        {daysBetween(row.fechaRadicacion)} días desde radicación
                      </div>
                    )}
                    {row.anticipo && (
                      <div className="mt-1 rounded-lg bg-orange-100 px-2 py-1 text-[10px] font-black text-orange-700">
                        Anticipo: {formatMoney(row.anticipo.valor || 0)}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      value={row.fechaPago || ""}
                      disabled={locked || !puedeEditarFechaPago}
                      onChange={(e) =>
                        updateEstadoAutomatico(index, {
                          fechaPago: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                      value={row.medio || ""}
                      disabled={locked || !puedeEditarMedio}
                      placeholder="Banco / Caja"
                      onChange={(e) =>
                        updateEstadoAutomatico(index, { medio: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex w-full flex-col gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-600 disabled:opacity-40"
                        disabled={
                          !puedeEditarAlgunaFacturacion ||
                          (locked &&
                            !row.factura &&
                            !row.valor &&
                            !(row.pagos || []).length)
                        }
                        onClick={() =>
                          updateFactura(index, {
                            factura: "",
                            fechaFactura: "",
                            fechaRadicacion: "",
                            valor: 0,
                            pagos: [],
                            fechaPago: "",
                            medio: "",
                            estado: "Pendiente",
                            anticipo: undefined,
                          })
                        }
                      >
                        Limpiar
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-600 disabled:opacity-40"
                        disabled={
                          !row.factura &&
                          !row.valor &&
                          !(row.pagos || []).length &&
                          !row.anticipo
                        }
                        onClick={() => setResumenModalIndex(index)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-40"
                        disabled={!(row.pagos || []).length && !row.anticipo}
                        onClick={() => setReciboModalIndex(index)}
                      >
                        Recibo
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedPagoRow && pagoModalIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-emerald-600 px-6 py-4 text-white">
              <h4 className="text-lg font-black">
                Gestión de Factura y Pagos - Mes: {selectedPagoRow.mes}
              </h4>
              <button
                type="button"
                className="text-2xl font-black"
                onClick={() => setPagoModalIndex(null)}
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <Field label="Fecha Factura">
                  <input
                    type="date"
                    className={inputClass}
                    value={selectedPagoRow.fechaFactura || ""}
                    disabled={!isCurrentBillingMonth(pagoModalIndex) || !puedeEditarNumeroFechaFactura}
                    onChange={(e) =>
                      updateEstadoAutomatico(pagoModalIndex, {
                        fechaFactura: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Valor Total Factura">
                  <input
                    type="number"
                    className={inputClass}
                    value={selectedPagoRow.valor || ""}
                    disabled={!isCurrentBillingMonth(pagoModalIndex) || !puedeEditarValorFactura}
                    onChange={(e) =>
                      updateEstadoAutomatico(pagoModalIndex, {
                        valor: Number(e.target.value || 0),
                      })
                    }
                  />
                </Field>
                <Field label="Intereses Mora">
                  <input
                    type="number"
                    className={inputClass}
                    value={selectedPagoRow.interesesMora || ""}
                    disabled={!isCurrentBillingMonth(pagoModalIndex) || !puedeEditarValorFactura}
                    onChange={(e) =>
                      updateEstadoAutomatico(pagoModalIndex, {
                        interesesMora: Number(e.target.value || 0),
                      })
                    }
                  />
                </Field>
                <div className="rounded-2xl bg-white p-4 text-right shadow-sm">
                  <p className="text-sm font-bold text-emerald-700">
                    Total Abonado: {formatMoney(totalPagado(selectedPagoRow))}
                  </p>
                  <p className="mt-1 text-xl font-black text-red-600">
                    Saldo: {formatMoney(saldoFactura(selectedPagoRow))}
                  </p>
                </div>
              </div>

              <h5 className="mt-6 font-black">Registrar Nuevo Abono</h5>
              <div className="mt-3 grid gap-3 md:grid-cols-5">
                <Field label="Fecha Pago">
                  <input
                    type="date"
                    className={inputClass}
                    value={nuevoAbono.fecha || ""}
                    disabled={!puedeGestionarPagos}
                    onChange={(e) =>
                      setNuevoAbono((prev) => ({
                        ...prev,
                        fecha: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="N° Recibo">
                  <input
                    className={inputClass}
                    placeholder="N° Recibo"
                    value={nuevoAbono.recibo || ""}
                    disabled={!puedeGestionarPagos}
                    onChange={(e) =>
                      setNuevoAbono((prev) => ({
                        ...prev,
                        recibo: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Monto a abonar">
                  <input
                    type="number"
                    className={inputClass}
                    placeholder="Monto"
                    value={nuevoAbono.monto || ""}
                    disabled={!puedeGestionarPagos}
                    onChange={(e) =>
                      setNuevoAbono((prev) => ({
                        ...prev,
                        monto: Number(e.target.value || 0),
                      }))
                    }
                  />
                </Field>
                <Field label="Soporte (Opcional)">
                  <input
                    type="file"
                    className={inputClass}
                    accept="image/*,.pdf"
                    disabled={!puedeGestionarPagos}
                    onChange={(e) => puedeGestionarPagos && setSoporteAbono(e.target.files?.[0] || null)}
                  />
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-60"
                    onClick={agregarAbono}
                    disabled={subiendoSoporte || !puedeGestionarPagos}
                  >
                    {subiendoSoporte ? "Cargando..." : "Abonar"}
                  </button>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-2 py-2 text-left">Fecha</th>
                      <th className="px-2 py-2 text-left"># Recibo</th>
                      <th className="px-2 py-2 text-left">Monto Abonado</th>
                      <th className="px-2 py-2 text-left">Comprobante</th>
                      <th className="px-2 py-2 text-left">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedPagoRow.pagos || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-4 text-center text-slate-500"
                        >
                          No hay abonos registrados.
                        </td>
                      </tr>
                    ) : (
                      (selectedPagoRow.pagos || []).map((pago, idx) => (
                        <tr key={`${pago.recibo}-${idx}`}>
                          <td className="px-2 py-2">{pago.fecha || "-"}</td>
                          <td className="px-2 py-2">{pago.recibo || "-"}</td>
                          <td className="px-3 py-3 font-black">
                            {formatMoney(pago.monto || 0)}
                          </td>
                          <td className="px-2 py-2">
                            {pago.soporteUrl ? (
                              <a
                                href={pago.soporteUrl}
                                target="_blank"
                                className="font-bold text-blue-600 underline"
                              >
                                Ver soporte
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={!puedeGestionarPagos}
                              onClick={() => puedeGestionarPagos && eliminarAbono(idx)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h5 className="font-black text-slate-900">Seguimientos de Cartera</h5>
                  <p className="mt-1 text-sm text-slate-500">
                    Observaciones registradas desde Alertas de Cartera para este mes.
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {normalizarSeguimientos(selectedPagoRow.seguimientos).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                          No hay seguimientos registrados para este mes.
                        </td>
                      </tr>
                    ) : (
                      normalizarSeguimientos(selectedPagoRow.seguimientos).map((seg, idx) => (
                        <tr key={`${seg.fecha}-${idx}`}>
                          <td className="px-3 py-2 font-bold text-slate-900">{seg.tipo}</td>
                          <td className="px-3 py-2 text-slate-700">{seg.fecha}</td>
                          <td className="px-3 py-2 text-slate-700">{seg.observaciones || seg.obs || "Sin observaciones"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}


      {selectedResumenRow && resumenModalIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-blue-600 px-6 py-4 text-white">
              <h4 className="text-lg font-black">
                Resumen de factura - {selectedResumenRow.mes} {billingYear}
              </h4>
              <button
                type="button"
                className="text-2xl font-black"
                onClick={() => setResumenModalIndex(null)}
              >
                ×
              </button>
            </div>
            <div className="grid gap-3 p-6 md:grid-cols-2">
              <Info label="Mes" value={`${selectedResumenRow.mes} ${billingYear}`} />
              <Info label="Estado" value={selectedResumenRow.estado || "Pendiente"} />
              <Info label="N° Factura" value={selectedResumenRow.factura || "Sin factura"} />
              <Info label="Fecha factura" value={selectedResumenRow.fechaFactura || "Sin fecha"} />
              <Info label="Fecha radicación" value={selectedResumenRow.fechaRadicacion || "Sin fecha"} />
              <Info label="Fecha último pago" value={selectedResumenRow.fechaPago || "Sin pago"} />
              <Info label="Valor factura" value={formatMoney(selectedResumenRow.valor || 0)} />
              <Info label="Intereses mora" value={formatMoney(selectedResumenRow.interesesMora || 0)} />
              <Info label="Total abonado" value={formatMoney(totalPagado(selectedResumenRow))} />
              <Info label="Saldo pendiente" value={formatMoney(saldoFactura(selectedResumenRow))} />
            </div>
            {selectedResumenRow.anticipo && (
              <div className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-black">Pago anticipado aplicado</p>
                <p className="mt-1">
                  Recibo: {selectedResumenRow.anticipo.recibo || "-"} · Valor: {formatMoney(selectedResumenRow.anticipo.valor || 0)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedReciboRow && reciboModalIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 text-slate-900">
              <h4 className="text-2xl font-black">Recibo de caja</h4>
              <button
                type="button"
                className="text-4xl font-light text-slate-500"
                onClick={() => setReciboModalIndex(null)}
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                {(() => {
                  const pagosRecibo = (selectedReciboRow.pagos || []).length
                    ? selectedReciboRow.pagos || []
                    : selectedReciboRow.anticipo
                      ? [{
                          fecha: selectedReciboRow.anticipo.fecha,
                          recibo: selectedReciboRow.anticipo.recibo,
                          monto: selectedReciboRow.anticipo.valor,
                          medio: "Anticipado",
                        }]
                      : [];
                  const reciboPrincipal = pagosRecibo[0]?.recibo || selectedReciboRow.anticipo?.recibo || selectedReciboRow.factura || "-";
                  const fechaPrincipal = pagosRecibo[0]?.fecha || selectedReciboRow.fechaPago || selectedReciboRow.anticipo?.fecha || today();
                  const totalRecibo = pagosRecibo.reduce((total, pago) => total + Number(pago.monto || 0), 0);

                  return (
                    <>
                      <div className="mb-5">
                        <h3 className="text-3xl font-black text-slate-900">Recibo de Caja</h3>
                        <p className="mt-3 text-lg text-slate-800"><strong>Número:</strong> {reciboPrincipal}</p>
                        <p className="mt-1 text-lg text-slate-800"><strong>Fecha:</strong> {fechaPrincipal}</p>
                      </div>

                      <div className="my-6 h-px bg-slate-300" />

                      <div className="mb-6 grid gap-4 text-lg md:grid-cols-3">
                        <p><strong>Cliente:</strong> {cliente.razonSocial || "-"}</p>
                        <p><strong>NIT:</strong> {cliente.nit || "-"}</p>
                        <p><strong>Ciudad:</strong> {cliente.ciudad || "-"}</p>
                      </div>

                      <div className="overflow-hidden border border-slate-300">
                        <table className="w-full text-lg">
                          <thead className="bg-slate-50 text-slate-900">
                            <tr>
                              <th className="border-r border-slate-300 px-3 py-3 text-left">Concepto</th>
                              <th className="border-r border-slate-300 px-3 py-3 text-left">Mes</th>
                              <th className="border-r border-slate-300 px-3 py-3 text-left">Recibo</th>
                              <th className="px-3 py-3 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagosRecibo.map((pago, idx) => (
                              <tr key={`${pago.recibo}-${idx}`} className="border-t border-slate-300">
                                <td className="border-r border-slate-300 px-3 py-3">
                                  {selectedReciboRow.anticipo ? "Pago anticipado de membresía" : "Pago / abono de factura"}
                                </td>
                                <td className="border-r border-slate-300 px-3 py-3">{selectedReciboRow.mes} {billingYear}</td>
                                <td className="border-r border-slate-300 px-3 py-3">{pago.recibo || "-"}</td>
                                <td className="px-3 py-3 text-right font-black">{formatMoney(pago.monto || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50">
                            <tr className="border-t border-slate-300">
                              <th colSpan={3} className="border-r border-slate-300 px-3 py-4 text-right">Total registrado</th>
                              <th className="px-3 py-4 text-right text-xl">{formatMoney(totalRecibo)}</th>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="mt-6 text-lg">
                        <p className="font-black">Observación:</p>
                        <p className="mt-2">{selectedReciboRow.anticipo?.observacion || selectedReciboRow.observacion || "Sin observación"}</p>
                        {selectedReciboRow.anticipo && (
                          <p className="mt-6 text-base text-slate-500">
                            Este recibo corresponde a un pago anticipado y no reemplaza las facturas mensuales.
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-black text-slate-700"
              >
                Imprimir
              </button>
              <button
                type="button"
                onClick={() => setReciboModalIndex(null)}
                className="rounded-2xl bg-slate-600 px-6 py-3 font-black text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {anticipoIndex !== null && selectedAnticipoRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-amber-400 px-6 py-4 text-slate-900">
              <h4 className="text-lg font-black">Registrar pago anticipado</h4>
              <button
                type="button"
                className="text-2xl font-black"
                onClick={() => setAnticipoIndex(null)}
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Registre el valor recibido y marque los meses futuros que quedarán cubiertos. El valor se divide automáticamente entre el mes origen y los meses seleccionados. En los meses futuros no se crea factura; solo queda el anticipo hasta que ese mes sea el mes actual.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Mes origen">
                  <input
                    className={inputClass}
                    value={`${selectedAnticipoRow.mes} ${billingYear}`}
                    readOnly
                  />
                </Field>
                <Field label="Fecha recibo" required>
                  <input
                    type="date"
                    className={inputClass}
                    value={nuevoAnticipo.fecha}
                    onChange={(e) =>
                      setNuevoAnticipo((prev) => ({
                        ...prev,
                        fecha: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="No. Recibo">
                  <input
                    className={inputClass}
                    placeholder="RC-0001"
                    value={nuevoAnticipo.recibo}
                    onChange={(e) =>
                      setNuevoAnticipo((prev) => ({
                        ...prev,
                        recibo: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Valor recibido" required>
                  <input
                    type="number"
                    className={inputClass}
                    value={nuevoAnticipo.valor || ""}
                    onChange={(e) =>
                      setNuevoAnticipo((prev) => ({
                        ...prev,
                        valor: Number(e.target.value || 0),
                      }))
                    }
                  />
                </Field>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase text-emerald-700">
                    Valor por mes
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-800">
                    {formatMoney(valorAnticipoPorMes || 0)}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Incluye mes origen + {nuevoAnticipo.mesesCubiertos.length} mes(es) seleccionado(s).
                  </p>
                </div>
                <Field label="Observación">
                  <input
                    className={inputClass}
                    value={nuevoAnticipo.observacion}
                    onChange={(e) =>
                      setNuevoAnticipo((prev) => ({
                        ...prev,
                        observacion: e.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="font-black text-slate-900">Meses a cubrir</h5>
                    <p className="text-sm text-slate-500">
                      El mes origen se incluye automáticamente. Solo puedes marcar meses posteriores.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                    {nuevoAnticipo.mesesCubiertos.length} seleccionados
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <input type="checkbox" checked readOnly className="h-4 w-4" />
                    <span className="font-black text-emerald-800">
                      {selectedAnticipoRow.mes} {billingYear} · origen
                    </span>
                  </label>

                  {mesesDisponiblesAnticipo.map(({ row }) => {
                    const checked = nuevoAnticipo.mesesCubiertos.includes(row.mes);
                    return (
                      <label
                        key={row.mes}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                          checked
                            ? "border-amber-400 bg-amber-50 text-amber-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-amber-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={(e) => {
                            setNuevoAnticipo((prev) => ({
                              ...prev,
                              mesesCubiertos: e.target.checked
                                ? [...prev.mesesCubiertos, row.mes]
                                : prev.mesesCubiertos.filter((mes) => mes !== row.mes),
                            }));
                          }}
                        />
                        <span className="font-black">
                          {row.mes} {billingYear}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-2xl bg-slate-200 px-5 py-3 font-black text-slate-800"
                  onClick={() => setAnticipoIndex(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-amber-500 px-5 py-3 font-black text-white shadow-lg shadow-amber-500/20"
                  onClick={guardarAnticipo}
                >
                  Guardar anticipo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 font-black text-slate-900">{value}</div>
    </div>
  );
}

function AlertasTab({
  cliente,
  rows,
  billingYear,
  diasMora,
  updateFactura,
  setMensaje,
  permisos,
}: {
  cliente: Cliente;
  rows: FacturaMes[];
  billingYear: string;
  diasMora: number;
  updateFactura: (index: number, patch: Partial<FacturaMes>) => void;
  setMensaje: (value: string) => void;
  permisos: PermisosStaff;
}) {
  const [seguimientoIndex, setSeguimientoIndex] = useState<number | null>(null);
  const [tipoSeguimiento, setTipoSeguimiento] = useState("");
  const [obsSeguimiento, setObsSeguimiento] = useState("");
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);

  const alertas = rows.filter(
    (row) => row.estado === "Mora" || row.estado === "Parcial",
  );
  const correo = cliente.correoFacturacion || cliente.correoElectronico;
  const rowSeguimiento = seguimientoIndex !== null ? rows[seguimientoIndex] : null;
  const seguimientosActuales = normalizarSeguimientos(rowSeguimiento?.seguimientos);

  const agregarSeguimiento = () => {
    if (seguimientoIndex === null || !rowSeguimiento) return;
    if (!tipoSeguimiento.trim() && !obsSeguimiento.trim()) return;

    const nuevoSeguimiento: SeguimientoCartera = {
      tipo: tipoSeguimiento.trim() || "Seguimiento",
      fecha: today(),
      observaciones: obsSeguimiento.trim() || "Sin observaciones",
    };

    updateFactura(seguimientoIndex, {
      seguimientos: [...normalizarSeguimientos(rowSeguimiento.seguimientos), nuevoSeguimiento],
    });

    setTipoSeguimiento("");
    setObsSeguimiento("");
  };

  const enviarAlertaCorreo = async () => {
    if (!correo) {
      window.alert("Este cliente no tiene correo de facturación o correo principal registrado.");
      return;
    }

    if (!alertas.length) {
      window.alert("No hay facturas en mora o pago parcial para enviar.");
      return;
    }

    const detalleTexto = alertas
      .map((item) => {
        const dias = diasVencidosFactura(item.fechaRadicacion, diasMora);
        return `• ${item.mes} ${billingYear} | Factura: ${item.factura || "S/N"} | Fecha factura: ${item.fechaFactura || "Sin fecha"} | Fecha radicación: ${item.fechaRadicacion || "Sin fecha"} | Valor: ${formatMoney(item.valor || 0)} | Estado: ${item.estado || ""} | ${dias > 0 ? `${dias} días vencida` : "Saldo pendiente"}`;
      })
      .join("\n");

    const detalleHtml = alertas
      .map((item) => {
        const dias = diasVencidosFactura(item.fechaRadicacion, diasMora);
        return `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;">${item.mes} ${billingYear}</td>
            <td style="padding:8px;border:1px solid #ddd;">${item.factura || "S/N"}</td>
            <td style="padding:8px;border:1px solid #ddd;">${item.fechaFactura || "Sin fecha"}</td>
            <td style="padding:8px;border:1px solid #ddd;">${item.fechaRadicacion || "Sin fecha"}</td>
            <td style="padding:8px;border:1px solid #ddd;">${formatMoney(item.valor || 0)}</td>
            <td style="padding:8px;border:1px solid #ddd;">${item.estado || ""}</td>
            <td style="padding:8px;border:1px solid #ddd;">${dias > 0 ? `${dias} días` : "Pendiente"}</td>
          </tr>`;
      })
      .join("");

    setEnviandoCorreo(true);

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: "service_ybahyy2",
          template_id: "template_alerta_cartera",
          user_id: "ZnTClNQDNH6BiD1K1",
          template_params: {
            to_email: correo,
            to_name: cliente.razonSocial || "Cliente",
            client_name: cliente.razonSocial || "Cliente",
            nit: cliente.nit,
            facturas_mora_count: alertas.length,
            overdue_count: alertas.length,
            billing_year: billingYear,
            overdue_summary: detalleTexto,
            overdue_summary_html: `<table style="border-collapse:collapse;width:100%;"><thead><tr><th style="padding:8px;border:1px solid #ddd;">Mes</th><th style="padding:8px;border:1px solid #ddd;">No. Factura</th><th style="padding:8px;border:1px solid #ddd;">Fecha factura</th><th style="padding:8px;border:1px solid #ddd;">Fecha radicación</th><th style="padding:8px;border:1px solid #ddd;">Valor</th><th style="padding:8px;border:1px solid #ddd;">Estado</th><th style="padding:8px;border:1px solid #ddd;">Mora</th></tr></thead><tbody>${detalleHtml}</tbody></table>`,
            subject: `Alerta de cartera - ${cliente.razonSocial || cliente.nit}`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setMensaje(`Alerta de cartera enviada correctamente a ${correo}.`);
      window.alert(`Alerta de cartera enviada correctamente a ${correo}`);
    } catch (error) {
      console.error("Error enviando alerta de cartera:", error);
      window.alert("No fue posible enviar la alerta de cartera. Revisa el Service ID, Template ID y variables del template en EmailJS.");
    } finally {
      setEnviandoCorreo(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">Alertas de Cartera</h3>
          <p className="mt-1 text-sm text-slate-500">
            Facturas con atención requerida: mora o pago parcial.
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="text-xs font-black uppercase tracking-wider text-red-500">
            Facturas con atención requerida
          </p>
          <p className="text-4xl font-black text-red-600">{alertas.length}</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Correo destino sugerido</p>
        <p className="mt-1 font-black text-slate-900">
          {correo || "Sin correo registrado"}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="font-black text-slate-900">Gestión y Seguimiento de Cartera (Mora y Pagos Parciales):</h4>
          <p className="mt-1 text-sm text-slate-500">
            El correo de alerta incluirá facturas en mora o pago parcial, fecha de factura, fecha de radicación, valor y días vencidos.
          </p>
        </div>
        <button
          type="button"
          disabled={!alertas.length || enviandoCorreo || !permisos.enviarCorreosCartera}
          onClick={enviarAlertaCorreo}
          className="force-white rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
        >
          {enviandoCorreo ? "Enviando..." : permisos.enviarCorreosCartera ? "Enviar Alerta por Correo" : "Sin permiso para enviar"}
        </button>
      </div>

      <div className="grid gap-3">
        {alertas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500">
            No se encontraron facturas en mora o pago parcial.
          </div>
        ) : (
          alertas.map((row) => {
            const rowIndex = rows.findIndex((item) => item.mes === row.mes);
            const diasVencida = diasVencidosFactura(row.fechaRadicacion, diasMora);
            return (
              <article
                key={row.mes}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-black text-slate-900">
                      Factura #{row.factura || "S/N"} ({row.mes})
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Fecha factura: {row.fechaFactura || "Sin fecha"} · Valor: {formatMoney(row.valor || 0)}
                    </p>
                    <span className="force-white mt-2 inline-flex rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                      {diasVencida > 0 ? `${diasVencida} días vencida` : "Saldo pendiente"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!permisos.gestionarPagos}
                    onClick={() => permisos.gestionarPagos && setSeguimientoIndex(rowIndex)}
                    className="force-white rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                  >
                    Seguimiento
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {rowSeguimiento && seguimientoIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h4 className="font-black text-slate-900">
                Seguimiento Cartera - Factura: {rowSeguimiento.factura || "S/N"}
              </h4>
              <button
                type="button"
                className="text-2xl text-slate-500"
                onClick={() => setSeguimientoIndex(null)}
              >
                ×
              </button>
            </div>
            <div className="p-5">
              <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                <input
                  className={inputClass}
                  placeholder="Tipo (ej. Llamada)"
                  value={tipoSeguimiento}
                  onChange={(e) => setTipoSeguimiento(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Observaciones"
                  value={obsSeguimiento}
                  onChange={(e) => setObsSeguimiento(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!permisos.gestionarPagos}
                  onClick={agregarSeguimiento}
                  className="force-white rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {seguimientosActuales.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                          No hay seguimientos registrados.
                        </td>
                      </tr>
                    ) : (
                      seguimientosActuales.map((seg, idx) => (
                        <tr key={`${seg.fecha}-${idx}`}>
                          <td className="px-3 py-2 font-bold">{seg.tipo}</td>
                          <td className="px-3 py-2">{seg.fecha}</td>
                          <td className="px-3 py-2">{seg.observaciones || seg.obs || "Sin observaciones"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

