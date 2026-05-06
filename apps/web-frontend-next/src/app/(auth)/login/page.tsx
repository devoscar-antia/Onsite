import { LoginForm } from "@/components/auth/LoginForm";
import { Activity, BarChart2, ChevronRight, FileVideo, ScanSearch, Shield, Zap } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Iniciar sesión – Onsite" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-[#080c14]">
      {/* Left panel — branding */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex lg:w-[52%]">
        {/* Background gradient mesh */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute -bottom-32 -right-16 h-[400px] w-[400px] rounded-full bg-blue-500/8 blur-[100px]" />
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/6 blur-[80px]" />
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
              Análisis de video<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                impulsado por IA
              </span>
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-400">
              Detecta y cuenta productos en cintas transportadoras en tiempo real con modelos YOLO de última generación.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: Zap, label: "Detección en tiempo real" },
              { icon: BarChart2, label: "Analytics avanzados" },
              { icon: Shield, label: "Acceso seguro" },
              { icon: Activity, label: "Métricas por frame" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-sm"
              >
                <Icon className="h-3 w-3 text-blue-400" />
                {label}
              </div>
            ))}
          </div>

          {/* Pipeline flow */}
          <div className="rounded-2xl border border-white/8 bg-white/4 p-5 backdrop-blur-sm">
            <p className="mb-4 text-xs font-medium text-slate-500">Cómo funciona</p>
            <div className="flex items-start gap-2">
              {[
                { icon: FileVideo, label: "Sube el video", sub: "MP4, MOV, AVI, MKV" },
                { icon: ScanSearch, label: "YOLO analiza", sub: "Detección frame a frame" },
                { icon: BarChart2, label: "Ve los resultados", sub: "Conteos y métricas" },
              ].map(({ icon: Icon, label, sub }, i, arr) => (
                <div key={label} className="flex flex-1 items-start gap-2">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="mb-2 grid h-9 w-9 place-content-center rounded-xl bg-blue-500/15 text-blue-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">{label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <ChevronRight className="mt-2.5 h-3.5 w-3.5 shrink-0 text-slate-700" />
                  )}
                </div>
              ))}
            </div>
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
            <h1 className="text-2xl font-bold text-white">Bienvenido de vuelta</h1>
            <p className="mt-1 text-sm text-slate-500">Inicia sesión para acceder al dashboard</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-6 backdrop-blur-sm">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            ¿Sin cuenta?{" "}
            <Link className="text-blue-400 hover:text-blue-300 hover:underline" href="/register">
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}