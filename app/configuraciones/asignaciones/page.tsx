"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
  representanteLegal?: string;
  RepresentanteLegal?: string;
  [key: string]: unknown;
};

type MovilFirestore = {
  nombre?: string;
  movilNombre?: string;
  denominacion?: string;
  placa?: string;
  modelo?: string;
  tipo?: string;
  status?: string;
  estado?: string;
  fotos?: unknown;
  fotoUrl?: string;
  imagenUrl?: string;
  [key: string]: unknown;
};

type MovilActivo = {
  id: string;
  nombre: string;
  denominacion: string;
  placa: string;
  modelo: string;
  tipo: string;
  estado: string;
  fotoUrl: string;
};

type CategoriaAutoevaluacion = {
  categoria: string;
  totalItems: number;
  diligenciados: number;
  porcentaje: number;
  productos?: AsignacionBodegaMovil[];
};

type AutoevaluacionProductoBodega = {
  id: string;
  categoria: string;
  producto: string;
  tipo: string;
  stockMinimo: string;
  stockMaximo: string;
  asociados: AutoevaluacionAsociadoBodega[];
};

type AutoevaluacionAsociadoBodega = {
  id: string;
  codigoBarras: string;
  codigoPrincipal: string;
  categoria: string;
  producto: string;
  tipo: string;
  gestionado: boolean;
  asignado?: boolean;
  asignadoMovilId?: string;
  asignadoMovilNombre?: string;
  datos?: Record<string, unknown>;
};

type AsignacionBodegaMovil = {
  id: string;
  codigoBarras: string;
  codigoPrincipal: string;
  categoria: string;
  producto: string;
  tipo: string;
  productoId: string;
  asociadoId?: string;
  gestionado: boolean;
  codigoEscaneado?: string;
  fechaGestion?: unknown;
  usado?: boolean;
  motivoUso?: string;
  fechaUso?: unknown;
  fechaAsignacion?: unknown;
};

type UsuarioCliente = {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  tipoFuncionario: string;
  rol: string;
  estado: string;
  fotoUrl?: string;
};

type PersonalAsignadoMovil = UsuarioCliente & {
  fechaAsignacion?: unknown;
};

type UbicacionMovil = {
  lat: number;
  lng: number;
  precision?: number;
  fecha?: unknown;
  usuarioId?: string;
  usuarioNombre?: string;
};


const DEFAULT_LOGO = "/logo.png";
const DEFAULT_MOVIL_IMAGE =
  "data:image/svg+xml,%3Csvg width='600' height='360' viewBox='0 0 600 360' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='600' height='360' rx='36' fill='%23F1F5F9'/%3E%3Cpath d='M149 215h302l-28-72c-5-13-18-22-32-22H209c-14 0-27 9-32 22l-28 72Z' fill='%23CBD5E1'/%3E%3Cpath d='M181 215h238v37H181v-37Z' fill='%2394A3B8'/%3E%3Ccircle cx='221' cy='260' r='28' fill='%23475569'/%3E%3Ccircle cx='379' cy='260' r='28' fill='%23475569'/%3E%3Crect x='234' y='139' width='132' height='48' rx='10' fill='%23E2E8F0'/%3E%3Cpath d='M292 150h16v12h12v16h-12v12h-16v-12h-12v-16h12v-12Z' fill='%234F46E5'/%3E%3Ctext x='300' y='323' text-anchor='middle' font-family='Arial' font-size='22' font-weight='700' fill='%2364758B'%3ESin foto%3C/text%3E%3C/svg%3E";

function getStoredClienteSesion(): ClienteSesion | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("clienteSesion");
    return raw ? (JSON.parse(raw) as ClienteSesion) : null;
  } catch {
    return null;
  }
}

function normalizarTexto(value: unknown, fallback = "") {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function extraerFotoPrincipal(value: MovilFirestore): string {
  if (typeof value.fotoUrl === "string" && value.fotoUrl.trim())
    return value.fotoUrl;
  if (typeof value.imagenUrl === "string" && value.imagenUrl.trim())
    return value.imagenUrl;

  const fotos = value.fotos;

  if (Array.isArray(fotos)) {
    for (const item of fotos) {
      if (typeof item === "string" && item.trim()) return item;
      if (item && typeof item === "object") {
        const url = (item as any).url || (item as any).downloadURL;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }

  if (fotos && typeof fotos === "object") {
    for (const v of Object.values(fotos as Record<string, any>)) {
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object") {
        const url = v.url || v.downloadURL;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }

  return "";
}

function esMovilActivo(data: MovilFirestore) {
  const estado = normalizarTexto(data.estado || data.status, "Activo")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return estado === "activo" || estado === "active";
}

function calcularPorcentaje(total: number, diligenciados: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((diligenciados / total) * 100)));
}

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

function numeroUbicacion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const limpio = value.trim().replace(",", ".");
    const numero = Number(limpio);
    if (Number.isFinite(numero)) return numero;
  }
  return null;
}

function extraerUbicacionMovil(data: Record<string, unknown>): UbicacionMovil | null {
  const candidatos = [
    data.ubicacion,
    data.ultimaUbicacion,
    data.ubicacionActual,
    data.location,
    data.geolocation,
    data.coordenadas,
    data.gps,
  ].filter(Boolean) as Record<string, unknown>[];

  candidatos.push(data);

  for (const origen of candidatos) {
    const lat =
      numeroUbicacion(origen.lat) ??
      numeroUbicacion(origen.latitude) ??
      numeroUbicacion(origen.latitud);
    const lng =
      numeroUbicacion(origen.lng) ??
      numeroUbicacion(origen.lon) ??
      numeroUbicacion(origen.longitude) ??
      numeroUbicacion(origen.longitud);

    if (lat !== null && lng !== null) {
      return {
        lat,
        lng,
        precision:
          numeroUbicacion(origen.precision) ??
          numeroUbicacion(origen.accuracy) ??
          undefined,
        fecha:
          origen.updatedAt ||
          origen.actualizadoAt ||
          origen.fecha ||
          origen.timestamp ||
          data.ubicacionActualizadaAt ||
          data.ultimaUbicacionAt ||
          data.updatedAt,
        usuarioId: normalizarTexto(origen.usuarioId || data.usuarioId, ""),
        usuarioNombre: normalizarTexto(origen.usuarioNombre || data.usuarioNombre, ""),
      };
    }
  }

  return null;
}

function mapearMovil(id: string, data: MovilFirestore): MovilActivo | null {
  if (!esMovilActivo(data)) return null;

  return {
    id,
    nombre: normalizarTexto(
      data.nombre || data.movilNombre,
      "Móvil sin nombre",
    ),
    denominacion: normalizarTexto(data.denominacion, "Sin denominación"),
    placa: normalizarTexto(data.placa, "Sin placa"),
    modelo: normalizarTexto(data.modelo, "Sin modelo"),
    tipo: normalizarTexto(data.tipo, "Sin tipo"),
    estado: normalizarTexto(data.estado || data.status, "Activo"),
    fotoUrl: extraerFotoPrincipal(data) || DEFAULT_MOVIL_IMAGE,
  };
}

export default function AsignacionesPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [clienteSesion, setClienteSesion] = useState<ClienteSesion | null>(
    null,
  );
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [operativaOpen, setOperativaOpen] = useState(true);
  const [movilesOpen, setMovilesOpen] = useState(false);
  const [tareasOpen, setTareasOpen] = useState(false);
  const [soporteOpen, setSoporteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cargandoMoviles, setCargandoMoviles] = useState(true);
  const [moviles, setMoviles] = useState<MovilActivo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [mensajeLogo, setMensajeLogo] = useState("");
  const [movilSeleccionado, setMovilSeleccionado] =
    useState<MovilActivo | null>(null);
  const [cargandoCategorias, setCargandoCategorias] = useState(false);
  const [categoriasAutoevaluacion, setCategoriasAutoevaluacion] = useState<
    CategoriaAutoevaluacion[]
  >([]);
  const [modalBodegaOpen, setModalBodegaOpen] = useState(false);
  const [cargandoBodega, setCargandoBodega] = useState(false);
  const [productosBodega, setProductosBodega] = useState<
    AutoevaluacionProductoBodega[]
  >([]);
  const [busquedaBodega, setBusquedaBodega] = useState("");
  const [categoriaBodegaActiva, setCategoriaBodegaActiva] = useState("");
  const [guardandoAsignacionBodega, setGuardandoAsignacionBodega] =
    useState("");
  const [modalPersonalOpen, setModalPersonalOpen] = useState(false);
  const [usuariosPersonal, setUsuariosPersonal] = useState<UsuarioCliente[]>(
    [],
  );
  const [personalAsignado, setPersonalAsignado] = useState<
    PersonalAsignadoMovil[]
  >([]);
  const [cargandoPersonal, setCargandoPersonal] = useState(false);
  const [busquedaPersonal, setBusquedaPersonal] = useState("");
  const [guardandoAsignacionPersonal, setGuardandoAsignacionPersonal] =
    useState("");
  const [modalAsignadosCategoria, setModalAsignadosCategoria] =
    useState<CategoriaAutoevaluacion | null>(null);
  const [ubicacionMovil, setUbicacionMovil] = useState<UbicacionMovil | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapMarkerRef = useRef<any>(null);

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

  const movilesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return moviles;

    return moviles.filter((movil) =>
      [movil.nombre, movil.placa, movil.denominacion, movil.modelo, movil.tipo]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [moviles, busqueda]);

  const progresoGeneralAutoevaluacion = useMemo(() => {
    const total = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.totalItems,
      0,
    );
    const diligenciados = categoriasAutoevaluacion.reduce(
      (acumulado, item) => acumulado + item.diligenciados,
      0,
    );
    return calcularPorcentaje(total, diligenciados);
  }, [categoriasAutoevaluacion]);

  const categoriasBodega = useMemo(() => {
    const categorias = Array.from(
      new Set<string>(productosBodega.map((item) => item.categoria)),
    ).sort((a, b) => a.localeCompare(b, "es"));
    return categorias;
  }, [productosBodega]);

  const productosBodegaFiltrados = useMemo(() => {
    const texto = busquedaBodega.trim().toLowerCase();
    return productosBodega.filter((item) => {
      const coincideCategoria =
        !categoriaBodegaActiva || item.categoria === categoriaBodegaActiva;
      const coincideTexto =
        !texto ||
        [
          item.categoria,
          item.producto,
          item.tipo,
          ...item.asociados.map((asociado) => asociado.codigoBarras),
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto);
      return coincideCategoria && coincideTexto;
    });
  }, [productosBodega, busquedaBodega, categoriaBodegaActiva]);

  const codigosPersonalAsignado = useMemo(
    () => new Set(personalAsignado.map((usuario) => usuario.id)),
    [personalAsignado],
  );

  const usuariosPersonalFiltrados = useMemo(() => {
    const texto = busquedaPersonal.trim().toLowerCase();
    return usuariosPersonal.filter(
      (usuario) =>
        !texto ||
        [
          usuario.nombres,
          usuario.apellidos,
          usuario.email,
          usuario.tipoFuncionario,
          usuario.rol,
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto),
    );
  }, [usuariosPersonal, busquedaPersonal]);

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
          if (snap.exists()) setCliente(snap.data() as ClienteData);
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
      setCargandoMoviles(false);
      return;
    }

    setCargandoMoviles(true);

    const refMoviles = collection(
      db,
      "clientes",
      clienteSesion.clienteId,
      "moviles",
    );

    const unsubscribe = onSnapshot(
      refMoviles,
      (snapshot) => {
        const data = snapshot.docs
          .map((item) => mapearMovil(item.id, item.data() as MovilFirestore))
          .filter(Boolean) as MovilActivo[];

        data.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setMoviles(data);
        setCargandoMoviles(false);
      },
      (error) => {
        console.error("Error cargando móviles:", error);
        setCargandoMoviles(false);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId]);

  useEffect(() => {
    mapInstanceRef.current = null;
    mapMarkerRef.current = null;
  }, [movilSeleccionado?.id]);

  useEffect(() => {
    const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";

    if (!clienteId || !movilSeleccionado?.id) {
      setCategoriasAutoevaluacion([]);
      setCargandoCategorias(false);
      return;
    }

    setCargandoCategorias(true);
    let activo = true;
    let unsubscribeAsignaciones: (() => void) | null = null;

    const cargarCategoriasBase = async () => {
      try {
        const refBase = collection(
          db,
          "clientes",
          clienteId,
          "AUTOEVALUACION_GENERAL",
        );
        const snapBase = await getDocs(
          query(refBase, orderBy("categoria", "asc")),
        );
        const categoriasBase = Array.from(
          new Set(
            snapBase.docs.map((documento) =>
              normalizarTexto(documento.data().categoria, "Sin categoría"),
            ),
          ),
        ).sort((a, b) => a.localeCompare(b, "es"));

        const refAsignaciones = collection(
          db,
          "clientes",
          clienteId,
          "moviles",
          movilSeleccionado.id,
          "ASIGNACIONES_BODEGA",
        );

        unsubscribeAsignaciones = onSnapshot(
          refAsignaciones,
          (snapshot) => {
            if (!activo) return;

            const asignaciones = snapshot.docs.map((documento) => {
              const data = documento.data() as Record<string, unknown>;
              return {
                id: documento.id,
                codigoBarras: normalizarTexto(
                  data.codigoBarras || documento.id,
                  documento.id,
                ),
                codigoPrincipal: normalizarTexto(data.codigoPrincipal, ""),
                categoria: normalizarTexto(data.categoria, "Sin categoría"),
                producto: normalizarTexto(data.producto, "Sin producto"),
                tipo: normalizarTexto(data.tipo, "-"),
                productoId: normalizarTexto(data.productoId, ""),
                asociadoId: normalizarTexto(data.asociadoId, ""),
                gestionado: Boolean(
                  data.gestionado ||
                  data.diligenciado ||
                  data.estadoGestion === "diligenciado" ||
                  data.estadoGestion === "usado" ||
                  data.usado
                ),
                codigoEscaneado: normalizarTexto(
                  data.codigoEscaneado || data.codigoLeido || "",
                  "",
                ),
                fechaGestion: data.fechaGestion,
                usado: Boolean(data.usado || data.estadoUso === "usado" || data.estadoGestion === "usado"),
                motivoUso: normalizarTexto(data.motivoUso || data.motivo || data.motivoBaja, ""),
                fechaUso: data.fechaUso,
                fechaAsignacion: data.fechaAsignacion,
              } as AsignacionBodegaMovil;
            });

            const agrupadas = new Map<string, AsignacionBodegaMovil[]>();
            asignaciones.forEach((item) => {
              const lista = agrupadas.get(item.categoria) || [];
              lista.push(item);
              agrupadas.set(item.categoria, lista);
            });

            const nombresCategorias = Array.from(
              new Set([...categoriasBase, ...Array.from(agrupadas.keys())]),
            ).sort((a, b) => a.localeCompare(b, "es"));

            const categorias = nombresCategorias.map((categoria) => {
              const productos = (agrupadas.get(categoria) || []).sort((a, b) =>
                a.producto.localeCompare(b.producto, "es"),
              );
              const totalItems = productos.length;
              const diligenciados = productos.filter(
                (item) => item.gestionado,
              ).length;
              return {
                categoria,
                totalItems,
                diligenciados,
                productos,
                porcentaje: calcularPorcentaje(totalItems, diligenciados),
              } as CategoriaAutoevaluacion;
            });

            setCategoriasAutoevaluacion(categorias);
            setCargandoCategorias(false);
          },
          (error) => {
            console.error("Error cargando asignaciones de bodega:", error);
            if (!activo) return;
            setCategoriasAutoevaluacion(
              categoriasBase.map((categoria) => ({
                categoria,
                totalItems: 0,
                diligenciados: 0,
                productos: [],
                porcentaje: 0,
              })),
            );
            setCargandoCategorias(false);
          },
        );
      } catch (error) {
        console.error(
          "Error cargando categorías base de autoevaluación:",
          error,
        );
        if (activo) {
          setCategoriasAutoevaluacion([]);
          setCargandoCategorias(false);
        }
      }
    };

    cargarCategoriasBase();

    return () => {
      activo = false;
      if (unsubscribeAsignaciones) unsubscribeAsignaciones();
    };
  }, [clienteSesion?.clienteId, clienteSesion?.nit, movilSeleccionado?.id]);

  useEffect(() => {
    const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";

    if (!clienteId || !movilSeleccionado?.id) {
      setPersonalAsignado([]);
      return;
    }

    const refPersonal = collection(
      db,
      "clientes",
      clienteId,
      "moviles",
      movilSeleccionado.id,
      "PERSONAL_ASIGNADO",
    );

    const unsubscribe = onSnapshot(refPersonal, (snapshot) => {
      const data = snapshot.docs.map((documento) => {
        const item = documento.data() as Record<string, unknown>;
        return {
          id: documento.id,
          nombres: normalizarTexto(item.nombres, ""),
          apellidos: normalizarTexto(item.apellidos, ""),
          email: normalizarTexto(item.email, ""),
          tipoFuncionario: normalizarTexto(item.tipoFuncionario, "Sin tipo"),
          rol: normalizarTexto(item.rol, "Sin rol"),
          estado: normalizarTexto(item.estado, "ACTIVO"),
          fotoUrl: normalizarTexto(item.fotoUrl, ""),
          fechaAsignacion: item.fechaAsignacion,
        } as PersonalAsignadoMovil;
      });
      data.sort((a, b) =>
        `${a.nombres} ${a.apellidos}`.localeCompare(
          `${b.nombres} ${b.apellidos}`,
          "es",
        ),
      );
      setPersonalAsignado(data);
    });

    return () => unsubscribe();
  }, [clienteSesion?.clienteId, clienteSesion?.nit, movilSeleccionado?.id]);

  useEffect(() => {
    const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";

    if (!clienteId || !movilSeleccionado?.id) {
      setUbicacionMovil(null);
      return;
    }

    const refMovil = doc(db, "clientes", clienteId, "moviles", movilSeleccionado.id);

    const unsubscribe = onSnapshot(
      refMovil,
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
        setUbicacionMovil(extraerUbicacionMovil(data));
      },
      (error) => {
        console.error("Error cargando ubicación de la móvil:", error);
        setUbicacionMovil(null);
      },
    );

    return () => unsubscribe();
  }, [clienteSesion?.clienteId, clienteSesion?.nit, movilSeleccionado?.id]);

  useEffect(() => {
    if (!movilSeleccionado || !mapContainerRef.current) return;

    const inicializarMapa = () => {
      const googleMaps = (window as any).google?.maps;
      if (!googleMaps || !mapContainerRef.current) return;

      const centro = ubicacionMovil
        ? { lat: ubicacionMovil.lat, lng: ubicacionMovil.lng }
        : { lat: 4.710989, lng: -74.072092 };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new googleMaps.Map(mapContainerRef.current, {
          center: centro,
          zoom: ubicacionMovil ? 16 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
      } else {
        mapInstanceRef.current.setCenter(centro);
        mapInstanceRef.current.setZoom(ubicacionMovil ? 16 : 12);
      }

      if (ubicacionMovil) {
        if (!mapMarkerRef.current) {
          mapMarkerRef.current = new googleMaps.Marker({
            position: centro,
            map: mapInstanceRef.current,
            title: movilSeleccionado.nombre,
          });
        } else {
          mapMarkerRef.current.setPosition(centro);
          mapMarkerRef.current.setMap(mapInstanceRef.current);
          mapMarkerRef.current.setTitle(movilSeleccionado.nombre);
        }
      } else if (mapMarkerRef.current) {
        mapMarkerRef.current.setMap(null);
      }
    };

    (window as any).initAllMaps = inicializarMapa;

    const scriptId = "google-maps-asignaciones-script";
    const existente = document.getElementById(
      scriptId,
    ) as HTMLScriptElement | null;

    if ((window as any).google?.maps) {
      window.setTimeout(inicializarMapa, 80);
      return;
    }

    if (existente) {
      existente.addEventListener("load", inicializarMapa, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=AIzaSyAVp1ZPKd_HkrlwO5hD6njsn6h_reqaCEw&callback=initAllMaps&libraries=places";
    document.body.appendChild(script);
  }, [movilSeleccionado, ubicacionMovil]);


  useEffect(() => {
    if (!modalPersonalOpen) return;

    const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";
    if (!clienteId) return;

    let activo = true;

    const cargarUsuariosPersonal = async () => {
      setCargandoPersonal(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "clientes", clienteId, "usuarios"),
            orderBy("createdAt", "desc"),
          ),
        );
        const data = snap.docs.map((documento) => {
          const item = documento.data() as Record<string, unknown>;
          return {
            id: documento.id,
            nombres: normalizarTexto(item.nombres, ""),
            apellidos: normalizarTexto(item.apellidos, ""),
            email: normalizarTexto(item.email, ""),
            tipoFuncionario: normalizarTexto(item.tipoFuncionario, "Sin tipo"),
            rol: normalizarTexto(item.rol, "Sin rol"),
            estado: normalizarTexto(item.estado, "ACTIVO"),
            fotoUrl: normalizarTexto(item.fotoUrl, ""),
          } as UsuarioCliente;
        });
        data.sort((a, b) =>
          `${a.nombres} ${a.apellidos}`.localeCompare(
            `${b.nombres} ${b.apellidos}`,
            "es",
          ),
        );
        if (activo) setUsuariosPersonal(data);
      } catch (error) {
        console.error("Error cargando usuarios para asignar:", error);
        if (activo) setUsuariosPersonal([]);
      } finally {
        if (activo) setCargandoPersonal(false);
      }
    };

    cargarUsuariosPersonal();

    return () => {
      activo = false;
    };
  }, [modalPersonalOpen, clienteSesion?.clienteId, clienteSesion?.nit]);

  useEffect(() => {
    if (!modalBodegaOpen) return;

    const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";
    if (!clienteId) return;

    let activo = true;

    const cargarProductosBodega = async () => {
      setCargandoBodega(true);
      try {
        const asignacionesSnap = await getDocs(
          collectionGroup(db, "ASIGNACIONES_BODEGA"),
        );
        const codigosAsignados = new Map<
          string,
          { movilId: string; movilNombre: string }
        >();
        asignacionesSnap.docs.forEach((documento) => {
          const data = documento.data() as Record<string, unknown>;
          const codigo = normalizarTexto(
            data.codigoBarras || documento.id,
            documento.id,
          );
          if (!codigo) return;
          codigosAsignados.set(codigo, {
            movilId: normalizarTexto(data.movilId, ""),
            movilNombre: normalizarTexto(data.movilNombre, "Móvil asignada"),
          });
        });

        const refBase = collection(
          db,
          "clientes",
          clienteId,
          "AUTOEVALUACION_GENERAL",
        );
        const snap = await getDocs(query(refBase, orderBy("categoria", "asc")));
        const productos = await Promise.all(
          snap.docs.map(async (documento) => {
            const data = documento.data() as Record<string, unknown>;
            const categoria = normalizarTexto(data.categoria, "Sin categoría");
            const producto = normalizarTexto(data.producto, "Sin producto");
            const tipo = normalizarTexto(data.tipo, "-");
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
            const asociados = asociadosSnap.docs.map((asociadoDoc) => {
              const asociado = asociadoDoc.data() as Record<string, unknown>;
              return {
                id: asociadoDoc.id,
                codigoBarras: normalizarTexto(
                  asociado.codigoBarras || asociadoDoc.id,
                  asociadoDoc.id,
                ),
                codigoPrincipal: normalizarTexto(asociado.codigoPrincipal, ""),
                categoria: normalizarTexto(
                  asociado.categoria || categoria,
                  categoria,
                ),
                producto: normalizarTexto(
                  asociado.producto || producto,
                  producto,
                ),
                tipo: normalizarTexto(asociado.tipo || tipo, tipo),
                gestionado: Boolean(
                  asociado.gestionado ||
                  asociado.diligenciado ||
                  asociado.estadoGestion === "diligenciado",
                ),
                asignado: codigosAsignados.has(
                  normalizarTexto(
                    asociado.codigoBarras || asociadoDoc.id,
                    asociadoDoc.id,
                  ),
                ),
                asignadoMovilId:
                  codigosAsignados.get(
                    normalizarTexto(
                      asociado.codigoBarras || asociadoDoc.id,
                      asociadoDoc.id,
                    ),
                  )?.movilId || "",
                asignadoMovilNombre:
                  codigosAsignados.get(
                    normalizarTexto(
                      asociado.codigoBarras || asociadoDoc.id,
                      asociadoDoc.id,
                    ),
                  )?.movilNombre || "",
                datos: (asociado.datos || {}) as Record<string, unknown>,
              } as AutoevaluacionAsociadoBodega;
            });

            return {
              id: documento.id,
              categoria,
              producto,
              tipo,
              stockMinimo: normalizarTexto(data.stockMinimo, "0"),
              stockMaximo: normalizarTexto(data.stockMaximo, "0"),
              asociados,
            } as AutoevaluacionProductoBodega;
          }),
        );

        if (activo) {
          setProductosBodega(productos);
          setCategoriaBodegaActiva(
            (actual) => actual || productos[0]?.categoria || "",
          );
        }
      } catch (error) {
        console.error("Error cargando productos de autoevaluación:", error);
        if (activo) setProductosBodega([]);
      } finally {
        if (activo) setCargandoBodega(false);
      }
    };

    cargarProductosBodega();

    return () => {
      activo = false;
    };
  }, [modalBodegaOpen, clienteSesion?.clienteId, clienteSesion?.nit]);

  const asignarProductoBodegaAMovil = async (
    producto: AutoevaluacionProductoBodega,
    asociado: AutoevaluacionAsociadoBodega,
  ) => {
    const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";
    if (!clienteId || !movilSeleccionado?.id) return;

    const codigo = asociado.codigoBarras || asociado.id;
    const idAsignacion = limpiarId(codigo) || asociado.id;

    setGuardandoAsignacionBodega(codigo);
    try {
      await setDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "moviles",
          movilSeleccionado.id,
          "ASIGNACIONES_BODEGA",
          idAsignacion,
        ),
        {
          codigoBarras: codigo,
          codigoPrincipal: asociado.codigoPrincipal || "",
          categoria: asociado.categoria || producto.categoria,
          producto: asociado.producto || producto.producto,
          tipo: asociado.tipo || producto.tipo,
          productoId: producto.id,
          asociadoId: asociado.id,
          movilId: movilSeleccionado.id,
          movilNombre: movilSeleccionado.nombre,
          gestionado: false,
          diligenciado: false,
          fechaAsignacion: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setProductosBodega((actual) =>
        actual.map((item) => ({
          ...item,
          asociados: item.asociados.map((asociadoItem) =>
            asociadoItem.codigoBarras === codigo
              ? {
                  ...asociadoItem,
                  asignado: true,
                  asignadoMovilId: movilSeleccionado.id,
                  asignadoMovilNombre: movilSeleccionado.nombre,
                }
              : asociadoItem,
          ),
        })),
      );
    } catch (error) {
      console.error("Error asignando producto a móvil:", error);
    } finally {
      setGuardandoAsignacionBodega("");
    }
  };

  const asignarPersonalAMovil = async (usuario: UsuarioCliente) => {
    const clienteId = clienteSesion?.clienteId || clienteSesion?.nit || "";
    if (!clienteId || !movilSeleccionado?.id) return;

    setGuardandoAsignacionPersonal(usuario.id);
    try {
      await setDoc(
        doc(
          db,
          "clientes",
          clienteId,
          "moviles",
          movilSeleccionado.id,
          "PERSONAL_ASIGNADO",
          usuario.id,
        ),
        {
          usuarioId: usuario.id,
          nombres: usuario.nombres || "",
          apellidos: usuario.apellidos || "",
          email: usuario.email || "",
          tipoFuncionario: usuario.tipoFuncionario || "",
          rol: usuario.rol || "",
          estado: usuario.estado || "ACTIVO",
          fotoUrl: usuario.fotoUrl || "",
          movilId: movilSeleccionado.id,
          movilNombre: movilSeleccionado.nombre,
          fechaAsignacion: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error asignando personal a móvil:", error);
    } finally {
      setGuardandoAsignacionPersonal("");
    }
  };

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

  const cerrarSesion = async () => {
    try {
      await signOut(auth);
      window.localStorage.removeItem("clienteSesion");
      router.replace("/login_users");
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    }
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
        className={`fixed inset-y-0 left-0 z-40 border-r border-white/10 bg-[#081126] text-white shadow-[0_20px_60px_rgba(2,6,23,0.35)] transition-all duration-300 lg:translate-x-0 ${
          menuCollapsed ? "lg:w-[86px]" : "lg:w-[270px]"
        } ${menuOpen ? "translate-x-0 w-[270px]" : "-translate-x-full w-[270px]"}`}
      >
        <div className="flex h-full flex-col">
          <div className={`border-b border-white/10 ${menuCollapsed ? "px-3 py-4" : "px-4 py-4"}`}>
            <div className="flex items-center gap-3">
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
                className="hidden h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-lg font-black text-white shadow-sm transition hover:bg-white/15 lg:grid"
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
                <label className="mt-2 block cursor-pointer text-[10px] font-black text-white/80 hover:text-white">
                  <input type="file" accept="image/*" onChange={cambiarLogo} className="hidden" />
                  {subiendoLogo ? "Subiendo logo..." : "Cambiar logo"}
                </label>
                {mensajeLogo && (
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-white/45">{mensajeLogo}</p>
                )}
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
              } ${pathname === "/dashboard" ? "bg-white text-[#312e81] shadow-lg" : "text-white/85 hover:bg-white/10"}`}
            >
              {menuCollapsed ? "I" : "Inicio"}
            </Link>

            <div className="mt-4 space-y-3">
              <div>
                <button
                  type="button"
                  onClick={() => setConfigOpen((actual) => !actual)}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                    pathname.startsWith("/configuraciones/empresa") ||
                    pathname.startsWith("/configuraciones/usuarios") ||
                    pathname.startsWith("/configuraciones/ubicaciones")
                      ? "bg-white/10 text-white"
                      : "text-white/85 hover:bg-white/10"
                  } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                  title="1. Configuraciones"
                  aria-expanded={configOpen}
                >
                  <span>{menuCollapsed ? "1" : "1. Configuraciones"}</span>
                  {!menuCollapsed && <span className="text-xs text-white/45">{configOpen ? "▴" : "▾"}</span>}
                </button>

                {configOpen && !menuCollapsed && (
                  <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-2">
                    <Link href="/configuraciones/empresa" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/empresa" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>1.1 Empresa</Link>
                    <Link href="/configuraciones/usuarios" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/usuarios" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>1.2 Usuarios y Roles</Link>
                    <Link href="/configuraciones/ubicaciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/ubicaciones" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>1.3 Móviles y Bodegas</Link>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setOperativaOpen((actual) => !actual)}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                    pathname.startsWith("/configuraciones/autoevaluacion") || pathname.startsWith("/configuraciones/asignaciones")
                      ? "bg-white/10 text-white"
                      : "text-white/85 hover:bg-white/10"
                  } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                  title="2. Área operativa"
                  aria-expanded={operativaOpen}
                >
                  <span>{menuCollapsed ? "2" : "2. Área operativa"}</span>
                  {!menuCollapsed && <span className="text-xs text-white/45">{operativaOpen ? "▴" : "▾"}</span>}
                </button>

                {operativaOpen && !menuCollapsed && (
                  <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-2">
                    <Link href="/configuraciones/autoevaluacion" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/autoevaluacion" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>2.1 Autoevaluación General</Link>
                    <Link href="/configuraciones/asignaciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/asignaciones" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>2.2 Asignaciones a Móviles</Link>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setMovilesOpen((actual) => !actual)}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                    pathname.startsWith("/configuraciones/verificaciones") || pathname.startsWith("/configuraciones/mantenimientos") || pathname.startsWith("/configuraciones/infracciones")
                      ? "bg-white/10 text-white"
                      : "text-white/85 hover:bg-white/10"
                  } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                  title="3. Móviles"
                  aria-expanded={movilesOpen}
                >
                  <span>{menuCollapsed ? "3" : "3. Móviles"}</span>
                  {!menuCollapsed && <span className="text-xs text-white/45">{movilesOpen ? "▴" : "▾"}</span>}
                </button>

                {movilesOpen && !menuCollapsed && (
                  <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-2">
                    <Link href="/configuraciones/verificaciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/verificaciones" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>3.1 Verificación diaria</Link>
                    <Link href="/configuraciones/mantenimientos" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/mantenimientos" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>3.2 Programación de Mantenimientos</Link>
                    <Link href="/configuraciones/infracciones" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/infracciones" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>3.3 Gestión de Infracciones</Link>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setTareasOpen((actual) => !actual)}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                    pathname.startsWith("/configuraciones/tareas") ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/10"
                  } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                  title="4. Tareas"
                  aria-expanded={tareasOpen}
                >
                  <span>{menuCollapsed ? "4" : "4. Tareas"}</span>
                  {!menuCollapsed && <span className="text-xs text-white/45">{tareasOpen ? "▴" : "▾"}</span>}
                </button>
                {tareasOpen && !menuCollapsed && (
                  <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-2">
                    <Link href="/configuraciones/tareas" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/tareas" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>4.1 Programar tareas</Link>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setSoporteOpen((actual) => !actual)}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-left transition ${
                    pathname.startsWith("/configuraciones/soportea") ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/10"
                  } ${menuCollapsed ? "justify-center" : "justify-between gap-3"}`}
                  title="5. Soporte"
                  aria-expanded={soporteOpen}
                >
                  <span>{menuCollapsed ? "5" : "5. Soporte"}</span>
                  {!menuCollapsed && <span className="text-xs text-white/45">{soporteOpen ? "▴" : "▾"}</span>}
                </button>
                {soporteOpen && !menuCollapsed && (
                  <div className="mt-2 space-y-1 rounded-3xl bg-white/5 p-2">
                    <Link href="/configuraciones/soportea" className={`block rounded-2xl px-4 py-3 transition ${pathname === "/configuraciones/soportea" ? "bg-white text-[#312e81] shadow-lg" : "text-white/75 hover:bg-white/10"}`}>5.1 Solicitar un soporte</Link>
                  </div>
                )}
              </div>
            </div>
          </nav>

          {!menuCollapsed && (
            <div className="border-t border-white/10 p-4 text-[11px] leading-5 text-white/35">
              Un producto de Famiasistir
              <br />
              Desarrollado por Printserp SAS
            </div>
          )}
        </div>
      </aside>

      <section className={menuCollapsed ? "lg:pl-[86px]" : "lg:pl-[270px]"}>
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
                onClick={cerrarSesion}
                className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Área Operativa / 2.2
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">
                  Asignación a móviles
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Selecciona una móvil activa para gestionar asignaciones de
                  autoevaluación y personal. Por ahora se muestra el inventario
                  de móviles activas creadas.
                </p>
              </div>

              <div className="w-full lg:w-80">
                <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Buscar móvil
                </label>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Nombre, placa, tipo..."
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white"
                />
              </div>
            </div>
          </section>

          <section>
            {cargandoMoviles ? (
              <div className="rounded-3xl border border-slate-100 bg-white px-6 py-12 text-center shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                <p className="text-sm font-black text-slate-600">
                  Cargando móviles activas...
                </p>
              </div>
            ) : moviles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-lg font-black text-slate-700">
                  No hay móviles activas
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Crea o activa una móvil desde Configuraciones / Ubicaciones.
                </p>
                <Link
                  href="/configuraciones/ubicaciones"
                  className="mt-5 inline-flex rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
                >
                  Ir a ubicaciones
                </Link>
              </div>
            ) : movilesFiltrados.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-lg font-black text-slate-700">
                  Sin resultados
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  No encontramos móviles activas con esa búsqueda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {movilesFiltrados.map((movil) => (
                  <article
                    key={movil.id}
                    className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_4px_22px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.10)]"
                  >
                    <div className="relative h-44 overflow-hidden bg-slate-100">
                      <img
                        src={movil.fotoUrl}
                        alt={movil.nombre}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                        Activa
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="min-h-[76px]">
                        <h3 className="line-clamp-1 text-base font-black text-slate-800">
                          {movil.nombre}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-400">
                          {movil.denominacion}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-700">
                            {movil.tipo}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                            {movil.placa}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMovilSeleccionado(movil)}
                        className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                      >
                        Gestionar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {movilSeleccionado && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-3 sm:p-5">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Gestión de móvil
                </p>
                <h3 className="mt-1 truncate text-xl font-black">
                  MÓVIL: {movilSeleccionado.nombre}
                </h3>
                <p className="truncate text-xs font-semibold text-white/75">
                  {movilSeleccionado.placa} · {movilSeleccionado.tipo}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMovilSeleccionado(null)}
                className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-5">
              <div className="grid gap-5 lg:grid-cols-[260px_1fr_300px]">
                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 shadow-sm">
                  <img
                    src={movilSeleccionado.fotoUrl}
                    alt={movilSeleccionado.nombre}
                    className="h-56 w-full object-cover"
                  />
                  <div className="p-4">
                    <h4 className="line-clamp-1 text-base font-black text-slate-800">
                      {movilSeleccionado.nombre}
                    </h4>
                    <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500">
                      <p>Denominación: {movilSeleccionado.denominacion}</p>
                      <p>Modelo: {movilSeleccionado.modelo}</p>
                      <p>Placa: {movilSeleccionado.placa}</p>
                      <p>Estado: {movilSeleccionado.estado}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                        Cumplimiento general
                      </p>
                      <h4 className="mt-1 text-lg font-black text-slate-800">
                        Autoevaluación y asignaciones
                      </h4>
                    </div>
                    <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                      {progresoGeneralAutoevaluacion}%
                    </span>
                  </div>

                  <div className="mt-5 h-7 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="flex h-full items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white transition-all"
                      style={{ width: `${progresoGeneralAutoevaluacion}%` }}
                    >
                      {progresoGeneralAutoevaluacion}%
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setModalBodegaOpen(true)}
                      className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                    >
                      Agregar de bodega
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalPersonalOpen(true)}
                      className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                    >
                      Agregar personal
                    </button>
                  </div>

                  <div className="mt-6">
                    <h5 className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Auto evaluación de {movilSeleccionado.nombre}
                    </h5>
                    {cargandoCategorias ? (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                        Cargando categorías de autoevaluación...
                      </div>
                    ) : categoriasAutoevaluacion.length === 0 ? (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                        Esta móvil aún no tiene productos asignados desde
                        bodega.
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {categoriasAutoevaluacion.map((item) => (
                          <div
                            key={item.categoria}
                            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-black text-slate-700">
                                {item.categoria}
                              </p>
                              <span className="shrink-0 text-xs font-black text-slate-400">
                                {item.porcentaje}%
                              </span>
                            </div>
                            <p className="mt-2 text-xs font-bold text-slate-400">
                              Total ítems: {item.totalItems}
                            </p>
                            <p className="text-xs font-bold text-slate-400">
                              Diligenciados: {item.diligenciados}
                            </p>
                            {item.productos && item.productos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setModalAsignadosCategoria(item)}
                                className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-sm ring-1 ring-indigo-100 transition hover:bg-indigo-50"
                              >
                                Ver asignados ({item.productos.length})
                              </button>
                            )}
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                              <div
                                className="h-full rounded-full bg-indigo-500 transition-all"
                                style={{ width: `${item.porcentaje}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
                  <h5 className="text-center text-sm font-black uppercase tracking-wide text-slate-600">
                    ¿Dónde está?
                  </h5>
                  <div
                    ref={mapContainerRef}
                    className="mt-3 h-56 overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  />

                  {ubicacionMovil ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                      <p>Ubicación activa registrada</p>
                      <p className="mt-1 font-mono text-[11px] text-emerald-800">
                        {ubicacionMovil.lat.toFixed(6)}, {ubicacionMovil.lng.toFixed(6)}
                      </p>
                      {ubicacionMovil.precision !== undefined && (
                        <p className="mt-1 text-[11px] text-emerald-700">
                          Precisión aprox: {Math.round(ubicacionMovil.precision)} m
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                      Esta móvil aún no ha reportado ubicación desde el dashboard del usuario.
                    </div>
                  )}

                  <div className="mt-5">
                    <h5 className="text-sm font-black uppercase tracking-wide text-slate-600">
                      Personal asignado
                    </h5>
                    {personalAsignado.length === 0 ? (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm font-bold text-slate-400">
                        Sin personal asignado
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {personalAsignado.map((usuario) => (
                          <div
                            key={usuario.id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3"
                          >
                            {usuario.fotoUrl ? (
                              <img
                                src={usuario.fotoUrl}
                                alt={usuario.nombres}
                                className="h-11 w-11 rounded-full object-cover"
                              />
                            ) : (
                              <div className="grid h-11 w-11 place-items-center rounded-full bg-sky-100 text-sm font-black text-sky-700">
                                {(usuario.nombres || usuario.email || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-700">
                                {usuario.nombres} {usuario.apellidos}
                              </p>
                              <p className="truncate text-xs font-bold text-slate-400">
                                {usuario.tipoFuncionario}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalBodegaOpen && movilSeleccionado && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                  Agregar de bodega
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-800">
                  Seleccionar producto para {movilSeleccionado.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalBodegaOpen(false)}
                className="w-fit rounded-2xl bg-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-300"
              >
                Cerrar
              </button>
            </div>

            <div className="grid max-h-[calc(92vh-82px)] overflow-hidden lg:grid-cols-[280px_1fr]">
              <aside className="max-h-[calc(92vh-82px)] overflow-y-auto border-r border-slate-100 bg-slate-50 p-4">
                <input
                  type="search"
                  value={busquedaBodega}
                  onChange={(event) => setBusquedaBodega(event.target.value)}
                  placeholder="Buscar categoría, producto o código..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-300"
                />

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setCategoriaBodegaActiva("")}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-xs font-black transition ${
                      !categoriaBodegaActiva
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Todas las categorías
                  </button>
                  {categoriasBodega.map((categoria) => (
                    <button
                      key={categoria}
                      type="button"
                      onClick={() => setCategoriaBodegaActiva(categoria)}
                      className={`w-full rounded-2xl px-4 py-3 text-left text-xs font-black transition ${
                        categoriaBodegaActiva === categoria
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {categoria}
                    </button>
                  ))}
                </div>
              </aside>

              <section className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
                {cargandoBodega ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">
                    Cargando autoevaluación...
                  </div>
                ) : productosBodegaFiltrados.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">
                    No hay productos asociados para mostrar.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {productosBodegaFiltrados.map((producto) => (
                      <article
                        key={producto.id}
                        className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">
                              {producto.categoria}
                            </p>
                            <h4 className="mt-1 text-base font-black text-slate-800">
                              {producto.producto}
                            </h4>
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              Tipo: {producto.tipo} · Asociados:{" "}
                              {producto.asociados.length}
                            </p>
                          </div>
                        </div>

                        {producto.asociados.length === 0 ? (
                          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-400">
                            Este producto no tiene códigos asociados guardados.
                          </div>
                        ) : (
                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {producto.asociados.map((asociado) => (
                              <div
                                key={asociado.id}
                                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                              >
                                <p className="truncate text-sm font-black text-slate-700">
                                  {asociado.producto}
                                </p>
                                <p className="mt-1 text-xs font-bold text-slate-400">
                                  Código: {asociado.codigoBarras}
                                </p>
                                {asociado.codigoPrincipal && (
                                  <p className="text-xs font-bold text-slate-400">
                                    Principal: {asociado.codigoPrincipal}
                                  </p>
                                )}
                                {asociado.asignado && (
                                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                                    Asignado a{" "}
                                    {asociado.asignadoMovilNombre ||
                                      "otra móvil"}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(asociado.asignado) ||
                                    guardandoAsignacionBodega ===
                                      asociado.codigoBarras
                                  }
                                  onClick={() =>
                                    asignarProductoBodegaAMovil(
                                      producto,
                                      asociado,
                                    )
                                  }
                                  className={`mt-3 w-full rounded-2xl px-4 py-2 text-xs font-black shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    asociado.asignado
                                      ? "bg-slate-300 text-slate-600 shadow-none"
                                      : "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-500"
                                  }`}
                                >
                                  {guardandoAsignacionBodega ===
                                  asociado.codigoBarras
                                    ? "Guardando..."
                                    : asociado.asignado
                                      ? "Ya asignado"
                                      : "Asignar a móvil"}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {modalPersonalOpen && movilSeleccionado && (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/55 p-3 sm:p-5">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-sky-500">
                  Agregar personal
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-800">
                  Seleccionar personal para {movilSeleccionado.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPersonalOpen(false)}
                className="w-fit rounded-2xl bg-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-300"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">
              <input
                type="search"
                value={busquedaPersonal}
                onChange={(event) => setBusquedaPersonal(event.target.value)}
                placeholder="Buscar usuario, cargo, rol o correo..."
                className="mb-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-300"
              />

              {cargandoPersonal ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">
                  Cargando usuarios...
                </div>
              ) : usuariosPersonalFiltrados.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">
                  No hay usuarios para mostrar.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {usuariosPersonalFiltrados.map((usuario) => {
                    const yaAsignado = codigosPersonalAsignado.has(usuario.id);
                    return (
                      <article
                        key={usuario.id}
                        className="rounded-3xl border border-slate-100 bg-slate-50 p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          {usuario.fotoUrl ? (
                            <img
                              src={usuario.fotoUrl}
                              alt={usuario.nombres}
                              className="h-14 w-14 rounded-full object-cover"
                            />
                          ) : (
                            <div className="grid h-14 w-14 place-items-center rounded-full bg-sky-100 text-lg font-black text-sky-700">
                              {(usuario.nombres || usuario.email || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-black text-slate-800">
                              {usuario.nombres} {usuario.apellidos}
                            </h4>
                            <p className="truncate text-xs font-bold text-slate-400">
                              {usuario.email}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-1 text-xs font-bold text-slate-500">
                          <p>Tipo: {usuario.tipoFuncionario}</p>
                          <p>Rol: {usuario.rol}</p>
                          <p>Estado: {usuario.estado}</p>
                        </div>

                        <button
                          type="button"
                          disabled={
                            yaAsignado ||
                            guardandoAsignacionPersonal === usuario.id
                          }
                          onClick={() => asignarPersonalAMovil(usuario)}
                          className={`mt-4 w-full rounded-2xl px-4 py-2 text-xs font-black shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            yaAsignado
                              ? "bg-slate-300 text-slate-600 shadow-none"
                              : "bg-sky-500 text-white shadow-sky-500/20 hover:bg-sky-400"
                          }`}
                        >
                          {guardandoAsignacionPersonal === usuario.id
                            ? "Guardando..."
                            : yaAsignado
                              ? "Ya asignado"
                              : "Asignar a móvil"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalAsignadosCategoria && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-3 sm:p-5">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-indigo-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/70">
                  Productos asignados
                </p>
                <h3 className="mt-1 truncate text-lg font-black">
                  {modalAsignadosCategoria.categoria}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/75">
                  Total ítems: {modalAsignadosCategoria.totalItems} ·
                  Diligenciados: {modalAsignadosCategoria.diligenciados}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalAsignadosCategoria(null)}
                className="w-fit rounded-2xl bg-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/25"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-5">
              {!modalAsignadosCategoria.productos ||
              modalAsignadosCategoria.productos.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-black text-slate-400">
                  Esta categoría aún no tiene productos asignados para esta
                  móvil.
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-slate-100">
                  <div className="grid grid-cols-[1.4fr_1fr_1fr_120px] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    <span>Producto</span>
                    <span>Código</span>
                    <span>Tipo</span>
                    <span>Estado</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {modalAsignadosCategoria.productos.map((producto) => (
                      <div
                        key={producto.id || producto.codigoBarras}
                        className="grid grid-cols-1 gap-2 px-4 py-4 text-sm sm:grid-cols-[1.4fr_1fr_1fr_120px] sm:items-center sm:gap-3"
                      >
                        <div>
                          <p className="font-black text-slate-800">
                            {producto.producto}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400 sm:hidden">
                            Código:{" "}
                            {producto.codigoBarras ||
                              producto.codigoPrincipal ||
                              "Sin código"}
                          </p>
                        </div>

                        <p className="hidden truncate text-xs font-black text-slate-500 sm:block">
                          {producto.codigoBarras ||
                            producto.codigoPrincipal ||
                            "Sin código"}
                        </p>

                        <p className="text-xs font-bold text-slate-500">
                          {producto.tipo || "Sin tipo"}
                        </p>

                        <div className="flex flex-col items-start gap-1 sm:items-end">
                          <span
                            className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                              producto.usado
                                ? "bg-rose-50 text-rose-700"
                                : producto.gestionado
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {producto.usado
                              ? "Usado"
                              : producto.gestionado
                                ? "Diligenciado"
                                : "Pendiente"}
                          </span>
                          {producto.usado && producto.motivoUso && (
                            <p className="max-w-[180px] text-[10px] font-bold text-rose-500 sm:text-right">
                              {producto.motivoUso}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
