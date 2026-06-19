"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
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
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
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
  codigoHabilitacion?: string;
  CodigoHabilitacion?: string;
  IPS?: string;
  ips?: string;
  [key: string]: unknown;
};

type ArchivoGuardado = {
  nombre?: string;
  url?: string;
  path?: string;
  tipo?: string;
};

type ExtraDocumento = {
  nombre?: string;
  archivo?: ArchivoGuardado;
  vencimiento?: string;
};

type Movil = {
  id: string;
  nombre?: string;
  denominacion?: string;
  placa?: string;
  modelo?: string;
  kilometrajeInicial?: string;
  tipo?: string;
  codigoHabilitacion?: string;
  ips?: string;
  estado?: "Activo" | "Inactivo";
  fotos?: ArchivoGuardado[];
  tarjetaPropiedad?: ArchivoGuardado[];
  soatCompany?: string;
  soatDocument?: ArchivoGuardado;
  soatExpiry?: string;
  tecnomecanicaDocument?: ArchivoGuardado;
  tecnomecanicaExpiry?: string;
  policyAllRiskCompany?: string;
  policyAllRiskDocument?: ArchivoGuardado;
  policyAllRiskExpiry?: string;
  policyRCCompany?: string;
  policyRCDocument?: ArchivoGuardado;
  policyRCExpiry?: string;
  rentalContractDocument?: ArchivoGuardado;
  rentalContractExpiry?: string;
  gpsCompany?: string;
  gpsExpiry?: string;
  extras?: ExtraDocumento[];
  [key: string]: unknown;
};

type FormMovil = {
  nombre: string;
  denominacion: string;
  placa: string;
  modelo: string;
  kilometrajeInicial: string;
  tipo: string;
  codigoHabilitacion: string;
  ips: string;
  estado: "Activo" | "Inactivo";
  soatCompany: string;
  soatExpiry: string;
  tecnomecanicaExpiry: string;
  policyAllRiskCompany: string;
  policyAllRiskExpiry: string;
  policyRCCompany: string;
  policyRCExpiry: string;
  rentalContractExpiry: string;
  gpsCompany: string;
  gpsExpiry: string;
  extraDocName1: string;
  extraDocExpiry1: string;
  extraDocName2: string;
  extraDocExpiry2: string;
  extraDocName3: string;
  extraDocExpiry3: string;
  extraDocName4: string;
  extraDocExpiry4: string;
};

const DEFAULT_LOGO = "/logo.png";
const TIPOS_BASE = ["TAB", "TAM", "NEONATAL", "CONVENCIONAL"];
const MAX_IMAGEN_BYTES = 1024 * 1024;
const MAX_DOCUMENTO_BYTES = 5 * 1024 * 1024;

const formInicial: FormMovil = {
  nombre: "",
  denominacion: "",
  placa: "",
  modelo: "",
  kilometrajeInicial: "",
  tipo: "",
  codigoHabilitacion: "",
  ips: "",
  estado: "Activo",
  soatCompany: "",
  soatExpiry: "",
  tecnomecanicaExpiry: "",
  policyAllRiskCompany: "",
  policyAllRiskExpiry: "",
  policyRCCompany: "",
  policyRCExpiry: "",
  rentalContractExpiry: "",
  gpsCompany: "",
  gpsExpiry: "",
  extraDocName1: "",
  extraDocExpiry1: "",
  extraDocName2: "",
  extraDocExpiry2: "",
  extraDocName3: "",
  extraDocExpiry3: "",
  extraDocName4: "",
  extraDocExpiry4: "",
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

function normalizarNit(value?: string) {
  return String(value || "").replace(/[^0-9a-zA-Z]/g, "");
}

function texto(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

function nombreArchivo(file?: File | null) {
  return file?.name || "Sin archivo";
}

function archivoValido(file: File, tipo: "imagen" | "documento") {
  if (tipo === "imagen") {
    return (
      (file.type === "image/jpeg" || file.type === "image/png") &&
      file.size <= MAX_IMAGEN_BYTES
    );
  }

  return (
    (file.type === "application/pdf" || file.type.startsWith("image/")) &&
    file.size <= MAX_DOCUMENTO_BYTES
  );
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

const DIAS_ALERTA_MOVILES = 10;

function parseFechaLocal(fecha?: string) {
  if (!fecha) return null;
  const partes = fecha.split("-").map(Number);
  if (partes.length !== 3 || partes.some((item) => Number.isNaN(item))) {
    return null;
  }
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

function revisarVencimientoMovil(nombre: string, fechaVencimiento?: string) {
  const fecha = parseFechaLocal(fechaVencimiento);
  if (!fecha) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);

  const diasRestantes = Math.ceil(
    (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diasRestantes < 0) {
    return {
      nombre,
      fechaVencimiento: fechaVencimiento || "",
      tipoAlerta: "VENCIDO" as const,
      diasRestantes,
      mensaje: `${nombre} venció hace ${Math.abs(diasRestantes)} día(s).`,
    };
  }

  if (diasRestantes <= DIAS_ALERTA_MOVILES) {
    return {
      nombre,
      fechaVencimiento: fechaVencimiento || "",
      tipoAlerta: "POR_VENCER" as const,
      diasRestantes,
      mensaje:
        diasRestantes === 0
          ? `${nombre} vence hoy.`
          : `${nombre} vence en ${diasRestantes} día(s).`,
    };
  }

  return null;
}

function construirAlertasVencimientoMovil(form: FormMovil) {
  const vencimientos = [
    revisarVencimientoMovil("SOAT", form.soatExpiry),
    revisarVencimientoMovil("Tecnomecánica", form.tecnomecanicaExpiry),
    revisarVencimientoMovil("Póliza todo riesgo", form.policyAllRiskExpiry),
    revisarVencimientoMovil("Póliza responsabilidad civil", form.policyRCExpiry),
    revisarVencimientoMovil("Contrato de arrendamiento", form.rentalContractExpiry),
    revisarVencimientoMovil("GPS", form.gpsExpiry),
    revisarVencimientoMovil(form.extraDocName1 || "Documento extra 1", form.extraDocExpiry1),
    revisarVencimientoMovil(form.extraDocName2 || "Documento extra 2", form.extraDocExpiry2),
    revisarVencimientoMovil(form.extraDocName3 || "Documento extra 3", form.extraDocExpiry3),
    revisarVencimientoMovil(form.extraDocName4 || "Documento extra 4", form.extraDocExpiry4),
  ];

  return vencimientos.filter(Boolean) as Array<{
    nombre: string;
    fechaVencimiento: string;
    tipoAlerta: "VENCIDO" | "POR_VENCER";
    diasRestantes: number;
    mensaje: string;
  }>;
}

async function subirArchivo(
  clienteId: string,
  movilId: string,
  carpeta: string,
  file: File,
  onProgress?: (porcentaje: number) => void,
): Promise<ArchivoGuardado> {
  const seguro = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `clientes/${clienteId}/ubicaciones/moviles/${movilId}/${carpeta}/${Date.now()}_${seguro}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const porcentaje = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        onProgress?.(porcentaje);
      },
      reject,
      () => resolve(),
    );
  });

  const url = await getDownloadURL(task.snapshot.ref);
  onProgress?.(100);
  return { nombre: file.name, url, path, tipo: file.type };
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

function SeccionModal({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-indigo-50/60 px-4 py-3 sm:px-5">
        <h4 className="text-sm font-black text-slate-800">{titulo}</h4>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ArchivoExistente({
  archivo,
  etiqueta = "Ver archivo cargado",
  onQuitar,
}: {
  archivo?: ArchivoGuardado;
  etiqueta?: string;
  onQuitar?: () => void;
}) {
  if (!archivo?.url) return null;

  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
      <a
        href={archivo.url}
        target="_blank"
        rel="noreferrer"
        className="truncate hover:underline"
      >
        {etiqueta}
      </a>
      {onQuitar && (
        <button
          type="button"
          onClick={onQuitar}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-red-600 shadow-sm hover:bg-red-50"
          title="Quitar archivo"
          aria-label="Quitar archivo"
        >
          ×
        </button>
      )}
    </div>
  );
}

function MiniaturaExistente({
  archivo,
  onQuitar,
}: {
  archivo: ArchivoGuardado;
  onQuitar: () => void;
}) {
  if (!archivo?.url) return null;

  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <a
        href={archivo.url}
        target="_blank"
        rel="noreferrer"
        title={archivo.nombre || "Ver imagen"}
      >
        <img
          src={archivo.url}
          alt={archivo.nombre || "Imagen cargada"}
          className="h-full w-full object-cover"
        />
      </a>
      <button
        type="button"
        onClick={onQuitar}
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/75 text-xs font-black text-white hover:bg-red-600"
        title="Quitar imagen"
        aria-label="Quitar imagen"
      >
        ×
      </button>
    </div>
  );
}

function UbicacionesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [clienteSesion, setClienteSesion] = useState<ClienteSesion | null>(
    null,
  );
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [progresoGuardado, setProgresoGuardado] = useState(0);
  const [textoGuardado, setTextoGuardado] = useState("");
  const [progresoArchivos, setProgresoArchivos] = useState<
    Record<string, number>
  >({});
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"ok" | "error">("ok");

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [operativaOpen, setOperativaOpen] = useState(false);
  const [movilesOpen, setMovilesOpen] = useState(false);
  const [tareasOpen, setTareasOpen] = useState(false);
  const [soporteOpen, setSoporteOpen] = useState(false);

  const [moviles, setMoviles] = useState<Movil[]>([]);
  const [tiposMovil, setTiposMovil] = useState<string[]>(TIPOS_BASE);
  const [modalMovil, setModalMovil] = useState(false);
  const [origenAlertaProcesado, setOrigenAlertaProcesado] = useState(false);
  const [movilEditando, setMovilEditando] = useState<Movil | null>(null);
  const [form, setForm] = useState<FormMovil>(formInicial);

  const [fotos, setFotos] = useState<File[]>([]);
  const [tarjetaPropiedad, setTarjetaPropiedad] = useState<File[]>([]);
  const [soatDocument, setSoatDocument] = useState<File | null>(null);
  const [tecnomecanicaDocument, setTecnomecanicaDocument] =
    useState<File | null>(null);
  const [policyAllRiskDocument, setPolicyAllRiskDocument] =
    useState<File | null>(null);
  const [policyRCDocument, setPolicyRCDocument] = useState<File | null>(null);
  const [rentalContractDocument, setRentalContractDocument] =
    useState<File | null>(null);
  const [extraDocFile1, setExtraDocFile1] = useState<File | null>(null);
  const [extraDocFile2, setExtraDocFile2] = useState<File | null>(null);
  const [extraDocFile3, setExtraDocFile3] = useState<File | null>(null);
  const [extraDocFile4, setExtraDocFile4] = useState<File | null>(null);

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

  const logo = String(cliente?.logoUrl || DEFAULT_LOGO);

  const mostrarMensaje = (
    textoMensaje: string,
    tipo: "ok" | "error" = "ok",
  ) => {
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
        if (snap.exists()) {
          const data = snap.data() as ClienteData;
          setCliente(data);
          setForm((actual) => ({
            ...actual,
            codigoHabilitacion: texto(
              data.codigoHabilitacion,
              data.CodigoHabilitacion,
            ),
            ips: texto(
              data.ips,
              data.IPS,
              data.razonSocial,
              data.nombreComercial,
            ),
          }));
        }
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
    cargarMoviles();
    cargarTiposMovil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const cargarMoviles = async () => {
    if (!clienteId) return;
    try {
      const q = query(
        collection(db, "clientes", clienteId, "moviles"),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      setMoviles(
        snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<Movil, "id">),
        })),
      );
    } catch (error) {
      console.error("Error cargando móviles:", error);
      setMoviles([]);
    }
  };

  const cargarTiposMovil = async () => {
    if (!clienteId) return;
    try {
      const snap = await getDocs(
        collection(db, "clientes", clienteId, "tiposMoviles"),
      );
      const personalizados = snap.docs.map((item) => item.id);
      setTiposMovil(
        Array.from(new Set([...TIPOS_BASE, ...personalizados])).sort(),
      );
    } catch {
      setTiposMovil(TIPOS_BASE);
    }
  };


  useEffect(() => {
    const movilId =
      searchParams.get("movilId") ||
      searchParams.get("vehiculoId") ||
      searchParams.get("idMovil");
    const abrir = searchParams.get("abrir");

    const debeAbrirMovil = abrir === "movil" || searchParams.get("origen") === "alertaMovil";

    if (!movilId || !debeAbrirMovil || origenAlertaProcesado || moviles.length === 0) {
      return;
    }

    const idLimpio = movilId.replace(/^moviles_/, "").replace(/^vehiculos_/, "");
    const movilEncontrado = moviles.find((item) => item.id === movilId || item.id === idLimpio);

    if (!movilEncontrado) {
      mostrarMensaje(
        "La alerta abrió Ubicaciones, pero no se encontró el móvil puntual. Revisa que la alerta tenga el campo movilId correcto.",
        "error",
      );
      setOrigenAlertaProcesado(true);
      return;
    }

    setOrigenAlertaProcesado(true);
    abrirEditarMovil(movilEncontrado);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, moviles, origenAlertaProcesado]);

  const abrirCrearMovil = () => {
    setMovilEditando(null);
    setForm({
      ...formInicial,
      codigoHabilitacion: texto(
        cliente?.codigoHabilitacion,
        cliente?.CodigoHabilitacion,
      ),
      ips: texto(
        cliente?.ips,
        cliente?.IPS,
        cliente?.razonSocial,
        cliente?.nombreComercial,
      ),
    });
    setFotos([]);
    setTarjetaPropiedad([]);
    setSoatDocument(null);
    setTecnomecanicaDocument(null);
    setPolicyAllRiskDocument(null);
    setPolicyRCDocument(null);
    setRentalContractDocument(null);
    setExtraDocFile1(null);
    setExtraDocFile2(null);
    setExtraDocFile3(null);
    setExtraDocFile4(null);
    setModalMovil(true);
  };

  const abrirEditarMovil = (movil: Movil) => {
    setMovilEditando(movil);
    setForm({
      nombre: movil.nombre || "",
      denominacion: movil.denominacion || "",
      placa: movil.placa || "",
      modelo: movil.modelo || "",
      kilometrajeInicial: String(movil.kilometrajeInicial || ""),
      tipo: movil.tipo || "",
      codigoHabilitacion:
        movil.codigoHabilitacion ||
        texto(cliente?.codigoHabilitacion, cliente?.CodigoHabilitacion),
      ips:
        movil.ips ||
        texto(
          cliente?.ips,
          cliente?.IPS,
          cliente?.razonSocial,
          cliente?.nombreComercial,
        ),
      estado: movil.estado || "Activo",
      soatCompany: movil.soatCompany || "",
      soatExpiry: movil.soatExpiry || "",
      tecnomecanicaExpiry: movil.tecnomecanicaExpiry || "",
      policyAllRiskCompany: movil.policyAllRiskCompany || "",
      policyAllRiskExpiry: movil.policyAllRiskExpiry || "",
      policyRCCompany: movil.policyRCCompany || "",
      policyRCExpiry: movil.policyRCExpiry || "",
      rentalContractExpiry: movil.rentalContractExpiry || "",
      gpsCompany: movil.gpsCompany || "",
      gpsExpiry: movil.gpsExpiry || "",
      extraDocName1: movil.extras?.[0]?.nombre || "",
      extraDocExpiry1: movil.extras?.[0]?.vencimiento || "",
      extraDocName2: movil.extras?.[1]?.nombre || "",
      extraDocExpiry2: movil.extras?.[1]?.vencimiento || "",
      extraDocName3: movil.extras?.[2]?.nombre || "",
      extraDocExpiry3: movil.extras?.[2]?.vencimiento || "",
      extraDocName4: movil.extras?.[3]?.nombre || "",
      extraDocExpiry4: movil.extras?.[3]?.vencimiento || "",
    });
    setFotos([]);
    setTarjetaPropiedad([]);
    setSoatDocument(null);
    setTecnomecanicaDocument(null);
    setPolicyAllRiskDocument(null);
    setPolicyRCDocument(null);
    setRentalContractDocument(null);
    setExtraDocFile1(null);
    setExtraDocFile2(null);
    setExtraDocFile3(null);
    setExtraDocFile4(null);
    setModalMovil(true);
  };

  const quitarImagenExistente = (
    campo: "fotos" | "tarjetaPropiedad",
    index: number,
  ) => {
    setMovilEditando((actual) => {
      if (!actual) return actual;
      const lista = Array.isArray(actual[campo])
        ? ([...(actual[campo] || [])] as ArchivoGuardado[])
        : [];
      lista.splice(index, 1);
      return { ...actual, [campo]: lista };
    });
  };

  const quitarDocumentoExistente = (
    campo:
      | "soatDocument"
      | "tecnomecanicaDocument"
      | "policyAllRiskDocument"
      | "policyRCDocument"
      | "rentalContractDocument",
  ) => {
    setMovilEditando((actual) =>
      actual ? { ...actual, [campo]: undefined } : actual,
    );
  };

  const quitarExtraExistente = (index: number) => {
    setMovilEditando((actual) => {
      if (!actual) return actual;
      const extras = [...(actual.extras || [])];
      extras[index] = { ...(extras[index] || {}), archivo: undefined };
      return { ...actual, extras };
    });
  };

  const eliminarMovil = async (movil: Movil) => {
    if (!clienteId) return;
    const confirmar = window.confirm(
      `¿Eliminar el móvil "${movil.nombre || movil.placa || "seleccionado"}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "clientes", clienteId, "moviles", movil.id));
      await deleteDoc(doc(db, "clientes", clienteId, "alertas", `moviles_${movil.id}`)).catch(() => null);
      await cargarMoviles();
      mostrarMensaje("Móvil eliminado correctamente.");
    } catch (error) {
      console.error("Error eliminando móvil:", error);
      mostrarMensaje("No fue posible eliminar el móvil.", "error");
    }
  };

  const cerrarSesion = async () => {
    await signOut(auth);
    window.localStorage.removeItem("clienteSesion");
    router.replace("/login_users");
  };

  const validarArchivos = () => {
    for (const file of fotos) {
      if (!archivoValido(file, "imagen"))
        return `Foto inválida: ${file.name}. Usa JPG/PNG máximo 1 MB.`;
    }
    for (const file of tarjetaPropiedad) {
      if (!archivoValido(file, "imagen"))
        return `Tarjeta inválida: ${file.name}. Usa JPG/PNG máximo 1 MB.`;
    }

    const documentos = [
      soatDocument,
      tecnomecanicaDocument,
      policyAllRiskDocument,
      policyRCDocument,
      rentalContractDocument,
      extraDocFile1,
      extraDocFile2,
      extraDocFile3,
      extraDocFile4,
    ];

    for (const file of documentos) {
      if (file && !archivoValido(file, "documento"))
        return `Documento inválido: ${file.name}. Usa PDF/imagen máximo 5 MB.`;
    }

    return "";
  };

  const guardarMovil = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clienteId) return;

    if (!form.nombre.trim() || !form.placa.trim()) {
      mostrarMensaje("Nombre del móvil y placa son obligatorios.", "error");
      return;
    }

    const errorArchivos = validarArchivos();
    if (errorArchivos) {
      mostrarMensaje(errorArchivos, "error");
      return;
    }

    setGuardando(true);
    setProgresoGuardado(2);
    setTextoGuardado("Preparando guardado...");
    setProgresoArchivos({});

    try {
      const refMovil = movilEditando
        ? doc(db, "clientes", clienteId, "moviles", movilEditando.id)
        : await addDoc(collection(db, "clientes", clienteId, "moviles"), {
            createdAt: serverTimestamp(),
          });

      const movilId = refMovil.id;
      const totalArchivos =
        fotos.length +
        tarjetaPropiedad.length +
        [
          soatDocument,
          tecnomecanicaDocument,
          policyAllRiskDocument,
          policyRCDocument,
          rentalContractDocument,
          extraDocFile1,
          extraDocFile2,
          extraDocFile3,
          extraDocFile4,
        ].filter(Boolean).length;

      let archivosTerminados = 0;
      const actualizarProgresoGeneral = (avanceArchivo = 0) => {
        if (totalArchivos === 0) {
          setProgresoGuardado(55);
          return;
        }
        const avance =
          ((archivosTerminados + avanceArchivo / 100) / totalArchivos) * 78;
        setProgresoGuardado(Math.min(85, Math.round(5 + avance)));
      };

      const subirConProgreso = async (
        carpeta: string,
        file: File,
        etiqueta: string,
      ) => {
        setTextoGuardado(`Cargando ${etiqueta}: ${file.name}`);
        const clave = `${carpeta}-${file.name}`;
        const archivo = await subirArchivo(
          clienteId,
          movilId,
          carpeta,
          file,
          (porcentaje) => {
            setProgresoArchivos((actual) => ({
              ...actual,
              [clave]: porcentaje,
            }));
            actualizarProgresoGeneral(porcentaje);
          },
        );
        archivosTerminados += 1;
        actualizarProgresoGeneral(100);
        return archivo;
      };

      const fotosSubidas: ArchivoGuardado[] = [];
      for (const file of fotos) {
        fotosSubidas.push(
          await subirConProgreso("fotos", file, "foto del móvil"),
        );
      }

      const tarjetaSubida: ArchivoGuardado[] = [];
      for (const file of tarjetaPropiedad) {
        tarjetaSubida.push(
          await subirConProgreso(
            "tarjetaPropiedad",
            file,
            "tarjeta de propiedad",
          ),
        );
      }

      const soatSubido = soatDocument
        ? await subirConProgreso("soat", soatDocument, "SOAT")
        : undefined;
      const tecnoSubido = tecnomecanicaDocument
        ? await subirConProgreso(
            "tecnomecanica",
            tecnomecanicaDocument,
            "tecnomecánica",
          )
        : undefined;
      const allRiskSubido = policyAllRiskDocument
        ? await subirConProgreso(
            "polizaTodoRiesgo",
            policyAllRiskDocument,
            "póliza todo riesgo",
          )
        : undefined;
      const rcSubido = policyRCDocument
        ? await subirConProgreso("polizaRC", policyRCDocument, "póliza RC")
        : undefined;
      const rentalSubido = rentalContractDocument
        ? await subirConProgreso(
            "contratoArrendamiento",
            rentalContractDocument,
            "contrato de arrendamiento",
          )
        : undefined;

      const extraFiles = [
        extraDocFile1,
        extraDocFile2,
        extraDocFile3,
        extraDocFile4,
      ];
      const extrasAnteriores = movilEditando?.extras || [];
      const extras: ExtraDocumento[] = [];

      for (let i = 0; i < 4; i++) {
        const nombre = form[`extraDocName${i + 1}` as keyof FormMovil] || "";
        const vencimiento =
          form[`extraDocExpiry${i + 1}` as keyof FormMovil] || "";
        const archivo = extraFiles[i]
          ? await subirConProgreso(
              `extras/documento_${i + 1}`,
              extraFiles[i] as File,
              `documento extra ${i + 1}`,
            )
          : extrasAnteriores[i]?.archivo;

        extras.push({ nombre, vencimiento, archivo });
      }

      const payload: Omit<Movil, "id"> = {
        nombre: form.nombre.trim(),
        denominacion: form.denominacion.trim(),
        placa: form.placa.trim().toUpperCase(),
        modelo: form.modelo.trim(),
        kilometrajeInicial: form.kilometrajeInicial,
        tipo: form.tipo,
        codigoHabilitacion: form.codigoHabilitacion,
        ips: form.ips,
        estado: form.estado,
        fotos: [...(movilEditando?.fotos || []), ...fotosSubidas],
        tarjetaPropiedad: [
          ...(movilEditando?.tarjetaPropiedad || []),
          ...tarjetaSubida,
        ],
        soatCompany: form.soatCompany.trim(),
        soatExpiry: form.soatExpiry,
        soatDocument: soatSubido || movilEditando?.soatDocument || {},
        tecnomecanicaExpiry: form.tecnomecanicaExpiry,
        tecnomecanicaDocument:
          tecnoSubido || movilEditando?.tecnomecanicaDocument || {},
        policyAllRiskCompany: form.policyAllRiskCompany.trim(),
        policyAllRiskExpiry: form.policyAllRiskExpiry,
        policyAllRiskDocument:
          allRiskSubido || movilEditando?.policyAllRiskDocument || {},
        policyRCCompany: form.policyRCCompany.trim(),
        policyRCExpiry: form.policyRCExpiry,
        policyRCDocument: rcSubido || movilEditando?.policyRCDocument || {},
        rentalContractExpiry: form.rentalContractExpiry,
        rentalContractDocument:
          rentalSubido || movilEditando?.rentalContractDocument || {},
        gpsCompany: form.gpsCompany.trim(),
        gpsExpiry: form.gpsExpiry,
        extras,
        updatedAt: serverTimestamp(),
      };

      setTextoGuardado("Guardando información del móvil...");
      setProgresoGuardado(88);
      await setDoc(refMovil, limpiarUndefined(payload), { merge: true });

      setTextoGuardado("Revisando alertas de vencimiento...");
      setProgresoGuardado(94);
      const vencimientosAlerta = construirAlertasVencimientoMovil(form);
      const vencidos = vencimientosAlerta.filter((item) => item.tipoAlerta === "VENCIDO");
      const porVencer = vencimientosAlerta.filter((item) => item.tipoAlerta === "POR_VENCER");
      const alertaRef = doc(db, "clientes", clienteId, "alertas", `moviles_${movilId}`);

      if (vencimientosAlerta.length > 0) {
        const alertaExistente = await getDoc(alertaRef);
        await setDoc(
          alertaRef,
          limpiarUndefined({
            categoria: "alertas moviles",
            tipo: "MOVIL_VENCIMIENTOS",
            activo: true,
            movilId,
            movilNombre: form.nombre.trim(),
            placa: form.placa.trim().toUpperCase(),
            denominacion: form.denominacion.trim(),
            totalAlertas: vencimientosAlerta.length,
            vencidos: vencidos.length,
            porVencer: porVencer.length,
            diasUmbral: DIAS_ALERTA_MOVILES,
            vencimientosDetalle: vencimientosAlerta,
            mensaje:
              vencidos.length > 0
                ? `Móvil con ${vencidos.length} documento(s) vencido(s).`
                : `Móvil con ${porVencer.length} vencimiento(s) próximos en ${DIAS_ALERTA_MOVILES} días o menos.`,
            fechaGenerada: alertaExistente.exists()
              ? alertaExistente.data().fechaGenerada || serverTimestamp()
              : serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );
      } else {
        await deleteDoc(alertaRef).catch(() => null);
      }

      setProgresoGuardado(98);
      await cargarMoviles();
      setProgresoGuardado(100);
      setTextoGuardado("Guardado correctamente.");
      setModalMovil(false);
      mostrarMensaje(
        movilEditando
          ? "Móvil actualizado correctamente."
          : "Móvil creado correctamente.",
      );
    } catch (error) {
      console.error("Error guardando móvil:", error);
      mostrarMensaje("No fue posible guardar el móvil.", "error");
    } finally {
      setGuardando(false);
      window.setTimeout(() => {
        setProgresoGuardado(0);
        setTextoGuardado("");
        setProgresoArchivos({});
      }, 900);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f5fa] flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-xl border border-slate-100 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-semibold text-slate-600">
            Cargando ubicaciones...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f5fa] text-slate-700">
      {guardando && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/40 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-xl text-indigo-700">
                ⏳
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-800">
                  Guardando móvil
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  {textoGuardado || "Cargando información y archivos..."}
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                {progresoGuardado}%
              </span>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 transition-all"
                style={{ width: `${Math.max(progresoGuardado, 4)}%` }}
              />
            </div>

            {Object.keys(progresoArchivos).length > 0 && (
              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
                {Object.entries(progresoArchivos)
                  .slice(-8)
                  .map(([nombre, porcentaje]) => (
                    <div key={nombre} className="rounded-xl bg-white px-3 py-2">
                      <div className="flex justify-between gap-2 text-[10px] font-bold text-slate-500">
                        <span className="truncate">{nombre}</span>
                        <span>{porcentaje}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-center text-[11px] font-bold text-amber-700">
              No cierres esta ventana mientras finaliza la carga.
            </p>
          </div>
        </div>
      )}

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
              <p className="mt-2 text-[11px] font-medium text-white/45">Portal clientes</p>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto py-5 text-sm font-semibold ${menuCollapsed ? "px-2" : "px-4"}`}>
            <Link
              href="/dashboard"
              title="Inicio"
              className={`flex items-center rounded-2xl px-4 py-3 transition ${menuCollapsed ? "justify-center" : "gap-3"} ${
                pathname === "/dashboard" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {menuCollapsed ? "I" : "Inicio"}
            </Link>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setConfigOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/empresa") || pathname.startsWith("/configuraciones/usuarios") || pathname.startsWith("/configuraciones/ubicaciones")
                    ? "bg-white/10 text-white"
                    : "text-white/80"
                }`}
                title="1. Configuraciones"
              >
                <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{configOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && configOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/empresa" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/empresa" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.1 Empresa</Link>
                  <Link href="/configuraciones/usuarios" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/usuarios" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.2 Usuarios y Roles</Link>
                  <Link href="/configuraciones/ubicaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/ubicaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>1.3 Móviles y Bodegas</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOperativaOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/autoevaluacion") || pathname.startsWith("/configuraciones/asignaciones") ? "bg-white/10 text-white" : "text-white/80"
                }`}
                title="2. Área operativa"
              >
                <span>{menuCollapsed ? "2" : "2. Área operativa"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{operativaOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && operativaOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/autoevaluacion" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/autoevaluacion" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>2.1 Autoevaluación General</Link>
                  <Link href="/configuraciones/asignaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/asignaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>2.2 Asignaciones a Móviles</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMovilesOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${
                  pathname.startsWith("/configuraciones/verificaciones") || pathname.startsWith("/configuraciones/mantenimientos") || pathname.startsWith("/configuraciones/infracciones") ? "bg-white/10 text-white" : "text-white/80"
                }`}
                title="3. Móviles"
              >
                <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{movilesOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && movilesOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/verificaciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/verificaciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.1 Verificación diaria</Link>
                  <Link href="/configuraciones/mantenimientos" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/mantenimientos" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.2 Programación de Mantenimientos</Link>
                  <Link href="/configuraciones/infracciones" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/infracciones" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>3.3 Gestión de Infracciones</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setTareasOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${pathname.startsWith("/configuraciones/tareas") ? "bg-white/10 text-white" : "text-white/80"}`}
                title="4. Tareas"
              >
                <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{tareasOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && tareasOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/tareas" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/tareas" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>4.1 Programar tareas</Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSoporteOpen((actual) => !actual)}
                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 ${menuCollapsed ? "justify-center" : "justify-between gap-3"} ${pathname.startsWith("/configuraciones/soportea") ? "bg-white/10 text-white" : "text-white/80"}`}
                title="5. Soporte"
              >
                <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                {!menuCollapsed && <span className="text-xs text-white/45">{soporteOpen ? "▲" : "▼"}</span>}
              </button>
              {!menuCollapsed && soporteOpen && (
                <div className="space-y-1 rounded-3xl bg-white/5 p-2">
                  <Link href="/configuraciones/soportea" className={`block rounded-2xl px-4 py-3 text-sm transition ${pathname === "/configuraciones/soportea" ? "bg-white text-indigo-700 shadow-lg shadow-black/10" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>5.1 Solicitar un soporte</Link>
                </div>
              )}
            </div>
          </nav>

          {!menuCollapsed && (
            <div className="border-t border-white/10 p-4 text-[11px] text-white/40">
              Un producto de Famiasistir
              <br />
              Desarrollado por Printserp SAS
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

        <div className="space-y-6 px-4 pb-10 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">
              Configuraciones
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-800">
              Ubicaciones
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Gestión inicial de móviles. Primero creamos el modal de
              crear/editar móvil.
            </p>
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
            <div className="border-b border-slate-100 p-5 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-black text-slate-800">Lista de móviles</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Crea, consulta y edita la información principal de cada móvil.
                </p>
              </div>
              <button
                type="button"
                onClick={abrirCrearMovil}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-500"
              >
                Crear/Editar Móviles
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-black">Nombre</th>
                    <th className="px-5 py-4 font-black">Placa</th>
                    <th className="px-5 py-4 font-black">Denominación</th>
                    <th className="px-5 py-4 font-black">Kilometraje</th>
                    <th className="px-5 py-4 font-black">Tipo</th>
                    <th className="px-5 py-4 font-black">Estado</th>
                    <th className="px-5 py-4 font-black">Vista previa</th>
                    <th className="px-5 py-4 font-black">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {moviles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-10 text-center text-sm font-semibold text-slate-400"
                      >
                        Aún no hay móviles creados.
                      </td>
                    </tr>
                  ) : (
                    moviles.map((movil) => (
                      <tr key={movil.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-black text-slate-800">
                          {movil.nombre || "N/A"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {movil.placa || "N/A"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {movil.denominacion || "N/A"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {movil.kilometrajeInicial || "N/A"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {movil.tipo || "N/A"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                              movil.estado === "Inactivo"
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {movil.estado || "Activo"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {movil.fotos?.[0]?.url ? (
                            <a
                              href={movil.fotos[0].url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={movil.fotos[0].url}
                                alt="Móvil"
                                className="h-14 w-20 rounded-xl object-cover"
                              />
                            </a>
                          ) : (
                            <span className="text-slate-400">Sin foto</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditarMovil(movil)}
                              className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarMovil(movil)}
                              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {modalMovil && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-t-3xl bg-[#f4f5fa] shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Ubicaciones
                </p>
                <h3 className="text-lg font-black text-slate-800 sm:text-xl">
                  {movilEditando
                    ? `Editar móvil${movilEditando.nombre ? ` - ${movilEditando.nombre}` : ""}`
                    : "Crear móvil"}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Formulario responsive para móvil, tablet y escritorio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMovil(false)}
                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={guardarMovil}
              className="flex-1 overflow-y-auto p-4 sm:p-6"
            >
              {movilEditando && (
                <div className="mb-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                    <div className="flex flex-wrap gap-2 lg:col-span-3">
                      <button
                        type="button"
                        className="rounded-xl bg-red-50 px-4 py-2 text-xs font-black text-red-700"
                      >
                        Mantenimiento
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700"
                      >
                        Asignación
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-black text-amber-700"
                      >
                        Autoevaluación
                      </button>
                    </div>
                    <Campo label="Estado">
                      <div className="flex items-center gap-3">
                        <select
                          value={form.estado}
                          onChange={(event) =>
                            setForm((actual) => ({
                              ...actual,
                              estado: event.target.value as
                                | "Activo"
                                | "Inactivo",
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Inactivo">Inactivo</option>
                        </select>
                        <span
                          className={`h-4 w-4 animate-pulse rounded-full ${form.estado === "Activo" ? "bg-emerald-500" : "bg-red-500"}`}
                        />
                      </div>
                    </Campo>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                <SeccionModal titulo="Información Básica">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Campo label="Nombre del móvil">
                      <input
                        required
                        value={form.nombre}
                        onChange={(e) =>
                          setForm({ ...form, nombre: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Denominación">
                      <input
                        value={form.denominacion}
                        onChange={(e) =>
                          setForm({ ...form, denominacion: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Placa">
                      <input
                        required
                        value={form.placa}
                        onChange={(e) =>
                          setForm({ ...form, placa: e.target.value })
                        }
                        className="input uppercase"
                      />
                    </Campo>
                    <Campo label="Modelo">
                      <input
                        value={form.modelo}
                        onChange={(e) =>
                          setForm({ ...form, modelo: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Kilometraje inicial">
                      <input
                        type="number"
                        min="0"
                        value={form.kilometrajeInicial}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            kilometrajeInicial: e.target.value,
                          })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Tipo">
                      <select
                        value={form.tipo}
                        onChange={(e) =>
                          setForm({ ...form, tipo: e.target.value })
                        }
                        className="input"
                      >
                        <option value="">Seleccione...</option>
                        {tiposMovil.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Código habilitación">
                      <input
                        value={form.codigoHabilitacion}
                        readOnly
                        className="input bg-slate-50 text-slate-400"
                      />
                    </Campo>
                    <Campo label="IPS">
                      <input
                        value={form.ips}
                        readOnly
                        className="input bg-slate-50 text-slate-400"
                      />
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="Multimedia">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Campo label="Fotos de la móvil (jpeg/png máx 1MB)">
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg"
                        onChange={(e) =>
                          setFotos(Array.from(e.target.files || []))
                        }
                        className="input"
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {fotos.length
                          ? `${fotos.length} archivo(s) nuevo(s) seleccionado(s)`
                          : "Sin nuevos archivos"}
                      </p>
                      {movilEditando?.fotos?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {movilEditando.fotos.map((archivo, index) => (
                            <MiniaturaExistente
                              key={`${archivo.url || archivo.nombre}-foto-${index}`}
                              archivo={archivo}
                              onQuitar={() =>
                                quitarImagenExistente("fotos", index)
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                    </Campo>
                    <Campo label="Tarjeta de propiedad (jpeg/png máx 1MB)">
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg"
                        onChange={(e) =>
                          setTarjetaPropiedad(Array.from(e.target.files || []))
                        }
                        className="input"
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {tarjetaPropiedad.length
                          ? `${tarjetaPropiedad.length} archivo(s) nuevo(s) seleccionado(s)`
                          : "Sin nuevos archivos"}
                      </p>
                      {movilEditando?.tarjetaPropiedad?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {movilEditando.tarjetaPropiedad.map(
                            (archivo, index) => (
                              <MiniaturaExistente
                                key={`${archivo.url || archivo.nombre}-tarjeta-${index}`}
                                archivo={archivo}
                                onQuitar={() =>
                                  quitarImagenExistente(
                                    "tarjetaPropiedad",
                                    index,
                                  )
                                }
                              />
                            ),
                          )}
                        </div>
                      ) : null}
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="Información SOAT">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Campo label="Compañía SOAT">
                      <input
                        value={form.soatCompany}
                        onChange={(e) =>
                          setForm({ ...form, soatCompany: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Documento SOAT">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) =>
                          setSoatDocument(e.target.files?.[0] || null)
                        }
                        className="input"
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {nombreArchivo(soatDocument)}
                      </p>
                      <ArchivoExistente
                        archivo={movilEditando?.soatDocument}
                        etiqueta="Ver SOAT cargado"
                        onQuitar={() =>
                          quitarDocumentoExistente("soatDocument")
                        }
                      />
                    </Campo>
                    <Campo label="Vencimiento SOAT">
                      <input
                        type="date"
                        value={form.soatExpiry}
                        onChange={(e) =>
                          setForm({ ...form, soatExpiry: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="Tecnomecánica">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Campo label="Vencimiento tecnomecánica">
                      <input
                        type="date"
                        value={form.tecnomecanicaExpiry}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            tecnomecanicaExpiry: e.target.value,
                          })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Documento tecnomecánica">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) =>
                          setTecnomecanicaDocument(e.target.files?.[0] || null)
                        }
                        className="input"
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {nombreArchivo(tecnomecanicaDocument)}
                      </p>
                      <ArchivoExistente
                        archivo={movilEditando?.tecnomecanicaDocument}
                        etiqueta="Ver tecnomecánica cargada"
                        onQuitar={() =>
                          quitarDocumentoExistente("tecnomecanicaDocument")
                        }
                      />
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="Póliza Todo Riesgo">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Campo label="Compañía">
                      <input
                        value={form.policyAllRiskCompany}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            policyAllRiskCompany: e.target.value,
                          })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Póliza todo riesgo">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) =>
                          setPolicyAllRiskDocument(e.target.files?.[0] || null)
                        }
                        className="input"
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {nombreArchivo(policyAllRiskDocument)}
                      </p>
                      <ArchivoExistente
                        archivo={movilEditando?.policyAllRiskDocument}
                        etiqueta="Ver póliza todo riesgo"
                        onQuitar={() =>
                          quitarDocumentoExistente("policyAllRiskDocument")
                        }
                      />
                    </Campo>
                    <Campo label="Vencimiento">
                      <input
                        type="date"
                        value={form.policyAllRiskExpiry}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            policyAllRiskExpiry: e.target.value,
                          })
                        }
                        className="input"
                      />
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="Póliza de Responsabilidad Civil">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Campo label="Compañía póliza RC">
                      <input
                        value={form.policyRCCompany}
                        onChange={(e) =>
                          setForm({ ...form, policyRCCompany: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Documento póliza RC">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) =>
                          setPolicyRCDocument(e.target.files?.[0] || null)
                        }
                        className="input"
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {nombreArchivo(policyRCDocument)}
                      </p>
                      <ArchivoExistente
                        archivo={movilEditando?.policyRCDocument}
                        etiqueta="Ver póliza RC"
                        onQuitar={() =>
                          quitarDocumentoExistente("policyRCDocument")
                        }
                      />
                    </Campo>
                    <Campo label="Vencimiento póliza RC">
                      <input
                        type="date"
                        value={form.policyRCExpiry}
                        onChange={(e) =>
                          setForm({ ...form, policyRCExpiry: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="Contrato de Arrendamiento">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Campo label="Documento contrato">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) =>
                          setRentalContractDocument(e.target.files?.[0] || null)
                        }
                        className="input"
                      />
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {nombreArchivo(rentalContractDocument)}
                      </p>
                      <ArchivoExistente
                        archivo={movilEditando?.rentalContractDocument}
                        etiqueta="Ver contrato cargado"
                        onQuitar={() =>
                          quitarDocumentoExistente("rentalContractDocument")
                        }
                      />
                    </Campo>
                    <Campo label="Vencimiento contrato">
                      <input
                        type="date"
                        value={form.rentalContractExpiry}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            rentalContractExpiry: e.target.value,
                          })
                        }
                        className="input"
                      />
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="GPS">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo label="Compañía GPS">
                      <input
                        value={form.gpsCompany}
                        onChange={(e) =>
                          setForm({ ...form, gpsCompany: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                    <Campo label="Vencimiento GPS">
                      <input
                        type="date"
                        value={form.gpsExpiry}
                        onChange={(e) =>
                          setForm({ ...form, gpsExpiry: e.target.value })
                        }
                        className="input"
                      />
                    </Campo>
                  </div>
                </SeccionModal>

                <SeccionModal titulo="Extras">
                  <p className="mb-4 text-xs font-semibold text-slate-500">
                    Puedes subir hasta 4 documentos con nombre personalizable y
                    fecha de vencimiento.
                  </p>
                  <div className="space-y-4">
                    {[
                      [1, extraDocFile1, setExtraDocFile1],
                      [2, extraDocFile2, setExtraDocFile2],
                      [3, extraDocFile3, setExtraDocFile3],
                      [4, extraDocFile4, setExtraDocFile4],
                    ].map(([numero, file, setter]) => (
                      <div
                        key={String(numero)}
                        className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-3"
                      >
                        <Campo label={`Nombre documento ${numero}`}>
                          <input
                            value={
                              form[`extraDocName${numero}` as keyof FormMovil]
                            }
                            onChange={(e) =>
                              setForm({
                                ...form,
                                [`extraDocName${numero}`]: e.target.value,
                              } as FormMovil)
                            }
                            placeholder={
                              Number(numero) === 1 ? "Ej: Manual" : ""
                            }
                            className="input"
                          />
                        </Campo>
                        <Campo label={`Archivo documento ${numero}`}>
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(e) =>
                              (setter as (value: File | null) => void)(
                                e.target.files?.[0] || null,
                              )
                            }
                            className="input"
                          />
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {nombreArchivo(file as File | null)}
                          </p>
                          <ArchivoExistente
                            archivo={
                              movilEditando?.extras?.[Number(numero) - 1]
                                ?.archivo
                            }
                            etiqueta={`Ver documento ${numero} cargado`}
                            onQuitar={() =>
                              quitarExtraExistente(Number(numero) - 1)
                            }
                          />
                        </Campo>
                        <Campo label={`Vencimiento documento ${numero}`}>
                          <input
                            type="date"
                            value={
                              form[`extraDocExpiry${numero}` as keyof FormMovil]
                            }
                            onChange={(e) =>
                              setForm({
                                ...form,
                                [`extraDocExpiry${numero}`]: e.target.value,
                              } as FormMovil)
                            }
                            className="input"
                          />
                        </Campo>
                      </div>
                    ))}
                  </div>
                </SeccionModal>
              </div>

              {guardando && (
                <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs font-black text-indigo-700">
                    <span>{textoGuardado || "Guardando móvil..."}</span>
                    <span>{progresoGuardado}%</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${Math.max(progresoGuardado, 4)}%` }}
                    />
                  </div>
                  {Object.keys(progresoArchivos).length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {Object.entries(progresoArchivos)
                        .slice(-6)
                        .map(([nombre, porcentaje]) => (
                          <div
                            key={nombre}
                            className="rounded-xl bg-white px-3 py-2"
                          >
                            <div className="flex justify-between gap-2 text-[10px] font-bold text-slate-500">
                              <span className="truncate">{nombre}</span>
                              <span>{porcentaje}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${porcentaje}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] font-semibold text-indigo-600/80">
                    No cierres esta ventana mientras finaliza la carga de
                    archivos.
                  </p>
                </div>
              )}

              <div className="sticky bottom-0 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setModalMovil(false)}
                    className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {guardando ? "Guardando..." : "Guardar Móvil"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.65rem 0.8rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: rgb(51 65 85);
          outline: none;
        }
        .input:focus {
          border-color: rgb(99 102 241);
          box-shadow: 0 0 0 4px rgb(224 231 255);
        }
      `}</style>
    </main>
  );
}

export default function UbicacionesPage() {
  return (
    <Suspense fallback={null}>
      <UbicacionesPageContent />
    </Suspense>
  );
}
