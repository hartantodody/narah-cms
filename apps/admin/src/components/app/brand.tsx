// Brand mark assets live in apps/admin/public/, served from the root path.
// Square 1:1 logo at /narah-logo.png; wide text-logo at /narah-text-logo.png.

const LOGO_SRC = "/narah-logo.png";
const TEXT_LOGO_SRC = "/narah-text-logo.png";

type NarahLogoProps = {
  className?: string;
  alt?: string;
};

/**
 * Square 1:1 brand mark. Used wherever a small/icon-style brand badge
 * fits — sidebar rail, login top-left, header chips.
 */
export function NarahLogo({
  className = "size-7 shrink-0 rounded-md",
  alt = "Narah",
}: NarahLogoProps) {
  return (
    <img src={LOGO_SRC} alt={alt} draggable={false} className={className} />
  );
}

/**
 * Wide text-logo (logotype). Use where the brand mark needs more
 * prominence and there's room for the full lockup — login hero,
 * marketing surfaces.
 */
export function NarahTextLogo({
  className = "h-6 w-auto",
  alt = "Narah CMS",
}: NarahLogoProps) {
  return (
    <img
      src={TEXT_LOGO_SRC}
      alt={alt}
      draggable={false}
      className={className}
    />
  );
}
