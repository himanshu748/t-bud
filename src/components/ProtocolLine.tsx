export interface ProtocolStep {
  id: string;
  title: string;
  description: string;
}

export function ProtocolLine({ steps }: { steps: ProtocolStep[] }) {
  return (
    <div className="protocol-runway" role="list">
      {steps.map((step, index) => (
        <article className="protocol-runway__step" role="listitem" key={step.id}>
          <span className="protocol-runway__index">
            {String(index + 1).padStart(2, "0")} / {step.id}
          </span>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </article>
      ))}
    </div>
  );
}
