import type { ReactNode } from "react";
import { UtensilsIcon } from "./icons";

/**
 * Shared aspect-square image slot for menu-item cards (admin menu grid,
 * pos/new order builder). Previously each grid duplicated its own flat
 * placeholder box when an item had no photo — this gives every "no image"
 * card the same soft dish-icon mark instead of a blank tinted square.
 */
export function MenuItemImage({
  src,
  alt = "",
  children,
}: {
  src: string | null;
  alt?: string;
  children?: ReactNode;
}) {
  return (
    <div className="aspect-square bg-(--surface-muted) relative overflow-hidden">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-(--brand-soft)/40">
          <UtensilsIcon className="w-9 h-9" />
        </div>
      )}
      {children}
    </div>
  );
}
