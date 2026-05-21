"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

type Role = "ver" | "editar" | "admin";

type PermissionKey =
  | "verClientes"
  | "verPanelStaff"
  | "crearClientes"
  | "editarDatosPrincipales"
  | "editarDocumentos"
  | "verFacturacion"
  | "editarFacturacionFechaFactura"
  | "editarFacturacionFechaRadicacion"
  | "editarFacturacionValor"
  | "editarFacturacionEstado"
  | "editarFacturacionFechaPago"
  | "editarFacturacionMedio"
  | "gestionarPagos"
  | "verAlertasCartera"
  | "enviarCorreosCliente"
  | "enviarCorreosCartera";

type Permissions = Record<PermissionKey, boolean>;

type StaffUser = {
  id: string;
  nombre: string;
  telefono: string;
  rol: Role;
  permisos: Permissions;
  fechaRegistro?: string;
};

const permissionKeys: PermissionKey[] = [
  "verClientes",
  "verPanelStaff",
  "crearClientes",
  "editarDatosPrincipales",
  "editarDocumentos",
  "verFacturacion",
  "editarFacturacionFechaFactura",
  "editarFacturacionFechaRadicacion",
  "editarFacturacionValor",
  "editarFacturacionEstado",
  "editarFacturacionFechaPago",
  "editarFacturacionMedio",
  "gestionarPagos",
  "verAlertasCartera",
  "enviarCorreosCliente",
  "enviarCorreosCartera",
];

const permissionGroups: {
  title: string;
  icon: string;
  items: { key: PermissionKey; label: string }[];
}[] = [
  {
    title: "Navegación y acceso",
    icon: "🧭",
    items: [
      { key: "verClientes", label: "Puede entrar a Clientes" },
      { key: "verPanelStaff", label: "Puede entrar a Usuarios Staff" },
      { key: "crearClientes", label: "Puede crear clientes" },
    ],
  },
  {
    title: "Datos principales",
    icon: "🏢",
    items: [
      { key: "editarDatosPrincipales", label: "Puede editar Datos Principales" },
      { key: "editarDocumentos", label: "Puede editar Documentos" },
    ],
  },
  {
    title: "Facturación",
    icon: "🧾",
    items: [
      { key: "verFacturacion", label: "Puede ver Facturación" },
      { key: "editarFacturacionFechaFactura", label: "Puede editar Fecha Factura" },
      { key: "editarFacturacionFechaRadicacion", label: "Puede editar Fecha Radicación" },
      { key: "editarFacturacionValor", label: "Puede editar Valor Factura" },
      { key: "editarFacturacionEstado", label: "Puede editar Estado" },
      { key: "editarFacturacionFechaPago", label: "Puede editar Fecha Último Pago" },
      { key: "editarFacturacionMedio", label: "Puede editar Medio" },
      { key: "gestionarPagos", label: "Puede gestionar pagos / abonos" },
    ],
  },
  {
    title: "Cartera y correos",
    icon: "⚠️",
    items: [
      { key: "verAlertasCartera", label: "Puede ver Alertas de Cartera" },
      { key: "enviarCorreosCliente", label: "Puede enviar correo de acceso al cliente" },
      { key: "enviarCorreosCartera", label: "Puede enviar correo de cartera" },
    ],
  },
];

function getDefaultPermissionsByRole(role: Role | ""): Permissions {
  if (role === "admin") {
    return Object.fromEntries(permissionKeys.map((k) => [k, true])) as Permissions;
  }

  if (role === "editar") {
    return {
      verClientes: true,
      verPanelStaff: false,
      crearClientes: false,
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
      enviarCorreosCliente: false,
      enviarCorreosCartera: false,
    };
  }

  return {
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
}

function roleLabel(role: Role) {
  if (role === "admin") return "Control Total";
  if (role === "editar") return "Ver y Editar";
  return "Solo Ver";
}

function roleClass(role: Role) {
  if (role === "admin") return "bg-red-100 text-red-700 border-red-200";
  if (role === "editar") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-cyan-100 text-cyan-800 border-cyan-200";
}

function permissionSummary(permisos: Permissions) {
  const items: string[] = [];
  if (permisos.verPanelStaff) items.push("staff");
  if (permisos.crearClientes) items.push("Crear clientes");
  if (permisos.editarDatosPrincipales) items.push("Datos principales");
  if (permisos.editarDocumentos) items.push("Documentos");
  if (permisos.verFacturacion) items.push("Facturación");
  if (permisos.gestionarPagos) items.push("Pagos");
  if (permisos.verAlertasCartera) items.push("Cartera");
  if (permisos.enviarCorreosCliente) items.push("Correo acceso");
  if (permisos.enviarCorreosCartera) items.push("Correo cartera");
  return items;
}

const emptyForm = {
  nombre: "",
  telefono: "",
  rol: "" as Role | "",
  permisos: getDefaultPermissionsByRole("ver"),
};

export default function StaffPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      [s.nombre, s.telefono, roleLabel(s.rol)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [search, staff]);

  const stats = useMemo(() => {
    return {
      total: staff.length,
      admin: staff.filter((s) => s.rol === "admin").length,
      editar: staff.filter((s) => s.rol === "editar").length,
      ver: staff.filter((s) => s.rol === "ver").length,
    };
  }, [staff]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      try {
        const phone = currentUser.phoneNumber || "";
        const staffDoc = await getDoc(doc(db, "staff", phone));

        if (!staffDoc.exists()) {
          alert("Acceso denegado.");
          await signOut(auth);
          router.replace("/login");
          return;
        }

        const staffData = staffDoc.data();

        if (staffData.rol !== "admin") {
          alert("No tienes permisos para ingresar al panel de usuarios.");
          router.replace("/clientes");
          return;
        }

        await loadStaff();
      } catch (error) {
        console.error("Error validando acceso:", error);
        alert("Error validando acceso.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  async function loadStaff() {
    const snap = await getDocs(collection(db, "staff"));
    const rows: StaffUser[] = [];

    snap.forEach((d) => {
      const data = d.data();
      const rol = (data.rol || "ver") as Role;
      rows.push({
        id: d.id,
        nombre: data.nombre || "",
        telefono: data.telefono || d.id,
        rol,
        permisos: data.permisos || getDefaultPermissionsByRole(rol),
        fechaRegistro: data.fechaRegistro || "",
      });
    });

    rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setStaff(rows);
  }

  function openNewModal() {
    setEditingPhone(null);
    setForm(emptyForm);
    setMessage("");
    setModalOpen(true);
  }

  function openEditModal(item: StaffUser) {
    setEditingPhone(item.id);
    setForm({
      nombre: item.nombre,
      telefono: item.id,
      rol: item.rol,
      permisos: item.permisos || getDefaultPermissionsByRole(item.rol),
    });
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setMessage("");
  }

  function updateRole(role: Role | "") {
    setForm((prev) => ({
      ...prev,
      rol: role,
      permisos: editingPhone ? prev.permisos : getDefaultPermissionsByRole(role),
    }));
  }

  function togglePermission(key: PermissionKey) {
    setForm((prev) => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [key]: !prev.permisos[key],
      },
    }));
  }

  async function saveStaff() {
    const nombre = form.nombre.trim();
    const telefono = form.telefono.trim();
    const rol = form.rol;

    if (!nombre || !telefono || !rol) {
      setMessage("Por favor, completa todos los campos obligatorios.");
      return;
    }

    if (!telefono.startsWith("+")) {
      setMessage("El número debe incluir el código de país. Ejemplo: +57.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      nombre,
      telefono,
      rol,
      permisos: form.permisos,
      fechaRegistro:
        staff.find((s) => s.id === telefono)?.fechaRegistro || new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "staff", telefono), payload);
      await loadStaff();
      setModalOpen(false);
    } catch (error: any) {
      setMessage(`Error al guardar usuario: ${error?.message || "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeStaff(item: StaffUser) {
    if (item.id === user?.phoneNumber) {
      alert("No puedes eliminar tu propio usuario desde esta pantalla.");
      return;
    }

    const ok = confirm(`¿Estás seguro de eliminar el acceso a ${item.id}?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "staff", item.id));
      await loadStaff();
    } catch (error: any) {
      alert(`Error al eliminar: ${error?.message || "Error desconocido"}`);
    }
  }

  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-3xl border bg-white px-8 py-6 shadow-xl">
          <p className="text-sm font-bold text-slate-600">Cargando panel de staff...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Marthin"
                className="h-14 w-14 rounded-2xl object-contain ring-1 ring-slate-200"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">
                  Sistema Máster Marthin
                </p>
                <h1 className="text-2xl font-black tracking-tight text-slate-950">
                  Gestión de Usuarios Staff
                </h1>
                <p className="text-sm text-slate-500">
                  Control de accesos, roles y permisos específicos del panel maestro.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/clientes")}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 hover:bg-blue-100"
              >
                Ir a Clientes
              </button>
              <button
                onClick={logout}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat title="Usuarios registrados" value={stats.total} tone="blue" />
            <Stat title="Administradores" value={stats.admin} tone="red" />
            <Stat title="Editores" value={stats.editar} tone="amber" />
            <Stat title="Lectores" value={stats.ver} tone="cyan" />
          </section>
        </header>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black">Usuarios del sistema</h2>
              <p className="text-sm text-slate-500">
                Los usuarios se guardan en Firestore en la colección Staff.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, teléfono o rol..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-80"
              />
              <button
                onClick={openNewModal}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
              >
                + Añadir Usuario
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Nombre Completo</th>
                    <th className="px-5 py-4">Teléfono (ID)</th>
                    <th className="px-5 py-4">Rol Asignado</th>
                    <th className="px-5 py-4">Resumen Permisos</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                        No hay usuarios registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((item) => {
                      const summary = permissionSummary(item.permisos);
                      return (
                        <tr key={item.id} className="bg-white hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="font-black text-slate-900">{item.nombre}</div>
                            <div className="text-xs text-slate-400">
                              {item.fechaRegistro ? new Date(item.fechaRegistro).toLocaleDateString("es-CO") : ""}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-600">{item.id}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${roleClass(item.rol)}`}>
                              {roleLabel(item.rol)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {summary.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {summary.map((p) => (
                                  <span key={p} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">Sin permisos extra</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditModal(item)}
                                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => removeStaff(item)}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                              >
                                Eliminar
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
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
                  {editingPhone ? "Editar usuario" : "Nuevo usuario"}
                </p>
                <h3 className="text-xl font-black text-slate-950">
                  {editingPhone ? "Editar Usuario Staff" : "Añadir Usuario Staff"}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre Completo *">
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Juan Pérez"
                    className="input-staff"
                  />
                </Field>

                <Field label="Número de Teléfono *">
                  <input
                    value={form.telefono}
                    onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                    readOnly={!!editingPhone}
                    placeholder="+573001234567"
                    className="input-staff disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Debe incluir código de país. Este será su acceso de Login.
                  </p>
                </Field>

                <div className="md:col-span-2">
                  <Field label="Nivel de Permisos (Rol) *">
                    <select
                      value={form.rol}
                      onChange={(e) => updateRole(e.target.value as Role | "")}
                      className="input-staff"
                    >
                      <option value="">Selecciona un rol...</option>
                      <option value="ver">Solo Ver (Lector)</option>
                      <option value="editar">Ver y Editar (Editor)</option>
                      <option value="admin">Control Total (Administrador)</option>
                    </select>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      El rol pone una base general. Abajo puedes personalizar permisos específicos.
                    </p>
                  </Field>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                Tip: primero selecciona el rol. Luego ajusta manualmente los permisos que quieras activar o quitar.
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {permissionGroups.map((group) => (
                  <section key={group.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-4 text-sm font-black text-slate-900">
                      <span className="mr-2">{group.icon}</span>
                      {group.title}
                    </h4>

                    <div className="space-y-3">
                      {group.items.map((item) => (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100"
                        >
                          <span className="text-sm font-bold text-slate-700">{item.label}</span>
                          <input
                            type="checkbox"
                            checked={!!form.permisos[item.key]}
                            onChange={() => togglePermission(item.key)}
                            className="h-5 w-5 rounded border-slate-300 text-blue-600"
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {message && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                  {message}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={saveStaff}
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar Usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input-staff {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #dbe3ef;
          background: #f8fafc;
          padding: 0.8rem 1rem;
          font-size: 0.92rem;
          font-weight: 700;
          color: #0f172a;
          outline: none;
        }

        .input-staff:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18);
          background: #ffffff;
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Stat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "blue" | "red" | "amber" | "cyan";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
  };

  return (
    <div className={`rounded-3xl border px-5 py-4 ${colors[tone]}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
