"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z
  .object({
    name: z.string().min(1, "El nombre es requerido").max(80),
    lastName: z.string().max(80),
    email: z.string().email("Email inválido"),
    company: z.string().max(100),
    password: z.string().min(8, "Mínimo 8 caracteres").max(128),
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

const inputCls =
  "w-full rounded-xl border border-border-soft bg-surface px-4 py-2.5 text-sm text-text placeholder-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-danger">{msg}</p>;
}

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", lastName: "", email: "", company: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: FormData) => {
    const { confirmPassword: _, ...payload } = data;
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError("root", { message: err.error ?? "Error al registrarse" });
      return;
    }
    router.push("/login?registered=1");
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      {/* Nombre + Apellido */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-muted" htmlFor="name">
            Nombre <span className="text-danger">*</span>
          </label>
          <input
            {...register("name")}
            autoComplete="given-name"
            className={inputCls}
            id="name"
            placeholder="Carlos"
            type="text"
          />
          <FieldError msg={errors.name?.message} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted" htmlFor="lastName">
            Apellido
          </label>
          <input
            {...register("lastName")}
            autoComplete="family-name"
            className={inputCls}
            id="lastName"
            placeholder="García"
            type="text"
          />
          <FieldError msg={errors.lastName?.message} />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="email">
          Correo electrónico <span className="text-danger">*</span>
        </label>
        <input
          {...register("email")}
          autoComplete="email"
          className={inputCls}
          id="email"
          placeholder="tu@empresa.com"
          type="email"
        />
        <FieldError msg={errors.email?.message} />
      </div>

      {/* Empresa */}
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="company">
          Empresa / Organización
        </label>
        <input
          {...register("company")}
          autoComplete="organization"
          className={inputCls}
          id="company"
          placeholder="Acme S.A.S."
          type="text"
        />
        <FieldError msg={errors.company?.message} />
      </div>

      {/* Contraseña */}
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="password">
          Contraseña <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input
            {...register("password")}
            autoComplete="new-password"
            className={`${inputCls} pr-11`}
            id="password"
            placeholder="Mínimo 8 caracteres"
            type={showPassword ? "text" : "password"}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            type="button"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError msg={errors.password?.message} />
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="confirmPassword">
          Confirmar contraseña <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input
            {...register("confirmPassword")}
            autoComplete="new-password"
            className={`${inputCls} pr-11`}
            id="confirmPassword"
            placeholder="Repite tu contraseña"
            type={showConfirm ? "text" : "password"}
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            onClick={() => setShowConfirm((v) => !v)}
            tabIndex={-1}
            type="button"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError msg={errors.confirmPassword?.message} />
      </div>

      {errors.root && (
        <p className="shake rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      )}

      <button
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
}
