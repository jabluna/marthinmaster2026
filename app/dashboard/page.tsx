"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
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

type ClienteData = {
  razonSocial?: string;
  nombreComercial?: string;
  correoElectronico?: string;
  email?: string;
  logoUrl?: string;
  nit?: string;
  representante?: string;
  Representante?: string;
  representanteLegal?: string;
  RepresentanteLegal?: string;
  facturasMora?: number | string;
  FacturasMora?: number | string;
  facturacion?: Record<string, unknown>;
  [key: string]: unknown;
};

type MotivoNoCumple = {
  documento: string;
  motivo: string;
};

type DetalleVencimiento = {
  documento: string;
  estado: string;
  fechaVencimiento: string;
  tipoAlerta: string;
  diasRestantes: number | null;
  mensaje: string;
  archivoUrl?: string;
};

type AlertaDocumentoFirestore = {
  activo?: boolean;
  categoria?: string;
  documentosAprobados?: number;
  documentosCargados?: number;
  documentosPendientes?: number;
  documentosNoCumplen?: number;
  documentosSinFechaVencimiento?: number;
  documentosVencidos?: number;
  documentosPorVencer?: number;
  mensaje?: string;
  motivos?: unknown;
  motivosNoCumple?: unknown;
  documentosNoCumple?: unknown;
  vencimientosDetalle?: unknown;
  documentosVencimiento?: unknown;
  porcentaje?: number;
  porcentajeAprobado?: number;
  tipo?: string;
  tipoFuncionario?: string;
  totalDocumentos?: number;
  fechaGeneracion?: unknown;
  generadoAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  actualizadoAt?: unknown;
  usuarioEmail?: string;
  email?: string;
  usuarioId?: string;
  usuarioNombre?: string;
  nombreUsuario?: string;
  [key: string]: unknown;
};

type AlertaDocumento = {
  id: string;
  usuarioId: string;
  nombreUsuario: string;
  email: string;
  tipoFuncionario: string;
  total: number;
  aprobados: number;
  cargados: number;
  pendientes: number;
  noCumplen: number;
  sinFechaVencimiento: number;
  vencidos: number;
  porVencer: number;
  porcentaje: number;
  mensaje: string;
  motivosNoCumple: MotivoNoCumple[];
  vencimientosDetalle: DetalleVencimiento[];
  fechaGeneracion: string;
  updatedAt: string;
};

type AlertaFacturaMora = {
  id: string;
  mes: string;
  factura: string;
  estado: string;
  fechaFactura: string;
  fechaVencimiento: string;
  valor: string;
  interesesMora: string;
  observaciones: string;
};

type AlertaMovilFirestore = {
  activo?: boolean;
  categoria?: string;
  tipo?: string;
  movilId?: string;
  vehiculoId?: string;
  idMovil?: string;
  movilNombre?: string;
  nombreMovil?: string;
  placa?: string;
  denominacion?: string;
  totalAlertas?: number;
  vencidos?: number;
  porVencer?: number;
  diasUmbral?: number;
  vencimientosDetalle?: unknown;
  mensaje?: string;
  fechaGenerada?: unknown;
  fechaGeneracion?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  actualizadoAt?: unknown;
  [key: string]: unknown;
};

type AlertaMovil = {
  id: string;
  movilId: string;
  nombre: string;
  placa: string;
  denominacion: string;
  totalAlertas: number;
  vencidos: number;
  porVencer: number;
  diasUmbral: number;
  mensaje: string;
  vencimientosDetalle: DetalleVencimiento[];
  fechaGeneracion: string;
  updatedAt: string;
};

type AlertaAutoevaluacionFirestore = {
  activo?: boolean;
  tipo?: string;
  categoria?: string;
  producto?: string;
  productoId?: string;
  itemId?: string;
  codigoBarras?: string;
  motivo?: string;
  mensaje?: string;
  alerta?: string;
  detalle?: string;
  estado?: string;
  fechaAlerta?: unknown;
  fechaGeneracion?: unknown;
  fechaGenerada?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  actualizadoAt?: unknown;
  diasRestantes?: number | string;
  fechaVencimiento?: string;
  vencimientosDetalle?: unknown;
  [key: string]: unknown;
};

type AlertaAutoevaluacion = {
  id: string;
  categoria: string;
  producto: string;
  productoId: string;
  codigoBarras: string;
  motivo: string;
  mensaje: string;
  estado: string;
  diasRestantes: number | null;
  fechaVencimiento: string;
  vencimientosDetalle: DetalleVencimiento[];
  fechaGeneracion: string;
  updatedAt: string;
};

type MotivoAlertaAutoevaluacionMovil = {
  id: string;
  categoria: string;
  producto: string;
  codigoBarras: string;
  motivo: string;
  estado: string;
  fecha: string;
};

type AlertaAutoevaluacionMovil = {
  id: string;
  movilId: string;
  nombre: string;
  placa: string;
  totalItems: number;
  diligenciados: number;
  pendientes: number;
  porcentaje: number;
  conAlerta: boolean;
  mensaje: string;
  motivos: MotivoAlertaAutoevaluacionMovil[];
  updatedAt: string;
};

type MotivoAlertaVerificacionDiaria = {
  id: string;
  categoria: string;
  item: string;
  codigo: string;
  estado: string;
  observacion: string;
  motivo: string;
  fecha: string;
};

type AlertaVerificacionDiariaFirestore = {
  activo?: boolean;
  tipo?: string;
  categoria?: string;
  movilId?: string;
  vehiculoId?: string;
  idMovil?: string;
  movilNombre?: string;
  nombreMovil?: string;
  nombre?: string;
  placa?: string;
  fecha?: string;
  fechaVerificacion?: string;
  totalItems?: number | string;
  totalChecks?: number | string;
  diligenciados?: number | string;
  respondidos?: number | string;
  pendientes?: number | string;
  porcentaje?: number | string;
  mensaje?: string;
  motivo?: string;
  detalle?: string;
  motivos?: unknown;
  motivosDetalle?: unknown;
  itemsNoCumple?: unknown;
  itemsNoAplica?: unknown;
  itemsPendientes?: unknown;
  observaciones?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  actualizadoAt?: unknown;
  fechaGeneracion?: unknown;
  [key: string]: unknown;
};

type AlertaVerificacionDiaria = {
  id: string;
  movilId: string;
  nombre: string;
  placa: string;
  fecha: string;
  totalItems: number;
  diligenciados: number;
  pendientes: number;
  porcentaje: number;
  mensaje: string;
  motivos: MotivoAlertaVerificacionDiaria[];
  updatedAt: string;
};

type AlertaMantenimiento = {
  id: string;
  movilId: string;
  movilNombre: string;
  placa: string;
  fecha: string;
  tipoMantenimiento: string;
  sistema: string;
  estadoGestion: string;
  asignadoA: string;
  asignadoNombre: string;
  proveedorNombre: string;
  detalle: string;
  mensaje: string;
  updatedAt: string;
};

type ChatTareaAdmin = {
  id: string;
  autor: string;
  rol: "admin" | "operario" | "sistema";
  mensaje: string;
  fecha?: unknown;
};

type TareaProgramadaAdmin = {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  fechaCreacion: string;
  fechaMaxima: string;
  estadoFinal: string;
  asignadoA: string;
  asignadoNombre: string;
  asignadoEmail: string;
  creadoPor: string;
  creadoPorEmail: string;
  observaciones: string;
  chatTarea: ChatTareaAdmin[];
  updatedAt: string;
};

type UbicacionMovil = {
  lat: number;
  lng: number;
  fecha?: string;
};

type PersonalMapaMovil = {
  id: string;
  nombre: string;
  tipoFuncionario: string;
  rol: string;
  email: string;
};

type MapaMovil = {
  id: string;
  nombre: string;
  placa: string;
  tipo: string;
  denominacion: string;
  fotoUrl?: string;
  ubicacion: UbicacionMovil | null;
  personal: PersonalMapaMovil[];
};

type NotificacionSoporte = {
  id: string;
  tipo: string;
  asunto: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  modulo: string;
  respuesta: string;
  solicitanteNombre: string;
  solicitanteEmail: string;
  destino: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DEFAULT_LOGO = "/logo.png";
const MAPS_SCRIPT_ID = "google-maps-admin-dashboard-script";
const MAPS_SRC =
  "https://maps.googleapis.com/maps/api/js?key=AIzaSyAVp1ZPKd_HkrlwO5hD6njsn6h_reqaCEw&callback=initAllMaps&libraries=places";

function getStoredClienteSesion(): ClienteSesion | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("clienteSesion");
    return raw ? (JSON.parse(raw) as ClienteSesion) : null;
  } catch {
    return null;
  }
}

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function formatoMonedaCOP(value: unknown) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue <= 0) return "$0";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function valorTexto(value: unknown, fallback = "") {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  return String(value);
}

function esEstadoFacturaEnMora(value: unknown) {
  const estado = String(value || "").toLowerCase();

  return (
    estado.includes("mora") ||
    estado.includes("venc") ||
    estado.includes("vencida") ||
    estado.includes("vencido") ||
    estado.includes("pendiente de pago")
  );
}

function normalizarFactura(
  item: unknown,
  index: number,
): AlertaFacturaMora | null {
  if (!item || typeof item !== "object") return null;

  const data = item as Record<string, unknown>;
  const estado = valorTexto(
    data.estado || data.Estado || data.status,
    "Sin estado",
  );

  if (!esEstadoFacturaEnMora(estado)) return null;

  return {
    id: valorTexto(
      data.id || data.factura || data.numeroFactura || `factura-${index}`,
    ),
    mes: valorTexto(
      data.mes || data.Mes || data.periodo || data.Periodo,
      "Sin mes",
    ),
    factura: valorTexto(
      data.factura || data.numeroFactura || data.Factura,
      "Sin número",
    ),
    estado,
    fechaFactura: valorTexto(
      data.fechaFactura || data.fechaRadicacion || data.FechaFactura,
      "Sin fecha",
    ),
    fechaVencimiento: valorTexto(
      data.fechaVencimiento ||
        data.fechaVencimientoPago ||
        data.vencimiento ||
        data.FechaVencimiento,
      "Sin fecha",
    ),
    valor: formatoMonedaCOP(
      data.valor || data.Valor || data.total || data.Total,
    ),
    interesesMora: formatoMonedaCOP(
      data.interesesMora || data.InteresesMora || data.mora,
    ),
    observaciones: valorTexto(
      data.observaciones ||
        data.Observaciones ||
        data.seguimiento ||
        data.detalle,
      "Factura marcada en mora o vencida.",
    ),
  };
}

function extraerFacturasDesdeObjeto(value: unknown): unknown[] {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "object" && value !== null) {
    const data = value as Record<string, unknown>;

    if (Array.isArray(data.facturas)) return data.facturas;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.registros)) return data.registros;

    return Object.values(data).filter(
      (item) => item && typeof item === "object",
    );
  }

  return [];
}

function formatearFechaFirestore(value: unknown) {
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
        nanoseconds?: number;
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

function normalizarMotivos(value: unknown): MotivoNoCumple[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return { documento: "Documento", motivo: item };
        }

        if (typeof item === "object" && item !== null) {
          const data = item as Record<string, unknown>;
          return {
            documento: String(
              data.documento ||
                data.nombre ||
                data.documentoNombre ||
                "Documento",
            ),
            motivo: String(
              data.motivo ||
                data.motivoNoCumple ||
                data.observacion ||
                data.observaciones ||
                "",
            ),
          };
        }

        return null;
      })
      .filter((item): item is MotivoNoCumple => Boolean(item?.motivo));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        if (typeof item === "string") {
          return { documento: key, motivo: item };
        }

        if (typeof item === "object" && item !== null) {
          const data = item as Record<string, unknown>;
          return {
            documento: String(data.documento || data.nombre || key),
            motivo: String(
              data.motivo ||
                data.motivoNoCumple ||
                data.observacion ||
                data.observaciones ||
                "",
            ),
          };
        }

        return null;
      })
      .filter((item): item is MotivoNoCumple => Boolean(item?.motivo));
  }

  return [];
}

function normalizarVencimientos(value: unknown): DetalleVencimiento[] {
  if (!value) return [];

  const mapearItem = (
    item: unknown,
    key = "Documento",
  ): DetalleVencimiento | null => {
    if (typeof item === "string") {
      return {
        documento: key,
        estado: "",
        fechaVencimiento: "",
        tipoAlerta: "SIN_FECHA",
        diasRestantes: null,
        mensaje: item,
        archivoUrl: "",
      };
    }

    if (typeof item !== "object" || item === null) return null;

    const data = item as Record<string, unknown>;
    const documento = String(
      data.documento ||
        data.nombre ||
        data.documentoNombre ||
        key ||
        "Documento",
    );
    const tipoAlerta = String(
      data.tipoAlerta ||
        data.tipo ||
        data.alerta ||
        data.estadoVencimiento ||
        "",
    );
    const diasRaw = Number(
      data.diasRestantes ?? data.dias ?? data.diasParaVencer,
    );

    return {
      documento,
      estado: String(data.estado || data.estadoDocumento || ""),
      fechaVencimiento: String(data.fechaVencimiento || data.vencimiento || ""),
      tipoAlerta:
        tipoAlerta || (data.fechaVencimiento ? "POR_VENCER" : "SIN_FECHA"),
      diasRestantes: Number.isFinite(diasRaw) ? diasRaw : null,
      mensaje: String(
        data.mensaje ||
          data.observacion ||
          data.observaciones ||
          (tipoAlerta === "VENCIDO"
            ? "Documento vencido."
            : tipoAlerta === "POR_VENCER"
              ? "Documento próximo a vencer."
              : "Sin fecha de vencimiento diligenciada."),
      ),
      archivoUrl: String(data.archivoUrl || data.url || ""),
    };
  };

  if (Array.isArray(value)) {
    return value
      .map((item, index) => mapearItem(item, `Documento ${index + 1}`))
      .filter((item): item is DetalleVencimiento => Boolean(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => mapearItem(item, key))
      .filter((item): item is DetalleVencimiento => Boolean(item));
  }

  return [];
}

function mapearAlertaDocumento(
  id: string,
  data: AlertaDocumentoFirestore,
): AlertaDocumento | null {
  const activo = data.activo !== false;
  const categoria = String(data.categoria || "").toLowerCase();
  const tipo = String(data.tipo || "").toLowerCase();

  const esAlertaVehiculo =
    id.startsWith("moviles_") ||
    id.startsWith("vehiculos_") ||
    categoria.includes("movil") ||
    categoria.includes("móvil") ||
    categoria.includes("vehiculo") ||
    categoria.includes("vehículo") ||
    tipo.includes("movil") ||
    tipo.includes("móvil") ||
    tipo.includes("vehiculo") ||
    tipo.includes("vehículo");

  if (esAlertaVehiculo) return null;

  const tieneOrigenUsuario = Boolean(
    data.usuarioId ||
      data.usuarioNombre ||
      data.nombreUsuario ||
      data.usuarioEmail ||
      id.startsWith("documentos_"),
  );

  const esAlertaDocumental =
    tieneOrigenUsuario &&
    (id.startsWith("documentos_") ||
      categoria.includes("document") ||
      tipo.includes("document"));

  if (!activo || !esAlertaDocumental) return null;

  const total = toNumber(data.totalDocumentos);
  const aprobados = toNumber(data.documentosAprobados);
  const cargados = toNumber(data.documentosCargados);
  const noCumplen = toNumber(data.documentosNoCumplen);
  const sinFechaVencimiento = toNumber(data.documentosSinFechaVencimiento);
  const vencidos = toNumber(data.documentosVencidos);
  const porVencer = toNumber(data.documentosPorVencer);
  const vencimientosDetalle = normalizarVencimientos(
    data.vencimientosDetalle || data.documentosVencimiento,
  );
  const porcentaje = Math.min(
    100,
    Math.max(0, toNumber(data.porcentajeAprobado ?? data.porcentaje)),
  );
  const pendientes = toNumber(
    data.documentosPendientes,
    Math.max(total - aprobados, 0),
  );
  const motivosNoCumple = normalizarMotivos(
    data.motivosNoCumple || data.documentosNoCumple || data.motivos,
  );

  if (
    total <= 0 ||
    (porcentaje >= 100 &&
      motivosNoCumple.length === 0 &&
      noCumplen === 0 &&
      vencimientosDetalle.length === 0 &&
      sinFechaVencimiento === 0 &&
      vencidos === 0 &&
      porVencer === 0)
  )
    return null;

  const fechaGeneracion = formatearFechaFirestore(
    data.fechaGeneracion ||
      data.generadoAt ||
      data.createdAt ||
      data.updatedAt ||
      data.actualizadoAt,
  );

  return {
    id,
    usuarioId: String(data.usuarioId || id.replace(/^documentos_/, "")),
    nombreUsuario: String(
      data.usuarioNombre || data.nombreUsuario || "Usuario sin nombre",
    ),
    email: String(data.usuarioEmail || data.email || ""),
    tipoFuncionario: String(data.tipoFuncionario || "Sin tipo"),
    total,
    aprobados,
    cargados,
    pendientes,
    noCumplen: noCumplen || motivosNoCumple.length,
    sinFechaVencimiento:
      sinFechaVencimiento ||
      vencimientosDetalle.filter((item) => item.tipoAlerta === "SIN_FECHA")
        .length,
    vencidos:
      vencidos ||
      vencimientosDetalle.filter((item) => item.tipoAlerta === "VENCIDO")
        .length,
    porVencer:
      porVencer ||
      vencimientosDetalle.filter((item) => item.tipoAlerta === "POR_VENCER")
        .length,
    porcentaje,
    mensaje: String(
      data.mensaje ||
        `Documentación pendiente: ${aprobados}/${total} documentos aprobados.`,
    ),
    motivosNoCumple,
    vencimientosDetalle,
    fechaGeneracion,
    updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt),
  };
}


function mapearAlertaMovil(
  id: string,
  data: AlertaMovilFirestore,
): AlertaMovil | null {
  const activo = data.activo !== false;
  const categoria = String(data.categoria || "").toLowerCase();
  const tipo = String(data.tipo || "").toLowerCase();

  const esAlertaMovil =
    id.startsWith("moviles_") ||
    categoria.includes("movil") ||
    categoria.includes("vehiculo") ||
    categoria.includes("vehículo") ||
    tipo.includes("movil") ||
    tipo.includes("vehiculo") ||
    tipo.includes("vehículo");

  if (!activo || !esAlertaMovil) return null;

  const vencimientosDetalle = normalizarVencimientos(data.vencimientosDetalle);
  const vencidos =
    toNumber(data.vencidos) ||
    vencimientosDetalle.filter((item) => item.tipoAlerta === "VENCIDO").length;
  const porVencer =
    toNumber(data.porVencer) ||
    vencimientosDetalle.filter((item) => item.tipoAlerta === "POR_VENCER").length;
  const totalAlertas =
    toNumber(data.totalAlertas) || vencimientosDetalle.length || vencidos + porVencer;

  if (totalAlertas <= 0 && vencimientosDetalle.length === 0) return null;

  return {
    id,
    movilId: String(
      data.movilId ||
        data.vehiculoId ||
        data.idMovil ||
        id.replace(/^moviles_/, "").replace(/^vehiculos_/, ""),
    ),
    nombre: String(data.movilNombre || data.nombreMovil || "Móvil sin nombre"),
    placa: String(data.placa || "Sin placa"),
    denominacion: String(data.denominacion || "Sin denominación"),
    totalAlertas,
    vencidos,
    porVencer,
    diasUmbral: toNumber(data.diasUmbral, 10),
    mensaje: String(
      data.mensaje ||
        (vencidos > 0
          ? `Móvil con ${vencidos} documento(s) vencido(s).`
          : `Móvil con ${porVencer} vencimiento(s) próximos.`),
    ),
    vencimientosDetalle,
    fechaGeneracion: formatearFechaFirestore(
      data.fechaGenerada || data.fechaGeneracion || data.createdAt || data.updatedAt,
    ),
    updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt),
  };
}

function mapearAlertaAutoevaluacion(
  id: string,
  data: AlertaAutoevaluacionFirestore,
): AlertaAutoevaluacion | null {
  const activo = data.activo !== false;
  const tipo = String(data.tipo || "").toLowerCase();
  const categoriaTexto = String(data.categoria || "").toLowerCase();

  const esAutoevaluacion =
    id.startsWith("autoevaluacion_") ||
    id.startsWith("autoevaluación_") ||
    tipo.includes("autoevaluacion") ||
    tipo.includes("autoevaluación") ||
    categoriaTexto.includes("autoevaluacion") ||
    categoriaTexto.includes("autoevaluación");

  if (!activo || !esAutoevaluacion) return null;

  const vencimientosDetalle = normalizarVencimientos(data.vencimientosDetalle);
  const motivo = String(
    data.motivo || data.alerta || data.detalle || data.mensaje || "Alerta de autoevaluación.",
  );
  const diasRaw = Number(data.diasRestantes);

  return {
    id,
    categoria: String(data.categoria || "Sin categoría"),
    producto: String(data.producto || "Sin producto"),
    productoId: String(data.productoId || data.itemId || id.replace(/^autoevaluacion_/, "")),
    codigoBarras: String(data.codigoBarras || ""),
    motivo,
    mensaje: String(data.mensaje || motivo),
    estado: String(data.estado || "Activa"),
    diasRestantes: Number.isFinite(diasRaw) ? diasRaw : null,
    fechaVencimiento: String(data.fechaVencimiento || ""),
    vencimientosDetalle,
    fechaGeneracion: formatearFechaFirestore(
      data.fechaAlerta || data.fechaGenerada || data.fechaGeneracion || data.createdAt || data.updatedAt,
    ),
    updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt),
  };
}

function normalizarMotivosAutoevaluacionMovil(value: unknown): MotivoAlertaAutoevaluacionMovil[] {
  if (!value) return [];

  const mapear = (item: unknown, index: number): MotivoAlertaAutoevaluacionMovil | null => {
    if (typeof item === "string") {
      return {
        id: `motivo-${index}`,
        categoria: "Autoevaluación",
        producto: "Pendiente",
        codigoBarras: "",
        motivo: item,
        estado: "Pendiente",
        fecha: "",
      };
    }

    if (!item || typeof item !== "object") return null;

    const data = item as Record<string, unknown>;
    const motivo = valorTexto(
      data.motivo || data.mensaje || data.detalle || data.alerta || data.observacion || data.observaciones,
      "Autoevaluación pendiente.",
    );

    return {
      id: valorTexto(data.id || data.itemId || data.productoId || data.codigoBarras, `motivo-${index}`),
      categoria: valorTexto(data.categoria, "Sin categoría"),
      producto: valorTexto(data.producto || data.nombre || data.item, "Sin producto"),
      codigoBarras: valorTexto(data.codigoBarras || data.codigo || data.codigoLeido, ""),
      motivo,
      estado: valorTexto(data.estado || data.estadoGestion, "Pendiente"),
      fecha: formatearFechaFirestore(
        data.fecha || data.fechaGestion || data.fechaUso || data.fechaAlerta || data.updatedAt || data.actualizadoAt,
      ),
    };
  };

  if (Array.isArray(value)) {
    return value
      .map((item, index) => mapear(item, index))
      .filter((item): item is MotivoAlertaAutoevaluacionMovil => Boolean(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item], index) => {
        const motivo = mapear(item, index);
        return motivo ? { ...motivo, id: motivo.id || key } : null;
      })
      .filter((item): item is MotivoAlertaAutoevaluacionMovil => Boolean(item));
  }

  return [];
}

function mapearAlertaAutoevaluacionMovil(
  id: string,
  data: AlertaAutoevaluacionFirestore,
): AlertaAutoevaluacionMovil | null {
  const activo = data.activo !== false;
  const tipo = String(data.tipo || "").toLowerCase();
  const categoriaTexto = String(data.categoria || "").toLowerCase();
  const movilId = valorTexto((data as any).movilId || (data as any).idMovil || (data as any).vehiculoId, "");

  const esAutoevaluacionMovil =
    id.startsWith("autoevaluacion_movil_") ||
    id.startsWith("autoevaluación_movil_") ||
    tipo.includes("autoevaluacion_movil") ||
    tipo.includes("autoevaluación_movil") ||
    tipo.includes("autoevaluacion movil") ||
    tipo.includes("autoevaluación móvil") ||
    categoriaTexto.includes("autoevaluacion movil") ||
    categoriaTexto.includes("autoevaluación móvil") ||
    (Boolean(movilId) && (tipo.includes("autoevaluacion") || tipo.includes("autoevaluación") || categoriaTexto.includes("autoevaluacion") || categoriaTexto.includes("autoevaluación")));

  if (!activo || !esAutoevaluacionMovil) return null;

  const totalItems = toNumber((data as any).totalItems ?? (data as any).total ?? (data as any).totalProductos);
  const diligenciados = toNumber((data as any).diligenciados ?? (data as any).gestionados ?? (data as any).itemsGestionados);
  const pendientes = toNumber(
    (data as any).pendientes ?? (data as any).itemsPendientesCount ?? (data as any).faltantes,
    Math.max(totalItems - diligenciados, 0),
  );
  const porcentaje =
    totalItems > 0
      ? Math.min(100, Math.max(0, Math.round((diligenciados / totalItems) * 100)))
      : Math.min(100, Math.max(0, toNumber((data as any).porcentaje)));

  const motivos = [
    ...normalizarMotivosAutoevaluacionMovil((data as any).motivos),
    ...normalizarMotivosAutoevaluacionMovil((data as any).motivosDetalle),
    ...normalizarMotivosAutoevaluacionMovil((data as any).itemsPendientes),
    ...normalizarMotivosAutoevaluacionMovil((data as any).productosPendientes),
    ...normalizarMotivosAutoevaluacionMovil((data as any).usados),
    ...normalizarMotivosAutoevaluacionMovil((data as any).itemsUsados),
  ];

  const mensaje = valorTexto(
    data.mensaje || data.motivo || data.detalle || data.alerta,
    pendientes > 0
      ? `Móvil con ${pendientes} ítem(s) de autoevaluación pendiente(s).`
      : "Móvil con alerta de autoevaluación.",
  );

  if (pendientes <= 0 && porcentaje >= 100 && motivos.length === 0) return null;

  return {
    id,
    movilId: movilId || id.replace(/^autoevaluacion_movil_/, "").replace(/^autoevaluación_movil_/, ""),
    nombre: valorTexto((data as any).movilNombre || (data as any).nombreMovil || (data as any).nombre || (data as any).denominacion, "Móvil sin nombre"),
    placa: valorTexto((data as any).placa, "Sin placa"),
    totalItems,
    diligenciados,
    pendientes,
    porcentaje,
    conAlerta: true,
    mensaje,
    motivos: motivos.length
      ? motivos
      : [
          {
            id: `${id}-general`,
            categoria: valorTexto(data.categoria, "Autoevaluación"),
            producto: valorTexto(data.producto, "Pendiente general"),
            codigoBarras: valorTexto(data.codigoBarras, ""),
            motivo: mensaje,
            estado: valorTexto(data.estado, "Activa"),
            fecha: formatearFechaFirestore(data.fechaAlerta || data.fechaGeneracion || data.updatedAt || data.actualizadoAt),
          },
        ],
    updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt || data.fechaGeneracion || data.fechaAlerta),
  };
}

function normalizarMotivosVerificacionDiaria(value: unknown): MotivoAlertaVerificacionDiaria[] {
  if (!value) return [];

  const mapear = (item: unknown, index: number): MotivoAlertaVerificacionDiaria | null => {
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
    const estado = valorTexto(data.estado || data.cumple || data.valor || data.respuesta || data.cumplimiento, "Alerta");
    const observacion = valorTexto(
      data.observacion || data.observaciones || data.comentario || data.detalle || data.motivo,
      "",
    );
    const itemNombre = valorTexto(data.item || data.descripcion || data.nombre || data.pregunta, "Ítem");
    const motivo = valorTexto(
      data.motivo || data.mensaje || data.detalle || observacion,
      observacion
        ? `${itemNombre}: ${observacion}`
        : `${itemNombre} marcado como ${estado}.`,
    );

    return {
      id: valorTexto(data.id || data.codigo || data.itemId || `motivo-${index}`, `motivo-${index}`),
      categoria: valorTexto(data.categoria || data.grupo || data.seccion, "Verificación diaria"),
      item: itemNombre,
      codigo: valorTexto(data.codigo || data.codigoItem || data.itemCodigo, ""),
      estado,
      observacion,
      motivo,
      fecha: formatearFechaFirestore(
        data.fecha || data.fechaGestion || data.fechaVerificacion || data.createdAt || data.updatedAt || data.actualizadoAt,
      ),
    };
  };

  if (Array.isArray(value)) {
    return value
      .map((item, index) => mapear(item, index))
      .filter((item): item is MotivoAlertaVerificacionDiaria => Boolean(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item], index) => {
        const motivo = mapear(item, index);
        return motivo ? { ...motivo, id: motivo.id || key } : null;
      })
      .filter((item): item is MotivoAlertaVerificacionDiaria => Boolean(item));
  }

  return [];
}

function mapearAlertaVerificacionDiaria(
  id: string,
  data: AlertaVerificacionDiariaFirestore,
): AlertaVerificacionDiaria | null {
  const activo = data.activo !== false;
  const tipo = String(data.tipo || "").toLowerCase();
  const categoriaTexto = String(data.categoria || "").toLowerCase();

  const esVerificacionDiaria =
    id.startsWith("verificaciones_diarias_") ||
    id.startsWith("verificacion_diaria_") ||
    id.startsWith("verificaciones_moviles_") ||
    tipo.includes("verificacion_diaria") ||
    tipo.includes("verificaciones_diarias") ||
    tipo.includes("verificación diaria") ||
    tipo.includes("verificaciones moviles") ||
    tipo.includes("verificaciones móviles") ||
    categoriaTexto.includes("verificacion diaria") ||
    categoriaTexto.includes("verificación diaria") ||
    categoriaTexto.includes("verificaciones moviles") ||
    categoriaTexto.includes("verificaciones móviles");

  if (!activo || !esVerificacionDiaria) return null;

  const totalItems = toNumber(data.totalItems ?? data.totalChecks ?? (data as any).total);
  const diligenciados = toNumber(data.diligenciados ?? data.respondidos ?? (data as any).completados);
  const pendientes = toNumber(
    data.pendientes ?? (data as any).itemsPendientesCount ?? (data as any).faltantes,
    Math.max(totalItems - diligenciados, 0),
  );
  const porcentaje =
    totalItems > 0
      ? Math.min(100, Math.max(0, Math.round((diligenciados / totalItems) * 100)))
      : Math.min(100, Math.max(0, toNumber(data.porcentaje)));

  const motivosEstructurados = [
    ...normalizarMotivosVerificacionDiaria(data.itemsPendientes),
    ...normalizarMotivosVerificacionDiaria(data.itemsNoCumple),
    ...normalizarMotivosVerificacionDiaria(data.itemsNoAplica),
  ];

  const motivosCompatibles = [
    ...normalizarMotivosVerificacionDiaria(data.motivosDetalle),
    ...normalizarMotivosVerificacionDiaria(data.motivos),
    ...normalizarMotivosVerificacionDiaria(data.observaciones),
  ];

  const motivosSinDepurar = motivosEstructurados.length > 0 ? motivosEstructurados : motivosCompatibles;
  const motivosMap = new Map<string, MotivoAlertaVerificacionDiaria>();

  motivosSinDepurar.forEach((motivo, index) => {
    const clave = [
      motivo.codigo || motivo.id || `motivo-${index}`,
      motivo.estado,
      motivo.observacion || motivo.motivo,
    ]
      .join("|")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    if (!motivosMap.has(clave)) {
      motivosMap.set(clave, {
        ...motivo,
        id: motivo.id || `motivo-${index}`,
      });
    }
  });

  const motivos = Array.from(motivosMap.values());

  const movilId = valorTexto(data.movilId || data.vehiculoId || data.idMovil, "");
  const fecha = valorTexto(data.fecha || data.fechaVerificacion, "");
  const mensaje = valorTexto(
    data.mensaje || data.motivo || data.detalle,
    pendientes > 0
      ? `Móvil con verificación diaria incompleta: ${diligenciados}/${totalItems}.`
      : motivos.length > 0
        ? "Móvil con novedades en la verificación diaria."
        : "Alerta de verificación diaria.",
  );

  if (pendientes <= 0 && porcentaje >= 100 && motivos.length === 0) return null;

  return {
    id,
    movilId: movilId || id.replace(/^verificaciones_diarias_/, "").replace(/^verificacion_diaria_/, ""),
    nombre: valorTexto(data.movilNombre || data.nombreMovil || data.nombre, "Móvil sin nombre"),
    placa: valorTexto(data.placa, "Sin placa"),
    fecha,
    totalItems,
    diligenciados,
    pendientes,
    porcentaje,
    mensaje,
    motivos: motivos.length
      ? motivos
      : [
          {
            id: `${id}-general`,
            categoria: "Verificación diaria",
            item: "Pendiente general",
            codigo: "",
            estado: "Pendiente",
            observacion: "",
            motivo: mensaje,
            fecha: formatearFechaFirestore(data.fechaGeneracion || data.createdAt || data.updatedAt || data.actualizadoAt),
          },
        ],
    updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt || data.fechaGeneracion || data.createdAt),
  };
}

function extraerUbicacionMovil(data: Record<string, unknown>): UbicacionMovil | null {
  const fuentes = [
    data.ubicacionActual,
    data.ubicacion,
    data.localizacion,
    data.localización,
    data.gps,
    data.coords,
  ];

  for (const fuente of fuentes) {
    if (!fuente || typeof fuente !== "object") continue;
    const item = fuente as Record<string, unknown>;
    const lat = Number(
      item.lat ??
        item.latitude ??
        item.latitud ??
        item.Latitud ??
        item.LATITUD,
    );
    const lng = Number(
      item.lng ??
        item.lon ??
        item.long ??
        item.longitude ??
        item.longitud ??
        item.Longitud ??
        item.LONGITUD,
    );

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat,
        lng,
        fecha: formatearFechaFirestore(
          item.fecha || item.updatedAt || item.actualizadoAt || item.timestamp,
        ),
      };
    }
  }

  const latDirecta = Number(data.lat ?? data.latitude ?? data.latitud);
  const lngDirecta = Number(data.lng ?? data.lon ?? data.longitude ?? data.longitud);

  if (Number.isFinite(latDirecta) && Number.isFinite(lngDirecta)) {
    return {
      lat: latDirecta,
      lng: lngDirecta,
      fecha: formatearFechaFirestore(data.fechaUbicacion || data.updatedAt),
    };
  }

  return null;
}


function extraerFotoMovilMapa(data: Record<string, unknown>) {
  const directa = data.fotoUrl || data.imagenUrl || data.foto || data.imageUrl || data.urlFoto;
  if (typeof directa === "string" && directa.trim()) return directa.trim();

  const fotos = data.fotos || data.galeria || data.imagenes;

  if (Array.isArray(fotos)) {
    for (const item of fotos) {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (item && typeof item === "object") {
        const url = (item as any).url || (item as any).downloadURL || (item as any).fotoUrl || (item as any).src;
        if (typeof url === "string" && url.trim()) return url.trim();
      }
    }
  }

  if (fotos && typeof fotos === "object") {
    for (const item of Object.values(fotos as Record<string, unknown>)) {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (item && typeof item === "object") {
        const url = (item as any).url || (item as any).downloadURL || (item as any).fotoUrl || (item as any).src;
        if (typeof url === "string" && url.trim()) return url.trim();
      }
    }
  }

  return "";
}

function escaparHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function DashboardClientesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const mapaMovilesRef = useRef<HTMLDivElement | null>(null);
  const streetViewMovilesRef = useRef<HTMLDivElement | null>(null);
  const mapaAdminRef = useRef<any>(null);
  const streetViewAdminRef = useRef<any>(null);
  const markersAdminRef = useRef<any[]>([]);
  const infoWindowAdminRef = useRef<any>(null);

  const [user, setUser] = useState<User | null>(null);
  const [clienteSesion, setClienteSesion] = useState<ClienteSesion | null>(
    null,
  );
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [operativaOpen, setOperativaOpen] = useState(true);
  const [movilesOpen, setMovilesOpen] = useState(true);
  const [tareasOpen, setTareasOpen] = useState(true);
  const [soporteOpen, setSoporteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [mensajeLogo, setMensajeLogo] = useState("");
  const [alertasDocumentos, setAlertasDocumentos] = useState<AlertaDocumento[]>(
    [],
  );
  const [alertasMoviles, setAlertasMoviles] = useState<AlertaMovil[]>([]);
  const [alertasInfraccionesVehiculos, setAlertasInfraccionesVehiculos] = useState<AlertaMovil[]>([]);
  const [alertasAutoevaluacion, setAlertasAutoevaluacion] = useState<AlertaAutoevaluacion[]>([]);
  const [alertasAutoevaluacionMovil, setAlertasAutoevaluacionMovil] = useState<AlertaAutoevaluacionMovil[]>([]);
  const [alertasVerificacionDiaria, setAlertasVerificacionDiaria] = useState<AlertaVerificacionDiaria[]>([]);
  const [alertasMantenimientos, setAlertasMantenimientos] = useState<AlertaMantenimiento[]>([]);
  const [cargandoAlertas, setCargandoAlertas] = useState(true);
  const [busquedaAlertas, setBusquedaAlertas] = useState("");
  const [paginaAlertas, setPaginaAlertas] = useState(1);
  const [alertaDetalle, setAlertaDetalle] = useState<AlertaDocumento | null>(
    null,
  );
  const [busquedaAlertasMoviles, setBusquedaAlertasMoviles] = useState("");
  const [paginaAlertasMoviles, setPaginaAlertasMoviles] = useState(1);
  const [alertaMovilDetalle, setAlertaMovilDetalle] = useState<AlertaMovil | null>(null);
  const [busquedaAlertasAutoevaluacion, setBusquedaAlertasAutoevaluacion] = useState("");
  const [paginaAlertasAutoevaluacion, setPaginaAlertasAutoevaluacion] = useState(1);
  const [alertaAutoevaluacionDetalle, setAlertaAutoevaluacionDetalle] = useState<AlertaAutoevaluacion | null>(null);
  const [busquedaAlertasAutoevaluacionMovil, setBusquedaAlertasAutoevaluacionMovil] = useState("");
  const [paginaAlertasAutoevaluacionMovil, setPaginaAlertasAutoevaluacionMovil] = useState(1);
  const [alertaAutoevaluacionMovilDetalle, setAlertaAutoevaluacionMovilDetalle] = useState<AlertaAutoevaluacionMovil | null>(null);
  const [busquedaAlertasVerificacionDiaria, setBusquedaAlertasVerificacionDiaria] = useState("");
  const [paginaAlertasVerificacionDiaria, setPaginaAlertasVerificacionDiaria] = useState(1);
  const [alertaVerificacionDiariaDetalle, setAlertaVerificacionDiariaDetalle] = useState<AlertaVerificacionDiaria | null>(null);
  const [filtroVerificacionDiariaDetalle, setFiltroVerificacionDiariaDetalle] = useState<"todos" | "pendientes" | "no_aplica" | "no_cumple">("todos");
  const [busquedaAlertasMantenimientos, setBusquedaAlertasMantenimientos] = useState("");
  const [paginaAlertasMantenimientos, setPaginaAlertasMantenimientos] = useState(1);
  const [alertaMantenimientoDetalle, setAlertaMantenimientoDetalle] = useState<AlertaMantenimiento | null>(null);
  const [tareasAdmin, setTareasAdmin] = useState<TareaProgramadaAdmin[]>([]);
  const [busquedaTareasAdmin, setBusquedaTareasAdmin] = useState("");
  const [paginaTareasAdmin, setPaginaTareasAdmin] = useState(1);
  const [tareaAdminDetalle, setTareaAdminDetalle] = useState<TareaProgramadaAdmin | null>(null);
  const [mensajeChatTareaAdmin, setMensajeChatTareaAdmin] = useState("");
  const [guardandoTareaAdmin, setGuardandoTareaAdmin] = useState(false);
  const [modalFacturasMora, setModalFacturasMora] = useState(false);
  const [alertasFacturasMora, setAlertasFacturasMora] = useState<
    AlertaFacturaMora[]
  >([]);
  const [totalFacturasMora, setTotalFacturasMora] = useState(0);
  const [movilesMapa, setMovilesMapa] = useState<MapaMovil[]>([]);
  const [movilMapaSeleccionado, setMovilMapaSeleccionado] = useState<MapaMovil | null>(null);
  const [cargandoMovilesMapa, setCargandoMovilesMapa] = useState(true);
  const [notificacionesSoporte, setNotificacionesSoporte] = useState<NotificacionSoporte[]>([]);
  const [modalNotificacionesSoporte, setModalNotificacionesSoporte] = useState(false);


  const ALERTAS_POR_PAGINA = 5;

  const nombreCliente = useMemo(() => {
    return (
      cliente?.representante ||
      cliente?.Representante ||
      user?.displayName ||
      clienteSesion?.razonSocial ||
      cliente?.razonSocial ||
      cliente?.nombreComercial ||
      "Usuario"
    );
  }, [cliente, clienteSesion, user]);

  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);

  const alertasFiltradas = useMemo(() => {
    const texto = busquedaAlertas.trim().toLowerCase();

    if (!texto) return alertasDocumentos;

    return alertasDocumentos.filter((alerta) =>
      [alerta.nombreUsuario, alerta.email, alerta.tipoFuncionario]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [alertasDocumentos, busquedaAlertas]);

  const totalPaginasAlertas = Math.max(
    1,
    Math.ceil(alertasFiltradas.length / ALERTAS_POR_PAGINA),
  );

  const alertasPaginadas = useMemo(() => {
    const inicio = (paginaAlertas - 1) * ALERTAS_POR_PAGINA;
    return alertasFiltradas.slice(inicio, inicio + ALERTAS_POR_PAGINA);
  }, [alertasFiltradas, paginaAlertas]);

  const alertasVehiculosCombinadas = useMemo(() => {
    const mapa = new Map<string, AlertaMovil>();

    [...alertasMoviles, ...alertasInfraccionesVehiculos].forEach((alerta) => {
      const key = alerta.id;
      mapa.set(key, alerta);
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.vencidos - a.vencidos ||
        b.totalAlertas - a.totalAlertas ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
  }, [alertasMoviles, alertasInfraccionesVehiculos]);

  const alertasMovilesFiltradas = useMemo(() => {
    const texto = busquedaAlertasMoviles.trim().toLowerCase();

    if (!texto) return alertasVehiculosCombinadas;

    return alertasVehiculosCombinadas.filter((alerta) =>
      [alerta.nombre, alerta.placa, alerta.denominacion]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [alertasVehiculosCombinadas, busquedaAlertasMoviles]);

  const totalPaginasAlertasMoviles = Math.max(
    1,
    Math.ceil(alertasMovilesFiltradas.length / ALERTAS_POR_PAGINA),
  );

  const alertasMovilesPaginadas = useMemo(() => {
    const inicio = (paginaAlertasMoviles - 1) * ALERTAS_POR_PAGINA;
    return alertasMovilesFiltradas.slice(inicio, inicio + ALERTAS_POR_PAGINA);
  }, [alertasMovilesFiltradas, paginaAlertasMoviles]);

  const alertasAutoevaluacionFiltradas = useMemo(() => {
    const texto = busquedaAlertasAutoevaluacion.trim().toLowerCase();

    if (!texto) return alertasAutoevaluacion;

    return alertasAutoevaluacion.filter((alerta) =>
      [alerta.categoria, alerta.producto, alerta.codigoBarras, alerta.motivo]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [alertasAutoevaluacion, busquedaAlertasAutoevaluacion]);

  const totalPaginasAlertasAutoevaluacion = Math.max(
    1,
    Math.ceil(alertasAutoevaluacionFiltradas.length / ALERTAS_POR_PAGINA),
  );

  const alertasAutoevaluacionPaginadas = useMemo(() => {
    const inicio = (paginaAlertasAutoevaluacion - 1) * ALERTAS_POR_PAGINA;
    return alertasAutoevaluacionFiltradas.slice(inicio, inicio + ALERTAS_POR_PAGINA);
  }, [alertasAutoevaluacionFiltradas, paginaAlertasAutoevaluacion]);


  const alertasAutoevaluacionMovilFiltradas = useMemo(() => {
    const texto = busquedaAlertasAutoevaluacionMovil.trim().toLowerCase();

    if (!texto) return alertasAutoevaluacionMovil;

    return alertasAutoevaluacionMovil.filter((alerta) =>
      [alerta.nombre, alerta.placa, alerta.mensaje, ...alerta.motivos.map((motivo) => `${motivo.categoria} ${motivo.producto} ${motivo.motivo}`)]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [alertasAutoevaluacionMovil, busquedaAlertasAutoevaluacionMovil]);

  const totalPaginasAlertasAutoevaluacionMovil = Math.max(
    1,
    Math.ceil(alertasAutoevaluacionMovilFiltradas.length / ALERTAS_POR_PAGINA),
  );

  const alertasAutoevaluacionMovilPaginadas = useMemo(() => {
    const inicio = (paginaAlertasAutoevaluacionMovil - 1) * ALERTAS_POR_PAGINA;
    return alertasAutoevaluacionMovilFiltradas.slice(
      inicio,
      inicio + ALERTAS_POR_PAGINA,
    );
  }, [alertasAutoevaluacionMovilFiltradas, paginaAlertasAutoevaluacionMovil]);

  const alertasVerificacionDiariaFiltradas = useMemo(() => {
    const texto = busquedaAlertasVerificacionDiaria.trim().toLowerCase();

    if (!texto) return alertasVerificacionDiaria;

    return alertasVerificacionDiaria.filter((alerta) =>
      [alerta.nombre, alerta.placa, alerta.fecha, alerta.mensaje, ...alerta.motivos.map((motivo) => `${motivo.categoria} ${motivo.item} ${motivo.estado} ${motivo.observacion} ${motivo.motivo}`)]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [alertasVerificacionDiaria, busquedaAlertasVerificacionDiaria]);

  const totalPaginasAlertasVerificacionDiaria = Math.max(
    1,
    Math.ceil(alertasVerificacionDiariaFiltradas.length / ALERTAS_POR_PAGINA),
  );

  const alertasVerificacionDiariaPaginadas = useMemo(() => {
    const inicio = (paginaAlertasVerificacionDiaria - 1) * ALERTAS_POR_PAGINA;
    return alertasVerificacionDiariaFiltradas.slice(
      inicio,
      inicio + ALERTAS_POR_PAGINA,
    );
  }, [alertasVerificacionDiariaFiltradas, paginaAlertasVerificacionDiaria]);

  const alertasMantenimientosFiltradas = useMemo(() => {
    const texto = busquedaAlertasMantenimientos.trim().toLowerCase();

    if (!texto) return alertasMantenimientos;

    return alertasMantenimientos.filter((alerta) =>
      [
        alerta.movilNombre,
        alerta.placa,
        alerta.tipoMantenimiento,
        alerta.sistema,
        alerta.estadoGestion,
        alerta.asignadoNombre,
        alerta.proveedorNombre,
        alerta.detalle,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [alertasMantenimientos, busquedaAlertasMantenimientos]);

  const totalPaginasAlertasMantenimientos = Math.max(
    1,
    Math.ceil(alertasMantenimientosFiltradas.length / ALERTAS_POR_PAGINA),
  );

  const alertasMantenimientosPaginadas = useMemo(() => {
    const inicio = (paginaAlertasMantenimientos - 1) * ALERTAS_POR_PAGINA;
    return alertasMantenimientosFiltradas.slice(
      inicio,
      inicio + ALERTAS_POR_PAGINA,
    );
  }, [alertasMantenimientosFiltradas, paginaAlertasMantenimientos]);

  const tareasAdminFiltradas = useMemo(() => {
    const texto = busquedaTareasAdmin.trim().toLowerCase();
    const lista = tareasAdmin.filter((tarea) => {
      const estado = tarea.estadoFinal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return !estado.includes("realizado") || estado.includes("no realizado") || estado.includes("incompleto");
    });

    if (!texto) return lista;

    return lista.filter((tarea) =>
      [tarea.titulo, tarea.descripcion, tarea.prioridad, tarea.fechaMaxima, tarea.estadoFinal, tarea.asignadoNombre, tarea.creadoPor, tarea.observaciones]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [tareasAdmin, busquedaTareasAdmin]);

  const totalPaginasTareasAdmin = Math.max(1, Math.ceil(tareasAdminFiltradas.length / ALERTAS_POR_PAGINA));

  const tareasAdminPaginadas = useMemo(() => {
    const inicio = (paginaTareasAdmin - 1) * ALERTAS_POR_PAGINA;
    return tareasAdminFiltradas.slice(inicio, inicio + ALERTAS_POR_PAGINA);
  }, [tareasAdminFiltradas, paginaTareasAdmin]);

  const motivosVerificacionDiariaDetalleFiltrados = useMemo(() => {
    const motivos = alertaVerificacionDiariaDetalle?.motivos || [];
    if (filtroVerificacionDiariaDetalle === "todos") return motivos;

    return motivos.filter((motivo) => {
      const estado = `${motivo.estado || ""} ${motivo.motivo || ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (filtroVerificacionDiariaDetalle === "pendientes") {
        return estado.includes("pendiente") || estado.includes("sin diligenciar");
      }

      if (filtroVerificacionDiariaDetalle === "no_aplica") {
        return estado.includes("no aplica");
      }

      if (filtroVerificacionDiariaDetalle === "no_cumple") {
        return estado.includes("no cumple");
      }

      return true;
    });
  }, [alertaVerificacionDiariaDetalle, filtroVerificacionDiariaDetalle]);

  useEffect(() => {
    setPaginaAlertas(1);
  }, [busquedaAlertas, alertasDocumentos.length]);

  useEffect(() => {
    if (paginaAlertas > totalPaginasAlertas) {
      setPaginaAlertas(totalPaginasAlertas);
    }
  }, [paginaAlertas, totalPaginasAlertas]);

  useEffect(() => {
    setPaginaAlertasMoviles(1);
  }, [busquedaAlertasMoviles, alertasVehiculosCombinadas.length]);

  useEffect(() => {
    if (paginaAlertasMoviles > totalPaginasAlertasMoviles) {
      setPaginaAlertasMoviles(totalPaginasAlertasMoviles);
    }
  }, [paginaAlertasMoviles, totalPaginasAlertasMoviles]);

  useEffect(() => {
    setPaginaAlertasAutoevaluacion(1);
  }, [busquedaAlertasAutoevaluacion, alertasAutoevaluacion.length]);

  useEffect(() => {
    if (paginaAlertasAutoevaluacion > totalPaginasAlertasAutoevaluacion) {
      setPaginaAlertasAutoevaluacion(totalPaginasAlertasAutoevaluacion);
    }
  }, [paginaAlertasAutoevaluacion, totalPaginasAlertasAutoevaluacion]);


  useEffect(() => {
    setPaginaAlertasAutoevaluacionMovil(1);
  }, [busquedaAlertasAutoevaluacionMovil, alertasAutoevaluacionMovil.length]);

  useEffect(() => {
    if (paginaAlertasAutoevaluacionMovil > totalPaginasAlertasAutoevaluacionMovil) {
      setPaginaAlertasAutoevaluacionMovil(totalPaginasAlertasAutoevaluacionMovil);
    }
  }, [paginaAlertasAutoevaluacionMovil, totalPaginasAlertasAutoevaluacionMovil]);

  useEffect(() => {
    setPaginaAlertasVerificacionDiaria(1);
  }, [busquedaAlertasVerificacionDiaria, alertasVerificacionDiaria.length]);

  useEffect(() => {
    if (paginaAlertasVerificacionDiaria > totalPaginasAlertasVerificacionDiaria) {
      setPaginaAlertasVerificacionDiaria(totalPaginasAlertasVerificacionDiaria);
    }
  }, [paginaAlertasVerificacionDiaria, totalPaginasAlertasVerificacionDiaria]);

  useEffect(() => {
    setPaginaAlertasMantenimientos(1);
  }, [busquedaAlertasMantenimientos, alertasMantenimientos.length]);

  useEffect(() => {
    if (paginaAlertasMantenimientos > totalPaginasAlertasMantenimientos) {
      setPaginaAlertasMantenimientos(totalPaginasAlertasMantenimientos);
    }
  }, [paginaAlertasMantenimientos, totalPaginasAlertasMantenimientos]);

  useEffect(() => {
    setPaginaTareasAdmin(1);
  }, [busquedaTareasAdmin, tareasAdmin.length]);

  useEffect(() => {
    if (paginaTareasAdmin > totalPaginasTareasAdmin) setPaginaTareasAdmin(totalPaginasTareasAdmin);
  }, [paginaTareasAdmin, totalPaginasTareasAdmin]);

  const cargarAlertasFacturacion = async (
    clienteId: string,
    dataCliente: ClienteData,
  ) => {
    const moraCampo = Math.max(
      toNumber(dataCliente.facturasMora),
      toNumber(dataCliente.FacturasMora),
    );

    const anioActual = String(new Date().getFullYear());
    let facturasFuente: unknown[] = [];

    facturasFuente = [
      ...facturasFuente,
      ...extraerFacturasDesdeObjeto(dataCliente.facturacion?.[anioActual]),
      ...extraerFacturasDesdeObjeto(dataCliente.facturacion?.["2026"]),
    ];

    try {
      const snapAnioActual = await getDoc(
        doc(db, "clientes", clienteId, "facturacion", anioActual),
      );

      if (snapAnioActual.exists()) {
        facturasFuente = [
          ...facturasFuente,
          ...extraerFacturasDesdeObjeto(snapAnioActual.data()),
        ];
      }

      if (anioActual !== "2026") {
        const snap2026 = await getDoc(
          doc(db, "clientes", clienteId, "facturacion", "2026"),
        );

        if (snap2026.exists()) {
          facturasFuente = [
            ...facturasFuente,
            ...extraerFacturasDesdeObjeto(snap2026.data()),
          ];
        }
      }
    } catch (error) {
      console.error("Error cargando facturación para alerta de mora:", error);
    }

    const facturasMora = facturasFuente
      .map((item, index) => normalizarFactura(item, index))
      .filter(Boolean) as AlertaFacturaMora[];

    const facturasUnicas = Array.from(
      new Map(
        facturasMora.map((factura) => [
          `${factura.factura}-${factura.mes}-${factura.estado}`,
          factura,
        ]),
      ).values(),
    );

    setTotalFacturasMora(Math.max(moraCampo, facturasUnicas.length));
    setAlertasFacturasMora(facturasUnicas);

    if (moraCampo > 0 || facturasUnicas.length > 0) {
      setModalFacturasMora(true);
    }
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

      if (stored?.clienteId) {
        try {
          const snap = await getDoc(doc(db, "clientes", stored.clienteId));
          if (snap.exists()) {
            const dataCliente = snap.data() as ClienteData;
            setCliente(dataCliente);
            await cargarAlertasFacturacion(stored.clienteId, dataCliente);
          }
        } catch (error) {
          console.error("Error cargando cliente:", error);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!clienteSesion?.clienteId) {
      setNotificacionesSoporte([]);
      return;
    }

    const soportesRef = collection(db, "clientes", clienteSesion.clienteId, "soportes");

    const unsubscribe = onSnapshot(
      soportesRef,
      (snapshot) => {
        const respuestas = snapshot.docs
          .map((documento) => {
            const data = documento.data() as Record<string, unknown>;
            const respuesta = valorTexto(data.respuesta, "").trim();

            if (!respuesta) return null;

            return {
              id: documento.id,
              tipo: valorTexto(data.tipo, "soporte"),
              asunto: valorTexto(data.asunto, "Solicitud de soporte"),
              descripcion: valorTexto(data.descripcion, ""),
              prioridad: valorTexto(data.prioridad, "media"),
              estado: valorTexto(data.estado, "en proceso"),
              modulo: valorTexto(data.modulo, ""),
              respuesta,
              solicitanteNombre: valorTexto(data.solicitanteNombre, ""),
              solicitanteEmail: valorTexto(data.solicitanteEmail, ""),
              destino: valorTexto(data.destino, ""),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt || data.actualizadoAt || data.createdAt,
            } as NotificacionSoporte;
          })
          .filter(Boolean) as NotificacionSoporte[];

        respuestas.sort((a, b) =>
          formatearFechaFirestore(b.updatedAt).localeCompare(formatearFechaFirestore(a.updatedAt)),
        );

        setNotificacionesSoporte(respuestas);
      },
      (error) => {
        console.error("Error cargando respuestas de soporte:", error);
        setNotificacionesSoporte([]);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId]);

  useEffect(() => {
    if (!clienteSesion?.clienteId) {
      setCargandoAlertas(false);
      return;
    }

    setCargandoAlertas(true);

    const alertasRef = collection(
      db,
      "clientes",
      clienteSesion.clienteId,
      "alertas",
    );

    const unsubscribe = onSnapshot(
      alertasRef,
      (snapshot) => {
        const alertas = snapshot.docs
          .map((item) =>
            mapearAlertaDocumento(
              item.id,
              item.data() as AlertaDocumentoFirestore,
            ),
          )
          .filter(Boolean) as AlertaDocumento[];

        const alertasMovilesActuales = snapshot.docs
          .map((item) =>
            mapearAlertaMovil(
              item.id,
              item.data() as AlertaMovilFirestore,
            ),
          )
          .filter(Boolean) as AlertaMovil[];

        const alertasAutoevaluacionActuales = snapshot.docs
          .map((item) =>
            mapearAlertaAutoevaluacion(
              item.id,
              item.data() as AlertaAutoevaluacionFirestore,
            ),
          )
          .filter(Boolean) as AlertaAutoevaluacion[];

        const alertasAutoevaluacionMovilActuales = snapshot.docs
          .map((item) =>
            mapearAlertaAutoevaluacionMovil(
              item.id,
              item.data() as AlertaAutoevaluacionFirestore,
            ),
          )
          .filter(Boolean) as AlertaAutoevaluacionMovil[];

        const alertasVerificacionDiariaActuales = snapshot.docs
          .map((item) =>
            mapearAlertaVerificacionDiaria(
              item.id,
              item.data() as AlertaVerificacionDiariaFirestore,
            ),
          )
          .filter(Boolean) as AlertaVerificacionDiaria[];

        alertas.sort((a, b) => a.porcentaje - b.porcentaje);
        alertasMovilesActuales.sort((a, b) => b.vencidos - a.vencidos || a.porVencer - b.porVencer);
        alertasAutoevaluacionActuales.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.producto.localeCompare(b.producto));
        alertasAutoevaluacionMovilActuales.sort((a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, "es"));
        alertasVerificacionDiariaActuales.sort((a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, "es"));
        setAlertasDocumentos(alertas);
        setAlertasMoviles(alertasMovilesActuales);
        setAlertasAutoevaluacion(alertasAutoevaluacionActuales);
        setAlertasAutoevaluacionMovil(alertasAutoevaluacionMovilActuales);
        if (alertasVerificacionDiariaActuales.length > 0) {
          setAlertasVerificacionDiaria(alertasVerificacionDiariaActuales);
        }
        setCargandoAlertas(false);
      },
      (error) => {
        console.error("Error cargando alertas documentales:", error);
        setCargandoAlertas(false);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId]);


  useEffect(() => {
    if (!clienteSesion?.clienteId) {
      setAlertasVerificacionDiaria([]);
      return;
    }

    const vehiculosRef = collection(
      db,
      "clientes",
      clienteSesion.clienteId,
      "alertas",
      "verificaciones_diarias",
      "vehiculos",
    );

    const unsubscribe = onSnapshot(
      vehiculosRef,
      async (snapshot) => {
        try {
          const alertasPorFecha = await Promise.all(
            snapshot.docs.map(async (vehiculoDoc) => {
              const vehiculoData = vehiculoDoc.data() as Record<string, unknown>;
              const fechasSnap = await getDocs(
                collection(
                  db,
                  "clientes",
                  clienteSesion.clienteId || "",
                  "alertas",
                  "verificaciones_diarias",
                  "vehiculos",
                  vehiculoDoc.id,
                  "fechas",
                ),
              ).catch(() => null);

              if (!fechasSnap) return [];

              return fechasSnap.docs
                .map((fechaDoc) => {
                  const fechaData = fechaDoc.data() as AlertaVerificacionDiariaFirestore;
                  return mapearAlertaVerificacionDiaria(
                    `verificaciones_diarias_${fechaDoc.id}_${vehiculoDoc.id}`,
                    {
                      ...vehiculoData,
                      ...fechaData,
                      movilId: valorTexto(fechaData.movilId || vehiculoData.movilId || vehiculoDoc.id, vehiculoDoc.id),
                      movilNombre: valorTexto(fechaData.movilNombre || vehiculoData.movilNombre || vehiculoData.nombreMovil, "Móvil sin nombre"),
                      nombreMovil: valorTexto(fechaData.nombreMovil || fechaData.movilNombre || vehiculoData.nombreMovil || vehiculoData.movilNombre, "Móvil sin nombre"),
                      placa: valorTexto(fechaData.placa || vehiculoData.placa, "Sin placa"),
                      fecha: valorTexto(fechaData.fecha || fechaData.fechaVerificacion || fechaDoc.id, fechaDoc.id),
                      fechaVerificacion: valorTexto(fechaData.fechaVerificacion || fechaData.fecha || fechaDoc.id, fechaDoc.id),
                    } as AlertaVerificacionDiariaFirestore,
                  );
                })
                .filter(Boolean) as AlertaVerificacionDiaria[];
            }),
          );

          const alertas = alertasPorFecha.flat();
          alertas.sort((a, b) => {
            const fechaOrden = b.fecha.localeCompare(a.fecha);
            if (fechaOrden !== 0) return fechaOrden;
            return b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, "es");
          });

          setAlertasVerificacionDiaria(alertas);
        } catch (error) {
          console.error("Error cargando alertas estructuradas de verificaciones diarias:", error);
        }
      },
      (error) => {
        console.error("Error escuchando alertas estructuradas de verificaciones diarias:", error);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId]);

  useEffect(() => {
    if (!clienteSesion?.clienteId) {
      setAlertasInfraccionesVehiculos([]);
      return;
    }

    const conductoresRef = collection(
      db,
      "clientes",
      clienteSesion.clienteId,
      "alertas",
      "infracciones",
      "conductores",
    );

    const unsubscribe = onSnapshot(
      conductoresRef,
      async (snapshot) => {
        try {
          const alertasPorConductor = await Promise.all(
            snapshot.docs.map(async (conductorDoc) => {
              const conductorData = conductorDoc.data() as Record<string, unknown>;
              const registrosSnap = await getDocs(
                collection(
                  db,
                  "clientes",
                  clienteSesion.clienteId || "",
                  "alertas",
                  "infracciones",
                  "conductores",
                  conductorDoc.id,
                  "registros",
                ),
              ).catch(() => null);

              if (!registrosSnap) return [];

              return registrosSnap.docs
                .map((registroDoc) => {
                  const data = registroDoc.data() as Record<string, unknown>;
                  const activo = data.activo !== false;
                  const estadoRaw = valorTexto(data.estado, "avisado");
                  const estado = estadoRaw
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[̀-ͯ]/g, "")
                    .trim();

                  if (!activo || estado.includes("solucionado")) return null;

                  const conductorNombre = valorTexto(
                    data.conductorNombre || data.nombreCompleto || conductorData.conductorNombre || conductorData.nombreCompleto,
                    "Conductor sin nombre",
                  );
                  const infraccion = valorTexto(data.infraccion, "Infracción sin detalle");
                  const fecha = valorTexto(data.fecha, "Sin fecha");
                  const email = valorTexto(data.email || conductorData.email, "Sin email");
                  const nombreMovil = valorTexto(data.movilNombre || data.nombreMovil || data.vehiculoNombre, conductorNombre);
                  const placa = valorTexto(data.placa || data.vehiculoPlaca, "Infracción");
                  const esAvisado = estado.includes("avisado");

                  return {
                    id: `infraccion_${conductorDoc.id}_${registroDoc.id}`,
                    movilId: valorTexto(data.movilId || data.vehiculoId, ""),
                    nombre: nombreMovil,
                    placa,
                    denominacion: email,
                    totalAlertas: 1,
                    vencidos: esAvisado ? 1 : 0,
                    porVencer: esAvisado ? 0 : 1,
                    diasUmbral: 0,
                    mensaje: `${conductorNombre} tiene infracción activa: ${infraccion} (${estadoRaw}).`,
                    vencimientosDetalle: [
                      {
                        documento: "Infracción",
                        estado: estadoRaw,
                        fechaVencimiento: fecha,
                        tipoAlerta: "INFRACCION",
                        diasRestantes: null,
                        mensaje: `${infraccion}${data.observaciones ? ` · ${data.observaciones}` : ""}`,
                        archivoUrl: "",
                      },
                    ],
                    fechaGeneracion: formatearFechaFirestore(data.fechaGeneracion || data.createdAt || data.updatedAt),
                    updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt || data.fechaGeneracion),
                  } as AlertaMovil;
                })
                .filter(Boolean) as AlertaMovil[];
            }),
          );

          setAlertasInfraccionesVehiculos(alertasPorConductor.flat());
        } catch (error) {
          console.error("Error cargando alertas de infracciones:", error);
          setAlertasInfraccionesVehiculos([]);
        }
      },
      (error) => {
        console.error("Error escuchando alertas de infracciones:", error);
        setAlertasInfraccionesVehiculos([]);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId]);

  useEffect(() => {
    if (!clienteSesion?.clienteId) {
      setAlertasMantenimientos([]);
      return;
    }

    const mantenimientosRef = collection(
      db,
      "clientes",
      clienteSesion.clienteId,
      "mantenimientosVehiculares",
    );

    const unsubscribe = onSnapshot(
      mantenimientosRef,
      (snapshot) => {
        const alertas = snapshot.docs
          .map((documento) => {
            const data = documento.data() as Record<string, unknown>;
            const estadoRaw = valorTexto(data.estadoGestion || data.estado || "sin realizar", "sin realizar");
            const estado = estadoRaw
              .toLowerCase()
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .trim();

            const generaAlerta =
              estado.includes("incompleto") ||
              estado.includes("sin realizar") ||
              estado.includes("programado") ||
              estado === "";

            if (!generaAlerta || estado.includes("resuelto")) return null;

            const tareas = data.tareas && typeof data.tareas === "object" ? Object.values(data.tareas as Record<string, unknown>) : [];
            const detalle =
              valorTexto(data.fallaReportada, "") ||
              tareas.filter(Boolean).join(", ") ||
              valorTexto(data.novedadesConductor, "") ||
              "Mantenimiento pendiente de gestión.";

            const fecha = valorTexto(data.fecha || data.fechaSolicitud || data.createdAt, "Sin fecha");
            const movilNombre = valorTexto(data.movilNombre || data.nombreMovil, "Móvil sin nombre");
            const tipoMantenimiento = valorTexto(data.tipoMantenimiento, "Sin tipo");
            const sistema = valorTexto(data.sistema, "Sin sistema");

            return {
              id: documento.id,
              movilId: valorTexto(data.movilId || data.vehiculoId, ""),
              movilNombre,
              placa: valorTexto(data.placa, "Sin placa"),
              fecha,
              tipoMantenimiento,
              sistema,
              estadoGestion: estadoRaw || "sin realizar",
              asignadoA: valorTexto(data.asignadoA || data.usuarioId, ""),
              asignadoNombre: valorTexto(data.asignadoNombre || data.conductorNombre || data.usuarioNombre, "Sin asignar"),
              proveedorNombre: valorTexto(data.proveedorNombre || data.programarServicioConNombre, "N/A"),
              detalle,
              mensaje: `Mantenimiento ${tipoMantenimiento || "vehicular"} de ${movilNombre} está ${estadoRaw || "sin realizar"}.`,
              updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt || data.createdAt),
            } as AlertaMantenimiento;
          })
          .filter(Boolean) as AlertaMantenimiento[];

        alertas.sort((a, b) => {
          const prioridadA = a.estadoGestion.toLowerCase().includes("incompleto") ? 0 : 1;
          const prioridadB = b.estadoGestion.toLowerCase().includes("incompleto") ? 0 : 1;
          return prioridadA - prioridadB || b.fecha.localeCompare(a.fecha) || a.movilNombre.localeCompare(b.movilNombre, "es");
        });

        setAlertasMantenimientos(alertas);
      },
      (error) => {
        console.error("Error cargando alertas de mantenimientos:", error);
        setAlertasMantenimientos([]);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId]);

  useEffect(() => {
    if (!clienteSesion?.clienteId || !user) {
      setTareasAdmin([]);
      return;
    }

    const tareasRef = collection(db, "clientes", clienteSesion.clienteId, "tareasProgramadas");

    const unsubscribe = onSnapshot(
      tareasRef,
      (snapshot) => {
        const emailActual = valorTexto(user.email, "").toLowerCase();
        const uidActual = valorTexto(user.uid, "");
        const nombreActual = valorTexto(nombreCliente, "").toLowerCase();

        const tareas = snapshot.docs
          .map((documento) => {
            const data = documento.data() as Record<string, unknown>;
            const asignadoA = valorTexto(data.asignadoA || data.usuarioId || data.responsableId, "");
            const asignadoEmail = valorTexto(data.asignadoEmail || data.usuarioEmail || data.emailAsignado, "").toLowerCase();
            const asignadoNombre = valorTexto(data.asignadoNombre || data.usuarioNombre || data.responsableNombre, "");
            const rolAsignado = valorTexto(data.rolAsignado || data.tipoAsignado || data.tipoFuncionario, "").toLowerCase();
            const estadoRaw = valorTexto(data.estadoFinal || data.estado || data.estadoGestion, "sin realizar");
            const estado = estadoRaw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

            const asignadaAlAdmin =
              asignadoA === uidActual ||
              asignadoEmail === emailActual ||
              asignadoNombre.toLowerCase() === nombreActual ||
              rolAsignado.includes("admin") ||
              rolAsignado.includes("administrador") ||
              asignadoA.toLowerCase() === "admin";

            const pendiente = estado.includes("no realizado") || estado.includes("incompleto") || estado.includes("pendiente") || estado.includes("sin realizar") || estado.includes("programado") || estado === "";

            if (!asignadaAlAdmin || !pendiente || (estado.includes("realizado") && !estado.includes("no realizado"))) return null;

            const chat = Array.isArray(data.chatTarea)
              ? (data.chatTarea as ChatTareaAdmin[])
              : Array.isArray(data.chat)
                ? (data.chat as ChatTareaAdmin[])
                : [];

            return {
              id: documento.id,
              titulo: valorTexto(data.titulo || data.nombre || data.asunto, "Tarea programada"),
              descripcion: valorTexto(data.descripcion || data.detalle || data.tarea, "Sin descripción."),
              prioridad: valorTexto(data.prioridad, "media"),
              fechaCreacion: valorTexto(data.fechaCreacion || data.fecha || data.createdAt, ""),
              fechaMaxima: valorTexto(data.fechaMaxima || data.fechaLimite || data.vencimiento, "Sin fecha"),
              estadoFinal: estadoRaw,
              asignadoA,
              asignadoNombre: asignadoNombre || nombreCliente,
              asignadoEmail,
              creadoPor: valorTexto(data.creadoPor || data.creadoPorNombre || data.adminNombre, "Admin"),
              creadoPorEmail: valorTexto(data.creadoPorEmail || data.adminEmail, ""),
              observaciones: valorTexto(data.observaciones || data.observacion, ""),
              chatTarea: chat,
              updatedAt: formatearFechaFirestore(data.updatedAt || data.actualizadoAt || data.createdAt),
            } as TareaProgramadaAdmin;
          })
          .filter(Boolean) as TareaProgramadaAdmin[];

        tareas.sort((a, b) => {
          const prioridadOrden = (value: string) => {
            const normalizada = value.toLowerCase();
            if (normalizada.includes("inmediato")) return 0;
            if (normalizada.includes("alta")) return 1;
            if (normalizada.includes("media")) return 2;
            return 3;
          };
          return prioridadOrden(a.prioridad) - prioridadOrden(b.prioridad) || a.fechaMaxima.localeCompare(b.fechaMaxima);
        });

        setTareasAdmin(tareas);
      },
      (error) => {
        console.error("Error cargando tareas asignadas al admin:", error);
        setTareasAdmin([]);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId, user, nombreCliente]);

  useEffect(() => {
    if (!clienteSesion?.clienteId) {
      setMovilesMapa([]);
      setCargandoMovilesMapa(false);
      return;
    }

    setCargandoMovilesMapa(true);

    const movilesRef = collection(db, "clientes", clienteSesion.clienteId, "moviles");

    const unsubscribe = onSnapshot(
      movilesRef,
      async (snapshot) => {
        try {
          const data = await Promise.all(
            snapshot.docs.map(async (movilDoc) => {
              const movilData = movilDoc.data() as Record<string, unknown>;
              const ubicacion = extraerUbicacionMovil(movilData);

              const personalSnap = await getDocs(
                collection(
                  db,
                  "clientes",
                  clienteSesion.clienteId || "",
                  "moviles",
                  movilDoc.id,
                  "PERSONAL_ASIGNADO",
                ),
              ).catch(() => null);

              const personal =
                personalSnap?.docs.map((personalDoc) => {
                  const item = personalDoc.data() as Record<string, unknown>;
                  const nombres = valorTexto(item.nombres, "");
                  const apellidos = valorTexto(item.apellidos, "");
                  const nombre = `${nombres} ${apellidos}`.trim() || valorTexto(item.email, "Usuario");

                  return {
                    id: personalDoc.id,
                    nombre,
                    tipoFuncionario: valorTexto(item.tipoFuncionario, "Sin tipo"),
                    rol: valorTexto(item.rol, "Sin rol"),
                    email: valorTexto(item.email, ""),
                  } as PersonalMapaMovil;
                }) || [];

              return {
                id: movilDoc.id,
                nombre: valorTexto(
                  movilData.nombre || movilData.movilNombre || movilData.denominacion,
                  "Móvil sin nombre",
                ),
                placa: valorTexto(movilData.placa, "Sin placa"),
                tipo: valorTexto(movilData.tipo, "Sin tipo"),
                denominacion: valorTexto(movilData.denominacion, "Sin denominación"),
                fotoUrl: extraerFotoMovilMapa(movilData),
                ubicacion,
                personal,
              } as MapaMovil;
            }),
          );

          data.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
          setMovilesMapa(data);
        } catch (error) {
          console.error("Error cargando mapa de móviles:", error);
          setMovilesMapa([]);
        } finally {
          setCargandoMovilesMapa(false);
        }
      },
      (error) => {
        console.error("Error escuchando móviles para mapa:", error);
        setMovilesMapa([]);
        setCargandoMovilesMapa(false);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId]);

  useEffect(() => {
    const movilesConUbicacion = movilesMapa.filter((movil) => movil.ubicacion);

    if (movilesConUbicacion.length === 0) {
      setMovilMapaSeleccionado(null);
      return;
    }

    setMovilMapaSeleccionado((actual) => {
      if (actual && movilesConUbicacion.some((movil) => movil.id === actual.id)) {
        return movilesConUbicacion.find((movil) => movil.id === actual.id) || actual;
      }

      return movilesConUbicacion[0];
    });
  }, [movilesMapa]);

  useEffect(() => {
    if (!mapaMovilesRef.current) return;

    const inicializarMapa = () => {
      const googleMaps = (window as any).google?.maps;
      if (!googleMaps || !mapaMovilesRef.current) return;

      const movilesConUbicacion = movilesMapa.filter((movil) => movil.ubicacion);
      const centro = movilesConUbicacion[0]?.ubicacion || { lat: 4.710989, lng: -74.072092 };

      if (!mapaAdminRef.current) {
        mapaAdminRef.current = new googleMaps.Map(mapaMovilesRef.current, {
          center: centro,
          zoom: movilesConUbicacion.length > 0 ? 13 : 11,
          mapTypeId: googleMaps.MapTypeId?.SATELLITE || "satellite",
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
      } else {
        mapaAdminRef.current.setCenter(centro);
        mapaAdminRef.current.setZoom(movilesConUbicacion.length > 0 ? 13 : 11);
        mapaAdminRef.current.setMapTypeId(googleMaps.MapTypeId?.SATELLITE || "satellite");
      }

      if (streetViewMovilesRef.current) {
        if (!streetViewAdminRef.current) {
          streetViewAdminRef.current = new googleMaps.StreetViewPanorama(streetViewMovilesRef.current, {
            position: centro,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            visible: true,
            addressControl: false,
            fullscreenControl: true,
            linksControl: true,
            panControl: true,
            enableCloseButton: false,
          });
          mapaAdminRef.current.setStreetView(streetViewAdminRef.current);
        } else {
          streetViewAdminRef.current.setPosition(centro);
          streetViewAdminRef.current.setVisible(true);
        }
      }

      markersAdminRef.current.forEach((marker) => marker.setMap(null));
      markersAdminRef.current = [];

      if (!infoWindowAdminRef.current) {
        infoWindowAdminRef.current = new googleMaps.InfoWindow();
      }

      const bounds = new googleMaps.LatLngBounds();

      const crearIconoVehiculo = (fotoUrl?: string) => {
        if (fotoUrl) {
          const fotoSegura = escaparHtml(fotoUrl);
          const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="68" height="68" viewBox="0 0 68 68">
              <defs>
                <clipPath id="fotoVehiculoClip">
                  <circle cx="34" cy="34" r="24" />
                </clipPath>
                <filter id="sombra" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.35" />
                </filter>
              </defs>
              <circle cx="34" cy="34" r="30" fill="#ffffff" filter="url(#sombra)" />
              <circle cx="34" cy="34" r="28" fill="#f97316" />
              <circle cx="34" cy="34" r="25" fill="#ffffff" />
              <image href="${fotoSegura}" x="10" y="10" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#fotoVehiculoClip)" />
              <circle cx="34" cy="34" r="25" fill="none" stroke="#f97316" stroke-width="4" />
            </svg>`;

          return {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
            scaledSize: new googleMaps.Size(68, 68),
            anchor: new googleMaps.Point(34, 34),
          };
        }

        return {
          path: googleMaps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#f97316",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 5,
        };
      };

      movilesConUbicacion.forEach((movil) => {
        if (!movil.ubicacion) return;

        const personalHtml = movil.personal.length
          ? movil.personal
              .map(
                (persona) =>
                  `<li><strong>${escaparHtml(persona.nombre)}</strong><br/><span>${escaparHtml(persona.tipoFuncionario)} · ${escaparHtml(persona.rol)}</span></li>`,
              )
              .join("")
          : "<li>Sin personal asignado</li>";

        const tieneFoto = Boolean(movil.fotoUrl);
        const marker = new googleMaps.Marker({
          position: { lat: movil.ubicacion.lat, lng: movil.ubicacion.lng },
          map: mapaAdminRef.current,
          title: movil.nombre,
          icon: crearIconoVehiculo(movil.fotoUrl),
          animation: googleMaps.Animation?.BOUNCE,
          optimized: false,
          zIndex: 100,
          label: tieneFoto
            ? undefined
            : {
                text: movil.nombre.slice(0, 10),
                fontSize: "10px",
                fontWeight: "900",
                color: "#ffffff",
              },
        });

        window.setTimeout(() => {
          if (marker.getAnimation && marker.setAnimation) marker.setAnimation(null);
        }, 1800);

        marker.addListener("click", () => {
          setMovilMapaSeleccionado(movil);
          if (marker.setAnimation) {
            marker.setAnimation(googleMaps.Animation?.BOUNCE);
            window.setTimeout(() => marker.setAnimation(null), 1400);
          }
          if (streetViewAdminRef.current && movil.ubicacion) {
            streetViewAdminRef.current.setPosition({ lat: movil.ubicacion.lat, lng: movil.ubicacion.lng });
            streetViewAdminRef.current.setPov({ heading: 0, pitch: 0 });
            streetViewAdminRef.current.setVisible(true);
          }
          infoWindowAdminRef.current.setContent(`
            <div style="min-width:230px;max-width:290px;font-family:Arial,sans-serif">
              ${movil.fotoUrl ? `<div style="height:92px;border-radius:14px;overflow:hidden;margin-bottom:10px;background:#e2e8f0"><img src="${escaparHtml(movil.fotoUrl)}" alt="${escaparHtml(movil.nombre)}" style="width:100%;height:100%;object-fit:cover"/></div>` : ""}
              <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px">${escaparHtml(movil.nombre)}</div>
              <div style="font-size:12px;color:#475569;margin-bottom:8px">${escaparHtml(movil.placa)} · ${escaparHtml(movil.tipo)}</div>
              <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px">Última ubicación: ${escaparHtml(movil.ubicacion?.fecha || "Sin fecha")}</div>
              <div style="font-size:12px;font-weight:800;color:#334155;margin-bottom:4px">Personal asignado</div>
              <ul style="padding-left:16px;margin:0;font-size:12px;color:#475569;display:grid;gap:6px">${personalHtml}</ul>
            </div>
          `);
          infoWindowAdminRef.current.open(mapaAdminRef.current, marker);
        });

        markersAdminRef.current.push(marker);
        bounds.extend(marker.getPosition());
      });

      if (movilesConUbicacion.length === 1) {
        mapaAdminRef.current.setCenter(movilesConUbicacion[0].ubicacion);
        mapaAdminRef.current.setZoom(15);
      } else if (movilesConUbicacion.length > 1) {
        mapaAdminRef.current.fitBounds(bounds);
      }
    };

    (window as any).initAllMaps = inicializarMapa;

    if ((window as any).google?.maps) {
      window.setTimeout(inicializarMapa, 80);
      return;
    }

    const existente = document.getElementById(MAPS_SCRIPT_ID) as HTMLScriptElement | null;
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
  }, [movilesMapa]);

  const cambiarLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !clienteSesion?.clienteId) return;

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

      const storageRef = ref(
        storage,
        `clientes/${clienteSesion.clienteId}/logo/logo_cliente`,
      );
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);

      await setDoc(
        doc(db, "clientes", clienteSesion.clienteId),
        { logoUrl: url, logoActualizadoAt: new Date().toISOString() },
        { merge: true },
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

  const actualizarEstadoTareaAdmin = async (tarea: TareaProgramadaAdmin, estadoFinal: "realizado" | "no realizado" | "incompleto") => {
    if (!clienteSesion?.clienteId || guardandoTareaAdmin) return;
    setGuardandoTareaAdmin(true);
    try {
      await setDoc(
        doc(db, "clientes", clienteSesion.clienteId, "tareasProgramadas", tarea.id),
        {
          estadoFinal,
          estado: estadoFinal,
          gestionadoPor: nombreCliente,
          gestionadoPorEmail: user?.email || "",
          fechaGestion: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      if (estadoFinal === "realizado") setTareaAdminDetalle(null);
    } catch (error) {
      console.error("Error actualizando tarea del admin:", error);
    } finally {
      setGuardandoTareaAdmin(false);
    }
  };

  const enviarMensajeTareaAdmin = async (tarea: TareaProgramadaAdmin) => {
    if (!clienteSesion?.clienteId || !mensajeChatTareaAdmin.trim() || guardandoTareaAdmin) return;
    setGuardandoTareaAdmin(true);
    try {
      const nuevoMensaje: ChatTareaAdmin = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        autor: nombreCliente,
        rol: "admin",
        mensaje: mensajeChatTareaAdmin.trim(),
        fecha: new Date().toISOString(),
      };
      await setDoc(
        doc(db, "clientes", clienteSesion.clienteId, "tareasProgramadas", tarea.id),
        { chatTarea: [...(tarea.chatTarea || []), nuevoMensaje], updatedAt: new Date().toISOString() },
        { merge: true },
      );
      setMensajeChatTareaAdmin("");
    } catch (error) {
      console.error("Error enviando mensaje de tarea:", error);
    } finally {
      setGuardandoTareaAdmin(false);
    }
  };

  const cerrarSesion = async () => {
    try {
      await signOut(auth);
      window.localStorage.removeItem("clienteSesion");
      router.replace("/login_users");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    }
  };

  const abrirOrigenAlertaDocumento = (alerta: AlertaDocumento) => {
    if (!alerta.usuarioId) {
      setAlertaDetalle(alerta);
      return;
    }

    const destinoDocumentos = `/configuraciones/usuarios?usuarioId=${encodeURIComponent(
      alerta.usuarioId,
    )}&abrir=documentos&origen=alertaDocumento`;

    router.push(destinoDocumentos);
  };

  const abrirOrigenAlertaMovil = (alerta: AlertaMovil) => {
    const esInfraccion = alerta.vencimientosDetalle.some(
      (item) => item.tipoAlerta === "INFRACCION",
    );

    if (esInfraccion) {
      router.push("/configuraciones/infracciones?origen=alertaVehiculo");
      return;
    }

    if (!alerta.movilId) {
      setAlertaMovilDetalle(alerta);
      return;
    }

    router.push(
      `/configuraciones/ubicaciones?movilId=${encodeURIComponent(
        alerta.movilId,
      )}&abrir=movil&origen=alertaMovil`,
    );
  };

  const abrirOrigenAlertaAutoevaluacion = (alerta: AlertaAutoevaluacion) => {
    router.push(
      `/configuraciones/autoevaluacion?categoria=${encodeURIComponent(
        alerta.categoria,
      )}&producto=${encodeURIComponent(
        alerta.producto,
      )}&codigo=${encodeURIComponent(
        alerta.codigoBarras,
      )}&abrir=producto&origen=alertaAutoevaluacion`,
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f5fa] flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-xl border border-slate-100 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-semibold text-slate-600">
            Validando sesión...
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
            {!menuCollapsed && (
              <>
                <label className="mt-3 block cursor-pointer text-[10px] font-bold text-indigo-200 hover:text-white">
                  <input type="file" accept="image/*" onChange={cambiarLogo} className="hidden" />
                  {subiendoLogo ? "Subiendo logo..." : "Cambiar logo"}
                </label>
                {mensajeLogo && <p className="mt-1 max-w-[180px] text-[10px] font-semibold text-white/45">{mensajeLogo}</p>}
                <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>
              </>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto py-5 ${menuCollapsed ? "px-2" : "px-4"}`}>
            <Link
              href="/dashboard"
              title="Inicio"
              className={`flex items-center rounded-2xl px-4 py-3 text-sm font-bold transition ${menuCollapsed ? "justify-center" : "gap-3"} ${
                pathname === "/dashboard"
                  ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {menuCollapsed ? "I" : "Inicio"}
            </Link>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setConfigOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="1. Configuraciones"
                aria-expanded={configOpen}
              >
                <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{configOpen ? "▲" : "▼"}</span>}
              </button>
              {configOpen && (
                <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                  <Link href="/configuraciones/empresa" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/empresa" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.1" : "1.1 Empresa"}</Link>
                  <Link href="/configuraciones/usuarios" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/usuarios" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.2" : "1.2 Usuarios y Roles"}</Link>
                  <Link href="/configuraciones/ubicaciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/ubicaciones" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "1.3" : "1.3 Móviles y Bodegas"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setOperativaOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="2. Área operativa"
                aria-expanded={operativaOpen}
              >
                <span>{menuCollapsed ? "2" : "2. Área operativa"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{operativaOpen ? "▲" : "▼"}</span>}
              </button>
              {operativaOpen && (
                <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                  <Link href="/configuraciones/autoevaluacion" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/autoevaluacion" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.1" : "2.1 Autoevaluación General"}</Link>
                  <Link href="/configuraciones/asignaciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/asignaciones" ? "bg-indigo-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "2.2" : "2.2 Asignaciones a Móviles"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setMovilesOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="3. Móviles"
                aria-expanded={movilesOpen}
              >
                <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{movilesOpen ? "▲" : "▼"}</span>}
              </button>
              {movilesOpen && (
                <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                  <Link href="/configuraciones/verificaciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/verificaciones" ? "bg-amber-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.1" : "3.1 Verificación diaria"}</Link>
                  <Link href="/configuraciones/mantenimientos" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/mantenimientos" ? "bg-amber-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.2" : "3.2 Programación de Mantenimientos"}</Link>
                  <Link href="/configuraciones/infracciones" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/infracciones" ? "bg-amber-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "3.3" : "3.3 Gestión de Infracciones"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setTareasOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="4. Tareas"
                aria-expanded={tareasOpen}
              >
                <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{tareasOpen ? "▲" : "▼"}</span>}
              </button>
              {tareasOpen && (
                <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                  <Link href="/configuraciones/tareas" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/tareas" ? "bg-emerald-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "4.1" : "4.1 Programar tareas"}</Link>
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setSoporteOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="5. Soporte"
                aria-expanded={soporteOpen}
              >
                <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{soporteOpen ? "▲" : "▼"}</span>}
              </button>
              {soporteOpen && (
                <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-1">
                  <Link href="/configuraciones/soporte" className={`flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${menuCollapsed ? "justify-center" : "pl-7"} ${pathname === "/configuraciones/soporte" ? "bg-sky-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{menuCollapsed ? "5.1" : "5.1 Solicitar un soporte"}</Link>
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
                {nombreCliente}
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
                onClick={() => setModalNotificacionesSoporte(true)}
                className="relative rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25"
                title="Respuestas de soporte"
                aria-label="Respuestas de soporte"
              >
                🔔
                {notificacionesSoporte.length > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-lg">
                    {notificacionesSoporte.length}
                  </span>
                )}
              </button>

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
          <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">Mis tareas administrativas</p>
                <h2 className="mt-1 text-lg font-black text-slate-800">Tareas asignadas al admin</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{tareasAdminFiltradas.length} pendiente(s) o incompleta(s) por gestionar.</p>
              </div>
              <div className="rounded-2xl bg-violet-50 px-4 py-2 text-center">
                <p className="text-2xl font-black text-violet-600">{tareasAdmin.length}</p>
                <p className="text-[9px] font-black uppercase tracking-wide text-violet-600/80">Activas</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[260px_1fr] lg:items-start">
              <input type="search" value={busquedaTareasAdmin} onChange={(event) => setBusquedaTareasAdmin(event.target.value)} placeholder="Buscar tarea, prioridad o estado..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white" />
              {tareasAdmin.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-center text-sm font-black text-emerald-700">Sin tareas administrativas pendientes.</div>
              ) : tareasAdminFiltradas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-black text-slate-500">Sin resultados para la búsqueda.</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2">Tarea</th><th className="hidden px-3 py-2 sm:table-cell">Prioridad</th><th className="hidden px-3 py-2 sm:table-cell">Fecha máxima</th><th className="px-3 py-2 text-right">Gestión</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {tareasAdminPaginadas.map((tarea) => (
                        <tr key={tarea.id} className="bg-white align-top hover:bg-violet-50/50">
                          <td className="px-3 py-2"><p className="font-black text-slate-800">{tarea.titulo}</p><p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-500">{tarea.descripcion}</p><p className="mt-1 text-[10px] font-bold text-slate-400">Estado: {tarea.estadoFinal}</p></td>
                          <td className="hidden px-3 py-2 sm:table-cell"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${tarea.prioridad.toLowerCase().includes("inmediato") ? "bg-red-50 text-red-700" : tarea.prioridad.toLowerCase().includes("alta") ? "bg-orange-50 text-orange-700" : tarea.prioridad.toLowerCase().includes("media") ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{tarea.prioridad}</span></td>
                          <td className="hidden px-3 py-2 text-xs font-bold text-slate-500 sm:table-cell">{tarea.fechaMaxima}</td>
                          <td className="px-3 py-2 text-right"><button type="button" onClick={() => { setTareaAdminDetalle(tarea); setMensajeChatTareaAdmin(""); }} className="rounded-xl bg-violet-50 px-3 py-2 text-[10px] font-black text-violet-700 hover:bg-violet-100">Gestionar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {tareasAdminFiltradas.length > 0 && (
              <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-black text-slate-500"><button type="button" disabled={paginaTareasAdmin <= 1} onClick={() => setPaginaTareasAdmin((actual) => Math.max(1, actual - 1))} className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button><span>{paginaTareasAdmin}/{totalPaginasTareasAdmin}</span><button type="button" disabled={paginaTareasAdmin >= totalPaginasTareasAdmin} onClick={() => setPaginaTareasAdmin((actual) => Math.min(totalPaginasTareasAdmin, actual + 1))} className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button></div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Mapa operativo
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-800">
                  Ubicación de móviles
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {movilesMapa.filter((movil) => movil.ubicacion).length} móvil(es) reportando ubicación · {movilesMapa.length} registrada(s)
                </p>
              </div>
              <div className="rounded-2xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700">
                Clic en el marcador para ver personal
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 xl:col-span-6">
                <div className="border-b border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Mapa satelital
                </div>
                <div
                  ref={mapaMovilesRef}
                  className="h-[420px] w-full bg-slate-100"
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4 xl:col-span-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Personal asignado
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-800">
                      {movilMapaSeleccionado?.nombre || "Seleccione una móvil"}
                    </h3>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">
                      {movilMapaSeleccionado
                        ? `${movilMapaSeleccionado.placa} · ${movilMapaSeleccionado.denominacion}`
                        : "Clic en un marcador del mapa"}
                    </p>
                  </div>
                  {movilMapaSeleccionado?.fotoUrl ? (
                    <img
                      src={movilMapaSeleccionado.fotoUrl}
                      alt={movilMapaSeleccionado.nombre}
                      className="h-12 w-12 rounded-2xl object-cover ring-2 ring-orange-100"
                    />
                  ) : null}
                </div>

                <div className="mt-4 max-h-[356px] space-y-3 overflow-y-auto pr-1">
                  {!movilMapaSeleccionado ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-bold text-slate-400">
                      Selecciona una móvil en el mapa para ver el personal asignado.
                    </div>
                  ) : movilMapaSeleccionado.personal.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-bold text-slate-400">
                      Esta móvil no tiene personal asignado.
                    </div>
                  ) : (
                    movilMapaSeleccionado.personal.map((persona) => (
                      <article
                        key={persona.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                      >
                        <p className="text-sm font-black text-slate-800">
                          {persona.nombre}
                        </p>
                        <p className="mt-1 text-xs font-bold text-indigo-600">
                          {persona.tipoFuncionario}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400">
                          {persona.rol}
                        </p>
                        {persona.email ? (
                          <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                            {persona.email}
                          </p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 xl:col-span-3">
                <div className="border-b border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Street View
                </div>
                <div
                  ref={streetViewMovilesRef}
                  className="h-[420px] w-full bg-slate-100"
                />
              </div>
            </div>

            {cargandoMovilesMapa ? (
              <p className="mt-3 text-xs font-bold text-slate-400">
                Cargando ubicaciones de móviles...
              </p>
            ) : movilesMapa.filter((movil) => movil.ubicacion).length === 0 ? (
              <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                Ninguna móvil ha reportado ubicación desde el dashboard del usuario.
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {movilesMapa
                  .filter((movil) => movil.ubicacion)
                  .map((movil) => (
                    <span
                      key={movil.id}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700"
                    >
                      {movil.nombre}
                    </span>
                  ))}
              </div>
            )}
          </section>

          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">
                      Alertas
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-800">
                      Documentos
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Resumen documental pendiente.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center">
                    <p className="text-xl font-black text-amber-600">
                      {alertasDocumentos.length}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-wide text-amber-600/80">
                      Activas
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="search"
                    value={busquedaAlertas}
                    onChange={(event) => setBusquedaAlertas(event.target.value)}
                    placeholder="Buscar usuario..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white"
                  />
                </div>

                <div className="mt-4">
                  {cargandoAlertas ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-500">
                      Cargando alertas...
                    </div>
                  ) : alertasDocumentos.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-emerald-700">
                        Sin alertas
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-600">
                        Documentos al 100% aprobado.
                      </p>
                    </div>
                  ) : alertasFiltradas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-slate-600">
                        Sin resultados
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        No hay alertas con ese nombre.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:hidden">
                        {alertasPaginadas.map((alerta) => (
                          <button
                            key={alerta.id}
                            type="button"
                            onClick={() => abrirOrigenAlertaDocumento(alerta)}
                            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left transition active:bg-indigo-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800">
                                  {alerta.nombreUsuario}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                                  {alerta.tipoFuncionario}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                                  alerta.noCumplen > 0
                                    ? "bg-red-50 text-red-600"
                                    : alerta.porcentaje < 50
                                      ? "bg-orange-50 text-orange-600"
                                      : "bg-amber-50 text-amber-600"
                                }`}
                              >
                                {alerta.porcentaje}%
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-500">
                              {alerta.mensaje}
                            </p>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${
                                  alerta.noCumplen > 0
                                    ? "bg-red-500"
                                    : alerta.porcentaje < 50
                                      ? "bg-orange-500"
                                      : "bg-amber-500"
                                }`}
                                style={{
                                  width: `${Math.max(alerta.porcentaje, 4)}%`,
                                }}
                              />
                            </div>
                            <p className="mt-2 text-[10px] font-bold text-indigo-600">
                              Toca para abrir ficha
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 sm:block">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Usuario</th>
                              <th className="px-3 py-2 text-center">%</th>
                              <th className="px-3 py-2 text-right">Detalle</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {alertasPaginadas.map((alerta) => (
                              <tr
                                key={alerta.id}
                                onClick={() => abrirOrigenAlertaDocumento(alerta)}
                                className="cursor-pointer bg-white align-top transition hover:bg-indigo-50/60"
                              >
                                <td className="px-3 py-2">
                                  <p className="max-w-[130px] truncate font-black text-slate-800">
                                    {alerta.nombreUsuario}
                                  </p>
                                  <p className="max-w-[130px] truncate text-[10px] font-semibold text-slate-400">
                                    {alerta.tipoFuncionario}
                                  </p>
                                  <p className="mt-1 max-w-[180px] line-clamp-2 text-[10px] font-semibold text-slate-500">
                                    {alerta.mensaje}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${
                                      alerta.noCumplen > 0
                                        ? "bg-red-50 text-red-600"
                                        : alerta.porcentaje < 50
                                          ? "bg-orange-50 text-orange-600"
                                          : "bg-amber-50 text-amber-600"
                                    }`}
                                  >
                                    {alerta.porcentaje}%
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      abrirOrigenAlertaDocumento(alerta);
                                    }}
                                    className="rounded-xl bg-indigo-50 px-2 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"
                                  >
                                    Abrir
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {alertasFiltradas.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black text-slate-500">
                    <button
                      type="button"
                      disabled={paginaAlertas <= 1}
                      onClick={() =>
                        setPaginaAlertas((actual) => Math.max(1, actual - 1))
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>
                      {paginaAlertas}/{totalPaginasAlertas}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAlertas >= totalPaginasAlertas}
                      onClick={() =>
                        setPaginaAlertas((actual) =>
                          Math.min(totalPaginasAlertas, actual + 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </article>

              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-red-500">
                      Alertas
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-800">
                      Vehículos
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Vencimientos e infracciones de móviles.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-red-50 px-3 py-2 text-center">
                    <p className="text-xl font-black text-red-600">
                      {alertasVehiculosCombinadas.length}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-wide text-red-600/80">
                      Activas
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="search"
                    value={busquedaAlertasMoviles}
                    onChange={(event) => setBusquedaAlertasMoviles(event.target.value)}
                    placeholder="Buscar móvil o placa..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white"
                  />
                </div>

                <div className="mt-4">
                  {cargandoAlertas ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-500">
                      Cargando alertas...
                    </div>
                  ) : alertasVehiculosCombinadas.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-emerald-700">
                        Sin alertas
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-600">
                        Vehículos sin vencimientos próximos ni infracciones activas.
                      </p>
                    </div>
                  ) : alertasMovilesFiltradas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-slate-600">
                        Sin resultados
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        No hay alertas con esa búsqueda.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:hidden">
                        {alertasMovilesPaginadas.map((alerta) => (
                          <button
                            key={alerta.id}
                            type="button"
                            onClick={() => setAlertaMovilDetalle(alerta)}
                            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left transition active:bg-red-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800">
                                  {alerta.nombre}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                                  {alerta.placa} · {alerta.denominacion}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                                  alerta.vencidos > 0
                                    ? "bg-red-50 text-red-600"
                                    : "bg-amber-50 text-amber-600"
                                }`}
                              >
                                {alerta.totalAlertas}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-500">
                              {alerta.mensaje}
                            </p>
                            <p className="mt-2 text-[10px] font-bold text-red-600">
                              Toca para ver motivo
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 sm:block">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Móvil</th>
                              <th className="px-3 py-2 text-center">Alertas</th>
                              <th className="px-3 py-2 text-right">Detalle</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {alertasMovilesPaginadas.map((alerta) => (
                              <tr
                                key={alerta.id}
                                onClick={() => setAlertaMovilDetalle(alerta)}
                                className="cursor-pointer bg-white align-top transition hover:bg-red-50/60"
                              >
                                <td className="px-3 py-2">
                                  <p className="max-w-[130px] truncate font-black text-slate-800">
                                    {alerta.nombre}
                                  </p>
                                  <p className="max-w-[130px] truncate text-[10px] font-semibold text-slate-400">
                                    {alerta.placa}
                                  </p>
                                  <p className="mt-1 max-w-[180px] line-clamp-2 text-[10px] font-semibold text-slate-500">
                                    {alerta.mensaje}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${
                                      alerta.vencidos > 0
                                        ? "bg-red-50 text-red-600"
                                        : "bg-amber-50 text-amber-600"
                                    }`}
                                  >
                                    {alerta.totalAlertas}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setAlertaMovilDetalle(alerta);
                                    }}
                                    className="rounded-xl bg-red-50 px-2 py-1.5 text-[10px] font-black text-red-700 hover:bg-red-100"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {alertasMovilesFiltradas.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black text-slate-500">
                    <button
                      type="button"
                      disabled={paginaAlertasMoviles <= 1}
                      onClick={() =>
                        setPaginaAlertasMoviles((actual) => Math.max(1, actual - 1))
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>
                      {paginaAlertasMoviles}/{totalPaginasAlertasMoviles}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAlertasMoviles >= totalPaginasAlertasMoviles}
                      onClick={() =>
                        setPaginaAlertasMoviles((actual) =>
                          Math.min(totalPaginasAlertasMoviles, actual + 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </article>


              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-sky-500">
                      Alertas
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-800">
                      Autoevaluación
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Productos pendientes o vencidos.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-sky-50 px-3 py-2 text-center">
                    <p className="text-xl font-black text-sky-600">
                      {alertasAutoevaluacion.length}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-wide text-sky-600/80">
                      Activas
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="search"
                    value={busquedaAlertasAutoevaluacion}
                    onChange={(event) => setBusquedaAlertasAutoevaluacion(event.target.value)}
                    placeholder="Buscar categoría o producto..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white"
                  />
                </div>

                <div className="mt-4">
                  {cargandoAlertas ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-500">
                      Cargando alertas...
                    </div>
                  ) : alertasAutoevaluacion.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-emerald-700">
                        Sin alertas
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-600">
                        Autoevaluación sin pendientes activos.
                      </p>
                    </div>
                  ) : alertasAutoevaluacionFiltradas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-slate-600">
                        Sin resultados
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        No hay alertas con esa búsqueda.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:hidden">
                        {alertasAutoevaluacionPaginadas.map((alerta) => (
                          <button
                            key={alerta.id}
                            type="button"
                            onClick={() => setAlertaAutoevaluacionDetalle(alerta)}
                            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left transition active:bg-sky-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800">
                                  {alerta.producto}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                                  {alerta.categoria}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-600">
                                Activa
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-500">
                              {alerta.motivo || alerta.mensaje}
                            </p>
                            <p className="mt-2 text-[10px] font-bold text-sky-600">
                              Toca para ver motivo
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 sm:block">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Producto</th>
                              <th className="px-3 py-2 text-center">Estado</th>
                              <th className="px-3 py-2 text-right">Detalle</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {alertasAutoevaluacionPaginadas.map((alerta) => (
                              <tr
                                key={alerta.id}
                                onClick={() => setAlertaAutoevaluacionDetalle(alerta)}
                                className="cursor-pointer bg-white align-top transition hover:bg-sky-50/60"
                              >
                                <td className="px-3 py-2">
                                  <p className="max-w-[150px] truncate font-black text-slate-800">
                                    {alerta.producto}
                                  </p>
                                  <p className="max-w-[150px] truncate text-[10px] font-semibold text-slate-400">
                                    {alerta.categoria}
                                  </p>
                                  <p className="mt-1 max-w-[190px] line-clamp-2 text-[10px] font-semibold text-slate-500">
                                    {alerta.motivo || alerta.mensaje}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-flex rounded-full bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700">
                                    {alerta.estado || "Activa"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setAlertaAutoevaluacionDetalle(alerta);
                                    }}
                                    className="rounded-xl bg-sky-50 px-2 py-1.5 text-[10px] font-black text-sky-700 hover:bg-sky-100"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {alertasAutoevaluacionFiltradas.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black text-slate-500">
                    <button
                      type="button"
                      disabled={paginaAlertasAutoevaluacion <= 1}
                      onClick={() =>
                        setPaginaAlertasAutoevaluacion((actual) => Math.max(1, actual - 1))
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>
                      {paginaAlertasAutoevaluacion}/{totalPaginasAlertasAutoevaluacion}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAlertasAutoevaluacion >= totalPaginasAlertasAutoevaluacion}
                      onClick={() =>
                        setPaginaAlertasAutoevaluacion((actual) =>
                          Math.min(totalPaginasAlertasAutoevaluacion, actual + 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </article>

              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-sky-500">
                      Alertas
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-800">
                      Autoevaluación x móvil
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Móviles con ítems pendientes o usados.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-sky-50 px-3 py-2 text-center">
                    <p className="text-xl font-black text-sky-600">
                      {alertasAutoevaluacionMovil.length}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-wide text-sky-600/80">
                      Con alerta
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="search"
                    value={busquedaAlertasAutoevaluacionMovil}
                    onChange={(event) => setBusquedaAlertasAutoevaluacionMovil(event.target.value)}
                    placeholder="Buscar móvil o placa..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white"
                  />
                </div>

                <div className="mt-4">
                  {cargandoAlertas ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-500">
                      Cargando alertas...
                    </div>
                  ) : alertasAutoevaluacionMovil.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-emerald-700">
                        Sin alertas
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-600">
                        Todas las móviles tienen autoevaluación al día.
                      </p>
                    </div>
                  ) : alertasAutoevaluacionMovilFiltradas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-slate-600">
                        Sin resultados
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        No hay móviles con esa búsqueda.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:hidden">
                        {alertasAutoevaluacionMovilPaginadas.map((alerta) => (
                          <button
                            key={alerta.id}
                            type="button"
                            onClick={() => setAlertaAutoevaluacionMovilDetalle(alerta)}
                            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left transition active:bg-sky-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800">
                                  {alerta.nombre}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                                  {alerta.placa} · {alerta.pendientes} pendiente(s)
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-600">
                                {alerta.porcentaje}%
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-500">
                              {alerta.mensaje}
                            </p>
                            <p className="mt-2 text-[10px] font-bold text-sky-600">
                              Toca para ver motivos
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 sm:block">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Móvil</th>
                              <th className="px-3 py-2 text-center">Con alerta</th>
                              <th className="px-3 py-2 text-right">Ver</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {alertasAutoevaluacionMovilPaginadas.map((alerta) => (
                              <tr
                                key={alerta.id}
                                onClick={() => setAlertaAutoevaluacionMovilDetalle(alerta)}
                                className="cursor-pointer bg-white align-top transition hover:bg-sky-50/60"
                              >
                                <td className="px-3 py-2">
                                  <p className="max-w-[140px] truncate font-black text-slate-800">
                                    {alerta.nombre}
                                  </p>
                                  <p className="max-w-[140px] truncate text-[10px] font-semibold text-slate-400">
                                    {alerta.placa}
                                  </p>
                                  <p className="mt-1 max-w-[190px] line-clamp-2 text-[10px] font-semibold text-slate-500">
                                    {alerta.diligenciados}/{alerta.totalItems} diligenciados · {alerta.pendientes} pendiente(s)
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${alerta.conAlerta ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>
                                    {alerta.conAlerta ? "Sí" : "No"}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setAlertaAutoevaluacionMovilDetalle(alerta);
                                    }}
                                    className="rounded-xl bg-sky-50 px-2 py-1.5 text-[10px] font-black text-sky-700 hover:bg-sky-100"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {alertasAutoevaluacionMovilFiltradas.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black text-slate-500">
                    <button
                      type="button"
                      disabled={paginaAlertasAutoevaluacionMovil <= 1}
                      onClick={() =>
                        setPaginaAlertasAutoevaluacionMovil((actual) => Math.max(1, actual - 1))
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>
                      {paginaAlertasAutoevaluacionMovil}/{totalPaginasAlertasAutoevaluacionMovil}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAlertasAutoevaluacionMovil >= totalPaginasAlertasAutoevaluacionMovil}
                      onClick={() =>
                        setPaginaAlertasAutoevaluacionMovil((actual) =>
                          Math.min(totalPaginasAlertasAutoevaluacionMovil, actual + 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </article>

              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">
                      Alertas
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-800">
                      Verificaciones diarias
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Móviles sin verificación al 100% o con novedades.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-violet-50 px-3 py-2 text-center">
                    <p className="text-xl font-black text-violet-600">
                      {alertasVerificacionDiaria.length}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-wide text-violet-600/80">
                      Activas
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="search"
                    value={busquedaAlertasVerificacionDiaria}
                    onChange={(event) => setBusquedaAlertasVerificacionDiaria(event.target.value)}
                    placeholder="Buscar móvil, placa o fecha..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white"
                  />
                </div>

                <div className="mt-4">
                  {cargandoAlertas ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-500">
                      Cargando alertas...
                    </div>
                  ) : alertasVerificacionDiaria.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-emerald-700">
                        Sin alertas
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-600">
                        Verificaciones diarias completas.
                      </p>
                    </div>
                  ) : alertasVerificacionDiariaFiltradas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-slate-600">
                        Sin resultados
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        No hay verificaciones con esa búsqueda.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:hidden">
                        {alertasVerificacionDiariaPaginadas.map((alerta) => (
                          <button
                            key={alerta.id}
                            type="button"
                            onClick={() => setAlertaVerificacionDiariaDetalle(alerta)}
                            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left transition active:bg-violet-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800">
                                  {alerta.nombre}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                                  {alerta.placa} · {alerta.fecha || "Sin fecha"}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-600">
                                {alerta.porcentaje}%
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-500">
                              {alerta.mensaje}
                            </p>
                            <p className="mt-2 text-[10px] font-bold text-violet-600">
                              Toca para ver motivos
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 sm:block">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Móvil</th>
                              <th className="px-3 py-2 text-center">Con alerta</th>
                              <th className="px-3 py-2 text-right">Ver</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {alertasVerificacionDiariaPaginadas.map((alerta) => (
                              <tr
                                key={alerta.id}
                                onClick={() => setAlertaVerificacionDiariaDetalle(alerta)}
                                className="cursor-pointer bg-white align-top transition hover:bg-violet-50/60"
                              >
                                <td className="px-3 py-2">
                                  <p className="max-w-[140px] truncate font-black text-slate-800">
                                    {alerta.nombre}
                                  </p>
                                  <p className="max-w-[140px] truncate text-[10px] font-semibold text-slate-400">
                                    {alerta.placa}
                                  </p>
                                  <p className="mt-1 max-w-[190px] line-clamp-2 text-[10px] font-semibold text-slate-500">
                                    {alerta.diligenciados}/{alerta.totalItems} diligenciados · {alerta.pendientes} pendiente(s)
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-flex rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">
                                    Sí
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setAlertaVerificacionDiariaDetalle(alerta);
                                    }}
                                    className="rounded-xl bg-violet-50 px-2 py-1.5 text-[10px] font-black text-violet-700 hover:bg-violet-100"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {alertasVerificacionDiariaFiltradas.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black text-slate-500">
                    <button
                      type="button"
                      disabled={paginaAlertasVerificacionDiaria <= 1}
                      onClick={() =>
                        setPaginaAlertasVerificacionDiaria((actual) => Math.max(1, actual - 1))
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>
                      {paginaAlertasVerificacionDiaria}/{totalPaginasAlertasVerificacionDiaria}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAlertasVerificacionDiaria >= totalPaginasAlertasVerificacionDiaria}
                      onClick={() =>
                        setPaginaAlertasVerificacionDiaria((actual) =>
                          Math.min(totalPaginasAlertasVerificacionDiaria, actual + 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </article>

              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
                      Tareas
                    </p>
                    <h3 className="mt-1 text-base font-black text-slate-800">
                      Mantenimientos
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Órdenes incompletas o sin realizar.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-orange-50 px-3 py-2 text-center">
                    <p className="text-xl font-black text-orange-600">
                      {alertasMantenimientos.length}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-wide text-orange-600/80">
                      Activas
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="search"
                    value={busquedaAlertasMantenimientos}
                    onChange={(event) => setBusquedaAlertasMantenimientos(event.target.value)}
                    placeholder="Buscar móvil, estado o conductor..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-orange-300 focus:bg-white"
                  />
                </div>

                <div className="mt-4">
                  {alertasMantenimientos.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-emerald-700">
                        Sin tareas pendientes
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-600">
                        No hay mantenimientos incompletos o sin realizar.
                      </p>
                    </div>
                  ) : alertasMantenimientosFiltradas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center">
                      <p className="text-sm font-black text-slate-600">
                        Sin resultados
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        No hay mantenimientos con esa búsqueda.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 sm:hidden">
                        {alertasMantenimientosPaginadas.map((alerta) => (
                          <button
                            key={alerta.id}
                            type="button"
                            onClick={() => setAlertaMantenimientoDetalle(alerta)}
                            className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left transition active:bg-orange-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-800">
                                  {alerta.movilNombre}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                                  {alerta.placa} · {alerta.fecha}
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${alerta.estadoGestion.toLowerCase().includes("incompleto") ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                {alerta.estadoGestion}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-500">
                              {alerta.mensaje}
                            </p>
                            <p className="mt-2 text-[10px] font-bold text-orange-600">
                              Toca para ver detalle
                            </p>
                          </button>
                        ))}
                      </div>

                      <div className="hidden overflow-hidden rounded-2xl border border-slate-100 sm:block">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Móvil</th>
                              <th className="px-3 py-2 text-center">Estado</th>
                              <th className="px-3 py-2 text-right">Ver</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {alertasMantenimientosPaginadas.map((alerta) => (
                              <tr
                                key={alerta.id}
                                onClick={() => setAlertaMantenimientoDetalle(alerta)}
                                className="cursor-pointer bg-white align-top transition hover:bg-orange-50/60"
                              >
                                <td className="px-3 py-2">
                                  <p className="max-w-[140px] truncate font-black text-slate-800">
                                    {alerta.movilNombre}
                                  </p>
                                  <p className="max-w-[140px] truncate text-[10px] font-semibold text-slate-400">
                                    {alerta.placa}
                                  </p>
                                  <p className="mt-1 max-w-[190px] line-clamp-2 text-[10px] font-semibold text-slate-500">
                                    {alerta.tipoMantenimiento} · {alerta.sistema} · {alerta.asignadoNombre}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${alerta.estadoGestion.toLowerCase().includes("incompleto") ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                    {alerta.estadoGestion}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setAlertaMantenimientoDetalle(alerta);
                                    }}
                                    className="rounded-xl bg-orange-50 px-2 py-1.5 text-[10px] font-black text-orange-700 hover:bg-orange-100"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {alertasMantenimientosFiltradas.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black text-slate-500">
                    <button
                      type="button"
                      disabled={paginaAlertasMantenimientos <= 1}
                      onClick={() =>
                        setPaginaAlertasMantenimientos((actual) => Math.max(1, actual - 1))
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span>
                      {paginaAlertasMantenimientos}/{totalPaginasAlertasMantenimientos}
                    </span>
                    <button
                      type="button"
                      disabled={paginaAlertasMantenimientos >= totalPaginasAlertasMantenimientos}
                      onClick={() =>
                        setPaginaAlertasMantenimientos((actual) =>
                          Math.min(totalPaginasAlertasMantenimientos, actual + 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </article>
            </div>
          </section>
        </div>
      </section>


      {tareaAdminDetalle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-violet-600 px-5 py-4 text-white">
              <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-widest text-white/75">Tarea administrativa</p><h3 className="mt-1 truncate text-lg font-black text-white">{tareaAdminDetalle.titulo}</h3><p className="truncate text-xs font-semibold text-white/75">Máxima: {tareaAdminDetalle.fechaMaxima} · Prioridad {tareaAdminDetalle.prioridad}</p></div>
              <button type="button" onClick={() => setTareaAdminDetalle(null)} className="rounded-2xl bg-white/20 px-3 py-2 text-sm font-black text-white hover:bg-white/30">✕</button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Estado</p><p className="mt-1 text-sm font-black text-slate-800">{tareaAdminDetalle.estadoFinal}</p></div><div className="rounded-2xl bg-violet-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-violet-600">Asignada a</p><p className="mt-1 text-sm font-black text-violet-700">{tareaAdminDetalle.asignadoNombre}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Creada por</p><p className="mt-1 text-sm font-black text-slate-800">{tareaAdminDetalle.creadoPor}</p></div></div>
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Descripción</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">{tareaAdminDetalle.descripcion}</p>{tareaAdminDetalle.observaciones && <p className="mt-3 whitespace-pre-line rounded-xl bg-white p-3 text-xs font-semibold leading-5 text-slate-500">{tareaAdminDetalle.observaciones}</p>}</div>
              <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/60 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-violet-700">Comunicación</p><div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">{tareaAdminDetalle.chatTarea.length === 0 ? <p className="rounded-xl bg-white p-3 text-xs font-bold text-slate-400">Sin mensajes todavía.</p> : tareaAdminDetalle.chatTarea.map((mensaje, index) => <div key={`${mensaje.id || index}-tarea-admin-chat`} className="rounded-xl bg-white p-3 text-xs"><div className="flex items-center justify-between gap-2"><p className="font-black text-slate-700">{mensaje.autor || "Usuario"}</p><span className="text-[10px] font-bold text-slate-400">{formatearFechaFirestore(mensaje.fecha)}</span></div><p className="mt-1 whitespace-pre-line font-semibold leading-5 text-slate-500">{mensaje.mensaje}</p></div>)}</div><div className="mt-3 flex gap-2"><input value={mensajeChatTareaAdmin} onChange={(event) => setMensajeChatTareaAdmin(event.target.value)} placeholder="Escribir observación o respuesta..." className="min-w-0 flex-1 rounded-2xl border border-violet-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-violet-300" /><button type="button" disabled={guardandoTareaAdmin || !mensajeChatTareaAdmin.trim()} onClick={() => enviarMensajeTareaAdmin(tareaAdminDetalle)} className="rounded-2xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Enviar</button></div></div>
              <div className="mt-5 grid gap-2 sm:grid-cols-3"><button type="button" disabled={guardandoTareaAdmin} onClick={() => actualizarEstadoTareaAdmin(tareaAdminDetalle, "realizado")} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50">Marcar realizado</button><button type="button" disabled={guardandoTareaAdmin} onClick={() => actualizarEstadoTareaAdmin(tareaAdminDetalle, "incompleto")} className="rounded-2xl bg-amber-500 px-4 py-3 text-xs font-black text-white hover:bg-amber-400 disabled:opacity-50">Marcar incompleto</button><button type="button" disabled={guardandoTareaAdmin} onClick={() => actualizarEstadoTareaAdmin(tareaAdminDetalle, "no realizado")} className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black text-white hover:bg-red-500 disabled:opacity-50">No realizado</button></div>
            </div>
          </div>
        </div>
      )}

      {alertaMantenimientoDetalle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
                  Tarea de mantenimiento
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {alertaMantenimientoDetalle.movilNombre}
                </h3>
                <p className="truncate text-xs font-semibold text-slate-400">
                  {alertaMantenimientoDetalle.placa} · {alertaMantenimientoDetalle.fecha}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertaMantenimientoDetalle(null)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Tipo</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{alertaMantenimientoDetalle.tipoMantenimiento}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Sistema</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{alertaMantenimientoDetalle.sistema}</p>
                </div>
                <div className="rounded-2xl bg-orange-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-orange-600">Estado</p>
                  <p className="mt-1 text-sm font-black text-orange-700">{alertaMantenimientoDetalle.estadoGestion}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">
                {alertaMantenimientoDetalle.mensaje}
              </div>

              <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                <p><b>Conductor:</b> {alertaMantenimientoDetalle.asignadoNombre}</p>
                <p><b>Proveedor:</b> {alertaMantenimientoDetalle.proveedorNombre}</p>
                <p><b>Fecha:</b> {alertaMantenimientoDetalle.fecha}</p>
                <p><b>Actualizado:</b> {alertaMantenimientoDetalle.updatedAt || "Sin dato"}</p>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Detalle</p>
                <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">
                  {alertaMantenimientoDetalle.detalle}
                </p>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/configuraciones/mantenimientos?mantenimientoId=${encodeURIComponent(alertaMantenimientoDetalle.id)}&origen=dashboard`)}
                  className="rounded-2xl bg-orange-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-orange-600/20 hover:bg-orange-500"
                >
                  Ir a mantenimientos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {alertaVerificacionDiariaDetalle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">
                  Verificación diaria
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {alertaVerificacionDiariaDetalle.nombre}
                </h3>
                <p className="truncate text-xs font-semibold text-slate-400">
                  {alertaVerificacionDiariaDetalle.placa} · {alertaVerificacionDiariaDetalle.fecha || "Sin fecha"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setAlertaVerificacionDiariaDetalle(null); setFiltroVerificacionDiariaDetalle("todos"); }}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Total
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800">
                    {alertaVerificacionDiariaDetalle.totalItems}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600">
                    Diligenciados
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-700">
                    {alertaVerificacionDiariaDetalle.diligenciados}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-600">
                    Pendientes
                  </p>
                  <p className="mt-1 text-xl font-black text-amber-700">
                    {alertaVerificacionDiariaDetalle.pendientes}
                  </p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wide text-violet-600">
                    Avance
                  </p>
                  <p className="mt-1 text-xl font-black text-violet-700">
                    {alertaVerificacionDiariaDetalle.porcentaje}%
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">
                {alertaVerificacionDiariaDetalle.mensaje}
              </div>

              <div className="mt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-500">
                    Motivos
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "todos", label: `Todos (${alertaVerificacionDiariaDetalle.motivos.length})` },
                      { key: "pendientes", label: `Pendientes (${alertaVerificacionDiariaDetalle.motivos.filter((motivo) => `${motivo.estado} ${motivo.motivo}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("pendiente") || `${motivo.estado} ${motivo.motivo}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("sin diligenciar")).length})` },
                      { key: "no_aplica", label: `No aplica (${alertaVerificacionDiariaDetalle.motivos.filter((motivo) => `${motivo.estado} ${motivo.motivo}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("no aplica")).length})` },
                      { key: "no_cumple", label: `No cumple (${alertaVerificacionDiariaDetalle.motivos.filter((motivo) => `${motivo.estado} ${motivo.motivo}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("no cumple")).length})` },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setFiltroVerificacionDiariaDetalle(item.key as "todos" | "pendientes" | "no_aplica" | "no_cumple")}
                        className={`rounded-xl px-3 py-2 text-[11px] font-black transition ${
                          filtroVerificacionDiariaDetalle === item.key
                            ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Categoría</th>
                        <th className="px-3 py-2">Ítem</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {motivosVerificacionDiariaDetalleFiltrados.map((motivo, index) => (
                        <tr key={`${motivo.id}-${index}`} className="align-top">
                          <td className="px-3 py-2 font-black text-slate-700">
                            {motivo.categoria}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-bold text-slate-700">{motivo.item}</p>
                            {motivo.codigo && (
                              <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                                {motivo.codigo}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                              motivo.estado.toLowerCase().includes("no cumple")
                                ? "bg-red-50 text-red-700"
                                : motivo.estado.toLowerCase().includes("no aplica")
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}>
                              {motivo.estado}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-600">
                              {motivo.observacion || motivo.motivo}
                            </p>
                            {motivo.fecha && (
                              <p className="mt-1 text-[10px] font-bold text-slate-400">
                                {motivo.fecha}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {alertaVerificacionDiariaDetalle.updatedAt && (
                <p className="mt-4 text-[11px] font-bold text-slate-400">
                  Última actualización: {alertaVerificacionDiariaDetalle.updatedAt}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {alertaDetalle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">
                  Alerta documental
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {alertaDetalle.nombreUsuario}
                </h3>
                <p className="truncate text-xs font-semibold text-slate-400">
                  {alertaDetalle.tipoFuncionario} ·{" "}
                  {alertaDetalle.email || "Sin correo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertaDetalle(null)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Cumplimiento
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {alertaDetalle.porcentaje}%
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600/70">
                    Aprobados
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">
                    {alertaDetalle.aprobados}
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-sky-600/70">
                    Cargados
                  </p>
                  <p className="mt-1 text-2xl font-black text-sky-700">
                    {alertaDetalle.cargados}
                  </p>
                </div>
                <div className="rounded-2xl bg-red-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-red-600/70">
                    No cumple
                  </p>
                  <p className="mt-1 text-2xl font-black text-red-700">
                    {alertaDetalle.noCumplen}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-800">
                  {alertaDetalle.mensaje}
                </p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${
                      alertaDetalle.noCumplen > 0
                        ? "from-red-500 to-rose-500"
                        : alertaDetalle.porcentaje < 50
                          ? "from-orange-500 to-amber-400"
                          : "from-amber-400 to-indigo-500"
                    }`}
                    style={{
                      width: `${Math.max(alertaDetalle.porcentaje, 4)}%`,
                    }}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
                  <p>Total documentos: {alertaDetalle.total}</p>
                  <p>Pendientes: {alertaDetalle.pendientes}</p>
                  <p>
                    Fecha alerta: {alertaDetalle.fechaGeneracion || "Sin fecha"}
                  </p>
                  <p>
                    Última actualización:{" "}
                    {alertaDetalle.updatedAt || "Sin registro"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/60 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-red-600">
                  Motivos de no cumple
                </p>
                {alertaDetalle.motivosNoCumple.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {alertaDetalle.motivosNoCumple.map((motivo, index) => (
                      <div
                        key={`${alertaDetalle.id}-detalle-${index}`}
                        className="rounded-xl bg-white p-3 text-xs text-red-700"
                      >
                        <p className="font-black">{motivo.documento}</p>
                        <p className="mt-1 leading-5">{motivo.motivo}</p>
                      </div>
                    ))}
                  </div>
                ) : alertaDetalle.noCumplen > 0 ? (
                  <p className="mt-2 text-xs font-semibold leading-5 text-red-700">
                    Hay documentos marcados como no cumple, pero no se registró
                    motivo específico.
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    No hay documentos marcados como no cumple. La alerta se
                    genera por documentación pendiente de aprobación.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                    Alertas por vencimiento
                  </p>
                  <div className="flex flex-wrap gap-2 text-[10px] font-black">
                    <span className="rounded-full bg-white px-2 py-1 text-slate-600">
                      Sin fecha: {alertaDetalle.sinFechaVencimiento}
                    </span>
                    <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                      Vencidos: {alertaDetalle.vencidos}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                      Por vencer: {alertaDetalle.porVencer}
                    </span>
                  </div>
                </div>

                {alertaDetalle.vencimientosDetalle.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {alertaDetalle.vencimientosDetalle.map((item, index) => (
                      <div
                        key={`${alertaDetalle.id}-vencimiento-${index}`}
                        className="rounded-xl bg-white p-3 text-xs text-slate-700"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-black text-slate-800">
                              {item.documento}
                            </p>
                            <p className="mt-1 leading-5 text-slate-500">
                              {item.mensaje}
                            </p>
                          </div>
                          <span
                            className={`w-fit rounded-full px-2 py-1 text-[10px] font-black ${
                              item.tipoAlerta === "VENCIDO"
                                ? "bg-red-50 text-red-700"
                                : item.tipoAlerta === "POR_VENCER"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.tipoAlerta === "SIN_FECHA"
                              ? "Sin fecha"
                              : item.tipoAlerta === "VENCIDO"
                                ? "Vencido"
                                : "Por vencer"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
                          <span>Estado: {item.estado || "Sin estado"}</span>
                          <span>
                            {item.tipoAlerta === "INFRACCION" ? "Fecha infracción" : "Vence"}: {item.fechaVencimiento || "No diligenciado"}
                          </span>
                          {item.diasRestantes !== null && (
                            <span>Días restantes: {item.diasRestantes}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    No hay alertas por fecha de vencimiento en este usuario.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {alertaMovilDetalle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-red-500">
                  Alerta de vehículo
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {alertaMovilDetalle.nombre}
                </h3>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {alertaMovilDetalle.placa} · {alertaMovilDetalle.denominacion}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertaMovilDetalle(null)}
                className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-red-500 shadow-sm hover:bg-red-100"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Total alertas
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {alertaMovilDetalle.totalAlertas}
                  </p>
                </div>
                <div className="rounded-2xl bg-red-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-red-600/70">
                    Vencidos
                  </p>
                  <p className="mt-1 text-2xl font-black text-red-700">
                    {alertaMovilDetalle.vencidos}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-600/70">
                    Por vencer
                  </p>
                  <p className="mt-1 text-2xl font-black text-amber-700">
                    {alertaMovilDetalle.porVencer}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-800">
                  {alertaMovilDetalle.mensaje}
                </p>
                <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
                  <p>Umbral: {alertaMovilDetalle.diasUmbral} días</p>
                  <p>Fecha alerta: {alertaMovilDetalle.fechaGeneracion || "Sin fecha"}</p>
                  <p>Última actualización: {alertaMovilDetalle.updatedAt || "Sin registro"}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/60 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-red-600">
                  Detalle de alertas del vehículo
                </p>
                {alertaMovilDetalle.vencimientosDetalle.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {alertaMovilDetalle.vencimientosDetalle.map((item, index) => (
                      <div
                        key={`${alertaMovilDetalle.id}-movil-vencimiento-${index}`}
                        className="rounded-xl bg-white p-3 text-xs text-slate-700"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-black text-slate-800">
                              {item.documento}
                            </p>
                            <p className="mt-1 leading-5 text-slate-500">
                              {item.mensaje}
                            </p>
                          </div>
                          <span
                            className={`w-fit rounded-full px-2 py-1 text-[10px] font-black ${
                              item.tipoAlerta === "VENCIDO"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {item.tipoAlerta === "INFRACCION" ? "Infracción" : item.tipoAlerta === "VENCIDO" ? "Vencido" : "Por vencer"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
                          <span>{item.tipoAlerta === "INFRACCION" ? "Fecha infracción" : "Vence"}: {item.fechaVencimiento || "No diligenciado"}</span>
                          {item.diasRestantes !== null && (
                            <span>Días restantes: {item.diasRestantes}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    No hay detalle de vencimientos cargado para este móvil.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => abrirOrigenAlertaMovil(alertaMovilDetalle)}
                  className="mt-4 w-full rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white hover:bg-red-500"
                >
                  {alertaMovilDetalle.vencimientosDetalle.some((item) => item.tipoAlerta === "INFRACCION") ? "Ir a infracciones" : "Abrir ficha del móvil"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {alertaAutoevaluacionMovilDetalle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-sky-50 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-sky-500">
                  Alertas de autoevaluación por móvil
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {alertaAutoevaluacionMovilDetalle.nombre}
                </h3>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {alertaAutoevaluacionMovilDetalle.placa} · {alertaAutoevaluacionMovilDetalle.diligenciados}/{alertaAutoevaluacionMovilDetalle.totalItems} diligenciados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertaAutoevaluacionMovilDetalle(null)}
                className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-sky-500 shadow-sm hover:bg-sky-100"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Total</p>
                  <p className="mt-1 text-lg font-black text-slate-800">{alertaAutoevaluacionMovilDetalle.totalItems}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600/70">Diligenciados</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">{alertaAutoevaluacionMovilDetalle.diligenciados}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-600/70">Pendientes</p>
                  <p className="mt-1 text-lg font-black text-amber-700">{alertaAutoevaluacionMovilDetalle.pendientes}</p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-sky-600/70">Cumplimiento</p>
                  <p className="mt-1 text-lg font-black text-sky-700">{alertaAutoevaluacionMovilDetalle.porcentaje}%</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Motivos
                </p>
                <p className="mt-2 text-sm font-black leading-6 text-slate-800">
                  {alertaAutoevaluacionMovilDetalle.mensaje}
                </p>
              </div>

              {alertaAutoevaluacionMovilDetalle.motivos.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                  No hay motivos detallados para esta móvil.
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                  <div className="grid grid-cols-[1fr_1fr_1.4fr_110px] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-400">
                    <span>Categoría</span>
                    <span>Producto</span>
                    <span>Motivo</span>
                    <span>Estado</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {alertaAutoevaluacionMovilDetalle.motivos.map((motivo, index) => (
                      <div
                        key={`${alertaAutoevaluacionMovilDetalle.id}-motivo-${motivo.id}-${index}`}
                        className="grid gap-3 px-4 py-3 text-xs text-slate-600 sm:grid-cols-[1fr_1fr_1.4fr_110px] sm:items-start"
                      >
                        <div>
                          <p className="font-black text-slate-800">{motivo.categoria}</p>
                          {motivo.codigoBarras && (
                            <p className="mt-1 text-[10px] font-bold text-slate-400">Código: {motivo.codigoBarras}</p>
                          )}
                        </div>
                        <p className="font-bold text-slate-600">{motivo.producto}</p>
                        <div>
                          <p className="font-bold leading-5 text-slate-600">{motivo.motivo}</p>
                          {motivo.fecha && (
                            <p className="mt-1 text-[10px] font-bold text-slate-400">{motivo.fecha}</p>
                          )}
                        </div>
                        <span className="w-fit rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-700">
                          {motivo.estado || "Activa"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {alertaAutoevaluacionDetalle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-sky-50 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-sky-500">
                  Alerta de autoevaluación
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {alertaAutoevaluacionDetalle.producto}
                </h3>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {alertaAutoevaluacionDetalle.categoria}
                  {alertaAutoevaluacionDetalle.codigoBarras
                    ? ` · ${alertaAutoevaluacionDetalle.codigoBarras}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertaAutoevaluacionDetalle(null)}
                className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-sky-500 shadow-sm hover:bg-sky-100"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Estado
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-800">
                    {alertaAutoevaluacionDetalle.estado || "Activa"}
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-sky-600/70">
                    Fecha alerta
                  </p>
                  <p className="mt-1 text-xs font-black text-sky-700">
                    {alertaAutoevaluacionDetalle.fechaGeneracion || "Sin fecha"}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-600/70">
                    Vencimiento
                  </p>
                  <p className="mt-1 text-xs font-black text-amber-700">
                    {alertaAutoevaluacionDetalle.fechaVencimiento || "No aplica"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Motivo
                </p>
                <p className="mt-2 text-sm font-black leading-6 text-slate-800">
                  {alertaAutoevaluacionDetalle.motivo || alertaAutoevaluacionDetalle.mensaje}
                </p>
                <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
                  <p>Producto: {alertaAutoevaluacionDetalle.producto}</p>
                  <p>Categoría: {alertaAutoevaluacionDetalle.categoria}</p>
                  <p>Código: {alertaAutoevaluacionDetalle.codigoBarras || "Sin código"}</p>
                  <p>
                    Días restantes: {alertaAutoevaluacionDetalle.diasRestantes ?? "No aplica"}
                  </p>
                </div>
              </div>

              {alertaAutoevaluacionDetalle.vencimientosDetalle.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                    Detalle de vencimientos
                  </p>
                  <div className="mt-3 space-y-2">
                    {alertaAutoevaluacionDetalle.vencimientosDetalle.map((item, index) => (
                      <div
                        key={`${alertaAutoevaluacionDetalle.id}-autoevaluacion-vencimiento-${index}`}
                        className="rounded-xl bg-white p-3 text-xs text-slate-700"
                      >
                        <p className="font-black text-slate-800">{item.documento}</p>
                        <p className="mt-1 leading-5 text-slate-500">{item.mensaje}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
                          <span>{item.tipoAlerta === "INFRACCION" ? "Fecha infracción" : "Vence"}: {item.fechaVencimiento || "No diligenciado"}</span>
                          {item.diasRestantes !== null && (
                            <span>Días restantes: {item.diasRestantes}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => abrirOrigenAlertaAutoevaluacion(alertaAutoevaluacionDetalle)}
                className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-500"
              >
                Abrir en autoevaluación
              </button>
            </div>
          </div>
        </div>
      )}

      {modalNotificacionesSoporte && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-indigo-100 bg-indigo-600 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Notificaciones de soporte
                </p>
                <h3 className="mt-1 text-lg font-black">
                  Respuestas recibidas
                </h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/75">
                  {notificacionesSoporte.length} solicitud(es) con respuesta del equipo de soporte.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalNotificacionesSoporte(false)}
                className="rounded-2xl bg-white/20 px-3 py-2 text-sm font-black text-white hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {notificacionesSoporte.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-black text-slate-600">Sin respuestas de soporte por ahora.</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Cuando soporte responda una solicitud, aparecerá aquí.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notificacionesSoporte.map((notificacion) => (
                    <article
                      key={notificacion.id}
                      className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800">{notificacion.asunto}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {notificacion.tipo} · {notificacion.estado} · {notificacion.modulo || "Sin módulo"}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-indigo-700">
                          {formatearFechaFirestore(notificacion.updatedAt) || "Reciente"}
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl bg-white p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">Respuesta</p>
                        <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">
                          {notificacion.respuesta}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalNotificacionesSoporte(false);
                    router.push("/configuraciones/soporte");
                  }}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500"
                >
                  Ir a soporte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalFacturasMora && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-red-500">
                  Alerta de facturación
                </p>
                <h3 className="mt-1 text-lg font-black text-red-700">
                  Tiene factura vencida
                </h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-red-600">
                  Se detectaron {totalFacturasMora} factura(s) en mora o
                  vencidas en la ficha del cliente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalFacturasMora(false)}
                className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-red-500 shadow-sm hover:bg-red-100"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
