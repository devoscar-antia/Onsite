import { RegisterForm } from "@/components/auth/RegisterForm";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Crear cuenta – Onsite" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen bg-[#080c14]">
      {/* Left panel — branding */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex lg:w-[52%]">
        {/* Background gradient mesh */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute -bottom-32 -right-16 h-[400px] w-[400px] rounded-full bg-indigo-500/8 blur-[100px]" />
        </div>

        {/* Grid lines overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-content-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 font-bold text-white shadow-lg shadow-blue-500/25">
            ON
          </div>
          <span className="text-lg font-semibold text-white">Onsite Analytics</span>
        </div>

        {/* Center content */}
        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
              Comienza a analizar<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                tus videos hoy
              </span>
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-400">
              Crea tu cuenta y empieza a detectar productos en cintas transportadoras con inteligencia artificial.
            </p>
          </div>

          {/* Benefits list */}
          <div className="space-y-3">
            {[
              "Sube videos en cualquier formato (MP4, MOV, AVI, MKV)",
              "Análisis automático con modelos YOLO entrenados",
              "Dashboard con métricas detalladas por frame",
              "Descarga los videos procesados con anotaciones",
            ].map((benefit) => (
              <div key={benefit} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <p className="text-sm text-slate-400">{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative text-xs text-slate-600">
          © {new Date().getFullYear()} Onsite · Enterprise Video Analytics
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="grid h-9 w-9 place-content-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 font-bold text-sm text-white">
            ON
          </div>
          <span className="font-semibold text-white">Onsite Analytics</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
            <p className="mt-1 text-sm text-slate-500">Completa los datos para registrarte</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-6 backdrop-blur-sm">
            <RegisterForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{" "}
            <Link className="text-blue-400 hover:text-blue-300 hover:underline" href="/login">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}