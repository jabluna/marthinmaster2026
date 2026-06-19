"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { initializeApp, deleteApp, getApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

type ClienteSesion = {
  uid?: string;
  email?: string;
  clienteId?: string;
  nit?: string;
  razonSocial?: string;
};

type TipoFuncionario = {
  id: string;
  nombre: string;
  documentos: DocumentoTipo[];
  origen?: string;
  editable?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type Rol = {
  id: string;
  nombre: string;
};

type DocumentoTipo = {
  id: string;
  nombre: string;
};

type DocumentoUsuario = DocumentoTipo & {
  estado?: "NO_CARGADO" | "CARGADO" | "APROBADO" | "NO_CUMPLE";
  archivoUrl?: string;
  archivoPath?: string;
  archivoNombre?: string;
  archivoTipo?: string;
  fechaVencimiento?: string;
  motivoNoCumple?: string;
  porcentajeCarga?: number;
};

type UsuarioCliente = {
  id: string;
  uidAuth?: string;
  nombres: string;
  apellidos: string;
  email: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  tipoFuncionario: string;
  tipoFuncionarioId: string;
  rol: string;
  rolId: string;
  rh: string;
  estado: string;
  fotoUrl?: string;
  fotoPath?: string;
  passwordAcceso?: string;
  documentosRequeridos?: DocumentoUsuario[];
};

const DOCUMENTOS_COMUNES = [
  "Oferta Laboral",
  "Hoja de Vida",
  "Documento de Identificación",
  "Certificado de antecedentes Procuraduría",
  "Certificado de antecedentes Policía Nacional",
  "Certificado medidas correctivas",
  "RUT",
  "Certificado de afiliación EPS",
  "Certificado de afiliación Fondo de Pensiones",
  "Certificado de afiliación ARL",
  "Certificado de aptitud laboral vigente",
  "Carné de vacunas",
  "Carné de vacunación Covid-19",
  "Experiencia laboral",
];

const MAX_DOCUMENTO_MB = 4;
const MAX_DOCUMENTO_BYTES = MAX_DOCUMENTO_MB * 1024 * 1024;

const EMAILJS_SERVICE_ID = "service_ybahyy2";
const EMAILJS_TEMPLATE_ID = "template_7kv6rwb";
const EMAILJS_PUBLIC_KEY = "ZnTClNQDNH6BiD1K1";

const DOCUMENTOS_ESPECIFICOS = [
  "Diploma de Bachiller Académico",
  "Diploma de Técnico o Profesional",
  "Acta de Grado",
  "Tarjeta Profesional",
  "Rethus",
  "Resolución de inscripción para ejercer en Cundinamarca",
  "Soporte Vital Básico",
  "Soporte Vital Avanzado",
  "Código Gris - Atención a víctimas de violencia sexual",
  "Curso de Humanización",
  "Formación operador de vehículo de emergencia",
  "Inscripción o acreditación por la ONAC",
  "Acta de Inicio",
  "Examen Médico Ocupacional",
  "Póliza",
  "Contrato Firmado",
];

const crearIdDocumento = (nombre: string) =>
  nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");




const TIPOS_FUNCIONARIO_PREDETERMINADOS: Array<{
  nombre: string;
  documentos: string[];
}> = [
  {
    nombre: "Auxiliar de Enfermería",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "Experiencia laboral",
      "Diploma Bachiller Académico",
      "Diploma Técnico Auxiliar de Enfermería",
      "Rethus (Ministerio de la Salud)",
      "Resolución de inscripción para ejercer en Cundinamarca",
      "Acta de grado auxiliar de enfermería",
      "Aplicación de víctimas de agentes químicos",
      "Código gris Atención a víctimas de violencia sexual",
      "Soporte vital básico",
      "Soporte vital avanzado",
      "Curso de humanización",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
  {
    nombre: "Médico",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "Experiencia laboral",
      "Diploma de bachiller académico",
      "Diploma como profesional",
      "Tarjeta profesional",
      "Resolución de inscripción para ejercer en Cundinamarca",
      "Acta de grado",
      "Rethus (Ministerio de la Salud)",
      "Soporte vital avanzado",
      "Aplicación de víctimas de agentes químicos",
      "Código gris Atención a víctimas de violencia sexual",
      "Curso de humanización",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
  {
    nombre: "Conductor Ambulancia",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "Experiencia laboral",
      "RUNT",
      "Licencia de conducción",
      "Soporte vital básico",
      "Certificado de primeros auxilios o primer respondiente",
      "Formación operador vehículo de emergencia",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
  {
    nombre: "Regente de Farmacia",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "Experiencia laboral",
      "Diploma de bachiller académico",
      "Diploma como técnico",
      "Rethus",
      "Acta de grado",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
  {
    nombre: "Ingeniero Biomédico",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "Diploma de bachiller académico",
      "Diploma como profesional",
      "Acta de grado",
      "Tarjeta profesional",
      "Inscripción o acreditación por la ONAC",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
  {
    nombre: "Líder Rodamiento",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "RUNT",
      "Licencia de conducción",
      "Formación operador vehículo de emergencia",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
  {
    nombre: "Director Operativo",
    documentos: ["Acta de inicio", "Examen médico ocupacional", "Póliza", "Contrato firmado"],
  },
  {
    nombre: "Líder Seguridad y Salud en el Trabajo",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "Diploma de bachiller académico",
      "Diploma como profesional seguridad y salud en el trabajo",
      "Tarjeta profesional",
      "Acta de grado",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
  {
    nombre: "Líder Talento Humano",
    documentos: [
      "Oferta Laboral",
      "Hoja de vida",
      "Documento de Identificación",
      "Certificado de antecedentes Procuraduría",
      "Certificado de antecedentes",
      "Certificado de antecedentes Policía Nacional",
      "Certificado medidas correctivas",
      "RUT",
      "Certificado de afiliación EPS",
      "Certificado de afiliación fondo de pensiones",
      "Certificado de afiliación ARL",
      "Certificado de aptitud laboral vigente (examen médico de ingreso menor a 3 años)",
      "Carné de vacunas: hepatitis y titulaciones, toxoide tetánico, difteria, sarampión y rubeola",
      "Carné de vacunación Covid 19",
      "Diploma de bachiller académico",
      "Acta de grado",
      "Técnico Laboral en Auxiliar en Recursos Humanos",
      "Acta de inicio",
      "Examen médico ocupacional",
      "Póliza",
      "Contrato firmado",
    ],
  },
];

const documentosDesdePlantilla = (documentos: string[]): DocumentoTipo[] =>
  documentos
    .filter((nombre) => nombre.trim())
    .map((nombre) => ({ id: crearIdDocumento(nombre), nombre }));

const calcularResumenDocumentos = (documentos: DocumentoUsuario[] = []) => {
  const total = documentos.length;
  const aprobados = documentos.filter((docu) => docu.estado === "APROBADO").length;
  const cargados = documentos.filter((docu) => Boolean(docu.archivoUrl)).length;
  const porcentaje = total > 0 ? Math.round((aprobados / total) * 100) : 0;

  return { total, aprobados, cargados, porcentaje };
};


const DIAS_ALERTA_VENCIMIENTO = 7;

const parseFechaLocal = (fecha?: string) => {
  if (!fecha) return null;
  const partes = fecha.split("-").map(Number);
  if (partes.length !== 3 || partes.some((item) => Number.isNaN(item))) return null;
  return new Date(partes[0], partes[1] - 1, partes[2]);
};

const revisarVencimientoDocumento = (fechaVencimiento?: string) => {
  if (!fechaVencimiento) {
    return {
      tipo: "SIN_FECHA" as const,
      diasRestantes: null,
      mensaje: "Sin fecha de vencimiento diligenciada.",
    };
  }

  const fecha = parseFechaLocal(fechaVencimiento);
  if (!fecha) {
    return {
      tipo: "SIN_FECHA" as const,
      diasRestantes: null,
      mensaje: "Fecha de vencimiento no válida.",
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);

  const diasRestantes = Math.ceil(
    (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diasRestantes < 0) {
    return {
      tipo: "VENCIDO" as const,
      diasRestantes,
      mensaje: `Documento vencido hace ${Math.abs(diasRestantes)} día(s).`,
    };
  }

  if (diasRestantes <= DIAS_ALERTA_VENCIMIENTO) {
    return {
      tipo: "POR_VENCER" as const,
      diasRestantes,
      mensaje:
        diasRestantes === 0
          ? "Documento vence hoy."
          : `Documento por vencer en ${diasRestantes} día(s).`,
    };
  }

  return null;
};

const construirDetalleVencimientos = (documentos: DocumentoUsuario[]) =>
  documentos
    .map((docu) => {
      const alerta = revisarVencimientoDocumento(docu.fechaVencimiento);
      if (!alerta) return null;

      return {
        id: docu.id,
        nombre: docu.nombre,
        estado: docu.estado || "NO_CARGADO",
        fechaVencimiento: docu.fechaVencimiento || "",
        tipoAlerta: alerta.tipo,
        diasRestantes: alerta.diasRestantes,
        mensaje: alerta.mensaje,
        archivoUrl: docu.archivoUrl || "",
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      nombre: string;
      estado: string;
      fechaVencimiento: string;
      tipoAlerta: "SIN_FECHA" | "VENCIDO" | "POR_VENCER";
      diasRestantes: number | null;
      mensaje: string;
      archivoUrl: string;
    }>;

declare global {
  interface Window {
    emailjs?: {
      init: (publicKey: string) => void;
      send: (
        serviceId: string,
        templateId: string,
        params: Record<string, string>,
        publicKey?: string,
      ) => Promise<unknown>;
    };
  }
}

const etiquetaEstadoDocumento = (estado?: DocumentoUsuario["estado"]) => {
  if (estado === "APROBADO") return "Aprobado";
  if (estado === "NO_CUMPLE") return "No cumple";
  if (estado === "CARGADO") return "Cargado / pendiente de revisión";
  return "No se ha cargado documento";
};

const crearAuthSecundario = () => {
  const principalApp = getApp();
  const secondaryName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(principalApp.options, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);
  return { secondaryApp, secondaryAuth };
};

export default function UsuariosClientePage() {
  const router = useRouter();
  const pathname = usePathname();
  const fotoInputRef = useRef<HTMLInputElement | null>(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error">("ok");

  const [clienteSesion, setClienteSesion] = useState<ClienteSesion | null>(
    null,
  );
  const [logoUrl, setLogoUrl] = useState("/logo.png");
  const [nombreHeader, setNombreHeader] = useState("Usuario");
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [menuColapsado, setMenuColapsado] = useState(false);
  const [configuracionesAbierto, setConfiguracionesAbierto] = useState(false);

  const [tiposFuncionario, setTiposFuncionario] = useState<TipoFuncionario[]>(
    [],
  );
  const [roles, setRoles] = useState<Rol[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCliente[]>([]);

  const [modalListas, setModalListas] = useState(false);
  const [modalTipoDocs, setModalTipoDocs] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalPreestablecidos, setModalPreestablecidos] = useState(false);
  const [modalDocumentosUsuario, setModalDocumentosUsuario] = useState(false);
  const [modalCarnet, setModalCarnet] = useState(false);

  const [usuarioDocsActivo, setUsuarioDocsActivo] =
    useState<UsuarioCliente | null>(null);
  const [usuarioCarnet, setUsuarioCarnet] = useState<UsuarioCliente | null>(null);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioCliente | null>(null);
  const [documentosUsuario, setDocumentosUsuario] = useState<
    DocumentoUsuario[]
  >([]);
  const [subiendoDocId, setSubiendoDocId] = useState<string | null>(null);
  const [progresoDocumentos, setProgresoDocumentos] = useState<
    Record<string, number>
  >({});

  const [nuevoTipo, setNuevoTipo] = useState("");
  const [nuevoRol, setNuevoRol] = useState("");
  const [tipoEditando, setTipoEditando] = useState<TipoFuncionario | null>(
    null,
  );
  const [documentosTipo, setDocumentosTipo] = useState<DocumentoTipo[]>([]);
  const [documentoManual, setDocumentoManual] = useState("");
  const [seleccionDocs, setSeleccionDocs] = useState<string[]>([]);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [passwordsVisibles, setPasswordsVisibles] = useState<Record<string, boolean>>({});
  const [alertaOrigenProcesada, setAlertaOrigenProcesada] = useState(false);

  const [formUsuario, setFormUsuario] = useState({
    nombres: "",
    apellidos: "",
    email: "",
    foto: null as File | null,
    tipoIdentificacion: "Cédula",
    numeroIdentificacion: "",
    tipoFuncionarioId: "",
    rolId: "",
    rh: "O+",
    password: "",
    estado: "ACTIVO",
  });

  const nit = useMemo(
    () => clienteSesion?.nit || clienteSesion?.clienteId || "",
    [clienteSesion],
  );
  const clienteBasePath = useMemo(() => (nit ? `clientes/${nit}` : ""), [nit]);

  const mostrarMensaje = (texto: string, tipo: "ok" | "error" = "ok") => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    setTimeout(() => setMensaje(""), 4500);
  };

  const alternarPasswordTabla = (usuarioId: string) => {
    setPasswordsVisibles((actual) => ({
      ...actual,
      [usuarioId]: !actual[usuarioId],
    }));
  };

  const claveTabla = (usuario: UsuarioCliente) => {
    if (!usuario.passwordAcceso) return "Sin clave";
    return passwordsVisibles[usuario.id] ? usuario.passwordAcceso : "•".repeat(Math.max(usuario.passwordAcceso.length, 6));
  };


  const limpiarFormularioUsuario = () => {
    setUsuarioEditando(null);
    setFormUsuario({
      nombres: "",
      apellidos: "",
      email: "",
      foto: null,
      tipoIdentificacion: "Cédula",
      numeroIdentificacion: "",
      tipoFuncionarioId: "",
      rolId: "",
      rh: "O+",
      password: "",
      estado: "ACTIVO",
    });
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  };

  const abrirCrearUsuario = () => {
    limpiarFormularioUsuario();
    setModalUsuario(true);
  };

  const abrirEditarUsuario = (usuario: UsuarioCliente) => {
    setUsuarioEditando(usuario);
    setFormUsuario({
      nombres: usuario.nombres || "",
      apellidos: usuario.apellidos || "",
      email: usuario.email || "",
      foto: null,
      tipoIdentificacion: usuario.tipoIdentificacion || "Cédula",
      numeroIdentificacion: usuario.numeroIdentificacion || "",
      tipoFuncionarioId: usuario.tipoFuncionarioId || "",
      rolId: usuario.rolId || "",
      rh: usuario.rh || "O+",
      password: "",
      estado: usuario.estado || "ACTIVO",
    });
    if (fotoInputRef.current) fotoInputRef.current.value = "";
    setModalUsuario(true);
  };

  const abrirCarnetUsuario = (usuario: UsuarioCliente) => {
    setUsuarioCarnet(usuario);
    setModalCarnet(true);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login_users");
        return;
      }

      const local =
        typeof window !== "undefined"
          ? window.localStorage.getItem("clienteSesion")
          : null;
      const sesion: ClienteSesion | null = local ? JSON.parse(local) : null;
      const nitSesion = sesion?.nit || sesion?.clienteId;

      if (!nitSesion) {
        router.replace("/login_users");
        return;
      }

      setClienteSesion(sesion);

      const clienteSnap = await getDoc(doc(db, "clientes", nitSesion));
      if (clienteSnap.exists()) {
        const data = clienteSnap.data() as Record<string, any>;
        setLogoUrl(data.logoUrl || "/logo.png");
        setNombreHeader(
          data.representante ||
            data.Representante ||
            data.razonSocial ||
            sesion?.razonSocial ||
            "Usuario",
        );
      } else {
        setNombreHeader(sesion?.razonSocial || user.email || "Usuario");
      }

      setCargando(false);
    });

    return () => unsub();
  }, [router]);


  useEffect(() => {
    if (!clienteBasePath) return;
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteBasePath]);

  const cargarTodo = async () => {
    await Promise.all([
      cargarTiposFuncionario(),
      cargarRoles(),
      cargarUsuarios(),
    ]);
  };

  const sembrarTiposFuncionarioPredeterminados = async () => {
    if (!clienteBasePath) return false;

    const tiposRef = collection(db, clienteBasePath, "tiposFuncionario");
    let huboCambios = false;

    await Promise.all(
      TIPOS_FUNCIONARIO_PREDETERMINADOS.map(async (tipo) => {
        const tipoId = crearIdDocumento(tipo.nombre);
        const tipoDocRef = doc(tiposRef, tipoId);
        const existe = await getDoc(tipoDocRef);
        const documentosBase = documentosDesdePlantilla(tipo.documentos);

        if (!existe.exists()) {
          huboCambios = true;
          await setDoc(tipoDocRef, {
            nombre: tipo.nombre,
            documentos: documentosBase,
            origen: "predeterminado_normativo",
            editable: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        }

        const dataExistente = existe.data() as Partial<TipoFuncionario>;
        const documentosActuales = Array.isArray(dataExistente.documentos)
          ? dataExistente.documentos
          : [];

        const documentosUnificados = [...documentosActuales];

        documentosBase.forEach((docBase) => {
          const yaExiste = documentosUnificados.some(
            (docActual) => docActual.id === docBase.id,
          );

          if (!yaExiste) {
            documentosUnificados.push(docBase);
            huboCambios = true;
          }
        });

        if (huboCambios) {
          await setDoc(
            tipoDocRef,
            {
              nombre: dataExistente.nombre || tipo.nombre,
              documentos: documentosUnificados,
              origen: dataExistente.origen || "predeterminado_normativo",
              editable: true,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      }),
    );

    return huboCambios;
  };

  const cargarTiposFuncionario = async () => {
    if (!clienteBasePath) return;

    const tiposRef = collection(db, clienteBasePath, "tiposFuncionario");
    let q = query(tiposRef, orderBy("nombre", "asc"));
    let snap = await getDocs(q);

    if (snap.empty) {
      await sembrarTiposFuncionarioPredeterminados();
      q = query(tiposRef, orderBy("nombre", "asc"));
      snap = await getDocs(q);
    }

    setTiposFuncionario(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TipoFuncionario, "id">),
      })),
    );
  };

  const cargarRoles = async () => {
    if (!clienteBasePath) return;
    const q = query(
      collection(db, clienteBasePath, "roles"),
      orderBy("nombre", "asc"),
    );
    const snap = await getDocs(q);
    setRoles(
      snap.docs.map((d) => ({
        id: d.id,
        nombre: String(d.data().nombre || ""),
      })),
    );
  };

  const cargarUsuarios = async () => {
    if (!clienteBasePath) return;
    const q = query(
      collection(db, clienteBasePath, "usuarios"),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    setUsuarios(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UsuarioCliente, "id">),
      })),
    );
  };

  const abrirNuevoTipo = () => {
    const nombre = nuevoTipo.trim();
    if (!nombre) {
      mostrarMensaje("Escribe el nombre del tipo de funcionario.", "error");
      return;
    }

    setTipoEditando({ id: "", nombre, documentos: [] });
    setDocumentosTipo([]);
    setSeleccionDocs([]);
    setModalTipoDocs(true);
  };

  const abrirEditarTipo = (tipo: TipoFuncionario) => {
    setTipoEditando(tipo);
    setDocumentosTipo(tipo.documentos || []);
    setSeleccionDocs((tipo.documentos || []).map((docu) => docu.nombre));
    setModalTipoDocs(true);
  };

  const agregarDocumentoManual = () => {
    const nombre = documentoManual.trim();
    if (!nombre) return;
    const id = crearIdDocumento(nombre);
    if (documentosTipo.some((d) => d.id === id)) {
      mostrarMensaje("Ese documento ya está agregado.", "error");
      return;
    }
    setDocumentosTipo((actual) => [...actual, { id, nombre }]);
    setDocumentoManual("");
  };

  const agregarDocumentosPreestablecidos = () => {
    const nuevos = seleccionDocs.map((nombre) => ({
      id: crearIdDocumento(nombre),
      nombre,
    }));
    const unidos = [...documentosTipo];
    nuevos.forEach((docu) => {
      if (!unidos.some((d) => d.id === docu.id)) unidos.push(docu);
    });
    setDocumentosTipo(unidos);
    setModalPreestablecidos(false);
  };

  const guardarTipoFuncionario = async () => {
    if (!clienteBasePath || !tipoEditando) return;

    if (!tipoEditando.nombre.trim()) {
      mostrarMensaje("El tipo de funcionario debe tener nombre.", "error");
      return;
    }

    if (documentosTipo.length === 0) {
      mostrarMensaje("Agrega al menos un documento requerido.", "error");
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        nombre: tipoEditando.nombre.trim(),
        documentos: documentosTipo,
        updatedAt: serverTimestamp(),
      };

      if (tipoEditando.id) {
        await updateDoc(
          doc(db, clienteBasePath, "tiposFuncionario", tipoEditando.id),
          payload,
        );
      } else {
        await addDoc(collection(db, clienteBasePath, "tiposFuncionario"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setNuevoTipo("");
      setTipoEditando(null);
      setDocumentosTipo([]);
      setModalTipoDocs(false);
      await cargarTiposFuncionario();
      mostrarMensaje("Tipo de funcionario guardado correctamente.");
    } catch (error) {
      console.error(error);
      mostrarMensaje("No se pudo guardar el tipo de funcionario.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const cargarTiposBaseManual = async () => {
    if (!clienteBasePath) return;
    setGuardando(true);
    try {
      const huboCambios = await sembrarTiposFuncionarioPredeterminados();
      await cargarTiposFuncionario();
      mostrarMensaje(
        huboCambios
          ? "Tipos base actualizados. Se restauraron documentos predeterminados faltantes sin borrar documentos personalizados ni roles nuevos."
          : "Los tipos base ya están completos. Tus documentos personalizados y roles nuevos se conservan.",
      );
    } catch (error) {
      console.error(error);
      mostrarMensaje("No se pudieron cargar los tipos base.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const guardarRol = async () => {
    if (!clienteBasePath) return;
    const nombre = nuevoRol.trim();
    if (!nombre) {
      mostrarMensaje("Escribe el nombre del rol.", "error");
      return;
    }

    setGuardando(true);
    try {
      await addDoc(collection(db, clienteBasePath, "roles"), {
        nombre,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNuevoRol("");
      await cargarRoles();
      mostrarMensaje("Rol guardado correctamente.");
    } catch (error) {
      console.error(error);
      mostrarMensaje("No se pudo guardar el rol.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const guardarUsuario = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clienteBasePath || !nit) return;

    const tipoFuncionario = tiposFuncionario.find(
      (tipo) => tipo.id === formUsuario.tipoFuncionarioId,
    );
    const rol = roles.find((item) => item.id === formUsuario.rolId);

    if (!tipoFuncionario || !rol) {
      mostrarMensaje("Selecciona tipo de funcionario y rol.", "error");
      return;
    }

    if (formUsuario.foto && formUsuario.foto.size > 350 * 1024) {
      mostrarMensaje("La foto supera el límite de 350 KB.", "error");
      return;
    }

    if (!usuarioEditando && formUsuario.password.length < 6) {
      mostrarMensaje("La contraseña debe tener mínimo 6 caracteres.", "error");
      return;
    }

    setGuardando(true);

    let secondaryApp: ReturnType<typeof initializeApp> | null = null;

    try {
      let uidDestino = usuarioEditando?.id || "";
      let fotoUrl = usuarioEditando?.fotoUrl || "";
      let fotoPath = usuarioEditando?.fotoPath || "";

      if (!usuarioEditando) {
        const secundario = crearAuthSecundario();
        secondaryApp = secundario.secondaryApp;

        const cred = await createUserWithEmailAndPassword(
          secundario.secondaryAuth,
          formUsuario.email.trim().toLowerCase(),
          formUsuario.password,
        );

        await signOut(secundario.secondaryAuth);
        uidDestino = cred.user.uid;
      }

      if (formUsuario.foto) {
        fotoPath = `clientes/${nit}/usuarios/${uidDestino}/foto_${Date.now()}_${formUsuario.foto.name}`;
        const storageRef = ref(storage, fotoPath);
        await uploadBytes(storageRef, formUsuario.foto);
        fotoUrl = await getDownloadURL(storageRef);
      }

      const cambioTipoFuncionario =
        usuarioEditando &&
        usuarioEditando.tipoFuncionarioId !== formUsuario.tipoFuncionarioId;

      const documentosRequeridos =
        usuarioEditando && !cambioTipoFuncionario
          ? usuarioEditando.documentosRequeridos || []
          : (tipoFuncionario.documentos || []).map((docu) => ({
              ...docu,
              estado: "NO_CARGADO",
              aprobado: false,
              archivoUrl: "",
              archivoPath: "",
              fechaVencimiento: "",
            }));

      const payload = {
        uidAuth: uidDestino,
        nombres: formUsuario.nombres.trim(),
        apellidos: formUsuario.apellidos.trim(),
        email: formUsuario.email.trim().toLowerCase(),
        tipoIdentificacion: formUsuario.tipoIdentificacion,
        numeroIdentificacion: formUsuario.numeroIdentificacion.trim(),
        tipoFuncionario: tipoFuncionario.nombre,
        tipoFuncionarioId: tipoFuncionario.id,
        rol: rol.nombre,
        rolId: rol.id,
        rh: formUsuario.rh,
        estado: formUsuario.estado,
        accesoBloqueado: formUsuario.estado !== "ACTIVO",
        bloqueadoMotivo:
          formUsuario.estado !== "ACTIVO"
            ? "Usuario inactivo o suspendido desde gestión de usuarios."
            : "",
        fotoUrl,
        fotoPath,
        passwordAcceso: usuarioEditando
          ? usuarioEditando.passwordAcceso || ""
          : formUsuario.password,
        documentosRequeridos,
        clienteNit: nit,
        updatedAt: serverTimestamp(),
        ...(usuarioEditando ? {} : { createdAt: serverTimestamp() }),
      };

      await setDoc(
        doc(db, clienteBasePath, "usuarios", uidDestino),
        payload,
        { merge: true },
      );

      const documentosParaAlerta = documentosRequeridos as DocumentoUsuario[];
      const resumenInicial = calcularResumenDocumentos(documentosParaAlerta);
      const pendientesIniciales = documentosParaAlerta
        .filter((docu) => docu.estado !== "APROBADO")
        .map((docu) => ({
          id: docu.id,
          nombre: docu.nombre,
          estado: docu.estado || "NO_CARGADO",
          motivoNoCumple: docu.motivoNoCumple || "",
          fechaVencimiento: docu.fechaVencimiento || "",
          archivoUrl: docu.archivoUrl || "",
        }));

      const noCumplenIniciales = documentosParaAlerta
        .filter((docu) => docu.estado === "NO_CUMPLE")
        .map((docu) => ({
          id: docu.id,
          nombre: docu.nombre,
          motivo: docu.motivoNoCumple || "Sin motivo registrado",
          fechaVencimiento: docu.fechaVencimiento || "",
          archivoUrl: docu.archivoUrl || "",
        }));

      const vencimientosIniciales = construirDetalleVencimientos(documentosParaAlerta);
      const sinFechaIniciales = vencimientosIniciales.filter(
        (docu) => docu.tipoAlerta === "SIN_FECHA",
      );
      const vencidosIniciales = vencimientosIniciales.filter(
        (docu) => docu.tipoAlerta === "VENCIDO",
      );
      const porVencerIniciales = vencimientosIniciales.filter(
        (docu) => docu.tipoAlerta === "POR_VENCER",
      );

      const alertaUsuarioRef = doc(
        db,
        clienteBasePath,
        "alertas",
        `documentos_${uidDestino}`,
      );

      const debeTenerAlertaDocumental =
        resumenInicial.total > 0 &&
        (resumenInicial.porcentaje < 100 ||
          noCumplenIniciales.length > 0 ||
          vencimientosIniciales.length > 0);

      if (debeTenerAlertaDocumental) {
        const alertaExistente = await getDoc(alertaUsuarioRef);

        await setDoc(
          alertaUsuarioRef,
          {
            categoria: "alertas documentos",
            tipo: "DOCUMENTOS_USUARIO",
            activo: true,
            usuarioId: uidDestino,
            usuarioNombre: `${formUsuario.nombres.trim()} ${formUsuario.apellidos.trim()}`.trim(),
            usuarioEmail: formUsuario.email.trim().toLowerCase(),
            tipoFuncionario: tipoFuncionario.nombre,
            totalDocumentos: resumenInicial.total,
            documentosAprobados: resumenInicial.aprobados,
            documentosCargados: resumenInicial.cargados,
            documentosPendientes: pendientesIniciales.length,
            documentosNoCumplen: noCumplenIniciales.length,
            documentosSinFechaVencimiento: sinFechaIniciales.length,
            documentosVencidos: vencidosIniciales.length,
            documentosPorVencer: porVencerIniciales.length,
            porcentajeAprobado: resumenInicial.porcentaje,
            pendientesDetalle: pendientesIniciales,
            motivosNoCumple: noCumplenIniciales,
            vencimientosDetalle: vencimientosIniciales,
            mensaje:
              noCumplenIniciales.length > 0
                ? `Documentación con no cumple: ${noCumplenIniciales.length}. Aprobados ${resumenInicial.aprobados}/${resumenInicial.total}.`
                : vencidosIniciales.length > 0
                  ? `Hay ${vencidosIniciales.length} documento(s) vencido(s). Aprobados ${resumenInicial.aprobados}/${resumenInicial.total}.`
                  : porVencerIniciales.length > 0
                    ? `Hay ${porVencerIniciales.length} documento(s) por vencer en ${DIAS_ALERTA_VENCIMIENTO} días o menos.`
                    : sinFechaIniciales.length > 0
                      ? `Hay ${sinFechaIniciales.length} documento(s) sin fecha de vencimiento.`
                      : `Documentación pendiente: ${resumenInicial.aprobados}/${resumenInicial.total} documentos aprobados.`,
            fechaGenerada: alertaExistente.exists()
              ? alertaExistente.data().fechaGenerada || serverTimestamp()
              : serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        await deleteDoc(alertaUsuarioRef).catch(() => null);
      }


      limpiarFormularioUsuario();
      setModalUsuario(false);
      await cargarUsuarios();
      mostrarMensaje(
        usuarioEditando
          ? "Usuario actualizado correctamente."
          : "Usuario creado correctamente y con acceso habilitado.",
      );
    } catch (error: any) {
      console.error(error);
      const code = String(error?.code || "");
      if (code.includes("auth/email-already-in-use")) {
        mostrarMensaje(
          "Ese correo ya tiene acceso creado en Authentication.",
          "error",
        );
      } else if (code.includes("auth/invalid-email")) {
        mostrarMensaje("El correo no es válido.", "error");
      } else if (code.includes("auth/weak-password")) {
        mostrarMensaje(
          "La contraseña es muy débil. Usa mínimo 6 caracteres.",
          "error",
        );
      } else {
        mostrarMensaje("No se pudo crear el usuario.", "error");
      }
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => null);
      setGuardando(false);
    }
  };

  const abrirDocumentosUsuario = (usuario: UsuarioCliente) => {
    const tipo = tiposFuncionario.find(
      (item) => item.id === usuario.tipoFuncionarioId,
    );
    const baseDocs = usuario.documentosRequeridos?.length
      ? usuario.documentosRequeridos
      : (tipo?.documentos || []).map((docu) => ({
          ...docu,
          estado: "NO_CARGADO" as const,
          archivoUrl: "",
          archivoPath: "",
          archivoNombre: "",
          archivoTipo: "",
          fechaVencimiento: "",
          motivoNoCumple: "",
          porcentajeCarga: 0,
        }));

    setUsuarioDocsActivo(usuario);
    setDocumentosUsuario(baseDocs as DocumentoUsuario[]);
    setProgresoDocumentos({});
    setSubiendoDocId(null);
    setModalDocumentosUsuario(true);
  };

  useEffect(() => {
    if (alertaOrigenProcesada || usuarios.length === 0) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const usuarioId = params.get("usuarioId");
    const abrir = params.get("abrir");

    if (!usuarioId || abrir !== "documentos") return;

    const usuarioEncontrado = usuarios.find(
      (usuario) => usuario.id === usuarioId || usuario.uidAuth === usuarioId,
    );

    if (!usuarioEncontrado) {
      setAlertaOrigenProcesada(true);
      mostrarMensaje("No se encontró el usuario asociado a la alerta.", "error");
      return;
    }

    abrirDocumentosUsuario(usuarioEncontrado);
    setAlertaOrigenProcesada(true);
    mostrarMensaje(
      `Abriendo documentos de ${usuarioEncontrado.nombres} ${usuarioEncontrado.apellidos}.`,
      "ok",
    );
  }, [alertaOrigenProcesada, usuarios]);

  const actualizarDocumentoUsuario = (
    docId: string,
    cambios: Partial<DocumentoUsuario>,
  ) => {
    setDocumentosUsuario((actual) =>
      actual.map((docu) =>
        docu.id === docId ? { ...docu, ...cambios } : docu,
      ),
    );
  };

  const cargarArchivoDocumento = async (
    docu: DocumentoUsuario,
    file: File | null,
  ) => {
    if (!file || !usuarioDocsActivo || !nit) return;

    const tipoPermitido =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!tipoPermitido) {
      mostrarMensaje("Solo se permiten imágenes o PDF.", "error");
      return;
    }

    if (file.size > MAX_DOCUMENTO_BYTES) {
      mostrarMensaje(
        `El archivo supera ${MAX_DOCUMENTO_MB} MB. Usa un archivo más liviano.`,
        "error",
      );
      return;
    }

    const nombreSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const archivoPath = `clientes/${nit}/usuarios/${usuarioDocsActivo.id}/documentos/${docu.id}_${Date.now()}_${nombreSeguro}`;
    const storageRef = ref(storage, archivoPath);

    setSubiendoDocId(docu.id);
    setProgresoDocumentos((actual) => ({ ...actual, [docu.id]: 1 }));

    try {
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const porcentaje = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            );
            setProgresoDocumentos((actual) => ({
              ...actual,
              [docu.id]: porcentaje,
            }));
          },
          reject,
          () => resolve(),
        );
      });

      const archivoUrl = await getDownloadURL(uploadTask.snapshot.ref);
      actualizarDocumentoUsuario(docu.id, {
        archivoUrl,
        archivoPath,
        archivoNombre: file.name,
        archivoTipo: file.type,
        estado:
          docu.estado === "APROBADO" || docu.estado === "NO_CUMPLE"
            ? docu.estado
            : "CARGADO",
        porcentajeCarga: 100,
      });
      mostrarMensaje("Documento cargado. Recuerda guardar los cambios.");
    } catch (error) {
      console.error(error);
      mostrarMensaje("No se pudo cargar el documento.", "error");
    } finally {
      setSubiendoDocId(null);
    }
  };

  const guardarDocumentosUsuario = async () => {
    if (!clienteBasePath || !usuarioDocsActivo) return;

    const documentosNormalizados = documentosUsuario.map((docu) => ({
      id: docu.id,
      nombre: docu.nombre,
      estado: docu.archivoUrl ? docu.estado || "CARGADO" : "NO_CARGADO",
      archivoUrl: docu.archivoUrl || "",
      archivoPath: docu.archivoPath || "",
      archivoNombre: docu.archivoNombre || "",
      archivoTipo: docu.archivoTipo || "",
      fechaVencimiento: docu.fechaVencimiento || "",
      motivoNoCumple:
        docu.estado === "NO_CUMPLE" ? docu.motivoNoCumple || "" : "",
      updatedAt: new Date().toISOString(),
    }));

    setGuardando(true);
    try {
      await updateDoc(
        doc(db, clienteBasePath, "usuarios", usuarioDocsActivo.id),
        {
          documentosRequeridos: documentosNormalizados,
          updatedAt: serverTimestamp(),
        },
      );

      const resumen = calcularResumenDocumentos(
        documentosNormalizados as DocumentoUsuario[],
      );

      const documentosPendientes = documentosNormalizados
        .filter((docu) => docu.estado !== "APROBADO")
        .map((docu) => ({
          id: docu.id,
          nombre: docu.nombre,
          estado: docu.estado || "NO_CARGADO",
          motivoNoCumple: docu.motivoNoCumple || "",
          fechaVencimiento: docu.fechaVencimiento || "",
          archivoUrl: docu.archivoUrl || "",
        }));

      const documentosNoCumplen = documentosNormalizados
        .filter((docu) => docu.estado === "NO_CUMPLE")
        .map((docu) => ({
          id: docu.id,
          nombre: docu.nombre,
          motivo: docu.motivoNoCumple || "Sin motivo registrado",
          fechaVencimiento: docu.fechaVencimiento || "",
          archivoUrl: docu.archivoUrl || "",
        }));

      const documentosVencimiento = construirDetalleVencimientos(
        documentosNormalizados as DocumentoUsuario[],
      );
      const documentosSinFechaVencimiento = documentosVencimiento.filter(
        (docu) => docu.tipoAlerta === "SIN_FECHA",
      );
      const documentosVencidos = documentosVencimiento.filter(
        (docu) => docu.tipoAlerta === "VENCIDO",
      );
      const documentosPorVencer = documentosVencimiento.filter(
        (docu) => docu.tipoAlerta === "POR_VENCER",
      );

      const debeGenerarAlerta =
        resumen.total > 0 &&
        (resumen.porcentaje < 100 ||
          documentosNoCumplen.length > 0 ||
          documentosVencimiento.length > 0);

      const alertaRef = doc(
        db,
        clienteBasePath,
        "alertas",
        `documentos_${usuarioDocsActivo.id}`,
      );

      if (debeGenerarAlerta) {
        const alertaExistente = await getDoc(alertaRef);

        await setDoc(
          alertaRef,
          {
            categoria: "alertas documentos",
            tipo: "DOCUMENTOS_USUARIO",
            activo: true,
            usuarioId: usuarioDocsActivo.id,
            usuarioNombre: `${usuarioDocsActivo.nombres} ${usuarioDocsActivo.apellidos}`.trim(),
            usuarioEmail: usuarioDocsActivo.email,
            tipoFuncionario: usuarioDocsActivo.tipoFuncionario,
            totalDocumentos: resumen.total,
            documentosAprobados: resumen.aprobados,
            documentosCargados: resumen.cargados,
            documentosPendientes: documentosPendientes.length,
            documentosNoCumplen: documentosNoCumplen.length,
            documentosSinFechaVencimiento: documentosSinFechaVencimiento.length,
            documentosVencidos: documentosVencidos.length,
            documentosPorVencer: documentosPorVencer.length,
            porcentajeAprobado: resumen.porcentaje,
            pendientesDetalle: documentosPendientes,
            motivosNoCumple: documentosNoCumplen,
            vencimientosDetalle: documentosVencimiento,
            mensaje:
              documentosNoCumplen.length > 0
                ? `Documentación con no cumple: ${documentosNoCumplen.length}. Aprobados ${resumen.aprobados}/${resumen.total}.`
                : documentosVencidos.length > 0
                  ? `Hay ${documentosVencidos.length} documento(s) vencido(s). Aprobados ${resumen.aprobados}/${resumen.total}.`
                  : documentosPorVencer.length > 0
                    ? `Hay ${documentosPorVencer.length} documento(s) por vencer en ${DIAS_ALERTA_VENCIMIENTO} días o menos.`
                    : documentosSinFechaVencimiento.length > 0
                      ? `Hay ${documentosSinFechaVencimiento.length} documento(s) sin fecha de vencimiento.`
                      : `Documentación pendiente: ${resumen.aprobados}/${resumen.total} documentos aprobados.`,
            fechaGenerada: alertaExistente.exists()
              ? alertaExistente.data().fechaGenerada || serverTimestamp()
              : serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        await deleteDoc(alertaRef).catch(() => null);
      }
      setUsuarios((actual) =>
        actual.map((u) =>
          u.id === usuarioDocsActivo.id
            ? {
                ...u,
                documentosRequeridos:
                  documentosNormalizados as DocumentoUsuario[],
              }
            : u,
        ),
      );
      setUsuarioDocsActivo((actual) =>
        actual
          ? {
              ...actual,
              documentosRequeridos:
                documentosNormalizados as DocumentoUsuario[],
            }
          : actual,
      );
      mostrarMensaje("Documentos guardados correctamente.");
    } catch (error) {
      console.error(error);
      mostrarMensaje("No se pudieron guardar los documentos.", "error");
    } finally {
      setGuardando(false);
    }
  };


  const cargarEmailJs = () =>
    new Promise<typeof window.emailjs>((resolve, reject) => {
      if (window.emailjs) {
        window.emailjs.init(EMAILJS_PUBLIC_KEY);
        resolve(window.emailjs);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      script.async = true;
      script.onload = () => {
        if (!window.emailjs) {
          reject(new Error("EmailJS no cargó correctamente."));
          return;
        }
        window.emailjs.init(EMAILJS_PUBLIC_KEY);
        resolve(window.emailjs);
      };
      script.onerror = () => reject(new Error("No se pudo cargar EmailJS."));
      document.body.appendChild(script);
    });

  const enviarCredencialesUsuario = async (usuario: UsuarioCliente) => {
    if (!usuario.email) {
      mostrarMensaje("El usuario no tiene correo registrado.", "error");
      return;
    }

    if (!usuario.passwordAcceso) {
      mostrarMensaje(
        "No hay contraseña guardada para enviar. Este dato se guarda al crear el usuario desde el campo contraseña.",
        "error",
      );
      return;
    }

    setGuardando(true);
    try {
      const emailjs = await cargarEmailJs();
      const nombreCompleto = `${usuario.nombres || ""} ${
        usuario.apellidos || ""
      }`.trim();

      await emailjs?.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: usuario.email,
          to_name: nombreCompleto || usuario.email,
          subject: "Tus datos de usuario en nuestra plataforma",
          message: `Hola ${nombreCompleto || usuario.email},\n\nEstos son tus datos de acceso:\nUsuario: ${usuario.email}\nContraseña: ${usuario.passwordAcceso}\n\nGracias por usar nuestra plataforma.`,
        },
        EMAILJS_PUBLIC_KEY,
      );

      mostrarMensaje(`Correo enviado con éxito a ${usuario.email}.`);
    } catch (error) {
      console.error(error);
      mostrarMensaje(
        "No se pudo enviar el correo. Revisa la configuración de EmailJS.",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = async () => {
    await auth.signOut();
    if (typeof window !== "undefined")
      window.localStorage.removeItem("clienteSesion");
    router.replace("/login_users");
  };

  if (cargando) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f4f5fb] text-slate-600">
        Cargando usuarios...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5fb] text-slate-800">
      {sidebarAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarAbierto(false)}
          className="fixed inset-0 z-30 bg-slate-900/35 xl:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white shadow-[0_0_35px_rgba(15,23,42,0.25)] transition-all duration-300 xl:translate-x-0 ${
          menuColapsado ? "xl:w-20" : "xl:w-72"
        } ${sidebarAbierto ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div className={`border-b border-white/10 ${menuColapsado ? "px-3 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" title="Ir al inicio" className="min-w-0 flex-1">
                <Image
                  src={logoUrl || "/logo.png"}
                  alt="Logo"
                  width={150}
                  height={70}
                  className={`h-12 object-contain ${menuColapsado ? "mx-auto w-12" : "w-36 object-left"}`}
                />
              </Link>

              <button
                type="button"
                onClick={() => setMenuColapsado((actual) => !actual)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-base font-black text-white transition hover:bg-white/20 xl:flex"
                aria-label={menuColapsado ? "Expandir menú" : "Encoger menú"}
                title={menuColapsado ? "Expandir menú" : "Encoger menú"}
              >
                ☰
              </button>

              <button
                type="button"
                onClick={() => setSidebarAbierto(false)}
                className="ml-auto rounded-xl p-2 text-white/70 hover:bg-white/10 xl:hidden"
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>

            {!menuColapsado && (
              <>
                <p className="mt-1 text-[10px] font-bold text-sky-300">Portal clientes</p>
                <p className="mt-2 text-[11px] font-medium text-white/45">Gestión administrativa</p>
              </>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto px-3 py-5 text-sm font-semibold ${menuColapsado ? "space-y-2" : "space-y-3"}`}>
            <Link
              href="/dashboard"
              className={`flex items-center rounded-2xl px-4 py-3 transition ${
                pathname === "/dashboard"
                  ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              } ${menuColapsado ? "justify-center px-2" : ""}`}
              title="Inicio"
            >
              {menuColapsado ? "I" : "Inicio"}
            </Link>

            <div className="space-y-2">
              <div
                className={`rounded-2xl px-4 py-3 text-white/90 ${pathname.startsWith("/configuraciones") ? "bg-white/10" : ""} ${
                  menuColapsado ? "text-center px-2" : ""
                }`}
                title="1. Configuraciones"
              >
                {menuColapsado ? "1" : "1. Configuraciones"}
              </div>

              {!menuColapsado && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link
                    href="/configuraciones/empresa"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/empresa"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    1.1 Empresa
                  </Link>
                  <Link
                    href="/configuraciones/usuarios"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/usuarios"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    1.2 Usuarios y Roles
                  </Link>
                  <Link
                    href="/configuraciones/ubicaciones"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/ubicaciones"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    1.3 Móviles y Bodegas
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className={`rounded-2xl px-4 py-3 text-white/90 ${menuColapsado ? "text-center px-2" : ""}`} title="2. Área operativa">
                {menuColapsado ? "2" : "2. Área operativa"}
              </div>

              {!menuColapsado && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link
                    href="/configuraciones/autoevaluacion"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/autoevaluacion"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    2.1 Autoevaluación General
                  </Link>
                  <Link
                    href="/configuraciones/asignaciones"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/asignaciones"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    2.2 Asignaciones a Móviles
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className={`rounded-2xl px-4 py-3 text-white/90 ${menuColapsado ? "text-center px-2" : ""}`} title="3. Móviles">
                {menuColapsado ? "3" : "3. Móviles"}
              </div>

              {!menuColapsado && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link
                    href="/configuraciones/verificaciones"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/verificaciones"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    3.1 Verificación diaria
                  </Link>
                  <Link
                    href="/configuraciones/mantenimientos"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/mantenimientos"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    3.2 Programación de Mantenimientos
                  </Link>
                  <Link
                    href="/configuraciones/infracciones"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/infracciones"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    3.3 Gestión de Infracciones
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className={`rounded-2xl px-4 py-3 text-white/90 ${menuColapsado ? "text-center px-2" : ""}`} title="4. Tareas">
                {menuColapsado ? "4" : "4. Tareas"}
              </div>

              {!menuColapsado && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link
                    href="/configuraciones/tareas"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/tareas"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    4.1 Programar tareas
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className={`rounded-2xl px-4 py-3 text-white/90 ${menuColapsado ? "text-center px-2" : ""}`} title="5. Soporte">
                {menuColapsado ? "5" : "5. Soporte"}
              </div>

              {!menuColapsado && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link
                    href="/configuraciones/soportea"
                    className={`block rounded-2xl px-4 py-2.5 transition ${
                      pathname === "/configuraciones/soportea"
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/20"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    5.1 Solicitar un soporte
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {!menuColapsado && (
            <div className="border-t border-white/10 p-4 text-[11px] leading-5 text-white/45">
              Un producto de Famiasistir
              <br />
              Desarrollado por Printserp SAS
            </div>
          )}
        </div>
      </aside>

      <section className={`${menuColapsado ? "xl:pl-20" : "xl:pl-72"} transition-all duration-300`}>
        <header className="sticky top-0 z-20 px-4 py-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-[#5b35f5] via-[#7c2df2] to-[#25a7f0] px-4 py-4 text-white shadow-xl shadow-indigo-500/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarAbierto(true)}
                className="xl:hidden rounded-xl bg-white/15 px-3 py-2"
                aria-label="Abrir menú"
              >
                ☰
              </button>
              <div>
                <p className="text-xs opacity-80">Hola,</p>
                <h1 className="text-sm sm:text-base font-black truncate">
                  {nombreHeader}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:block text-right min-w-0">
                <p className="text-xs opacity-70">Sesión cliente</p>
                <p className="text-xs font-bold truncate max-w-[220px]">
                  {clienteSesion?.email}
                </p>
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
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-500 font-black">
              Configuraciones
            </p>
            <h2 className="text-2xl font-black">Usuarios</h2>
            <p className="mt-1 text-sm text-slate-500">
              Primero configura tipos de funcionario y luego crea usuarios con
              acceso.
            </p>
          </div>

          {mensaje && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${tipoMensaje === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
            >
              {mensaje}
            </div>
          )}

          <section className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-black">Gestión inicial</h3>
                <p className="text-sm text-slate-500">
                  Crea tipos de funcionario, roles y usuarios.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setModalListas(true)}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                >
                  Tipo de Funcionario y Roles
                </button>
                <button
                  onClick={abrirCrearUsuario}
                  className="rounded-xl bg-[#5b45f5] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={tiposFuncionario.length === 0 || roles.length === 0}
                >
                  Crear Nuevo Usuario
                </button>
              </div>
            </div>
            <div className="p-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Si una persona cumple con más de un rol o tipo de funcionario,
                crea un perfil separado para cada cargo. La documentación se
                gestiona de forma independiente por perfil.
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-black">Usuarios guardados</h3>
              <p className="text-sm text-slate-500">
                Tabla inicial con los datos creados.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Contraseña</th>
                    <th className="px-4 py-3 text-left">Identificación</th>
                    <th className="px-4 py-3 text-left">Tipo Funcionario</th>
                    <th className="px-4 py-3 text-left">Rol</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-left">Progreso docs</th>
                    <th className="px-4 py-3 text-left">Docs</th>
                    <th className="px-4 py-3 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        Aún no hay usuarios creados.
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((usuario) => {
                      const resumenDocs = calcularResumenDocumentos(
                        usuario.documentosRequeridos || [],
                      );

                      return (
                      <tr key={usuario.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-bold whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {usuario.fotoUrl ? (
                              <img
                                src={usuario.fotoUrl}
                                alt="Foto"
                                className="h-9 w-9 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center">
                                {usuario.nombres.charAt(0)}
                              </div>
                            )}
                            {usuario.nombres} {usuario.apellidos}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {usuario.email}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="rounded-xl bg-slate-100 px-3 py-1.5 font-mono text-xs font-black text-slate-700">
                              {claveTabla(usuario)}
                            </span>
                            {usuario.passwordAcceso && (
                              <button
                                type="button"
                                onClick={() => alternarPasswordTabla(usuario.id)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-600 hover:bg-slate-50"
                                title={passwordsVisibles[usuario.id] ? "Ocultar contraseña" : "Ver contraseña"}
                              >
                                {passwordsVisibles[usuario.id] ? "🙈" : "👁️"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {usuario.tipoIdentificacion}{" "}
                          {usuario.numeroIdentificacion}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {usuario.tipoFuncionario}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {usuario.rol}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${usuario.estado === "ACTIVO" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {usuario.estado}
                          </span>
                        </td>
                        <td className="px-4 py-4 min-w-[180px]">
                          <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-600">
                            <span>
                              {resumenDocs.aprobados}/{resumenDocs.total} aprobados
                            </span>
                            <span>{resumenDocs.porcentaje}%</span>
                          </div>
                          <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                resumenDocs.porcentaje === 100
                                  ? "bg-emerald-500"
                                  : resumenDocs.cargados > 0
                                    ? "bg-amber-500"
                                    : "bg-slate-300"
                              }`}
                              style={{ width: `${resumenDocs.porcentaje}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={() => abrirDocumentosUsuario(usuario)}
                            className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                          >
                            Ver documentos (
                            {usuario.documentosRequeridos?.length || 0})
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => abrirCarnetUsuario(usuario)}
                              className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100"
                            >
                              Carnet
                            </button>
                            <button
                              onClick={() => abrirEditarUsuario(usuario)}
                              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => enviarCredencialesUsuario(usuario)}
                              disabled={guardando}
                              className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                            >
                              Enviar email
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {modalListas && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="bg-[#5b45f5] px-6 py-4 text-white flex justify-between items-center">
              <h3 className="font-black">Gestionar Listas</h3>
              <button
                onClick={() => setModalListas(false)}
                className="rounded-xl bg-white/15 px-3 py-2"
              >
                ✕
              </button>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-6">
              <div>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-xs uppercase tracking-widest text-slate-400 font-black">
                    Tipos de Funcionario
                  </h4>
                  <button
                    onClick={cargarTiposBaseManual}
                    disabled={guardando}
                    className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    Cargar tipos base
                  </button>
                </div>
                <div className="space-y-2 mb-4">
                  {tiposFuncionario.map((tipo) => (
                    <div
                      key={tipo.id}
                      className="rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold">{tipo.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {tipo.documentos?.length || 0} documentos
                        </p>
                      </div>
                      <button
                        onClick={() => abrirEditarTipo(tipo)}
                        className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700"
                      >
                        Editar documentos
                      </button>
                    </div>
                  ))}
                </div>
                <label className="text-sm font-bold">
                  Nuevo Tipo de Funcionario
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value)}
                    placeholder="Ej: Auxiliar de Enfermería"
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={abrirNuevoTipo}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
                  >
                    Crear nuevo
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs uppercase tracking-widest text-slate-400 font-black mb-3">
                  Roles
                </h4>
                <div className="space-y-2 mb-4">
                  {roles.map((rol) => (
                    <div
                      key={rol.id}
                      className="rounded-2xl border border-slate-200 p-3 font-bold"
                    >
                      {rol.nombre}
                    </div>
                  ))}
                </div>
                <label className="text-sm font-bold">Nuevo Rol</label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={nuevoRol}
                    onChange={(e) => setNuevoRol(e.target.value)}
                    placeholder="Ej: Auditor Interno"
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={guardarRol}
                    disabled={guardando}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalTipoDocs && tipoEditando && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start gap-4">
              <div>
                <h3 className="font-black">
                  Configurar Documentos para:{" "}
                  <span className="text-indigo-600">{tipoEditando.nombre}</span>
                </h3>
                <p className="text-sm text-slate-500">
                  Define los documentos requeridos para este tipo de
                  funcionario.
                </p>
              </div>
              <button
                onClick={() => setModalTipoDocs(false)}
                className="rounded-xl bg-slate-100 px-3 py-2"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => setModalPreestablecidos(true)}
                className="rounded-xl bg-[#5b45f5] px-4 py-3 text-sm font-black text-white"
              >
                + Agregar Documentos Preestablecidos
              </button>
              <div className="space-y-2">
                {documentosTipo.map((docu) => (
                  <div
                    key={docu.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <span className="font-semibold">{docu.nombre}</span>
                    <button
                      onClick={() =>
                        setDocumentosTipo((actual) =>
                          actual.filter((d) => d.id !== docu.id),
                        )
                      }
                      className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={documentoManual}
                  onChange={(e) => setDocumentoManual(e.target.value)}
                  placeholder="Nombre del Documento"
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-400"
                />
                <button
                  onClick={agregarDocumentoManual}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
                >
                  + Agregar manualmente
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setModalTipoDocs(false)}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={guardarTipoFuncionario}
                disabled={guardando}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                Guardar Documentos
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPreestablecidos && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between">
              <h3 className="font-black">
                Seleccionar Documentos Preestablecidos
              </h3>
              <button
                onClick={() => setModalPreestablecidos(false)}
                className="rounded-xl bg-slate-100 px-3 py-2"
              >
                ✕
              </button>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-6">
              {[
                { title: "Documentos Comunes", items: DOCUMENTOS_COMUNES },
                {
                  title: "Documentos Específicos",
                  items: DOCUMENTOS_ESPECIFICOS,
                },
              ].map((grupo) => (
                <div key={grupo.title}>
                  <h4 className="font-black mb-3">{grupo.title}</h4>
                  <div className="space-y-2">
                    {grupo.items.map((item) => (
                      <label
                        key={item}
                        className="flex gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={seleccionDocs.includes(item)}
                          onChange={(e) =>
                            setSeleccionDocs((actual) =>
                              e.target.checked
                                ? [...actual, item]
                                : actual.filter((x) => x !== item),
                            )
                          }
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setModalPreestablecidos(false)}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={agregarDocumentosPreestablecidos}
                className="rounded-xl bg-[#5b45f5] px-4 py-3 text-sm font-black text-white"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalUsuario && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black">{usuarioEditando ? "Editar Usuario" : "Formulario de Usuario"}</h3>
              <button
                onClick={() => { setModalUsuario(false); limpiarFormularioUsuario(); }}
                className="rounded-xl bg-slate-100 px-3 py-2"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={guardarUsuario}
              className="p-6 grid md:grid-cols-3 gap-5"
            >
              <Campo label="Nombres">
                <input
                  required
                  value={formUsuario.nombres}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, nombres: e.target.value })
                  }
                  className="input"
                />
              </Campo>
              <Campo label="Apellidos">
                <input
                  required
                  value={formUsuario.apellidos}
                  onChange={(e) =>
                    setFormUsuario({
                      ...formUsuario,
                      apellidos: e.target.value,
                    })
                  }
                  className="input"
                />
              </Campo>
              <Campo label="Email">
                <input
                  required
                  type="email"
                  disabled={!!usuarioEditando}
                  value={formUsuario.email}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, email: e.target.value })
                  }
                  className="input disabled:bg-slate-50 disabled:text-slate-400"
                />
              </Campo>
              <Campo label="Foto (350 KB max, opcional)">
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setFormUsuario({
                      ...formUsuario,
                      foto: e.target.files?.[0] || null,
                    })
                  }
                  className="input"
                />
              </Campo>
              <Campo label="Tipo de Identificación">
                <select
                  value={formUsuario.tipoIdentificacion}
                  onChange={(e) =>
                    setFormUsuario({
                      ...formUsuario,
                      tipoIdentificacion: e.target.value,
                    })
                  }
                  className="input"
                >
                  <option>Cédula</option>
                  <option>Tarjeta de Identidad</option>
                  <option>Pasaporte</option>
                  <option>Cédula de Extranjería</option>
                  <option>Permiso de Permanencia</option>
                </select>
              </Campo>
              <Campo label="Número de Identificación">
                <input
                  required
                  value={formUsuario.numeroIdentificacion}
                  onChange={(e) =>
                    setFormUsuario({
                      ...formUsuario,
                      numeroIdentificacion: e.target.value,
                    })
                  }
                  className="input"
                />
              </Campo>
              <Campo label="Tipo de Funcionario">
                <select
                  required
                  value={formUsuario.tipoFuncionarioId}
                  onChange={(e) =>
                    setFormUsuario({
                      ...formUsuario,
                      tipoFuncionarioId: e.target.value,
                    })
                  }
                  className="input"
                >
                  <option value="">Seleccionar</option>
                  {tiposFuncionario.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Rol">
                <select
                  required
                  value={formUsuario.rolId}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, rolId: e.target.value })
                  }
                  className="input"
                >
                  <option value="">Seleccionar</option>
                  {roles.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Grupo Sanguíneo y RH">
                <select
                  value={formUsuario.rh}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, rh: e.target.value })
                  }
                  className="input"
                >
                  <option>O+</option>
                  <option>O-</option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>B-</option>
                  <option>AB+</option>
                  <option>AB-</option>
                </select>
              </Campo>
              <Campo label={usuarioEditando ? "Contraseña (solo se define al crear)" : "Contraseña"}>
                <div className="flex">
                  <input
                    required={!usuarioEditando}
                    disabled={!!usuarioEditando}
                    type={mostrarPassword ? "text" : "password"}
                    value={formUsuario.password}
                    onChange={(e) =>
                      setFormUsuario({
                        ...formUsuario,
                        password: e.target.value,
                      })
                    }
                    className="input rounded-r-none disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="rounded-r-xl border border-l-0 border-slate-200 px-3"
                  >
                    {mostrarPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </Campo>
              <Campo label="Estado">
                <select
                  value={formUsuario.estado}
                  onChange={(e) =>
                    setFormUsuario({ ...formUsuario, estado: e.target.value })
                  }
                  className="input"
                >
                  <option>ACTIVO</option>
                  <option>SUSPENDIDO</option>
                  <option>INACTIVO</option>
                </select>
              </Campo>
              <div className="md:col-span-3 flex justify-center pt-3">
                <button
                  disabled={guardando}
                  className="w-full sm:w-1/2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : usuarioEditando ? "Guardar cambios" : "Guardar y crear acceso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalCarnet && usuarioCarnet && (
        <div className="fixed inset-0 z-[64] grid place-items-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#5b35f5] via-[#7c2df2] to-[#25a7f0] p-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-80">Carnet virtual</p>
                  <h3 className="mt-1 text-xl font-black">Marthin</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    usuarioCarnet.estado === "ACTIVO"
                      ? "bg-emerald-400/25 text-white"
                      : usuarioCarnet.estado === "SUSPENDIDO"
                        ? "bg-amber-300/25 text-white"
                        : "bg-red-400/25 text-white"
                  }`}
                >
                  {usuarioCarnet.estado}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                {usuarioCarnet.fotoUrl ? (
                  <img
                    src={usuarioCarnet.fotoUrl}
                    alt="Foto usuario"
                    className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg ring-4 ring-indigo-50"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-indigo-100 text-3xl font-black text-indigo-700 grid place-items-center shadow-lg ring-4 ring-indigo-50">
                    {usuarioCarnet.nombres?.charAt(0) || "U"}
                  </div>
                )}

                <h4 className="mt-4 text-xl font-black text-slate-900">
                  {usuarioCarnet.nombres} {usuarioCarnet.apellidos}
                </h4>
                <p className="text-sm font-bold text-indigo-600">
                  {usuarioCarnet.tipoFuncionario}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <DatoCarnet label="Identificación" value={`${usuarioCarnet.tipoIdentificacion} ${usuarioCarnet.numeroIdentificacion}`} />
                <DatoCarnet label="RH" value={usuarioCarnet.rh || "N/A"} />
                <DatoCarnet label="Rol" value={usuarioCarnet.rol || "N/A"} />
                <DatoCarnet label="Correo" value={usuarioCarnet.email || "N/A"} />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setModalCarnet(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalDocumentosUsuario && usuarioDocsActivo && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-black/45 p-3 sm:p-4">
          <div className="w-full max-w-6xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900">
                  Documentos de {usuarioDocsActivo.nombres}{" "}
                  {usuarioDocsActivo.apellidos}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  {usuarioDocsActivo.tipoFuncionario} · Máximo{" "}
                  {MAX_DOCUMENTO_MB} MB por archivo · PDF o imagen
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalDocumentosUsuario(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold"
                >
                  Cerrar
                </button>
                <button
                  onClick={guardarDocumentosUsuario}
                  disabled={guardando || !!subiendoDocId}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              {documentosUsuario.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  Este usuario no tiene documentos configurados para su tipo de
                  funcionario.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-3 text-left">Documento</th>
                        <th className="px-3 py-3 text-left">Adjuntar</th>
                        <th className="px-3 py-3 text-left">Archivo</th>
                        <th className="px-3 py-3 text-left">Vencimiento</th>
                        <th className="px-3 py-3 text-left">Estado</th>
                        <th className="px-3 py-3 text-left">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documentosUsuario.map((docu) => {
                        const progreso =
                          progresoDocumentos[docu.id] || docu.porcentajeCarga || 0;
                        const subiendoEste = subiendoDocId === docu.id;
                        const estadoActual = docu.archivoUrl
                          ? docu.estado || "CARGADO"
                          : "NO_CARGADO";

                        return (
                          <tr key={docu.id} className="align-top hover:bg-slate-50">
                            <td className="px-3 py-3 w-[260px]">
                              <p className="font-black text-slate-900 leading-snug">
                                {docu.nombre}
                              </p>
                              <p
                                className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${
                                  estadoActual === "APROBADO"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : estadoActual === "NO_CUMPLE"
                                      ? "bg-red-50 text-red-700"
                                      : estadoActual === "CARGADO"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {etiquetaEstadoDocumento(estadoActual)}
                              </p>
                            </td>

                            <td className="px-3 py-3 w-[220px]">
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                disabled={!!subiendoDocId}
                                onChange={(e) =>
                                  cargarArchivoDocumento(
                                    docu,
                                    e.target.files?.[0] || null,
                                  )
                                }
                                className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-black file:text-indigo-700"
                              />
                              {(subiendoEste || progreso > 0) && progreso < 100 && (
                                <div className="mt-2">
                                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className="h-full bg-indigo-600 transition-all"
                                      style={{ width: `${progreso}%` }}
                                    />
                                  </div>
                                  <p className="mt-1 text-[11px] font-bold text-indigo-600">
                                    Cargando... {progreso}%
                                  </p>
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-3 w-[170px]">
                              {docu.archivoUrl ? (
                                <a
                                  href={docu.archivoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex animate-pulse rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm shadow-emerald-200"
                                >
                                  Ver cargado
                                </a>
                              ) : (
                                <span className="text-xs font-bold text-slate-400">
                                  No se ha cargado documento
                                </span>
                              )}
                              {docu.archivoNombre && (
                                <p className="mt-1 max-w-[150px] truncate text-[11px] text-slate-500">
                                  {docu.archivoNombre}
                                </p>
                              )}
                            </td>

                            <td className="px-3 py-3 w-[160px]">
                              <input
                                type="date"
                                value={docu.fechaVencimiento || ""}
                                onChange={(e) =>
                                  actualizarDocumentoUsuario(docu.id, {
                                    fechaVencimiento: e.target.value,
                                  })
                                }
                                className="input py-2 text-sm"
                              />
                            </td>

                            <td className="px-3 py-3 w-[190px]">
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  disabled={!docu.archivoUrl}
                                  onClick={() =>
                                    actualizarDocumentoUsuario(docu.id, {
                                      estado: "APROBADO",
                                      motivoNoCumple: "",
                                    })
                                  }
                                  className={`rounded-xl px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${
                                    docu.estado === "APROBADO"
                                      ? "bg-emerald-600 text-white"
                                      : "bg-white text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  Aprobado
                                </button>
                                <button
                                  type="button"
                                  disabled={!docu.archivoUrl}
                                  onClick={() =>
                                    actualizarDocumentoUsuario(docu.id, {
                                      estado: "NO_CUMPLE",
                                    })
                                  }
                                  className={`rounded-xl px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${
                                    docu.estado === "NO_CUMPLE"
                                      ? "bg-red-600 text-white"
                                      : "bg-white text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  No cumple
                                </button>
                              </div>
                            </td>

                            <td className="px-3 py-3 w-[220px]">
                              {docu.estado === "NO_CUMPLE" ? (
                                <textarea
                                  value={docu.motivoNoCumple || ""}
                                  onChange={(e) =>
                                    actualizarDocumentoUsuario(docu.id, {
                                      motivoNoCumple: e.target.value,
                                    })
                                  }
                                  placeholder="Motivo del no cumple"
                                  className="w-full rounded-xl border border-red-100 bg-white px-3 py-2 text-sm outline-none focus:border-red-300"
                                  rows={2}
                                />
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setModalDocumentosUsuario(false)}
                className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-bold"
              >
                Cerrar
              </button>
              <button
                onClick={guardarDocumentosUsuario}
                disabled={guardando || !!subiendoDocId}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar documentos"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.75rem 1rem;
          outline: none;
          background: white;
        }
        .input:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        }
      `}</style>
    </main>
  );
}

function DatoCarnet({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
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
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
