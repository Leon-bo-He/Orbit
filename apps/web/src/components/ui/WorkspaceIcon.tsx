/** Returns true when the icon value is an uploaded image URL rather than an emoji. */
export function isIconUrl(icon: string): boolean {
  return icon.startsWith('/') || icon.startsWith('http://') || icon.startsWith('https://');
}

interface Props {
  icon: string;
  /** Extra classes applied to the <img> when the icon is a URL. */
  imgClassName?: string;
}

/**
 * Renders the content of a workspace icon — either an <img> (for uploaded images)
 * or the raw emoji string. Place this inside whatever styled container you need.
 */
export function WorkspaceIconContent({ icon, imgClassName }: Props) {
  if (isIconUrl(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={`w-full h-full object-cover rounded-full ${imgClassName ?? ''}`}
      />
    );
  }
  return <>{icon}</>;
}
