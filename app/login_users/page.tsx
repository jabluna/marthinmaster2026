"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { collection, collectionGroup, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type ClienteFirestore = {
  nit?: string;
  razonSocial?: string;
  nombreComercial?: string;
  correoElectronico?: string;
  email?: string;
  estado?: string;
  activo?: boolean;
  [key: string]: unknown;
};

type ClienteValidado = {
  id: string;
  data: ClienteFirestore;
};

type UsuarioOperativoValidado = {
  id: string;
  clienteId: string;
  data: Record<string, any>;
};

const normalizarCorreo = (value: string) => value.trim().toLowerCase();

export default function LoginUsersPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guardarSesion, setGuardarSesion] = useState(true);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"error" | "ok">("error");
  const [cargando, setCargando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  const emailLimpio = useMemo(() => normalizarCorreo(email), [email]);

  const mensajeAccesoDenegado =
    "No se puede ingresar. Contacta al administrador.";

  const buscarClientePorCorreo = async (
    correo: string
  ): Promise<ClienteValidado | null> => {
    const clientesRef = collection(db, "clientes");

    const consultaCorreoElectronico = query(
      clientesRef,
      where("correoElectronico", "==", correo),
      limit(1)
    );

    const resultadoCorreoElectronico = await getDocs(consultaCorreoElectronico);

    if (!resultadoCorreoElectronico.empty) {
      const docCliente = resultadoCorreoElectronico.docs[0];

      return {
        id: docCliente.id,
        data: docCliente.data() as ClienteFirestore,
      };
    }

    const consultaEmail = query(
      clientesRef,
      where("email", "==", correo),
      limit(1)
    );

    const resultadoEmail = await getDocs(consultaEmail);

    if (!resultadoEmail.empty) {
      const docCliente = resultadoEmail.docs[0];

      return {
        id: docCliente.id,
        data: docCliente.data() as ClienteFirestore,
      };
    }

    return null;
  };

  const emailDeUsuario = (data: Record<string, any>) =>
    normalizarCorreo(String(data.email || data.correo || data.correoElectronico || ""));

  const usuarioEstaActivo = (data: Record<string, any>) => {
    const estado = String(data.estado || "ACTIVO").trim().toLowerCase();
    return estado === "activo" || estado === "active" || estado === "habilitado";
  };

  const construirUsuarioOperativo = (
    usuarioId: string,
    clienteId: string,
    data: Record<string, any>,
  ): UsuarioOperativoValidado => ({
    id: usuarioId,
    clienteId,
    data,
  });

  const buscarUsuarioEnCliente = async (
    clienteId: string,
    uidAuth: string,
    correo: string,
  ): Promise<UsuarioOperativoValidado | null> => {
    const refUsuarioPorUid = doc(db, "clientes", clienteId, "usuarios", uidAuth);
    const snapUid = await getDoc(refUsuarioPorUid).catch(() => null);

    if (snapUid?.exists()) {
      const data = snapUid.data() as Record<string, any>;
      if (emailDeUsuario(data) === correo) {
        return construirUsuarioOperativo(snapUid.id, clienteId, data);
      }
    }

    const usuariosRef = collection(db, "clientes", clienteId, "usuarios");

    const consultas = [
      query(usuariosRef, where("uidAuth", "==", uidAuth), limit(5)),
      query(usuariosRef, where("email", "==", correo), limit(5)),
    ];

    for (const consulta of consultas) {
      const resultado = await getDocs(consulta).catch(() => null);
      if (!resultado || resultado.empty) continue;

      for (const docUsuario of resultado.docs) {
        const data = docUsuario.data() as Record<string, any>;
        if (emailDeUsuario(data) === correo) {
          return construirUsuarioOperativo(docUsuario.id, clienteId, data);
        }
      }
    }

    const todosUsuarios = await getDocs(usuariosRef).catch(() => null);
    if (!todosUsuarios || todosUsuarios.empty) return null;

    for (const docUsuario of todosUsuarios.docs) {
      const data = docUsuario.data() as Record<string, any>;
      if (emailDeUsuario(data) === correo || String(data.uidAuth || "") === uidAuth) {
        return construirUsuarioOperativo(docUsuario.id, clienteId, data);
      }
    }

    return null;
  };

  const buscarUsuarioOperativoAutenticado = async (
    uidAuth: string,
    correo: string,
  ): Promise<UsuarioOperativoValidado | null> => {
    try {
      const usuariosRef = collectionGroup(db, "usuarios");
      const consultasGrupo = [
        query(usuariosRef, where("uidAuth", "==", uidAuth), limit(5)),
        query(usuariosRef, where("email", "==", correo), limit(5)),
      ];

      for (const consulta of consultasGrupo) {
        const resultado = await getDocs(consulta).catch(() => null);
        if (!resultado || resultado.empty) continue;

        for (const docUsuario of resultado.docs) {
          const clienteDoc = docUsuario.ref.parent.parent;
          if (!clienteDoc?.id) continue;
          const data = docUsuario.data() as Record<string, any>;
          if (emailDeUsuario(data) === correo || String(data.uidAuth || "") === uidAuth) {
            return construirUsuarioOperativo(docUsuario.id, clienteDoc.id, data);
          }
        }
      }
    } catch (error) {
      console.warn("No fue posible buscar con collectionGroup. Se usará búsqueda por clientes.", error);
    }

    const clientesSnap = await getDocs(collection(db, "clientes"));

    for (const clienteDoc of clientesSnap.docs) {
      const encontrado = await buscarUsuarioEnCliente(clienteDoc.id, uidAuth, correo);
      if (encontrado) return encontrado;
    }

    return null;
  };

  const iniciarSesion = async () => {
    try {
      setMensaje("");
      setTipoMensaje("error");

      if (!emailLimpio || !password.trim()) {
        setMensaje("Ingresa el correo y la contraseña.");
        return;
      }

      setCargando(true);

      await setPersistence(
        auth,
        guardarSesion ? browserLocalPersistence : browserSessionPersistence
      );

      const credencial = await signInWithEmailAndPassword(
        auth,
        emailLimpio,
        password
      );

      const correoAuth = normalizarCorreo(credencial.user.email || "");

      if (!correoAuth || correoAuth !== emailLimpio) {
        await auth.signOut();
        setMensaje(mensajeAccesoDenegado);
        return;
      }

      const usuarioOperativo = await buscarUsuarioOperativoAutenticado(
        credencial.user.uid,
        correoAuth
      );

      if (usuarioOperativo) {
        const estadoUsuario = String(usuarioOperativo.data.estado || "ACTIVO")
          .trim()
          .toLowerCase();

        if (!usuarioEstaActivo(usuarioOperativo.data)) {
          await auth.signOut();
          setMensaje(mensajeAccesoDenegado);
          return;
        }

        if (emailDeUsuario(usuarioOperativo.data) !== correoAuth) {
          await auth.signOut();
          setMensaje(mensajeAccesoDenegado);
          return;
        }

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "usuarioSesion",
            JSON.stringify({
              uid: credencial.user.uid,
              email: correoAuth,
              usuarioId: usuarioOperativo.id,
              clienteId: usuarioOperativo.clienteId,
              nit: usuarioOperativo.clienteId,
              nombres: usuarioOperativo.data.nombres || "",
              apellidos: usuarioOperativo.data.apellidos || "",
              rol: usuarioOperativo.data.rol || "",
              tipoFuncionario: usuarioOperativo.data.tipoFuncionario || "",
              fotoUrl: usuarioOperativo.data.fotoUrl || "",
            })
          );

          window.localStorage.setItem(
            "clienteSesion",
            JSON.stringify({
              uid: credencial.user.uid,
              email: correoAuth,
              clienteId: usuarioOperativo.clienteId,
              nit: usuarioOperativo.clienteId,
              razonSocial: "",
            })
          );
        }

        router.replace("/configuraciones/dashboarduser");
        return;
      }

      const cliente = await buscarClientePorCorreo(correoAuth);

      if (!cliente) {
        await auth.signOut();
        setMensaje(mensajeAccesoDenegado);
        return;
      }

      const correoCliente = normalizarCorreo(
        String(cliente.data.correoElectronico || cliente.data.email || "")
      );

      if (correoCliente !== correoAuth) {
        await auth.signOut();
        setMensaje(mensajeAccesoDenegado);
        return;
      }

      if (
        cliente.data.activo === false ||
        String(cliente.data.estado || "").toLowerCase() === "inactivo"
      ) {
        await auth.signOut();
        setMensaje(mensajeAccesoDenegado);
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("usuarioSesion");
        window.localStorage.setItem(
          "clienteSesion",
          JSON.stringify({
            uid: credencial.user.uid,
            email: correoAuth,
            clienteId: cliente.id,
            nit: cliente.data.nit || cliente.id,
            razonSocial:
              cliente.data.razonSocial || cliente.data.nombreComercial || "",
          })
        );
      }

      router.replace("/dashboard");
    } catch (error: any) {
      console.error("Error login:", error);

      const code = String(error?.code || "");

      if (
        code.includes("auth/invalid-credential") ||
        code.includes("auth/wrong-password") ||
        code.includes("auth/invalid-password")
      ) {
        setMensaje("Contraseña errónea.");
      } else if (code.includes("auth/user-not-found")) {
        setMensaje(mensajeAccesoDenegado);
      } else if (code.includes("auth/too-many-requests")) {
        setMensaje("Demasiados intentos. Espera unos minutos e intenta nuevamente.");
      } else {
        setMensaje(mensajeAccesoDenegado);
      }
    } finally {
      setCargando(false);
    }
  };

  const recuperarContrasena = async () => {
    try {
      setMensaje("");
      setTipoMensaje("error");

      if (!emailLimpio) {
        setMensaje("Escribe tu correo para enviarte el enlace de recuperación.");
        return;
      }

      setRecuperando(true);

      await sendPasswordResetEmail(auth, emailLimpio);

      setTipoMensaje("ok");
      setMensaje("Te enviamos un correo para recuperar tu contraseña.");
    } catch (error: any) {
      console.error("Error recuperar contraseña:", error);
      setMensaje(mensajeAccesoDenegado);
    } finally {
      setRecuperando(false);
    }
  };

  const manejarSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    iniciarSesion();
  };

  return (
    <main className="min-h-screen bg-[#07111f] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb_0,transparent_32%),radial-gradient(circle_at_bottom_right,#059669_0,transparent_30%)] opacity-35" />

      <section className="relative min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between p-12">
          <div>
            <div className="inline-flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center font-black">
                C
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-wide">
                  Portal Clientes
                </h1>
                <p className="text-sm text-emerald-100/70">Acceso privado</p>
              </div>
            </div>

            <div className="mt-28 max-w-xl">
              <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-emerald-100">
                Consulta segura para clientes
              </span>

              <h2 className="mt-8 text-5xl font-black leading-tight">
                Bienvenido a Marthin
              </h2>

              <p className="mt-6 text-lg text-slate-300 leading-8">
                Ingresa con el correo autorizado en Authentication y registrado
                en tu ficha de cliente.
              </p>

              <div className="mt-10 grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-3xl font-black">Auth</p>
                  <p className="mt-1 text-sm text-slate-300">Validación</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-3xl font-black">NIT</p>
                  <p className="mt-1 text-sm text-slate-300">Ficha cliente</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-3xl font-black">24/7</p>
                  <p className="mt-1 text-sm text-slate-300">Portal web</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Marthin. Portal privado de clientes.
          </p>
        </div>

        <div className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 text-center">
              <div className="relative mx-auto h-20 w-56">
                <Image
                  src="/logo.png"
                  alt="Marthin"
                  fill
                  priority
                  className="object-contain"
                />
              </div>

              <h1 className="mt-4 text-2xl font-black">Portal Clientes</h1>
              <p className="text-sm text-slate-300">Acceso privado</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.08] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
              <div className="mb-8 text-center">
                <div className="relative mx-auto mb-5 h-24 w-64">
                  <Image
                    src="/logo.png"
                    alt="Marthin"
                    fill
                    priority
                    className="object-contain"
                  />
                </div>

                <p className="text-sm font-semibold text-emerald-300">
                  Acceso usuarios
                </p>

                <h2 className="mt-2 text-3xl font-black">Iniciar sesión</h2>

                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Ingresa con el correo registrado en Authentication y en usuarios.
                </p>
              </div>

              <form onSubmit={manejarSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-200">
                    Correo electrónico
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@empresa.com"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-200">
                    Contraseña
                  </label>

                  <div className="relative">
                    <input
                      type={mostrarPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu contraseña"
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pr-14 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                    />

                    <button
                      type="button"
                      onClick={() => setMostrarPassword((actual) => !actual)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-lg text-slate-300 hover:bg-white/10 hover:text-white"
                      aria-label={
                        mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"
                      }
                    >
                      {mostrarPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={guardarSesion}
                      onChange={(e) => setGuardarSesion(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-black/30 accent-emerald-500"
                    />
                    Guardar sesión
                  </label>

                  <button
                    type="button"
                    onClick={recuperarContrasena}
                    disabled={recuperando}
                    className="text-sm font-semibold text-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {recuperando ? "Enviando..." : "Recuperar contraseña"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cargando ? "Validando acceso..." : "Entrar al dashboard"}
                </button>
              </form>

              {mensaje && (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    tipoMensaje === "ok"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-red-400/30 bg-red-500/10 text-red-200"
                  }`}
                >
                  {mensaje}
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Un producto de Famiasistir, &amp; Desarrollado por Printserp SAS
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}