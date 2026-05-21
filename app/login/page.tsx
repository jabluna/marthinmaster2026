"use client";

import Image from "next/image";
import { useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: any;
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pasoCodigo, setPasoCodigo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const prepararRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "normal" }
      );
    }

    return window.recaptchaVerifier;
  };

  const enviarSms = async () => {
    try {
      setMensaje("");
      setCargando(true);

      if (!telefono.startsWith("+57")) {
        setMensaje("El número debe incluir +57. Ejemplo: +573001234567");
        return;
      }

      const appVerifier = prepararRecaptcha();

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        telefono,
        appVerifier
      );

      window.confirmationResult = confirmationResult;
      setPasoCodigo(true);
    } catch (error) {
      console.error("Error SMS:", error);
      setMensaje("No pudimos enviar el SMS. Verifica el número o intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const verificarCodigo = async () => {
    try {
      setMensaje("");
      setCargando(true);

      if (!window.confirmationResult) {
        setMensaje("Primero debes solicitar el código SMS.");
        return;
      }

      await window.confirmationResult.confirm(codigo);
      router.replace("/clientes");
    } catch (error) {
      console.error("Código incorrecto:", error);
      setMensaje("El código ingresado no es correcto.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07111f] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#1d4ed8_0,transparent_32%),radial-gradient(circle_at_bottom_right,#0f766e_0,transparent_30%)] opacity-40" />

      <section className="relative min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between p-12">
          <div>
            <div className="inline-flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 flex items-center justify-center font-black">
                M
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide">Marthin Master</h1>
                <p className="text-sm text-blue-100/70">Administración central</p>
              </div>
            </div>

            <div className="mt-28 max-w-xl">
              <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-blue-100">
                Plataforma multi-cliente
              </span>

              <h2 className="mt-8 text-5xl font-black leading-tight">
                Control maestro para operaciones, clientes y accesos.
              </h2>

              <p className="mt-6 text-lg text-slate-300 leading-8">
                Gestiona clientes, usuarios, permisos y módulos operativos desde
                una consola moderna, segura y centralizada.
              </p>

              <div className="mt-10 grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-3xl font-black">SMS</p>
                  <p className="mt-1 text-sm text-slate-300">Acceso seguro</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-3xl font-black">RTDB</p>
                  <p className="mt-1 text-sm text-slate-300">Firebase</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <p className="text-3xl font-black">360°</p>
                  <p className="mt-1 text-sm text-slate-300">Gestión total</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Marthin. Panel privado.
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
              <h1 className="mt-4 text-2xl font-black">Marthin Master</h1>
              <p className="text-sm text-slate-300">Administración central</p>
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

                <p className="text-sm font-semibold text-blue-300">
                  Acceso seguro
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Iniciar sesión
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Ingresa con verificación SMS para acceder al panel maestro.
                </p>
              </div>

              {!pasoCodigo ? (
                <>
                  <label className="block text-sm font-semibold mb-2 text-slate-200">
                    Teléfono autorizado
                  </label>

                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+573001234567"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
                  />

                  <div className="mt-5 rounded-2xl bg-white p-3">
                    <div id="recaptcha-container" />
                  </div>

                  <button
                    onClick={enviarSms}
                    disabled={cargando}
                    className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cargando ? "Enviando código..." : "Enviar código SMS"}
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-sm font-semibold mb-2 text-slate-200">
                    Código de verificación
                  </label>

                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                  />

                  <button
                    onClick={verificarCodigo}
                    disabled={cargando}
                    className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cargando ? "Verificando..." : "Entrar al panel"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPasoCodigo(false);
                      setCodigo("");
                      setMensaje("");
                    }}
                    className="mt-4 w-full text-sm font-semibold text-slate-300 hover:text-white"
                  >
                    Cambiar número
                  </button>
                </>
              )}

              {mensaje && (
                <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                  {mensaje}
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Acceso restringido a usuarios autorizados.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
