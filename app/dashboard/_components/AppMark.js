"use client";

const palettes = [
  "from-primary/35 to-secondary/20 text-primary",
  "from-secondary/35 to-accent/20 text-secondary",
  "from-accent/35 to-primary/20 text-accent",
  "from-success/30 to-secondary/15 text-success",
  "from-warning/30 to-primary/15 text-warning",
];

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function paletteFor(name) {
  const score = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[score % palettes.length];
}

export function platformLabel(platform) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "Android + iOS";
}

export function AppMark({ name, size = "md" }) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <div className={`grid shrink-0 place-items-center rounded-box border border-base-content/10 bg-gradient-to-br shadow-sm ${paletteFor(name)} ${sizes[size]}`}>
      <span className="font-black tracking-wide">{getInitials(name)}</span>
    </div>
  );
}
