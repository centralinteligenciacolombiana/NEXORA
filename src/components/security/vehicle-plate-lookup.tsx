"use client";

import { useActionState } from "react";
import { Car, Search, ShieldCheck, ShieldX } from "lucide-react";
import {
  lookupAuthorizedVehicleAction,
  type VehicleLookupState,
} from "@/lib/actions/vehicles";
import { VEHICLE_TYPE_LABELS, type VehicleType } from "@/lib/vehicles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function VehiclePlateLookup() {
  const [state, formAction, pending] = useActionState(
    lookupAuthorizedVehicleAction,
    {} as VehicleLookupState,
  );

  return (
    <section className="space-y-4">
      <form action={formAction} className="space-y-3">
        <Input
          name="plate"
          label="Buscar placa"
          required
          placeholder="ABC123"
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="lg"
          className="min-h-12 w-full"
          disabled={pending}
        >
          <Search className="size-4" aria-hidden />
          {pending ? "Buscando…" : "Verificar autorización"}
        </Button>
      </form>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.success && state.found === false && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
          <ShieldX className="mx-auto size-8 text-red-600" aria-hidden />
          <p className="mt-2 font-semibold text-red-900">
            {state.plate ?? "Placa"} · No autorizada
          </p>
          <p className="mt-1 text-sm text-red-800">{state.message}</p>
        </div>
      )}

      {state.success && state.found && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            {state.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.photoUrl}
                alt=""
                className="size-16 rounded-xl object-cover"
              />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-xl bg-white text-emerald-700">
                <Car className="size-7" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-700" aria-hidden />
                <p className="font-display text-xl font-semibold tracking-wide text-emerald-950">
                  {state.plate}
                </p>
              </div>
              <p className="mt-1 text-sm font-medium text-emerald-900">
                {state.unitLabel}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.vehicleType ? (
                  <Badge variant="success">
                    {VEHICLE_TYPE_LABELS[state.vehicleType as VehicleType] ??
                      state.vehicleType}
                  </Badge>
                ) : null}
                {state.color ? (
                  <Badge variant="muted">{state.color}</Badge>
                ) : null}
              </div>
              {state.notes ? (
                <p className="mt-2 text-xs text-emerald-900/80">{state.notes}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
