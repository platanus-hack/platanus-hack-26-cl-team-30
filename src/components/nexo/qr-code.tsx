"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

type Props = {
  /** Dirección que abre el código. */
  url: string;
  /** Para lectores de pantalla: a qué lleva. */
  label: string;
  /** Lado en píxeles CSS. */
  size?: number;
  className?: string;
};

// Código QR dibujado en el navegador. Mientras se genera reserva su espacio.
export function QrCode({ url, label, size = 160, className }: Props) {
  const [image, setImage] = useState<{ url: string; data: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: "#0e2a33", light: "#ffffff" } })
      .then((data) => {
        if (!cancelled) setImage({ url, data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-md border border-border bg-white", className)} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image?.url === url && <img src={image.data} alt={label} width={size} height={size} className="size-full" />}
    </span>
  );
}
