type StatusTone = "human" | "protocol" | "success" | "error" | "neutral";

export function Status({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span className={`status status--${tone}`}>
      <span className="status__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
