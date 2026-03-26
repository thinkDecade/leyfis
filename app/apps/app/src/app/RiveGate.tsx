"use client";
import { useRive, Layout, Fit, Alignment } from "@rive-app/react-canvas";

// Uses Rive's community security/access animation
// If the .riv file isn't available, the component gracefully returns null
export default function RiveGate() {
  const { RiveComponent } = useRive({
    // Rive community: "Security Check" animation
    src: "https://public.rive.app/community/runtime-files/2244-4463-animated-login-screen.riv",
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  });

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "300px" }}>
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
