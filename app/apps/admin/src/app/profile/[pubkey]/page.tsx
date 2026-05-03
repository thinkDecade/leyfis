// Static-export shim.
// All profile links use /profile?wallet= format — this route is never navigated to directly.
// One placeholder path is required so Next.js output:export accepts the dynamic segment.
export function generateStaticParams() {
  return [{ pubkey: "placeholder" }];
}

type Props = { params: { pubkey: string } };

export default function ProfileRedirect({ params }: Props) {
  // Rendered only for the placeholder path at build time.
  // Real wallets navigate via /profile?wallet= (query-param route).
  return null;
}
