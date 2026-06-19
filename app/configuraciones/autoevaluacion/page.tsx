"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

type XLSXGlobal = {
  read: (
    data: ArrayBuffer,
    options: Record<string, unknown>,
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (
      sheet: unknown,
      options: Record<string, unknown>,
    ) => unknown[][];
    json_to_sheet: (data: Record<string, unknown>[]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (
      workbook: unknown,
      worksheet: unknown,
      name: string,
    ) => void;
  };
  writeFile: (workbook: unknown, filename: string) => void;
};

type JsBarcodeFn = (
  element: SVGElement,
  text: string,
  options?: Record<string, unknown>,
) => void;
type JsPdfConstructor = new (options?: Record<string, unknown>) => {
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  text: (
    text: string,
    x: number,
    y: number,
    options?: Record<string, unknown>,
  ) => void;
  setFontSize: (size: number) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  addPage: () => void;
  save: (filename: string) => void;
};

declare global {
  interface Window {
    XLSX?: XLSXGlobal;
    JsBarcode?: JsBarcodeFn;
    jspdf?: { jsPDF: JsPdfConstructor };
  }
}

const XLSX_CDN_URL =
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const JSBARCODE_CDN_URL =
  "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";
const JSPDF_CDN_URL =
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";

function cargarLibreriaXlsx() {
  return new Promise<XLSXGlobal>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("XLSX solo puede cargarse en el navegador."));
      return;
    }

    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }

    const scriptExistente = document.querySelector<HTMLScriptElement>(
      `script[src="${XLSX_CDN_URL}"]`,
    );

    if (scriptExistente) {
      scriptExistente.addEventListener("load", () => {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error("La librería XLSX no quedó disponible."));
      });
      scriptExistente.addEventListener("error", () =>
        reject(new Error("No se pudo cargar XLSX.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = XLSX_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("La librería XLSX no quedó disponible."));
    };
    script.onerror = () => reject(new Error("No se pudo cargar XLSX."));
    document.body.appendChild(script);
  });
}

function cargarScriptBrowser(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("La librería solo puede cargarse en el navegador."));
      return;
    }

    const existente = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existente) {
      if (existente.dataset.loaded === "true") {
        resolve();
        return;
      }
      existente.addEventListener("load", () => resolve());
      existente.addEventListener("error", () =>
        reject(new Error(`No se pudo cargar ${src}`)),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.body.appendChild(script);
  });
}

async function cargarLibreriasImpresion() {
  if (!window.JsBarcode) {
    await cargarScriptBrowser(JSBARCODE_CDN_URL);
  }

  if (!window.jspdf?.jsPDF) {
    await cargarScriptBrowser(JSPDF_CDN_URL);
  }

  if (!window.JsBarcode || !window.jspdf?.jsPDF) {
    throw new Error("No fue posible cargar las librerías de impresión.");
  }
}

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

type AutoevaluacionItem = {
  id: string;
  categoria: string;
  producto: string;
  tipo: string;
  stockMinimo: string;
  stockMaximo: string;
  origen?: "excel" | "firestore";
  tieneAsociados?: boolean;
  totalAsociados?: number;
  ultimoCodigoBarras?: string;
  // NUEVO: Soporte para datos precargados del Excel
  datosPrevios?: {
    nombreComercial?: string;
    medicamentoGenerico?: string;
    presentacion?: string;
    cantidadPresentacion?: string;
    codigoBarras?: string;
    codBarras?: string;
    concentracion?: string;
    numeroLote?: string;
    invimaSerie?: string;
    laboratorioFabricante?: string;
    proveedor?: string;
    fecha?: string;
    fechaVencimiento?: string;
    semaforizacion?: string;
    precioCompra?: string | number;
    precioVenta?: string | number;
    usuario?: string;
  };
};
type CampoModalAutoevaluacion = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "select" | "file";
  options?: string[];
  readOnly?: boolean;
};

type SeccionModalAutoevaluacion = {
  titulo: string;
  campos?: CampoModalAutoevaluacion[];
  checklist?: string[];
  accesoriosBiomedicos?: boolean;
};

type AccesorioBiomedico = {
  id: string;
  nombre: string;
  codigoSerial: string;
  fotoNombre: string;
  estado: string;
};

type RegistroAsociadoAutoevaluacion = {
  id: string;
  codigoBarras: string;
  codigoPrincipal: string;
  categoria: string;
  producto: string;
  tipo: string;
  creadoComo?: "original" | "generado" | "reemplazado";
  datos?: Record<string, string>;
  accesoriosBiomedicos?: AccesorioBiomedico[];
  asignado?: boolean;
  asignadoMovilId?: string;
  asignadoMovilNombre?: string;
  gestionado?: boolean;
  usado?: boolean;
  motivoUso?: string;
  retirado?: boolean;
  activo?: boolean;
  estadoInventario?: string;
  fechaGestion?: unknown;
  fechaUso?: unknown;
  fechaRetiro?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type HistorialInventarioItem = {
  id: string;
  categoria: string;
  producto: string;
  codigoBarras: string;
  codigoPrincipal: string;
  accion: string;
  estado: string;
  motivo: string;
  movilNombre: string;
  movilId: string;
  gestionadoPor: string;
  retiradoPor: string;
  fechaGestion?: unknown;
  fechaUso?: unknown;
  fechaRetiro?: unknown;
  createdAt?: unknown;
  productoBaseId?: string;
  asociadoId?: string;
  historialGlobalId?: string;
  historialProductoId?: string;
};

type TamanoEtiquetaBarcode = "5x3" | "3x1_5" | "personalizado";

type ModalAutoevaluacionConfig = {
  tipo: string;
  titulo: string;
  subtitulo: string;
  secciones: SeccionModalAutoevaluacion[];
};

const HOY_ISO = new Date().toISOString().slice(0, 10);

const CHECKLIST_CARROCERIA = [
  "Dos compartimentos, uno para el conductor y otro para el paciente con comunicación visual y auditiva entre sí",
  "Acceso principal posterior",
  "Ventanas con vidrio de seguridad",
  "Visibilidad interna",
  "Martillo para fractura de vidrio en cabina y habitáculo",
  "Dimensiones internas mínimas del habitáculo",
  "Leyenda ambulancia",
  "Nombre o logotipo del prestador",
  "Estrella de la vida en costados y puertas",
  "Luces delanteras, posteriores y de delimitación",
];

const CHECKLIST_HABITACULO = [
  "Revestimientos interiores lavables, no rugosos y sin elementos cortantes",
  "Piso antideslizante",
  "Silla de acompañante y personal auxiliador con cinturones",
  "Cinturones de seguridad de camilla",
  "Leyendas internas de seguridad",
  "Gabinetes funcionales y seguros",
  "Entrepaños elevados",
  "Gases de tubo de escape no ingresan al habitáculo",
  "Iluminación interna",
  "Barra pasamanos resistente y fijada",
  "Compartimiento aislado para oxígeno medicinal",
];

const CHECKLIST_SONIDO = [
  "Sirena principal de alerta",
  "Sistema de telecomunicaciones",
  "Sistema de georreferenciación",
];

const CHECKLIST_SEGURIDAD = [
  "Extintor para fuegos ABC",
  "Chalecos reflectivos",
  "Conos o señales preventivas",
  "Botiquín o elementos básicos de seguridad",
  "Herramientas de emergencia",
];

const CHECKLIST_SENALIZACION = [
  "Luces delanteras / barra de luces",
  "Luces posteriores / minibarra",
  "Luces de delimitación blancas",
  "Luces de delimitación rojas",
];

const OPCIONES_PRESENTACION_MEDICAMENTOS = [
  "Ampolla",
  "Insumo",
  "Tableta",
  "Jarabe",
  "Solución inyectable",
  "Solución oral",
  "Bolsa",
];

function normalizarTextoComparacion(value: unknown) {
  return normalizarValor(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function obtenerPresentacionSelect(value: unknown) {
  const textoOriginal = normalizarValor(value);
  const texto = normalizarTextoComparacion(textoOriginal);
  if (!texto) return "";

  // Si el Excel viene unificado, ejemplo "Ampolla x4" o "Ampolla x 4",
  // tomamos la parte antes de la X para cargar el selector Presentación.
  const textoAntesDeCantidad = normalizarTextoComparacion(
    textoOriginal.split(/\s+x\s*/i)[0] || textoOriginal,
  );

  const opcion = OPCIONES_PRESENTACION_MEDICAMENTOS.find((item) => {
    const opcionNormalizada = normalizarTextoComparacion(item);
    return opcionNormalizada === texto || opcionNormalizada === textoAntesDeCantidad;
  });

  return opcion || "";
}

function obtenerCantidadPresentacionExcel(value: unknown) {
  const texto = normalizarValor(value);
  if (!texto) return "";

  // Extrae solo la cantidad desde la X cuando el Excel trae valores como:
  // "Sachet x 10", "Ampolla x4", "Tableta x 20".
  // Resultado esperado para Cantidad presentación: "x10", "x4", "x20".
  const coincidencia = texto.match(/(?:^|\s)x\s*([a-z0-9.,-]+)/i);
  if (!coincidencia?.[1]) return "";

  return `x${coincidencia[1].trim()}`;
}

const camposComunesMovimiento: CampoModalAutoevaluacion[] = [
  { name: "codigoBarras", label: "Código barras" },
  { name: "fecha", label: "Fecha", type: "date" },
  { name: "usuario", label: "Usuario", readOnly: true },
  { name: "tipoMovimiento", label: "Tipo de movimiento" },
  { name: "numeroMovimiento", label: "Número de movimiento" },
  {
    name: "estadoHabilitacion",
    label: "Estado de habilitación",
    type: "select",
    options: ["Cumple", "No cumple"],
  },
  { name: "ubicacion", label: "Ubicación" },
];

const crearConfigModal = (
  item: AutoevaluacionItem,
  usuario: string,
): ModalAutoevaluacionConfig => {
  const categoria = item.categoria.trim().toUpperCase();
  const baseDatosProducto: CampoModalAutoevaluacion[] = [
    { name: "producto", label: "Producto / ítem", readOnly: true },
    { name: "tipo", label: "Tipo", readOnly: true },
    { name: "stockMinimo", label: "Stock mínimo", type: "number" },
    { name: "stockMaximo", label: "Stock máximo", type: "number" },
  ];

  if (
    categoria.includes("DOTACION EQUIPOS BIOMEDICOS") ||
    categoria.includes("DOTACIÓN EQUIPOS BIOMÉDICOS")
  ) {
    return {
      tipo: "DOTACION_EQUIPOS_BIOMEDICOS",
      titulo: "DOTACIÓN EQUIPOS BIOMÉDICOS",
      subtitulo: "Modal específico para equipos biomédicos según la guía HTML.",
      secciones: [
        {
          titulo: "Sección 1: Información general",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Sección 2: Datos del equipo",
          campos: [
            { name: "serialEquipo", label: "Serial del equipo / inventario" },
            { name: "modeloEquipo", label: "Modelo" },
            { name: "marcaEquipo", label: "Marca" },
            { name: "serieEquipo", label: "Serie" },
            {
              name: "estadoEquipo",
              label: "Estado",
              type: "select",
              options: ["Activo", "Inactivo"],
            },
            { name: "fotoEquipo", label: "Fotografía", type: "file" },
          ],
        },
        {
          titulo: "Sección 2.2: Accesorios",
          accesoriosBiomedicos: true,
        },
        {
          titulo: "Sección 3 y 4: Seguridad y aseguramiento",
          campos: [
            { name: "clasificacionRiesgo", label: "Clasificación de riesgo" },
            { name: "clasificacionUso", label: "Clasificación según uso" },
            { name: "registroInvima", label: "Registro INVIMA" },
            { name: "riesgoSanitario", label: "Riesgo sanitario" },
            {
              name: "asegurado",
              label: "Asegurado",
              type: "select",
              options: ["Sí", "No"],
            },
            { name: "compania", label: "Compañía" },
            { name: "poliza", label: "Póliza" },
            {
              name: "vencimientoPoliza",
              label: "Vencimiento póliza",
              type: "date",
            },
            {
              name: "documentoPoliza",
              label: "Documento póliza",
              type: "file",
            },
          ],
        },
        {
          titulo: "Sección 5: Documentación",
          campos: [
            { name: "facturaCompra", label: "Factura de compra", type: "file" },
            {
              name: "certificadoImportacion",
              label: "Certificado de importación",
              type: "file",
            },
            {
              name: "certificadoCalibracion",
              label: "Certificado de calibración",
              type: "file",
            },
            {
              name: "vencimientoCertificadoCalibracion",
              label: "Vencimiento certificado calibración",
              type: "date",
            },
            { name: "hojaVida", label: "Hoja de vida", type: "file" },
            {
              name: "vencimientoHojaVida",
              label: "Vencimiento hoja de vida",
              type: "date",
            },
          ],
        },
      ],
    };
  }

  if (
    categoria.includes("DOTACION EQUIPAMIENTO") ||
    categoria.includes("DOTACIÓN EQUIPAMIENTO")
  ) {
    return {
      tipo: "DOTACION_EQUIPAMIENTO",
      titulo: "DOTACIÓN EQUIPAMIENTO",
      subtitulo: "Modal específico para dotación/equipamiento.",
      secciones: [
        {
          titulo: "Información general del equipamiento",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Tipo de insumo",
          campos: [
            {
              name: "tipoInsumo",
              label: "Insumo",
              type: "select",
              options: ["Desechable", "Esterilizable"],
            },
            {
              name: "fechaEsterilizacion",
              label: "Fecha de esterilización",
              type: "date",
            },
            {
              name: "fechaVencimientoEsterilizacion",
              label: "Fecha de vencimiento",
              type: "date",
            },
          ],
        },
      ],
    };
  }

  if (categoria.includes("KIT")) {
    return {
      tipo: "DOTACION_KITS",
      titulo: "DOTACIÓN KITS",
      subtitulo: `Modal específico para ${item.categoria}.`,
      secciones: [
        {
          titulo: "Información general del kit",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Contenido del kit",
          campos: [
            { name: "nombreKit", label: "Nombre del kit", readOnly: true },
            {
              name: "completo",
              label: "Completo",
              type: "select",
              options: ["Sí", "No"],
            },
            { name: "observaciones", label: "Observaciones" },
          ],
        },
      ],
    };
  }

  if (categoria.includes("RESPIRATORIOS")) {
    return {
      tipo: "RESPIRATORIOS",
      titulo: "RESPIRATORIOS",
      subtitulo:
        "Modal específico para cilindros/oxígeno y datos respiratorios.",
      secciones: [
        {
          titulo: "Información general",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Información del cilindro / producto",
          campos: [
            { name: "numeroSerieCilindro", label: "Número de serie" },
            {
              name: "presentacionCilindro",
              label: "Presentación",
              type: "select",
              options: ["Cilindro 1M", "Cilindro 3M", "Cilindro 6.5M"],
            },
            { name: "concentracionCilindro", label: "Concentración" },
            { name: "principioActivo", label: "Principio activo" },
            { name: "formaFarmaceutica", label: "Forma farmacéutica" },
            { name: "registroSanitarioProducto", label: "Registro sanitario" },
            { name: "numeroLoteProducto", label: "Número de lote" },
            {
              name: "fechaVencimientoProducto",
              label: "Fecha de vencimiento",
              type: "date",
            },
          ],
        },
        {
          titulo: "Proveedor y almacenamiento",
          campos: [
            { name: "temperaturaAlmacenamiento", label: "Temperatura" },
            { name: "presionAlmacenamiento", label: "Presión" },
            { name: "ventilacionAlmacenamiento", label: "Ventilación" },
            { name: "companiaProveedor", label: "Compañía proveedor" },
            { name: "contratoProveedor", label: "Contrato" },
            {
              name: "registroInvimaProveedor",
              label: "Registro INVIMA proveedor",
            },
          ],
        },
      ],
    };
  }

  if (
    categoria.includes("MEDICAMENTOS") ||
    categoria.includes("QUIRURGICO") ||
    categoria.includes("CIRCULATORIOS")
  ) {
    return {
      tipo: "MEDICAMENTOS_VARIOS",
      titulo: "MEDICAMENTOS / QUIRÚRGICO",
      subtitulo:
        "Modal específico para medicamentos, controlados o quirúrgicos.",
      secciones: [
        {
          titulo: "Información del medicamento",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Datos técnicos y compra",
          campos: [
            {
              name: "medicamentoGenerico",
              label: "Medicamento / producto genérico",
              readOnly: true,
            },
            { name: "nombreComercial", label: "Nombre comercial" },
            {
              name: "presentacion",
              label: "Presentación",
              type: "select",
              options: OPCIONES_PRESENTACION_MEDICAMENTOS,
            },
            {
              name: "cantidadPresentacion",
              label: "Cantidad presentación",
              type: "text",
            },
            { name: "concentracion", label: "Concentración" },
            { name: "numeroLote", label: "Número de lote" },
            {
              name: "fechaVencimiento",
              label: "Fecha de vencimiento",
              type: "date",
            },
            { name: "invimaSerie", label: "INVIMA / Serie" },
            {
              name: "laboratorioFabricante",
              label: "Laboratorio / Fabricante",
            },
            { name: "proveedor", label: "Proveedor" },
            { name: "precioCompra", label: "Precio de compra", type: "number" },
            { name: "precioVenta", label: "Precio de venta", type: "number" },
          ],
        },
      ],
    };
  }

  if (categoria.includes("TSINF HABITACULO CARROCERIA")) {
    return {
      tipo: "TSINF_CARROCERIA",
      titulo: "TSINF / Carrocería del vehículo",
      subtitulo: "Checklist de carrocería del vehículo.",
      secciones: [
        {
          titulo: "Campos principales",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Checklist de observaciones",
          checklist: CHECKLIST_CARROCERIA,
        },
      ],
    };
  }

  if (categoria.includes("TSINF DISPOSITIVO DE SEÑALIZACION")) {
    return {
      tipo: "TSINF_SENALIZACION",
      titulo: "TSINF / Dispositivo de señalización",
      subtitulo: "Checklist de señalización óptica.",
      secciones: [
        {
          titulo: "Campos principales",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Checklist de observaciones",
          checklist: CHECKLIST_SENALIZACION,
        },
      ],
    };
  }

  if (categoria.includes("TSINF HABITACULO")) {
    return {
      tipo: "TSINF_HABITACULO",
      titulo: "TSINF / Habitáculo",
      subtitulo: "Checklist de habitáculo.",
      secciones: [
        {
          titulo: "Campos principales",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Checklist de observaciones",
          checklist: CHECKLIST_HABITACULO,
        },
      ],
    };
  }

  if (categoria.includes("TSINF SISTEMA SONIDO Y COMUNICACIONES")) {
    return {
      tipo: "TSINF_SONIDO",
      titulo: "TSINF / Sistema sonido y comunicaciones",
      subtitulo: "Checklist de sonido y comunicaciones.",
      secciones: [
        {
          titulo: "Campos principales",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        { titulo: "Checklist de observaciones", checklist: CHECKLIST_SONIDO },
      ],
    };
  }

  if (categoria.includes("TSINF CONDICIONES DE SEGURIDAD")) {
    return {
      tipo: "TSINF_SEGURIDAD",
      titulo: "TSINF / Condiciones de seguridad",
      subtitulo: "Checklist de condiciones de seguridad.",
      secciones: [
        {
          titulo: "Campos principales",
          campos: [...camposComunesMovimiento, ...baseDatosProducto],
        },
        {
          titulo: "Checklist de observaciones",
          checklist: CHECKLIST_SEGURIDAD,
        },
      ],
    };
  }

  return {
    tipo: "GENERICO",
    titulo: item.categoria || "Autoevaluación",
    subtitulo:
      "Categoría sin modal específico detectado. Se abre un formulario general para continuar.",
    secciones: [
      {
        titulo: "Información general",
        campos: [...camposComunesMovimiento, ...baseDatosProducto],
      },
    ],
  };
};

const DEFAULT_LOGO = "/logo.png";
const PLANTILLA_EXCEL_URL = "/autoevaluacion_base.xlsx";

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

function getStoredClienteSesion(): ClienteSesion | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("clienteSesion");
    return raw ? (JSON.parse(raw) as ClienteSesion) : null;
  } catch {
    return null;
  }
}

function normalizarValor(value: unknown, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const texto = String(value).trim();
  return texto || fallback;
}

function formatearFechaValor(value: unknown) {
  if (!value) return "Sin fecha";

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
      const timestamp = value as { seconds?: number; toDate?: () => Date };
      const fecha =
        typeof timestamp.toDate === "function"
          ? timestamp.toDate()
          : typeof timestamp.seconds === "number"
            ? new Date(timestamp.seconds * 1000)
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
    return "Sin fecha";
  }

  return "Sin fecha";
}

function normalizarEncabezado(value: unknown) {
  return normalizarValor(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function filaEsEncabezadoExcel(row: unknown[] = []) {
  const celdas = row.map(normalizarEncabezado);
  const primera = celdas[0] || "";
  const segunda = celdas[1] || "";
  const tercera = celdas[2] || "";
  const cuarta = celdas[3] || "";
  const quinta = celdas[4] || "";

  return (
    ((primera === "categoria" || primera === "accion") &&
      (segunda === "producto" || segunda === "categoria") &&
      (tercera === "tipo" || tercera === "producto")) ||
    (primera === "categoria" &&
      segunda === "producto" &&
      tercera === "tipo" &&
      cuarta.includes("stock minimo") &&
      quinta.includes("stock maximo"))
  );
}

function crearItemDesdeFila(
  row: unknown[],
  index: number,
): AutoevaluacionItem | null {
  const categoria = normalizarValor(row[0]);
  const producto = normalizarValor(row[1]);
  const tipo = normalizarValor(row[2]);
  const stockMinimo = normalizarValor(row[3] ?? "0");
  const stockMaximo = normalizarValor(row[4] ?? "0");

  if (!categoria || !producto) return null;

  const idBase =
    limpiarId(`${categoria}_${producto}_${index}`) || `item_${index}`;

  const itemBase: AutoevaluacionItem = {
    id: idBase,
    categoria,
    producto,
    tipo: tipo || "-",
    stockMinimo: stockMinimo || "0",
    stockMaximo: stockMaximo || "0",
    origen: "excel",
  };

  // NUEVO: Si la fila tiene más de 5 columnas, extraemos los datos pre-diligenciados
  // (Saltamos el índice 5 porque es el Código de Barras que dejamos en blanco)
  if (row.length > 5) {
    const presentacionExcel = normalizarValor(row[8]);

    itemBase.datosPrevios = {
      codigoBarras: normalizarValor(row[5]),
      codBarras: normalizarValor(row[5]),
      nombreComercial: normalizarValor(row[6]),
      medicamentoGenerico: normalizarValor(row[7]),
      // Si PRESENTACIÓN coincide con una opción del selector, se carga en el select.
      // Si viene como texto libre, ejemplo "Sachet x 10", se muestra en Cantidad presentación.
      presentacion: obtenerPresentacionSelect(presentacionExcel),
      cantidadPresentacion: obtenerCantidadPresentacionExcel(presentacionExcel),
      concentracion: normalizarValor(row[9]),
      numeroLote: normalizarValor(row[10]),
      invimaSerie: normalizarValor(row[11]),
      laboratorioFabricante: normalizarValor(row[12]),
      proveedor: normalizarValor(row[13]),
      fecha: normalizarValor(row[14]),
      fechaVencimiento: normalizarValor(row[15]),
      semaforizacion: normalizarValor(row[16]),
      precioCompra: normalizarValor(row[17]),
      precioVenta: normalizarValor(row[18]),
      usuario: normalizarValor(row[19])
    };
  }

  return itemBase;
}
export default function AutoevaluacionPage() {
  const router = useRouter();
  const pathname = usePathname();
  const inputExcelRef = useRef<HTMLInputElement | null>(null);
  const videoScannerRef = useRef<HTMLVideoElement | null>(null);
  const streamScannerRef = useRef<MediaStream | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [clienteSesion, setClienteSesion] = useState<ClienteSesion | null>(
    null,
  );
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [operativaOpen, setOperativaOpen] = useState(true);
  const [movilesOpen, setMovilesOpen] = useState(false);
  const [tareasOpen, setTareasOpen] = useState(false);
  const [soporteOpen, setSoporteOpen] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [mensajeLogo, setMensajeLogo] = useState("");

  const [items, setItems] = useState<AutoevaluacionItem[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [leyendoExcel, setLeyendoExcel] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error" | "info">(
    "info",
  );
  const [busqueda, setBusqueda] = useState("");
  const [filasPorPagina, setFilasPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  const [itemConfigurando, setItemConfigurando] =
    useState<AutoevaluacionItem | null>(null);
  const [formModal, setFormModal] = useState<Record<string, string>>({});
  const [accesoriosBiomedicos, setAccesoriosBiomedicos] = useState<
    AccesorioBiomedico[]
  >([]);
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false);
  const [modalScanner, setModalScanner] = useState(false);
  const [scannerManual, setScannerManual] = useState("");
  const [scannerError, setScannerError] = useState("");
  const [itemAsociados, setItemAsociados] = useState<AutoevaluacionItem | null>(
    null,
  );
  const [registrosAsociados, setRegistrosAsociados] = useState<
    RegistroAsociadoAutoevaluacion[]
  >([]);
  const [cargandoAsociados, setCargandoAsociados] = useState(false);
  const [modalCodigoExistente, setModalCodigoExistente] = useState<{
    codigo: string;
  } | null>(null);
  const [modalGenerarAdicionales, setModalGenerarAdicionales] = useState<{
    codigo: string;
    payloadBase: any;
    idItem: string;
  } | null>(null);
  const [cantidadAdicionales, setCantidadAdicionales] = useState("0");
  const [sobrescribirAdicionales, setSobrescribirAdicionales] = useState(false);
  const [itemImpresion, setItemImpresion] = useState<AutoevaluacionItem | null>(
    null,
  );
  const [registrosImpresion, setRegistrosImpresion] = useState<
    RegistroAsociadoAutoevaluacion[]
  >([]);
  const [cargandoImpresion, setCargandoImpresion] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [tamanoEtiqueta, setTamanoEtiqueta] =
    useState<TamanoEtiquetaBarcode>("5x3");
  const [anchoEtiquetaPersonalizado, setAnchoEtiquetaPersonalizado] =
    useState("5");
  const [altoEtiquetaPersonalizado, setAltoEtiquetaPersonalizado] =
    useState("3");
  const [modalGuardarExcel, setModalGuardarExcel] = useState(false);
  const [modalSemaforizacion, setModalSemaforizacion] = useState(false);
  const [guardandoSemaforizacion, setGuardandoSemaforizacion] = useState(false);
  const [semaforoVencimiento, setSemaforoVencimiento] = useState(true);
  const [semaforoNoDiligenciado, setSemaforoNoDiligenciado] = useState(true);
  const [semaforoSinCodigo, setSemaforoSinCodigo] = useState(true);
  const [diasPreviosVencimiento, setDiasPreviosVencimiento] = useState("10");
  const [modalHistorialUso, setModalHistorialUso] = useState(false);
  const [cargandoHistorialUso, setCargandoHistorialUso] = useState(false);
  const [historialUso, setHistorialUso] = useState<HistorialInventarioItem[]>([]);
  const [busquedaHistorialUso, setBusquedaHistorialUso] = useState("");
  const [categoriaHistorialUsoActiva, setCategoriaHistorialUsoActiva] = useState("");
  const [eliminandoHistorialUso, setEliminandoHistorialUso] = useState("");

  const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";
  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);

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

  const itemsFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return items;

    return items.filter((item) =>
      [
        item.categoria,
        item.producto,
        item.tipo,
        item.stockMinimo,
        item.stockMaximo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [items, busqueda]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(itemsFiltrados.length / filasPorPagina),
  );

  const itemsPaginados = useMemo(() => {
    const inicio = (pagina - 1) * filasPorPagina;
    return itemsFiltrados.slice(inicio, inicio + filasPorPagina);
  }, [itemsFiltrados, pagina, filasPorPagina]);

  const categoriasHistorialUsoDisponibles = useMemo(() => {
    return Array.from(
      new Set<string>(items.map((item) => item.categoria || "Sin categoría")),
    ).sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const historialUsoFiltrado = useMemo(() => {
    const texto = String(busquedaHistorialUso || "").trim().toLowerCase();
    const categoria = String(categoriaHistorialUsoActiva || "").trim();

    return historialUso.filter((item) => {
      const coincideCategoria = !categoria || item.categoria === categoria;
      const coincideTexto =
        !texto ||
        [
          item.producto,
          item.codigoBarras,
          item.codigoPrincipal,
          item.motivo,
          item.movilNombre,
          item.gestionadoPor,
          item.retiradoPor,
          item.estado,
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto);
      return coincideCategoria && coincideTexto;
    });
  }, [historialUso, busquedaHistorialUso, categoriaHistorialUsoActiva]);

  const historialUsoPorCategoria = useMemo(() => {
    const grupos = new Map<string, HistorialInventarioItem[]>();
    historialUsoFiltrado.forEach((item) => {
      const categoria = item.categoria || "Sin categoría";
      const lista = grupos.get(categoria) || [];
      lista.push(item);
      grupos.set(categoria, lista);
    });
    return Array.from(grupos.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "es"),
    );
  }, [historialUsoFiltrado]);

  const mostrarMensaje = (
    texto: string,
    tipo: "ok" | "error" | "info" = "info",
  ) => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    window.setTimeout(() => setMensaje(""), 5000);
  };

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filasPorPagina]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/login_users");
        return;
      }

      setUser(firebaseUser);
      const stored = getStoredClienteSesion();
      setClienteSesion(stored);

      const id = stored?.clienteId || stored?.nit;
      if (!id) {
        router.replace("/login_users");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "clientes", id));
        if (snap.exists()) setCliente(snap.data() as ClienteData);
        await cargarDatosGuardados(id);
      } catch (error) {
        console.error("Error cargando autoevaluación:", error);
        mostrarMensaje(
          "No fue posible cargar la información inicial.",
          "error",
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const cargarDatosGuardados = async (id: string) => {
    const refBase = collection(db, "clientes", id, "AUTOEVALUACION_GENERAL");
    const snap = await getDocs(query(refBase, orderBy("categoria", "asc")));

    const data = snap.docs.map((documento) => {
      const item = documento.data() as Partial<AutoevaluacionItem>;
      return {
        id: documento.id,
        categoria: String(item.categoria || ""),
        producto: String(item.producto || ""),
        tipo: String(item.tipo || "-"),
        stockMinimo: String(item.stockMinimo || "0"),
        stockMaximo: String(item.stockMaximo || "0"),
        origen: "firestore" as const,
        tieneAsociados: Boolean((item as any).tieneAsociados),
        totalAsociados: Number((item as any).totalAsociados || 0),
        ultimoCodigoBarras: String((item as any).ultimoCodigoBarras || ""),
        // NUEVO: Cargar los datos previos desde Firebase
        datosPrevios: (item as any).datosPrevios || undefined,
      };
    });

    setItems(data);
  };

  const leerExcel = async (file: File) => {
    setLeyendoExcel(true);
    setMensaje("");

    try {
      const XLSX = await cargarLibreriaXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
      }) as unknown[][];

      const filasLimpias = [...rows].filter((row) =>
        row.some((cell) => normalizarValor(cell) !== ""),
      );

      const indiceEncabezado = filasLimpias.findIndex((row) =>
        filaEsEncabezadoExcel(row),
      );

      const filas =
        indiceEncabezado >= 0
          ? filasLimpias.slice(indiceEncabezado + 1)
          : filasLimpias;

      const nuevosItems = filas
        .filter((row) => !filaEsEncabezadoExcel(row))
        .map((row, index) => crearItemDesdeFila(row, index + 1))
        .filter((item): item is AutoevaluacionItem => Boolean(item));

      if (nuevosItems.length === 0) {
        mostrarMensaje("No se encontraron filas válidas en el Excel.", "error");
        return;
      }

      setItems(nuevosItems);
      setPagina(1);
      mostrarMensaje(
        `Excel cargado correctamente: ${nuevosItems.length} registros listos para revisar.`,
        "ok",
      );
      setModalGuardarExcel(true);
    } catch (error) {
      console.error("Error leyendo Excel:", error);
      mostrarMensaje(
        "No fue posible leer el Excel. Revisa el formato del archivo.",
        "error",
      );
    } finally {
      setLeyendoExcel(false);
    }
  };

  const importarExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const extensionValida = /\.(xlsx|xls)$/i.test(file.name);
    if (!extensionValida) {
      mostrarMensaje(
        "Selecciona un archivo Excel válido (.xlsx o .xls).",
        "error",
      );
      return;
    }

    leerExcel(file);
  };

  const limpiarAutoevaluacionGeneral = async (idCliente: string) => {
    const refBase = collection(
      db,
      "clientes",
      idCliente,
      "AUTOEVALUACION_GENERAL",
    );

    const snap = await getDocs(refBase);
    const operaciones: Array<Promise<void>> = [];

    for (const itemDoc of snap.docs) {
      const asociadosSnap = await getDocs(
        collection(
          db,
          "clientes",
          idCliente,
          "AUTOEVALUACION_GENERAL",
          itemDoc.id,
          "asociados",
        ),
      );

      asociadosSnap.docs.forEach((asociadoDoc) => {
        operaciones.push(deleteDoc(asociadoDoc.ref));
      });

      operaciones.push(deleteDoc(itemDoc.ref));
    }

    await Promise.all(operaciones);
  };

  const cargarExcelBasePorDefecto = async () => {
    setLeyendoExcel(true);
    setMensaje("");

    try {
      const rutas = [PLANTILLA_EXCEL_URL, "/plantillas/autoevaluacion_base.xlsx"];
      let respuesta: Response | null = null;

      for (const ruta of rutas) {
        const intento = await fetch(ruta, { cache: "no-store" });
        if (intento.ok) {
          respuesta = intento;
          break;
        }
      }

      if (!respuesta) {
        throw new Error("No se encontró la plantilla base en public.");
      }

      const blob = await respuesta.blob();
      await leerExcel(
        new File([blob], "autoevaluacion_base.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
    } catch (error) {
      console.error("Error cargando plantilla base:", error);
      mostrarMensaje(
        "No fue posible cargar el Excel base. Verifica que el archivo exista en /public/autoevaluacion_base.xlsx.",
        "error",
      );
    } finally {
      setLeyendoExcel(false);
    }
  };

  const guardarDatos = async () => {
    if (!clienteId || guardando) return;

    if (items.length === 0) {
      mostrarMensaje(
        "Primero importa el Excel para cargar datos en la tabla.",
        "error",
      );
      return;
    }

    setGuardando(true);
    setMensaje("");

    try {
      const batchSize = 450;
      const refBase = collection(
        db,
        "clientes",
        clienteId,
        "AUTOEVALUACION_GENERAL",
      );

      await limpiarAutoevaluacionGeneral(clienteId);

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = writeBatch(db);
        const grupo = items.slice(i, i + batchSize);

        grupo.forEach((item, index) => {
          const id =
            limpiarId(`${item.categoria}_${item.producto}`) ||
            `item_${i + index + 1}`;
          const refItem = doc(refBase, id);

          batch.set(refItem, {
            categoria: item.categoria || "",
            producto: item.producto || "",
            tipo: item.tipo || "-",
            stockMinimo: item.stockMinimo || "0",
            stockMaximo: item.stockMaximo || "0",
            origen: "excel",
            asociadosCount: 0,
            gestionado: false,
            // NUEVO: Guardar los datos previos en Firebase
            datosPrevios: item.datosPrevios || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      await cargarDatosGuardados(clienteId);
      setModalGuardarExcel(false);
      mostrarMensaje(
        "Estructura de Autoevaluación guardada correctamente. Este guardado corresponde al Excel base importado, no a los productos asociados.",
        "ok",
      );
    } catch (error) {
      console.error("Error guardando autoevaluación:", error);
      mostrarMensaje("No fue posible guardar los datos.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const exportarDatos = async () => {
    if (!clienteId) return;

    setMensaje("Generando archivo de exportación...");

    const escaparExcel = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const descargarBlob = (blob: Blob, nombreArchivo: string) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nombreArchivo;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    };

    try {
      const refBase = collection(
        db,
        "clientes",
        clienteId,
        "AUTOEVALUACION_GENERAL",
      );
      const snap = await getDocs(query(refBase, orderBy("categoria", "asc")));
      const filasExportar: Record<string, unknown>[] = [];

      for (const documento of snap.docs) {
        const data = documento.data() as Record<string, unknown>;
        const asociadosSnap = await getDocs(
          collection(
            db,
            "clientes",
            clienteId,
            "AUTOEVALUACION_GENERAL",
            documento.id,
            "asociados",
          ),
        );

        if (asociadosSnap.empty) {
          filasExportar.push({
            CATEGORÍA: data.categoria || "",
            PRODUCTO: data.producto || "",
            TIPO: data.tipo || "",
            "STOCK MÍNIMO": data.stockMinimo || "",
            "STOCK MÁXIMO": data.stockMaximo || "",
            "CÓDIGO BARRAS": "",
            "CÓDIGO PRINCIPAL": "",
            "TIPO REGISTRO": "Sin asociados",
            "DATOS MODAL": "",
          });
          continue;
        }

        asociadosSnap.docs.forEach((asociadoDoc) => {
          const asociado = asociadoDoc.data() as Record<string, unknown>;
          filasExportar.push({
            CATEGORÍA: data.categoria || asociado.categoria || "",
            PRODUCTO: data.producto || asociado.producto || "",
            TIPO: data.tipo || asociado.tipo || "",
            "STOCK MÍNIMO": data.stockMinimo || asociado.stockMinimo || "",
            "STOCK MÁXIMO": data.stockMaximo || asociado.stockMaximo || "",
            "CÓDIGO BARRAS": asociado.codigoBarras || asociadoDoc.id,
            "CÓDIGO PRINCIPAL": asociado.codigoPrincipal || "",
            "TIPO REGISTRO":
              asociado.creadoComo || asociado.modalTipo || "Asociado",
            "DATOS MODAL": asociado.datos ? JSON.stringify(asociado.datos) : "",
          });
        });
      }

      if (filasExportar.length === 0) {
        mostrarMensaje("No hay datos guardados para exportar.", "error");
        return;
      }

      const columnas = [
        "CATEGORÍA",
        "PRODUCTO",
        "TIPO",
        "STOCK MÍNIMO",
        "STOCK MÁXIMO",
        "CÓDIGO BARRAS",
        "CÓDIGO PRINCIPAL",
        "TIPO REGISTRO",
        "DATOS MODAL",
      ];

      const tablaHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charSet="utf-8" />
            <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>Autoevaluacion</x:Name>
                    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
            <![endif]-->
          </head>
          <body>
            <table border="1">
              <thead>
                <tr>${columnas.map((col) => `<th>${escaparExcel(col)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${filasExportar
                  .map(
                    (fila) =>
                      `<tr>${columnas
                        .map((col) => `<td>${escaparExcel(fila[col])}</td>`)
                        .join("")}</tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>`;

      const blob = new Blob(["\ufeff", tablaHtml], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });

      descargarBlob(
        blob,
        `autoevaluacion_con_asociados_${new Date()
          .toISOString()
          .slice(0, 10)}.xls`,
      );

      mostrarMensaje("Exportación generada correctamente.", "ok");
    } catch (error) {
      console.error("Error exportando autoevaluación:", error);
      mostrarMensaje("No fue posible exportar los datos.", "error");
    }
  };

 const abrirModalConfiguracion = (item: AutoevaluacionItem) => {
    setItemConfigurando(item);

    // NUEVO: Recuperamos los datos de Excel si existen
    const datos = item.datosPrevios || {};

    setFormModal({
      producto: item.producto,
      tipo: item.tipo,
      stockMinimo: item.stockMinimo,
      stockMaximo: item.stockMaximo,
      usuario: nombreCliente || user?.email || "",
      fecha: datos.fecha || HOY_ISO,
      nombreKit: item.producto,
      medicamentoGenerico: datos.medicamentoGenerico || item.producto,
      tipoMovimiento: "Ingreso",
      estadoHabilitacion: "Cumple",
      // --- Campos pre-diligenciados del Excel fusionado ---
      nombreComercial: datos.nombreComercial || "",
      codigoBarras: datos.codigoBarras || datos.codBarras || "",
      presentacion: obtenerPresentacionSelect(datos.presentacion || ""),
      cantidadPresentacion:
        datos.cantidadPresentacion || obtenerCantidadPresentacionExcel(datos.presentacion || ""),
      concentracion: datos.concentracion || "",
      numeroLote: datos.numeroLote || "",
      invimaSerie: datos.invimaSerie || "",
      laboratorioFabricante: datos.laboratorioFabricante || "",
      proveedor: datos.proveedor || "",
      fechaVencimiento: datos.fechaVencimiento || "",
      semaforizacion: datos.semaforizacion || "",
      precioCompra: datos.precioCompra ? String(datos.precioCompra) : "",
      precioVenta: datos.precioVenta ? String(datos.precioVenta) : "",
    });

    const categoria = item.categoria.trim().toUpperCase();
    if (
      categoria.includes("DOTACION EQUIPOS BIOMEDICOS") ||
      categoria.includes("DOTACIÓN EQUIPOS BIOMÉDICOS")
    ) {
      setAccesoriosBiomedicos([
        {
          id: crypto.randomUUID(),
          nombre: "",
          codigoSerial: "",
          fotoNombre: "",
          estado: "Cumple",
        },
      ]);
    } else {
      setAccesoriosBiomedicos([]);
    }
  };

  const cerrarModalConfiguracion = () => {
    setItemConfigurando(null);
    setFormModal({});
    setAccesoriosBiomedicos([]);
  };

  const actualizarCampoModal = (name: string, value: string) => {
    setFormModal((actual) => ({ ...actual, [name]: value }));
  };

  const agregarAccesorioBiomedico = () => {
    setAccesoriosBiomedicos((actual) => [
      ...actual,
      {
        id: crypto.randomUUID(),
        nombre: "",
        codigoSerial: "",
        fotoNombre: "",
        estado: "Cumple",
      },
    ]);
  };

  const actualizarAccesorioBiomedico = (
    id: string,
    campo: keyof AccesorioBiomedico,
    value: string,
  ) => {
    setAccesoriosBiomedicos((actual) =>
      actual.map((item) =>
        item.id === id ? { ...item, [campo]: value } : item,
      ),
    );
  };

  const eliminarAccesorioBiomedico = (id: string) => {
    setAccesoriosBiomedicos((actual) => {
      const filtrados = actual.filter((item) => item.id !== id);
      return filtrados.length > 0
        ? filtrados
        : [
            {
              id: crypto.randomUUID(),
              nombre: "",
              codigoSerial: "",
              fotoNombre: "",
              estado: "Cumple",
            },
          ];
    });
  };

  const configModalActual = itemConfigurando
    ? crearConfigModal(itemConfigurando, nombreCliente)
    : null;

  useEffect(() => {
    if (!modalScanner) return;

    let activo = true;
    let intervalo: number | undefined;

    const iniciarScanner = async () => {
      setScannerError("");
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
              actualizarCampoModal("codigoBarras", String(valor));
              setScannerManual(String(valor));
              cerrarScanner();
            }
          } catch {
            // algunos navegadores fallan mientras el video inicia; se ignora y reintenta
          }
        }, 650);
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
  }, [modalScanner]);

  const cerrarScanner = () => {
    streamScannerRef.current?.getTracks().forEach((track) => track.stop());
    streamScannerRef.current = null;
    setModalScanner(false);
  };

  const aplicarCodigoManual = () => {
    const codigo = scannerManual.trim();
    if (!codigo) {
      setScannerError("Digita o escanea un código válido.");
      return;
    }
    actualizarCampoModal("codigoBarras", codigo);
    cerrarScanner();
  };

  const guardarConfiguracionModal = async (opciones?: {
    forzarReemplazo?: boolean;
    codigoForzado?: string;
  }) => {
    if (!clienteId || !itemConfigurando || !configModalActual) return;

    const codigoBase = String(
      opciones?.codigoForzado || formModal.codigoBarras || "",
    ).trim();
    if (!codigoBase) {
      mostrarMensaje(
        "Debes escanear o digitar el código de barras antes de guardar.",
        "error",
      );
      return;
    }

    setGuardandoConfiguracion(true);
    try {
      const idItem =
        limpiarId(
          `${itemConfigurando.categoria}_${itemConfigurando.producto}`,
        ) || itemConfigurando.id;
      const refItem = doc(
        db,
        "clientes",
        clienteId,
        "AUTOEVALUACION_GENERAL",
        idItem,
      );
      const refOriginal = doc(
        db,
        "clientes",
        clienteId,
        "AUTOEVALUACION_GENERAL",
        idItem,
        "asociados",
        codigoBase,
      );
      const existeOriginal = await getDoc(refOriginal);

      if (existeOriginal.exists() && !opciones?.forzarReemplazo) {
        setModalCodigoExistente({ codigo: codigoBase });
        setGuardandoConfiguracion(false);
        return;
      }

      const payloadBase = {
        codigoBarras: codigoBase,
        codigoPrincipal: codigoBase,
        categoria: itemConfigurando.categoria,
        producto: itemConfigurando.producto,
        tipo: itemConfigurando.tipo,
        stockMinimo: itemConfigurando.stockMinimo,
        stockMaximo: itemConfigurando.stockMaximo,
        modalTipo: configModalActual.tipo,
        datos: { ...formModal, codigoBarras: codigoBase },
        accesoriosBiomedicos:
          configModalActual.tipo === "DOTACION_EQUIPOS_BIOMEDICOS"
            ? accesoriosBiomedicos
            : [],
        creadoComo: existeOriginal.exists() ? "reemplazado" : "original",
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        refItem,
        {
          categoria: itemConfigurando.categoria,
          producto: itemConfigurando.producto,
          tipo: itemConfigurando.tipo,
          stockMinimo: itemConfigurando.stockMinimo,
          stockMaximo: itemConfigurando.stockMaximo,
          tieneAsociados: true,
          ultimoCodigoBarras: codigoBase,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        refOriginal,
        {
          ...payloadBase,
          createdAt: existeOriginal.exists()
            ? existeOriginal.data()?.createdAt || serverTimestamp()
            : serverTimestamp(),
        },
        { merge: true },
      );

      setItems((actual) =>
        actual.map((item) =>
          item.id === idItem ||
          (item.categoria === itemConfigurando.categoria &&
            item.producto === itemConfigurando.producto)
            ? {
                ...item,
                tieneAsociados: true,
                ultimoCodigoBarras: codigoBase,
                totalAsociados: Math.max(Number(item.totalAsociados || 0), 1),
              }
            : item,
        ),
      );

      setModalGenerarAdicionales({ codigo: codigoBase, payloadBase, idItem });
      setCantidadAdicionales("0");
      setSobrescribirAdicionales(false);
    } catch (error) {
      console.error("Error guardando configuración:", error);
      mostrarMensaje(
        "No fue posible guardar la configuración del ítem.",
        "error",
      );
    } finally {
      setGuardandoConfiguracion(false);
    }
  };

  const generarCodigoNuevoSugerido = async (codigoBase: string) => {
    if (!clienteId || !itemConfigurando) return;
    const idItem =
      limpiarId(`${itemConfigurando.categoria}_${itemConfigurando.producto}`) ||
      itemConfigurando.id;
    let consecutivo = 1;
    let codigoNuevo = `${codigoBase}-${consecutivo}`;

    while (consecutivo <= 500) {
      const refNuevo = doc(
        db,
        "clientes",
        clienteId,
        "AUTOEVALUACION_GENERAL",
        idItem,
        "asociados",
        codigoNuevo,
      );
      const snap = await getDoc(refNuevo);
      if (!snap.exists()) break;
      consecutivo += 1;
      codigoNuevo = `${codigoBase}-${consecutivo}`;
    }

    setModalCodigoExistente(null);
    actualizarCampoModal("codigoBarras", codigoNuevo);
    mostrarMensaje(
      `Se sugirió un nuevo código disponible: ${codigoNuevo}. Revisa y guarda nuevamente.`,
      "info",
    );
  };

  const confirmarGeneracionAdicionales = async () => {
    if (!clienteId || !modalGenerarAdicionales || !itemConfigurando) return;

    const cantidad = Math.min(
      Math.max(Math.floor(Number(cantidadAdicionales || 0)), 0),
      200,
    );
    const { codigo, payloadBase, idItem } = modalGenerarAdicionales;

    try {
      setGuardandoConfiguracion(true);
      let generados = 0;
      let saltados = 0;

      if (cantidad > 0) {
        const batch = writeBatch(db);
        for (let i = 1; i <= cantidad; i += 1) {
          const codigoGenerado = `${codigo}-${i}`;
          const refGenerado = doc(
            db,
            "clientes",
            clienteId,
            "AUTOEVALUACION_GENERAL",
            idItem,
            "asociados",
            codigoGenerado,
          );
          const existe = await getDoc(refGenerado);

          if (existe.exists() && !sobrescribirAdicionales) {
            saltados += 1;
            continue;
          }

          batch.set(
            refGenerado,
            {
              ...payloadBase,
              codigoBarras: codigoGenerado,
              codigoPrincipal: codigo,
              creadoComo: existe.exists() ? "reemplazado" : "generado",
              datos: {
                ...(payloadBase.datos || {}),
                codigoBarras: codigoGenerado,
              },
              createdAt: existe.exists()
                ? existe.data()?.createdAt || serverTimestamp()
                : serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          generados += 1;
        }
        await batch.commit();
      }

      await setDoc(
        doc(db, "clientes", clienteId, "AUTOEVALUACION_GENERAL", idItem),
        {
          tieneAsociados: true,
          ultimoCodigoBarras: codigo,
          totalAsociados: 1 + generados,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setItems((actual) =>
        actual.map((item) =>
          item.id === idItem
            ? {
                ...item,
                tieneAsociados: true,
                ultimoCodigoBarras: codigo,
                totalAsociados: Math.max(
                  Number(item.totalAsociados || 0),
                  1 + generados,
                ),
              }
            : item,
        ),
      );

      setModalGenerarAdicionales(null);
      cerrarModalConfiguracion();
      mostrarMensaje(
        saltados > 0
          ? `Configuración guardada. Se generaron ${generados} códigos y se omitieron ${saltados} porque ya existían.`
          : `Configuración guardada correctamente. Se generaron ${generados} códigos adicionales.`,
        "ok",
      );
    } catch (error) {
      console.error("Error generando códigos adicionales:", error);
      mostrarMensaje(
        "No fue posible generar los códigos adicionales.",
        "error",
      );
    } finally {
      setGuardandoConfiguracion(false);
    }
  };

  const abrirAsociados = async (item: AutoevaluacionItem) => {
    if (!clienteId) return;

    setItemAsociados(item);
    setRegistrosAsociados([]);
    setCargandoAsociados(true);

    try {
      const registros = await cargarRegistrosAsociadosItem(item);
      setRegistrosAsociados(registros);
    } catch (error) {
      console.error("Error cargando asociados:", error);
      mostrarMensaje("No fue posible cargar los códigos asociados.", "error");
    } finally {
      setCargandoAsociados(false);
    }
  };

  const eliminarRegistroAsociado = async (
    registro: RegistroAsociadoAutoevaluacion,
  ) => {
    if (!clienteId || !itemAsociados) return;

    const confirmar = window.confirm(
      `¿Eliminar el código asociado ${registro.codigoBarras || registro.id}?`,
    );

    if (!confirmar) return;

    try {
      const idItem =
        limpiarId(`${itemAsociados.categoria}_${itemAsociados.producto}`) ||
        itemAsociados.id;
      await deleteDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "AUTOEVALUACION_GENERAL",
          idItem,
          "asociados",
          registro.id,
        ),
      );

      const restantes = registrosAsociados.filter(
        (item) => item.id !== registro.id,
      );
      setRegistrosAsociados(restantes);

      await setDoc(
        doc(db, "clientes", clienteId, "AUTOEVALUACION_GENERAL", idItem),
        {
          tieneAsociados: restantes.length > 0,
          totalAsociados: restantes.length,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setItems((actual) =>
        actual.map((item) =>
          item.id === idItem
            ? {
                ...item,
                tieneAsociados: restantes.length > 0,
                totalAsociados: restantes.length,
              }
            : item,
        ),
      );

      mostrarMensaje("Código asociado eliminado correctamente.", "ok");
    } catch (error) {
      console.error("Error eliminando asociado:", error);
      mostrarMensaje("No fue posible eliminar el código asociado.", "error");
    }
  };

  const sacarRegistroDelInventario = async (
    registro: RegistroAsociadoAutoevaluacion,
  ) => {
    if (!clienteId || !itemAsociados) return;

    const motivo = window.prompt(
      `Motivo para sacar del inventario ${registro.codigoBarras || registro.id}:`,
      registro.motivoUso || "Producto usado en autoevaluación móvil.",
    );

    if (motivo === null) return;

    const motivoLimpio = motivo.trim();
    if (!motivoLimpio) {
      mostrarMensaje(
        "Debes escribir el motivo para sacar el producto del inventario.",
        "error",
      );
      return;
    }

    try {
      const idItem =
        limpiarId(`${itemAsociados.categoria}_${itemAsociados.producto}`) ||
        itemAsociados.id;
      const codigoRetirado = String(registro.codigoBarras || registro.id || "").trim();
      const idAsociado = registro.id || codigoRetirado;
      const refAsociado = doc(
        db,
        "clientes",
        clienteId,
        "AUTOEVALUACION_GENERAL",
        idItem,
        "asociados",
        idAsociado,
      );

      const asignacionesSnap = await getDocs(
        collectionGroup(db, "ASIGNACIONES_BODEGA"),
      ).catch(() => null);
      const asignacionesDelCodigo =
        asignacionesSnap?.docs.filter((documento) => {
          const data = documento.data() as Record<string, unknown>;
          const codigo = String(data.codigoBarras || documento.id || "").trim();
          return (
            codigo === codigoRetirado &&
            documento.ref.path.includes(`clientes/${clienteId}/`)
          );
        }) || [];

      const asignacionActual = asignacionesDelCodigo[0]?.data() as
        | Record<string, unknown>
        | undefined;

      const historialId = `${Date.now()}_${limpiarId(codigoRetirado) || "retiro"}`;
      const payloadHistorial = {
        ...registro,
        categoria: itemAsociados.categoria,
        producto: itemAsociados.producto,
        codigoBarras: codigoRetirado,
        codigoPrincipal: registro.codigoPrincipal || codigoRetirado,
        motivoRetiro: motivoLimpio,
        motivo: motivoLimpio,
        accion: "SACAR_INVENTARIO",
        estado: "FUERA_INVENTARIO",
        estadoInventario: "FUERA_INVENTARIO",
        productoBaseId: idItem,
        asociadoId: idAsociado,
        asignacionPath: asignacionesDelCodigo[0]?.ref.path || "",
        movilId:
          String(asignacionActual?.movilId || registro.asignadoMovilId || ""),
        movilNombre:
          String(
            asignacionActual?.movilNombre ||
              registro.asignadoMovilNombre ||
              "Sin móvil",
          ),
        gestionadoPor:
          String(
            asignacionActual?.gestionadoPorNombre ||
              asignacionActual?.gestionadoPor ||
              (registro as any).gestionadoPorNombre ||
              (registro as any).gestionadoPor ||
              "",
          ),
        gestionadoPorId: String(asignacionActual?.gestionadoPorId || ""),
        fechaGestion: asignacionActual?.fechaGestion || registro.fechaGestion || null,
        fechaUso: asignacionActual?.fechaUso || registro.fechaUso || null,
        retiradoPor: nombreCliente || user?.email || "Usuario",
        retiradoPorEmail: user?.email || "",
        retiradoAt: serverTimestamp(),
        fechaRetiro: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      const batch = writeBatch(db);

      batch.set(
        doc(
          db,
          "clientes",
          clienteId,
          "AUTOEVALUACION_GENERAL",
          idItem,
          "HISTORIAL_RETIROS",
          historialId,
        ),
        payloadHistorial,
        { merge: true },
      );

      batch.set(
        doc(
          db,
          "clientes",
          clienteId,
          "HISTORIAL_INVENTARIO_AUTOEVALUACION",
          historialId,
        ),
        payloadHistorial,
        { merge: true },
      );

      batch.set(
        refAsociado,
        {
          activo: false,
          retirado: true,
          usado: true,
          fueraInventario: true,
          bajaInventario: true,
          asignado: false,
          asignadoMovilId: "",
          asignadoMovilNombre: "",
          estadoInventario: "FUERA_INVENTARIO",
          estadoUso: "USADO",
          motivoRetiro: motivoLimpio,
          fechaRetiro: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      asignacionesDelCodigo.forEach((documento) => {
        batch.delete(documento.ref);
      });

      const restantes = registrosAsociados.filter(
        (item) =>
          item.id !== registro.id &&
          item.codigoBarras !== registro.codigoBarras,
      );

      batch.set(
        doc(db, "clientes", clienteId, "AUTOEVALUACION_GENERAL", idItem),
        {
          tieneAsociados: restantes.length > 0,
          totalAsociados: restantes.length,
          ultimoRetiroInventario: {
            codigoBarras: codigoRetirado,
            motivo: motivoLimpio,
            fecha: new Date().toISOString(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await batch.commit();

      setRegistrosAsociados(restantes);
      setItems((actual) =>
        actual.map((item) =>
          item.id === idItem
            ? {
                ...item,
                tieneAsociados: restantes.length > 0,
                totalAsociados: restantes.length,
              }
            : item,
        ),
      );

      mostrarMensaje(
        "Producto sacado del inventario, retirado de la móvil y registrado en historial.",
        "ok",
      );
    } catch (error) {
      console.error("Error sacando producto del inventario:", error);
      mostrarMensaje(
        "No fue posible sacar el producto del inventario.",
        "error",
      );
    }
  };

  const cargarHistorialUsoInventario = async (categoriaSeleccionada?: string) => {
    if (!clienteId || cargandoHistorialUso) return;

    const categoriaActual = String(
      categoriaSeleccionada ||
        categoriaHistorialUsoActiva ||
        categoriasHistorialUsoDisponibles[0] ||
        "",
    );

    setCategoriaHistorialUsoActiva(categoriaActual);
    setBusquedaHistorialUso("");
    setCargandoHistorialUso(true);
    setModalHistorialUso(true);

    try {
      const acumulado: HistorialInventarioItem[] = [];

      const historialGlobalSnap = await getDocs(
        collection(db, "clientes", clienteId, "HISTORIAL_INVENTARIO_AUTOEVALUACION"),
      ).catch(() => null);

      historialGlobalSnap?.docs.forEach((documento) => {
        const data = documento.data() as Record<string, any>;
        const categoria = normalizarValor(data.categoria || data.productoCategoria, "Sin categoría");
        if (categoriaActual && categoria !== categoriaActual) return;

        acumulado.push({
          id: documento.id,
          historialGlobalId: documento.id,
          historialProductoId: normalizarValor(data.historialProductoId || data.historialId || documento.id, documento.id),
          productoBaseId: normalizarValor(data.productoBaseId || data.productoId || ""),
          asociadoId: normalizarValor(data.asociadoId || data.codigoBarras || documento.id, documento.id),
          categoria,
          producto: normalizarValor(data.producto || data.productoNombre, "Sin producto"),
          codigoBarras: normalizarValor(data.codigoBarras || data.asociadoId || documento.id, documento.id),
          codigoPrincipal: normalizarValor(data.codigoPrincipal || data.codigoBarras || data.asociadoId, documento.id),
          accion: normalizarValor(data.accion, "SACAR_INVENTARIO"),
          estado: normalizarValor(data.estado || data.estadoInventario, "FUERA_INVENTARIO"),
          motivo: normalizarValor(data.motivoRetiro || data.motivo || data.motivoUso, "Sin motivo registrado"),
          movilNombre: normalizarValor(data.movilNombre || data.asignadoMovilNombre, "Sin móvil"),
          movilId: normalizarValor(data.movilId || data.asignadoMovilId, ""),
          gestionadoPor: normalizarValor(data.gestionadoPor || data.gestionadoPorNombre, ""),
          retiradoPor: normalizarValor(data.retiradoPor, ""),
          fechaGestion: data.fechaGestion,
          fechaUso: data.fechaUso,
          fechaRetiro: data.fechaRetiro || data.retiradoAt,
          createdAt: data.createdAt,
        });
      });

      if (acumulado.length === 0) {
        const itemsCategoria = categoriaActual
          ? items.filter((item) => item.categoria === categoriaActual)
          : items;

        await Promise.all(
          itemsCategoria.map(async (item) => {
            const idItem = limpiarId(`${item.categoria}_${item.producto}`) || item.id;
            const asociados = await cargarRegistrosAsociadosItem(item, {
              incluirRetirados: true,
            });

            asociados
              .filter(
                (registro) =>
                  Boolean(registro.usado) ||
                  Boolean(registro.retirado) ||
                  registro.estadoInventario === "retirado" ||
                  registro.estadoInventario === "FUERA_INVENTARIO",
              )
              .forEach((registro) => {
                acumulado.push({
                  id: `${idItem}_${registro.id}`,
                  productoBaseId: idItem,
                  asociadoId: registro.id,
                  categoria: item.categoria,
                  producto: item.producto,
                  codigoBarras: registro.codigoBarras || registro.id,
                  codigoPrincipal:
                    registro.codigoPrincipal || registro.codigoBarras || registro.id,
                  accion: registro.retirado ? "SACAR_INVENTARIO" : "USO",
                  estado: registro.estadoInventario || (registro.usado ? "USADO" : "GESTIONADO"),
                  motivo:
                    registro.motivoUso ||
                    (registro as any).motivoRetiro ||
                    (registro as any).motivo ||
                    "Sin motivo registrado",
                  movilNombre: registro.asignadoMovilNombre || "Sin móvil",
                  movilId: registro.asignadoMovilId || "",
                  gestionadoPor:
                    (registro as any).gestionadoPorNombre ||
                    (registro as any).gestionadoPor ||
                    "",
                  retiradoPor: (registro as any).retiradoPor || "",
                  fechaGestion: registro.fechaGestion,
                  fechaUso: registro.fechaUso,
                  fechaRetiro: registro.fechaRetiro,
                  createdAt: registro.updatedAt || registro.createdAt,
                });
              });
          }),
        );
      }

      const unicos = Array.from(
        new Map(
          acumulado.map((item) => [
            item.historialGlobalId || `${item.categoria}_${item.producto}_${item.codigoBarras}_${formatearFechaValor(item.fechaRetiro || item.fechaUso || item.fechaGestion || item.createdAt)}`,
            item,
          ]),
        ).values(),
      );

      unicos.sort((a, b) =>
        formatearFechaValor(b.fechaRetiro || b.fechaUso || b.fechaGestion || b.createdAt).localeCompare(
          formatearFechaValor(a.fechaRetiro || a.fechaUso || a.fechaGestion || a.createdAt),
        ),
      );

      setHistorialUso(unicos);
    } catch (error) {
      console.error("Error cargando historial de inventario usado:", error);
      mostrarMensaje("No fue posible cargar el historial de productos usados.", "error");
      setHistorialUso([]);
    } finally {
      setCargandoHistorialUso(false);
    }
  };

  const eliminarHistorialUsoDefinitivo = async (registro: HistorialInventarioItem) => {
    if (!clienteId || eliminandoHistorialUso) return;

    const confirmar = window.confirm(
      `¿Eliminar definitivamente el historial del código ${registro.codigoBarras}? Esta acción no recupera el producto al inventario.`,
    );
    if (!confirmar) return;

    const idGlobal = registro.historialGlobalId || registro.id;
    setEliminandoHistorialUso(idGlobal);

    try {
      const operaciones: Promise<void>[] = [];

      operaciones.push(
        deleteDoc(doc(db, "clientes", clienteId, "HISTORIAL_INVENTARIO_AUTOEVALUACION", idGlobal)).catch(() => undefined),
      );

      const productoId = registro.productoBaseId || limpiarId(`${registro.categoria}_${registro.producto}`);
      const historialProductoId = registro.historialProductoId || registro.id;
      if (productoId && historialProductoId) {
        operaciones.push(
          deleteDoc(
            doc(
              db,
              "clientes",
              clienteId,
              "AUTOEVALUACION_GENERAL",
              productoId,
              "HISTORIAL_RETIROS",
              historialProductoId,
            ),
          ).catch(() => undefined),
        );
      }

      await Promise.all(operaciones);

      setHistorialUso((actual) =>
        actual.filter(
          (item) =>
            item.id !== registro.id &&
            item.historialGlobalId !== idGlobal &&
            `${item.productoBaseId}_${item.asociadoId}` !== `${registro.productoBaseId}_${registro.asociadoId}`,
        ),
      );

      mostrarMensaje("Historial eliminado definitivamente.", "ok");
    } catch (error) {
      console.error("Error eliminando historial:", error);
      mostrarMensaje("No fue posible eliminar el historial.", "error");
    } finally {
      setEliminandoHistorialUso("");
    }
  };

  const guardarSemaforizacion = async () => {
    if (!clienteId || guardandoSemaforizacion) return;

    setGuardandoSemaforizacion(true);

    try {
      const dias = Math.max(
        1,
        Math.min(365, Number(diasPreviosVencimiento || 10)),
      );
      await setDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "configuracionAlertas",
          "autoevaluacion",
        ),
        {
          vencimientoActivo: semaforoVencimiento,
          noDiligenciadoActivo: semaforoNoDiligenciado,
          sinCodigoActivo: semaforoSinCodigo,
          diasPreviosVencimiento: dias,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      const batch = writeBatch(db);
      let alertasCreadas = 0;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const limite = new Date(hoy);
      limite.setDate(limite.getDate() + dias);

      const refAlertas = collection(db, "clientes", clienteId, "alertas");

      if (semaforoNoDiligenciado || semaforoSinCodigo) {
        items.forEach((item) => {
          if (!item.tieneAsociados) {
            const alertaId = `autoevaluacion_${limpiarId(`${item.categoria}_${item.producto}`)}_sin_diligenciar`;
            batch.set(
              doc(refAlertas, alertaId),
              {
                tipo: "AUTOEVALUACION",
                categoria: item.categoria,
                producto: item.producto,
                motivo: semaforoNoDiligenciado
                  ? "Producto de autoevaluación sin diligenciar."
                  : "Código de barras pendiente.",
                tipoAlerta: "SIN_DILIGENCIAR",
                activo: true,
                fechaAlerta: new Date().toISOString(),
                rutaOrigen: `/configuraciones/autoevaluacion?categoria=${encodeURIComponent(item.categoria)}&producto=${encodeURIComponent(item.producto)}`,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
            alertasCreadas += 1;
          }
        });
      }

      if (semaforoVencimiento) {
        for (const item of items.filter((item) => item.tieneAsociados)) {
          const asociados = await cargarRegistrosAsociadosItem(item);
          asociados.forEach((registro) => {
            const datos = registro.datos || {};
            Object.entries(datos).forEach(([campo, valor]) => {
              if (!campo.toLowerCase().includes("venc") || !valor) return;
              const fecha = new Date(String(valor));
              if (Number.isNaN(fecha.getTime())) return;
              fecha.setHours(0, 0, 0, 0);
              if (fecha <= limite) {
                const vencida = fecha < hoy;
                const alertaId = `autoevaluacion_${limpiarId(`${item.categoria}_${item.producto}_${registro.id}_${campo}`)}`;
                batch.set(
                  doc(refAlertas, alertaId),
                  {
                    tipo: "AUTOEVALUACION",
                    categoria: item.categoria,
                    producto: item.producto,
                    codigoBarras: registro.codigoBarras || registro.id,
                    campoVencimiento: campo,
                    fechaVencimiento: String(valor),
                    motivo: vencida
                      ? "Producto de autoevaluación vencido."
                      : `Producto de autoevaluación próximo a vencer en ${dias} días o menos.`,
                    tipoAlerta: vencida ? "VENCIDO" : "POR_VENCER",
                    activo: true,
                    fechaAlerta: new Date().toISOString(),
                    rutaOrigen: `/configuraciones/autoevaluacion?categoria=${encodeURIComponent(item.categoria)}&producto=${encodeURIComponent(item.producto)}&codigo=${encodeURIComponent(registro.codigoBarras || registro.id)}`,
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true },
                );
                alertasCreadas += 1;
              }
            });
          });
        }
      }

      if (alertasCreadas > 0) {
        await batch.commit();
      }

      setModalSemaforizacion(false);
      mostrarMensaje(
        `Semaforización guardada. Alertas de autoevaluación actualizadas: ${alertasCreadas}.`,
        "ok",
      );
    } catch (error) {
      console.error("Error guardando semaforización:", error);
      mostrarMensaje("No fue posible guardar la semaforización.", "error");
    } finally {
      setGuardandoSemaforizacion(false);
    }
  };

  const abrirRegistroAsociado = (registro: RegistroAsociadoAutoevaluacion) => {
    if (!itemAsociados) return;

    setItemConfigurando(itemAsociados);
    setFormModal({
      producto: itemAsociados.producto,
      tipo: itemAsociados.tipo,
      stockMinimo: itemAsociados.stockMinimo,
      stockMaximo: itemAsociados.stockMaximo,
      usuario: nombreCliente || user?.email || "",
      fecha: HOY_ISO,
      nombreKit: itemAsociados.producto,
      medicamentoGenerico: itemAsociados.producto,
      tipoMovimiento: "Ingreso",
      estadoHabilitacion: "Cumple",
      ...(registro.datos || {}),
      codigoBarras: registro.codigoBarras || registro.id,
    });
    setAccesoriosBiomedicos(registro.accesoriosBiomedicos || []);
    setItemAsociados(null);
  };

  const dimensionesEtiquetaCm = useMemo(() => {
    if (tamanoEtiqueta === "3x1_5") {
      return { ancho: 3, alto: 1.5 };
    }

    if (tamanoEtiqueta === "personalizado") {
      const ancho = Math.min(
        Math.max(Number(anchoEtiquetaPersonalizado || 5), 1),
        15,
      );
      const alto = Math.min(
        Math.max(Number(altoEtiquetaPersonalizado || 3), 1),
        10,
      );
      return { ancho, alto };
    }

    return { ancho: 5, alto: 3 };
  }, [tamanoEtiqueta, anchoEtiquetaPersonalizado, altoEtiquetaPersonalizado]);

  const etiquetasPorPagina = useMemo(() => {
    const columnas = Math.max(1, Math.floor(19 / dimensionesEtiquetaCm.ancho));
    const filas = Math.max(1, Math.floor(26.7 / dimensionesEtiquetaCm.alto));
    return columnas * filas;
  }, [dimensionesEtiquetaCm]);

  const cargarRegistrosAsociadosItem = async (
    item: AutoevaluacionItem,
    opciones?: { incluirRetirados?: boolean },
  ) => {
    if (!clienteId) return [];

    const idItem = limpiarId(`${item.categoria}_${item.producto}`) || item.id;
    const snap = await getDocs(
      collection(
        db,
        "clientes",
        clienteId,
        "AUTOEVALUACION_GENERAL",
        idItem,
        "asociados",
      ),
    );

    const asignacionesSnap = await getDocs(
      collectionGroup(db, "ASIGNACIONES_BODEGA"),
    ).catch(() => null);
    const asignacionesPorCodigo = new Map<string, Record<string, unknown>>();
    asignacionesSnap?.docs.forEach((documento) => {
      if (!documento.ref.path.includes(`clientes/${clienteId}/`)) return;
      const data = documento.data() as Record<string, unknown>;
      const codigo = String(data.codigoBarras || documento.id || "").trim();
      const activo =
        data.activo !== false &&
        !data.retirado &&
        !data.bajaInventario &&
        String(data.estadoInventario || "").toLowerCase() !== "fuera_inventario";
      if (!codigo || !activo) return;
      asignacionesPorCodigo.set(codigo, data);
    });

    const registros = snap.docs
      .map((documento) => {
        const data = documento.data() as Omit<
          RegistroAsociadoAutoevaluacion,
          "id"
        >;
        const codigo = String(data.codigoBarras || documento.id || "").trim();
        const asignacion = asignacionesPorCodigo.get(codigo) || {};
        const estadoInventario = String(
          (data as any).estadoInventario || "",
        ).toLowerCase();
        const retirado = Boolean(
          (data as any).retirado ||
          (data as any).bajaInventario ||
          (data as any).fueraInventario ||
          (data as any).activo === false ||
          estadoInventario === "retirado" ||
          estadoInventario === "fuera_inventario" ||
          estadoInventario === "fuera inventario",
        );

        return {
          id: documento.id,
          ...data,
          asignado: Boolean(asignacion.codigoBarras || (data as any).asignado),
          asignadoMovilId: String(
            asignacion.movilId || (data as any).asignadoMovilId || "",
          ),
          asignadoMovilNombre: String(
            asignacion.movilNombre || (data as any).asignadoMovilNombre || "",
          ),
          gestionado: Boolean(
            (data as any).gestionado ||
            (data as any).diligenciado ||
            asignacion.gestionado ||
            asignacion.diligenciado ||
            asignacion.estadoGestion === "diligenciado",
          ),
          usado: Boolean(
            (data as any).usado ||
            asignacion.usado ||
            asignacion.estadoUso === "usado" ||
            String((data as any).estadoInventario || "").toLowerCase() ===
              "usado",
          ),
          motivoUso: String(
            (data as any).motivoUso || asignacion.motivoUso || "",
          ),
          retirado,
          fechaGestion: (data as any).fechaGestion || asignacion.fechaGestion,
          fechaUso: (data as any).fechaUso || asignacion.fechaUso,
        } as RegistroAsociadoAutoevaluacion;
      })
      .filter((registro) => opciones?.incluirRetirados || !registro.retirado);

    registros.sort((a, b) =>
      String(a.codigoBarras || a.id).localeCompare(
        String(b.codigoBarras || b.id),
        "es",
        { numeric: true },
      ),
    );

    return registros;
  };

  const abrirImpresionCodigos = async (item: AutoevaluacionItem) => {
    if (!clienteId) return;

    setItemImpresion(item);
    setRegistrosImpresion([]);
    setCargandoImpresion(true);

    try {
      const registros = await cargarRegistrosAsociadosItem(item);
      setRegistrosImpresion(registros);

      if (registros.length === 0) {
        mostrarMensaje(
          "Este producto aún no tiene códigos para imprimir. Primero configura y guarda al menos un código.",
          "info",
        );
      }
    } catch (error) {
      console.error("Error preparando impresión:", error);
      mostrarMensaje(
        "No fue posible cargar los códigos para imprimir.",
        "error",
      );
    } finally {
      setCargandoImpresion(false);
    }
  };

  const svgBarcodeToPng = async (codigo: string) => {
    await cargarLibreriasImpresion();

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    window.JsBarcode?.(svg, codigo, {
      format: "CODE128",
      displayValue: true,
      fontSize: 16,
      height: 58,
      margin: 6,
    });

    const svgText = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(420, image.width || 420);
      canvas.height = Math.max(180, image.height || 180);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo crear el canvas del código.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const descargarPdfCodigos = async () => {
    if (!itemImpresion || registrosImpresion.length === 0) return;

    try {
      setGenerandoPdf(true);
      await cargarLibreriasImpresion();
      const JsPDF = window.jspdf?.jsPDF;
      if (!JsPDF) throw new Error("jsPDF no está disponible.");

      const pdf = new JsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      });
      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const marginX = 10;
      const marginY = 10;
      const gapX = 3;
      const gapY = 3;
      const labelW = dimensionesEtiquetaCm.ancho * 10;
      const labelH = dimensionesEtiquetaCm.alto * 10;
      const cols = Math.max(
        1,
        Math.floor((pageWidth - marginX * 2 + gapX) / (labelW + gapX)),
      );
      const rows = Math.max(
        1,
        Math.floor((pageHeight - marginY * 2 + gapY) / (labelH + gapY)),
      );
      const porPagina = cols * rows;

      for (let index = 0; index < registrosImpresion.length; index += 1) {
        if (index > 0 && index % porPagina === 0) {
          pdf.addPage();
        }

        const posicion = index % porPagina;
        const col = posicion % cols;
        const row = Math.floor(posicion / cols);
        const x = marginX + col * (labelW + gapX);
        const y = marginY + row * (labelH + gapY);
        const registro = registrosImpresion[index];
        const codigo = String(registro.codigoBarras || registro.id);
        const png = await svgBarcodeToPng(codigo);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(Math.max(5, Math.min(8, labelH / 4)));
        pdf.text(String(itemImpresion.producto).slice(0, 36), x + 2, y + 4);
        pdf.addImage(
          png,
          "PNG",
          x + 2,
          y + 5,
          Math.max(10, labelW - 4),
          Math.max(8, labelH - 8),
        );
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(Math.max(5, Math.min(7, labelH / 5)));
        pdf.text(codigo, x + 2, y + labelH - 2);
      }

      pdf.save(
        `codigos_${limpiarId(itemImpresion.producto) || "autoevaluacion"}.pdf`,
      );
    } catch (error) {
      console.error("Error generando PDF:", error);
      mostrarMensaje("No fue posible generar el PDF de códigos.", "error");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const cambiarLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !clienteId) return;

    if (!file.type.startsWith("image/")) {
      setMensajeLogo("Selecciona una imagen válida.");
      return;
    }

    if (file.size > 700 * 1024) {
      setMensajeLogo("El logo es muy pesado. Máximo recomendado: 700 KB.");
      return;
    }

    try {
      setSubiendoLogo(true);
      setMensajeLogo("");
      const storageRef = ref(
        storage,
        `clientes/${clienteId}/logo/logo_cliente`,
      );
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await setDoc(
        doc(db, "clientes", clienteId),
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
          <p className="text-sm font-semibold text-slate-600">
            Cargando autoevaluación...
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
        className={`fixed inset-y-0 left-0 z-40 w-72 overflow-hidden border-r border-white/10 bg-[#071027] text-white shadow-2xl transition-all duration-300 lg:translate-x-0 ${menuCollapsed ? "lg:w-20" : "lg:w-72"} ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className={`border-b border-white/10 ${menuCollapsed ? "px-3 py-4" : "px-4 py-4"}`}>
            <div className="flex items-start gap-3">
              <Link href="/dashboard" className="min-w-0 flex-1" title="Ir al inicio">
                <img
                  src={logo}
                  alt="Marthin"
                  className={`h-12 object-contain ${menuCollapsed ? "mx-auto w-12" : "w-36 object-left"}`}
                />
              </Link>

              <button
                type="button"
                onClick={() => setMenuCollapsed((actual) => !actual)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-base font-black text-white transition hover:bg-white/20 lg:flex"
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
                <label className="mt-2 block cursor-pointer text-[10px] font-bold text-white/80 hover:text-white">
                  <input type="file" accept="image/*" onChange={cambiarLogo} className="hidden" />
                  {subiendoLogo ? "Subiendo logo..." : "Cambiar logo"}
                </label>
                {mensajeLogo && <p className="mt-1 text-[10px] font-semibold text-white/45">{mensajeLogo}</p>}
                <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>
              </>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto py-5 text-sm font-bold ${menuCollapsed ? "px-2" : "px-3"}`}>
            <Link
              href="/dashboard"
              title="Inicio"
              className={`flex items-center rounded-2xl px-4 py-3 transition ${
                menuCollapsed ? "justify-center" : "gap-3"
              } ${pathname === "/dashboard" ? "bg-white text-[#071027] shadow-xl" : "text-white/85 hover:bg-white/10"}`}
            >
              {menuCollapsed ? "I" : "Inicio"}
            </Link>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setConfigOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                  pathname.startsWith("/configuraciones/empresa") ||
                  pathname.startsWith("/configuraciones/usuarios") ||
                  pathname.startsWith("/configuraciones/ubicaciones")
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/10"
                } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="1. Configuraciones"
              >
                <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{configOpen ? "▲" : "▼"}</span>}
              </button>

              {configOpen && !menuCollapsed && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/empresa" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/empresa" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>1.1 Empresa</Link>
                  <Link href="/configuraciones/usuarios" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/usuarios" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>1.2 Usuarios y Roles</Link>
                  <Link href="/configuraciones/ubicaciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/ubicaciones" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>1.3 Móviles y Bodegas</Link>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setOperativaOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                  pathname.startsWith("/configuraciones/autoevaluacion") || pathname.startsWith("/configuraciones/asignaciones")
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/10"
                } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="2. Área operativa"
              >
                <span>{menuCollapsed ? "2" : "2. Área operativa"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{operativaOpen ? "▲" : "▼"}</span>}
              </button>

              {operativaOpen && !menuCollapsed && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/autoevaluacion" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/autoevaluacion" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>2.1 Autoevaluación General</Link>
                  <Link href="/configuraciones/asignaciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/asignaciones" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>2.2 Asignaciones a Móviles</Link>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setMovilesOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                  pathname.startsWith("/configuraciones/verificaciones") || pathname.startsWith("/configuraciones/mantenimientos") || pathname.startsWith("/configuraciones/infracciones")
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/10"
                } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="3. Móviles"
              >
                <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{movilesOpen ? "▲" : "▼"}</span>}
              </button>

              {movilesOpen && !menuCollapsed && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/verificaciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/verificaciones" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>3.1 Verificación diaria</Link>
                  <Link href="/configuraciones/mantenimientos" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/mantenimientos" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>3.2 Programación de Mantenimientos</Link>
                  <Link href="/configuraciones/infracciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/infracciones" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>3.3 Gestión de Infracciones</Link>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setTareasOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                  pathname.startsWith("/configuraciones/tareas") ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
                } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="4. Tareas"
              >
                <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{tareasOpen ? "▲" : "▼"}</span>}
              </button>

              {tareasOpen && !menuCollapsed && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/tareas" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/tareas" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>4.1 Programar tareas</Link>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setSoporteOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                  pathname.startsWith("/configuraciones/soportea") ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
                } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                title="5. Soporte"
              >
                <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{soporteOpen ? "▲" : "▼"}</span>}
              </button>

              {soporteOpen && !menuCollapsed && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/soportea" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/soportea" ? "bg-[#5b45f5] text-white shadow-lg shadow-indigo-950/30" : "text-white/75 hover:bg-white/10"}`}>5.1 Solicitar un soporte</Link>
                </div>
              )}
            </div>
          </nav>

          {!menuCollapsed && (
            <div className="border-t border-white/10 p-4">
              <p className="text-[11px] text-white/45">Un producto de Famiasistir</p>
              <p className="text-[11px] text-white/45">Desarrollado por Printserp SAS</p>
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

            <div className="hidden sm:block min-w-0">
              <p className="text-[11px] font-medium text-white/70">Hola,</p>
              <h1 className="text-sm font-bold text-white truncate">
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
                onClick={cerrarSesion}
                className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">
                  2. Área Operativa
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">
                  Autoevaluación
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Descarga la plantilla, revísala y luego impórtala para
                  visualizar los datos antes de guardarlos.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href={PLANTILLA_EXCEL_URL}
                  download
                  className="inline-flex items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 hover:bg-indigo-100"
                >
                  Descargar Excel base
                </a>
                <button
                  type="button"
                  onClick={() => inputExcelRef.current?.click()}
                  disabled={leyendoExcel || guardando}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {leyendoExcel ? "Leyendo Excel..." : "Importar Excel"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalSemaforizacion(true)}
                  disabled={guardando || leyendoExcel || !clienteId}
                  className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-400 disabled:opacity-60"
                >
                  Semaforización
                </button>
                <button
                  type="button"
                  onClick={() => cargarHistorialUsoInventario()}
                  disabled={guardando || leyendoExcel || !clienteId || cargandoHistorialUso}
                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-500 disabled:opacity-60"
                >
                  {cargandoHistorialUso ? "Cargando..." : "Historial por categoría"}
                </button>
                <input
                  ref={inputExcelRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={importarExcel}
                  className="hidden"
                />
              </div>
            </div>

            {mensaje && (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
                  tipoMensaje === "ok"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : tipoMensaje === "error"
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-indigo-100 bg-indigo-50 text-indigo-700"
                }`}
              >
                {mensaje}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white shadow-[0_4px_22px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Datos de autoevaluación
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {items.length > 0
                      ? `${items.length} registros cargados.`
                      : "Aún no hay datos importados o guardados."}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder="Buscar categoría, producto o tipo..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white sm:w-80"
                  />
                  <select
                    value={filasPorPagina}
                    onChange={(event) =>
                      setFilasPorPagina(Number(event.target.value))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none focus:border-indigo-300"
                  >
                    <option value={10}>10 filas</option>
                    <option value={50}>50 filas</option>
                    <option value={100}>100 filas</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-black">Acción</th>
                    <th className="px-5 py-4 font-black">Categoría</th>
                    <th className="px-5 py-4 font-black">Producto</th>
                    <th className="px-5 py-4 font-black">Tipo</th>
                    <th className="px-5 py-4 font-black">Stock mínimo</th>
                    <th className="px-5 py-4 font-black">Stock máximo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsPaginados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-sm font-semibold text-slate-400"
                      >
                        Importa el Excel para visualizar la información.
                      </td>
                    </tr>
                  ) : (
                    itemsPaginados.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          item.tieneAsociados
                            ? "bg-emerald-50/55 hover:bg-emerald-50"
                            : "hover:bg-slate-50/70"
                        }
                      >
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => abrirModalConfiguracion(item)}
                              className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500"
                            >
                              Configurar
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirAsociados(item)}
                              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                            >
                              Ver asociados
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirImpresionCodigos(item)}
                              className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                            >
                              Imprimir code bar
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-black text-slate-800">
                          <div className="flex flex-col gap-1">
                            <span>{item.categoria}</span>
                            {item.tieneAsociados && (
                              <span className="w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                Gestionada
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {item.producto}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {item.tipo}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {item.stockMinimo}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {item.stockMaximo}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {itemsPaginados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-400">
                  Importa el Excel para visualizar la información.
                </div>
              ) : (
                itemsPaginados.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-4 shadow-sm ${item.tieneAsociados ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">
                          {item.categoria}
                        </p>
                        <h4 className="mt-1 text-sm font-black text-slate-800">
                          {item.producto}
                        </h4>
                        {item.tieneAsociados && (
                          <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
                            Gestionada
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => abrirModalConfiguracion(item)}
                          className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-500"
                        >
                          Configurar
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirAsociados(item)}
                          className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-200"
                        >
                          Asociados
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="font-black text-slate-400">Tipo</p>
                        <p className="mt-1 font-bold text-slate-700">
                          {item.tipo}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="font-black text-slate-400">Mínimo</p>
                        <p className="mt-1 font-bold text-slate-700">
                          {item.stockMinimo}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="font-black text-slate-400">Máximo</p>
                        <p className="mt-1 font-bold text-slate-700">
                          {item.stockMaximo}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            {itemsFiltrados.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-xs font-black text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Mostrando {(pagina - 1) * filasPorPagina + 1} -{" "}
                  {Math.min(pagina * filasPorPagina, itemsFiltrados.length)} de{" "}
                  {itemsFiltrados.length}
                </p>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() =>
                      setPagina((actual) => Math.max(1, actual - 1))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span>
                    {pagina}/{totalPaginas}
                  </span>
                  <button
                    type="button"
                    disabled={pagina >= totalPaginas}
                    onClick={() =>
                      setPagina((actual) => Math.min(totalPaginas, actual + 1))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      {itemConfigurando && configModalActual && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-6xl sm:rounded-3xl">
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                    Modal específico
                  </p>
                  <h3 className="mt-1 truncate text-lg font-black sm:text-xl">
                    {configModalActual.titulo}
                  </h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-white/75">
                    {configModalActual.subtitulo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarModalConfiguracion}
                  className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-black text-white hover:bg-white/25"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">
                      Categoría
                    </p>
                    <p className="mt-1 font-black text-slate-800">
                      {itemConfigurando.categoria}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">
                      Producto
                    </p>
                    <p className="mt-1 font-black text-slate-800">
                      {itemConfigurando.producto}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">
                      Tipo detectado
                    </p>
                    <p className="mt-1 font-black text-slate-800">
                      {configModalActual.tipo}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-wide text-emerald-700">
                        Código de barras
                      </span>
                      <input
                        type="text"
                        value={formModal.codigoBarras || ""}
                        onChange={(event) =>
                          actualizarCampoModal(
                            "codigoBarras",
                            event.target.value,
                          )
                        }
                        placeholder="Escanea o digita el código"
                        className="mt-1 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerManual(formModal.codigoBarras || "");
                        setModalScanner(true);
                      }}
                      className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500"
                    >
                      Escanear code bar
                    </button>
                  </div>
                  <p className="text-xs font-semibold leading-5 text-emerald-700 lg:max-w-xs">
                    Si la cámara no lee el código, puedes digitarlo manualmente
                    en el campo. Al guardar podrás generar códigos asociados.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {configModalActual.secciones.map((seccion) => (
                  <section
                    key={seccion.titulo}
                    className="rounded-3xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5"
                  >
                    <h4 className="text-sm font-black text-slate-800">
                      {seccion.titulo}
                    </h4>

                    {seccion.campos && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {seccion.campos.map((campo) => (
                          <label key={campo.name} className="block">
                            <span className="text-xs font-black text-slate-500">
                              {campo.label}
                            </span>
                            {campo.type === "select" ? (
                              <select
                                value={
                                  formModal[campo.name] ||
                                  campo.options?.[0] ||
                                  ""
                                }
                                onChange={(event) =>
                                  actualizarCampoModal(
                                    campo.name,
                                    event.target.value,
                                  )
                                }
                                disabled={campo.readOnly}
                                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 disabled:bg-emerald-50 disabled:text-emerald-700"
                              >
                                {(campo.options || []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : campo.type === "file" ? (
                              <input
                                type="file"
                                onChange={(event) =>
                                  actualizarCampoModal(
                                    campo.name,
                                    event.target.files?.[0]?.name || "",
                                  )
                                }
                                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-black file:text-indigo-700"
                              />
                            ) : (
                              <input
                                type={campo.type || "text"}
                                value={formModal[campo.name] || ""}
                                readOnly={campo.readOnly}
                                onChange={(event) =>
                                  actualizarCampoModal(
                                    campo.name,
                                    event.target.value,
                                  )
                                }
                                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 read-only:bg-emerald-50 read-only:text-emerald-700"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    )}

                    {seccion.checklist && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
                        <div className="hidden grid-cols-[1fr_90px_110px] bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-400 sm:grid">
                          <span>Observación</span>
                          <span className="text-center">Cumple</span>
                          <span className="text-center">No cumple</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {seccion.checklist.map((itemChecklist, index) => (
                            <div
                              key={`${seccion.titulo}-${index}`}
                              className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_90px_110px] sm:items-center"
                            >
                              <p className="font-semibold leading-5 text-slate-700">
                                {itemChecklist}
                              </p>
                              <label className="flex items-center gap-2 text-xs font-black text-emerald-600 sm:justify-center">
                                <input
                                  type="radio"
                                  name={`${seccion.titulo}-${index}`}
                                  className="h-4 w-4 accent-emerald-600"
                                />{" "}
                                Cumple
                              </label>
                              <label className="flex items-center gap-2 text-xs font-black text-red-600 sm:justify-center">
                                <input
                                  type="radio"
                                  name={`${seccion.titulo}-${index}`}
                                  className="h-4 w-4 accent-red-600"
                                />{" "}
                                No cumple
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {seccion.accesoriosBiomedicos && (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-semibold leading-5 text-slate-500">
                            Registra los accesorios del equipo. Puedes agregar
                            varios accesorios con nombre, código/serial, foto y
                            estado.
                          </p>
                          <button
                            type="button"
                            onClick={agregarAccesorioBiomedico}
                            className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500"
                          >
                            Agregar accesorio
                          </button>
                        </div>

                        <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white md:block">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-400">
                              <tr>
                                <th className="px-3 py-3">Nombre</th>
                                <th className="px-3 py-3">
                                  Cod barras / serial
                                </th>
                                <th className="px-3 py-3">Foto</th>
                                <th className="px-3 py-3">Estado</th>
                                <th className="px-3 py-3 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {accesoriosBiomedicos.map((accesorio) => (
                                <tr key={accesorio.id}>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      value={accesorio.nombre}
                                      onChange={(event) =>
                                        actualizarAccesorioBiomedico(
                                          accesorio.id,
                                          "nombre",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Nombre del accesorio"
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="text"
                                      value={accesorio.codigoSerial}
                                      onChange={(event) =>
                                        actualizarAccesorioBiomedico(
                                          accesorio.id,
                                          "codigoSerial",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Código o serial"
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400"
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(event) =>
                                        actualizarAccesorioBiomedico(
                                          accesorio.id,
                                          "fotoNombre",
                                          event.target.files?.[0]?.name || "",
                                        )
                                      }
                                      className="w-full text-xs font-semibold file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:text-[10px] file:font-black file:text-indigo-700"
                                    />
                                    {accesorio.fotoNombre && (
                                      <p className="mt-1 truncate text-[10px] font-bold text-emerald-600">
                                        {accesorio.fotoNombre}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <select
                                      value={accesorio.estado}
                                      onChange={(event) =>
                                        actualizarAccesorioBiomedico(
                                          accesorio.id,
                                          "estado",
                                          event.target.value,
                                        )
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400"
                                    >
                                      <option value="Cumple">Cumple</option>
                                      <option value="No cumple">
                                        No cumple
                                      </option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        eliminarAccesorioBiomedico(accesorio.id)
                                      }
                                      className="rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-600 hover:bg-red-100"
                                    >
                                      Quitar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-3 md:hidden">
                          {accesoriosBiomedicos.map((accesorio, index) => (
                            <div
                              key={accesorio.id}
                              className="rounded-2xl border border-slate-100 bg-white p-3"
                            >
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-xs font-black text-slate-700">
                                  Accesorio {index + 1}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    eliminarAccesorioBiomedico(accesorio.id)
                                  }
                                  className="rounded-xl bg-red-50 px-3 py-1.5 text-[10px] font-black text-red-600"
                                >
                                  Quitar
                                </button>
                              </div>
                              <div className="grid gap-3">
                                <label className="block">
                                  <span className="text-xs font-black text-slate-500">
                                    Nombre
                                  </span>
                                  <input
                                    type="text"
                                    value={accesorio.nombre}
                                    onChange={(event) =>
                                      actualizarAccesorioBiomedico(
                                        accesorio.id,
                                        "nombre",
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-black text-slate-500">
                                    Cod barras / serial
                                  </span>
                                  <input
                                    type="text"
                                    value={accesorio.codigoSerial}
                                    onChange={(event) =>
                                      actualizarAccesorioBiomedico(
                                        accesorio.id,
                                        "codigoSerial",
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-black text-slate-500">
                                    Foto
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) =>
                                      actualizarAccesorioBiomedico(
                                        accesorio.id,
                                        "fotoNombre",
                                        event.target.files?.[0]?.name || "",
                                      )
                                    }
                                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-black text-slate-500">
                                    Estado
                                  </span>
                                  <select
                                    value={accesorio.estado}
                                    onChange={(event) =>
                                      actualizarAccesorioBiomedico(
                                        accesorio.id,
                                        "estado",
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                                  >
                                    <option value="Cumple">Cumple</option>
                                    <option value="No cumple">No cumple</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 bg-white px-5 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarModalConfiguracion}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => guardarConfiguracionModal()}
                  disabled={guardandoConfiguracion}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-500"
                >
                  {guardandoConfiguracion ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalCodigoExistente && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-600">
                Código ya existe
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-800">
                Este código ya está guardado
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                El código <strong>{modalCodigoExistente.codigo}</strong> ya
                tiene información asociada. Puedes reemplazarlo o generar un
                nuevo código disponible para este mismo producto.
              </p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  const codigo = modalCodigoExistente.codigo;
                  setModalCodigoExistente(null);
                  guardarConfiguracionModal({
                    forzarReemplazo: true,
                    codigoForzado: codigo,
                  });
                }}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500"
              >
                Reemplazar
              </button>
              <button
                type="button"
                onClick={() =>
                  generarCodigoNuevoSugerido(modalCodigoExistente.codigo)
                }
                className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-500"
              >
                Generar nuevo
              </button>
              <button
                type="button"
                onClick={() => setModalCodigoExistente(null)}
                className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalGenerarAdicionales && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-indigo-100 bg-indigo-50 px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
                Productos asociados
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-800">
                ¿Deseas generar más códigos?
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Ya se guardó el código principal{" "}
                <strong>{modalGenerarAdicionales.codigo}</strong>. Puedes crear
                códigos adicionales manteniendo la misma información del
                producto.
              </p>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="text-sm font-black text-slate-700">
                  Cantidad adicional
                </span>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={cantidadAdicionales}
                  onChange={(event) =>
                    setCantidadAdicionales(event.target.value)
                  }
                  placeholder="Ej: 5"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white"
                />
                <span className="mt-1 block text-xs font-semibold text-slate-400">
                  Ejemplo: si el principal es 10025 y escribes 5, se crean
                  10025-1 hasta 10025-5.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={sobrescribirAdicionales}
                  onChange={(event) =>
                    setSobrescribirAdicionales(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-indigo-600"
                />
                Sobrescribir códigos adicionales si ya existen.
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={confirmarGeneracionAdicionales}
                  disabled={guardandoConfiguracion}
                  className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {guardandoConfiguracion
                    ? "Guardando..."
                    : "Guardar y generar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalGenerarAdicionales(null);
                    cerrarModalConfiguracion();
                    mostrarMensaje(
                      "Configuración guardada correctamente.",
                      "ok",
                    );
                  }}
                  disabled={guardandoConfiguracion}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Solo guardar principal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalGuardarExcel && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                Guardar estructura de Autoevaluación
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-800">
                ¿Deseas guardar el Excel importado?
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Esta acción guarda las categorías y productos importados desde
                Excel. Este proceso se realiza normalmente una sola vez y
                reemplaza la estructura general existente. No guarda ni modifica
                los productos asociados ni códigos de barras.
              </p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={guardarDatos}
                disabled={guardando}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar estructura"}
              </button>
              <button
                type="button"
                onClick={() => setModalGuardarExcel(false)}
                disabled={guardando}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Revisar primero
              </button>
            </div>
          </div>
        </div>
      )}

      {modalHistorialUso && (
        <div className="fixed inset-0 z-[72] grid place-items-center bg-slate-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-rose-100 bg-rose-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-rose-600">
                  Historial de inventario
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-800">
                  Productos usados / sacados por categoría
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Trazabilidad de código, móvil destino, gestión, retiro, usuario y motivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalHistorialUso(false)}
                className="w-fit rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-600 hover:bg-rose-100"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(92vh-94px)] overflow-y-auto p-5">
              <div className="mb-4 grid gap-4 lg:grid-cols-[260px_1fr]">
                <aside className="rounded-3xl border border-slate-100 bg-slate-50 p-3">
                  <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Categorías
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {categoriasHistorialUsoDisponibles.map((categoria) => (
                      <button
                        key={categoria}
                        type="button"
                        onClick={() => cargarHistorialUsoInventario(categoria)}
                        disabled={cargandoHistorialUso}
                        className={`w-full rounded-2xl px-3 py-2.5 text-left text-xs font-black transition disabled:opacity-60 ${
                          categoriaHistorialUsoActiva === categoria
                            ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                            : "bg-white text-slate-600 hover:bg-rose-50"
                        }`}
                      >
                        {categoria}
                      </button>
                    ))}
                  </div>
                </aside>

                <section>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                    <input
                      type="search"
                      value={busquedaHistorialUso}
                      onChange={(event) => setBusquedaHistorialUso(event.target.value)}
                      placeholder="Buscar código de barras, lote, móvil, usuario o motivo dentro de la categoría..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rose-300 focus:bg-white"
                    />
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-600">
                      {historialUsoFiltrado.length} registro(s)
                    </div>
                  </div>

                  {categoriaHistorialUsoActiva && (
                    <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-black text-rose-700">
                      Historial de: {String(categoriaHistorialUsoActiva || "")}
                    </div>
                  )}
                </section>
              </div>

              {cargandoHistorialUso ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">
                  Cargando historial...
                </div>
              ) : historialUsoFiltrado.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">
                  No hay productos usados o retirados con ese criterio.
                </div>
              ) : (
                <div className="space-y-5">
                  {historialUsoPorCategoria.map(([categoria, registros]) => (
                    <section
                      key={categoria}
                      className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <h4 className="text-sm font-black uppercase tracking-wide text-slate-700">
                          {categoria}
                        </h4>
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700">
                          {registros.length} item(s)
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[1080px] text-left text-xs">
                          <thead className="bg-white text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-4 py-3">Producto</th>
                              <th className="px-4 py-3">Código / lote</th>
                              <th className="px-4 py-3">Estado</th>
                              <th className="px-4 py-3">Destino</th>
                              <th className="px-4 py-3">Gestión</th>
                              <th className="px-4 py-3">Retiro</th>
                              <th className="px-4 py-3">Motivo</th>
                              <th className="px-4 py-3 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {registros.map((registro) => (
                              <tr key={registro.id} className="align-top hover:bg-slate-50">
                                <td className="px-4 py-3 font-black text-slate-800">
                                  {registro.producto || "Sin producto"}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-mono font-black text-slate-700">
                                    {registro.codigoBarras}
                                  </p>
                                  {registro.codigoPrincipal && registro.codigoPrincipal !== registro.codigoBarras && (
                                    <p className="mt-1 font-mono text-[10px] font-bold text-slate-400">
                                      Principal: {registro.codigoPrincipal}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                                    {registro.estado || registro.accion}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-black text-slate-700">
                                    {registro.movilNombre || "Sin móvil"}
                                  </p>
                                  {registro.movilId && (
                                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                                      ID: {registro.movilId}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-bold text-slate-600">
                                    {registro.gestionadoPor || "Sin usuario"}
                                  </p>
                                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                                    {formatearFechaValor(registro.fechaGestion)}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-bold text-slate-600">
                                    {registro.retiradoPor || "Sin usuario"}
                                  </p>
                                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                                    {formatearFechaValor(registro.fechaRetiro || registro.fechaUso || registro.createdAt)}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="line-clamp-3 max-w-[260px] font-semibold text-slate-500">
                                    {registro.motivo || "Sin motivo registrado"}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => eliminarHistorialUsoDefinitivo(registro)}
                                    disabled={
                                      eliminandoHistorialUso ===
                                      (registro.historialGlobalId || registro.id)
                                    }
                                    className="rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {eliminandoHistorialUso ===
                                    (registro.historialGlobalId || registro.id)
                                      ? "..."
                                      : "Eliminar"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalSemaforizacion && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-amber-100 bg-amber-50 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-600">
                  Semaforización
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-800">
                  Alertas de Autoevaluación
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Configura y genera alertas en el nodo de alertas del cliente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalSemaforizacion(false)}
                className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-500 hover:bg-amber-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={semaforoVencimiento}
                  onChange={(e) => setSemaforoVencimiento(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-amber-500"
                />
                Generar alertas por fecha vencida o próxima a vencer.
              </label>
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <label className="text-sm font-black text-slate-700">
                  Días previos para alertar vencimiento
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={diasPreviosVencimiento}
                  onChange={(e) => setDiasPreviosVencimiento(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-amber-400 focus:bg-white"
                />
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={semaforoNoDiligenciado}
                  onChange={(e) => setSemaforoNoDiligenciado(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-amber-500"
                />
                Generar alertas por filas/productos de una categoría sin
                diligenciar.
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={semaforoSinCodigo}
                  onChange={(e) => setSemaforoSinCodigo(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-amber-500"
                />
                Generar alertas por código de barras faltante.
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={guardarSemaforizacion}
                  disabled={guardandoSemaforizacion}
                  className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-400 disabled:opacity-60"
                >
                  {guardandoSemaforizacion ? "Guardando..." : "Guardar alertas"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalSemaforizacion(false)}
                  disabled={guardandoSemaforizacion}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemAsociados && (
        <div className="fixed inset-0 z-[68] grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Códigos asociados
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {itemAsociados.producto}
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  {itemAsociados.categoria}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemAsociados(null)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-5">
              {cargandoAsociados ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-black text-slate-500">
                  Cargando códigos asociados...
                </div>
              ) : registrosAsociados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-black text-slate-500">
                  Este producto aún no tiene códigos asociados.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Principal</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registrosAsociados.map((registro) => (
                        <tr key={registro.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-black text-slate-800">
                            {registro.codigoBarras || registro.id}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {registro.codigoPrincipal || registro.codigoBarras}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-black ${registro.creadoComo === "generado" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}`}
                              >
                                {registro.creadoComo === "generado"
                                  ? "Generado"
                                  : "Original"}
                              </span>
                              {registro.asignado && (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                                  Asignado
                                  {registro.asignadoMovilNombre
                                    ? `: ${registro.asignadoMovilNombre}`
                                    : ""}
                                </span>
                              )}
                              {registro.gestionado && (
                                <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700">
                                  Gestionado
                                </span>
                              )}
                              {registro.usado && (
                                <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700">
                                  Usado
                                </span>
                              )}
                              {!registro.asignado &&
                                !registro.gestionado &&
                                !registro.usado && (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                                    Libre
                                  </span>
                                )}
                            </div>
                            {registro.motivoUso && (
                              <p className="mt-1 line-clamp-2 text-[10px] font-bold text-slate-400">
                                Motivo uso: {registro.motivoUso}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => abrirRegistroAsociado(registro)}
                                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500"
                              >
                                Ver
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  sacarRegistroDelInventario(registro)
                                }
                                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-500"
                              >
                                Sacar inventario
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  eliminarRegistroAsociado(registro)
                                }
                                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {itemImpresion && (
        <div className="fixed inset-0 z-[69] grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">
                  Imprimir code bar
                </p>
                <h3 className="mt-1 truncate text-lg font-black text-slate-800">
                  {itemImpresion.producto}
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  {registrosImpresion.length} código(s) disponibles · Vista
                  previa en tamaño carta
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemImpresion(null)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="grid max-h-[82vh] gap-5 overflow-auto p-5 lg:grid-cols-[320px_1fr]">
              <aside className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-black text-slate-800">
                    Tamaño etiqueta
                  </p>
                  <div className="mt-3 space-y-2 text-sm font-bold text-slate-600">
                    <label className="flex items-center gap-3 rounded-2xl bg-white p-3">
                      <input
                        type="radio"
                        name="tamanoEtiqueta"
                        checked={tamanoEtiqueta === "5x3"}
                        onChange={() => setTamanoEtiqueta("5x3")}
                        className="accent-indigo-600"
                      />
                      Predeterminado 5 × 3 cm
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl bg-white p-3">
                      <input
                        type="radio"
                        name="tamanoEtiqueta"
                        checked={tamanoEtiqueta === "3x1_5"}
                        onChange={() => setTamanoEtiqueta("3x1_5")}
                        className="accent-indigo-600"
                      />
                      Compacto 3 × 1.5 cm
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl bg-white p-3">
                      <input
                        type="radio"
                        name="tamanoEtiqueta"
                        checked={tamanoEtiqueta === "personalizado"}
                        onChange={() => setTamanoEtiqueta("personalizado")}
                        className="accent-indigo-600"
                      />
                      Personalizado
                    </label>
                  </div>
                </div>

                {tamanoEtiqueta === "personalizado" && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-black text-slate-500">
                        Ancho cm
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        step="0.1"
                        value={anchoEtiquetaPersonalizado}
                        onChange={(event) =>
                          setAnchoEtiquetaPersonalizado(event.target.value)
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-black text-slate-500">
                        Alto cm
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={altoEtiquetaPersonalizado}
                        onChange={(event) =>
                          setAltoEtiquetaPersonalizado(event.target.value)
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400"
                      />
                    </label>
                  </div>
                )}

                <div className="rounded-2xl bg-white p-3 text-xs font-bold text-slate-500">
                  <p>
                    Etiqueta: {dimensionesEtiquetaCm.ancho} ×{" "}
                    {dimensionesEtiquetaCm.alto} cm
                  </p>
                  <p className="mt-1">
                    Aprox. {etiquetasPorPagina} etiqueta(s) por hoja carta.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={descargarPdfCodigos}
                  disabled={
                    generandoPdf ||
                    cargandoImpresion ||
                    registrosImpresion.length === 0
                  }
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {generandoPdf ? "Generando PDF..." : "Descargar PDF"}
                </button>
              </aside>

              <section className="rounded-3xl border border-slate-100 bg-slate-100 p-4">
                {cargandoImpresion ? (
                  <div className="grid min-h-[520px] place-items-center text-sm font-black text-slate-500">
                    Cargando códigos...
                  </div>
                ) : registrosImpresion.length === 0 ? (
                  <div className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-sm font-black text-slate-500">
                    No hay códigos asociados para imprimir.
                  </div>
                ) : (
                  <div className="mx-auto min-h-[720px] w-full max-w-[612px] rounded-2xl bg-white p-[28px] shadow-inner">
                    <div
                      className="grid content-start gap-2"
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(80, dimensionesEtiquetaCm.ancho * 37.8)}px, 1fr))`,
                      }}
                    >
                      {registrosImpresion
                        .slice(
                          0,
                          Math.min(
                            registrosImpresion.length,
                            etiquetasPorPagina,
                          ),
                        )
                        .map((registro) => {
                          const codigo = String(
                            registro.codigoBarras || registro.id,
                          );
                          return (
                            <div
                              key={registro.id}
                              className="flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-1 text-center"
                              style={{
                                width: `${dimensionesEtiquetaCm.ancho}cm`,
                                height: `${dimensionesEtiquetaCm.alto}cm`,
                                maxWidth: "100%",
                              }}
                            >
                              <p className="truncate text-[8px] font-black leading-tight text-slate-700">
                                {itemImpresion.producto}
                              </p>
                              <div className="flex flex-1 items-center justify-center">
                                <div className="h-[42%] w-[88%] rounded bg-slate-900" />
                              </div>
                              <p className="truncate text-[8px] font-bold text-slate-700">
                                {codigo}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                    {registrosImpresion.length > etiquetasPorPagina && (
                      <p className="mt-4 text-center text-xs font-bold text-slate-400">
                        Vista previa de la primera hoja. El PDF incluirá todos
                        los códigos.
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {modalScanner && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">
                  Escáner de código
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-800">
                  Escanear o digitar código
                </h3>
              </div>
              <button
                type="button"
                onClick={cerrarScanner}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <div className="overflow-hidden rounded-2xl bg-slate-900">
                <video
                  ref={videoScannerRef}
                  className="h-64 w-full object-cover"
                  muted
                  playsInline
                />
              </div>
              {scannerError && (
                <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700">
                  {scannerError}
                </div>
              )}
              <label className="mt-4 block">
                <span className="text-xs font-black text-slate-500">
                  Código manual
                </span>
                <input
                  type="text"
                  value={scannerManual}
                  onChange={(event) => setScannerManual(event.target.value)}
                  placeholder="Ej: 10025"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-emerald-500"
                />
              </label>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarScanner}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={aplicarCodigoManual}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"
                >
                  Usar código
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(guardando || leyendoExcel || guardandoConfiguracion) && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
            <p className="text-sm font-black text-slate-800">
              {guardandoConfiguracion
                ? "Guardando configuración..."
                : guardando
                  ? "Guardando datos..."
                  : "Leyendo Excel..."}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Por favor espera un momento.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
