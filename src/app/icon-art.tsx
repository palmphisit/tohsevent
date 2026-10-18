// Shared artwork for the generated app icons (favicon, PWA, Apple touch icon).
export function IconArt({ size, rounded }: { size: number; rounded: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#18181b",
        color: "#ffffff",
        borderRadius: rounded ? size * 0.22 : 0,
        fontSize: size * 0.6,
        fontWeight: 700,
        letterSpacing: -size * 0.02,
      }}
    >
      T
    </div>
  );
}
