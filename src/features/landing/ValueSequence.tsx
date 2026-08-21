const values = [
  {
    amount: "₹16,000",
    title: "Base trek",
    copy: "Four places on a two-day guided Hampta introduction.",
    tone: "base"
  },
  {
    amount: "₹20,800",
    title: "Premium bundle exceeds budget",
    copy: "Pickup and premium meals push the request ₹800 over its hard limit.",
    tone: "rejected"
  },
  {
    amount: "₹19,600",
    title: "Human-approved revision",
    copy: "The requested pickup stays. A lower meal upgrade brings the total back inside budget.",
    tone: "approved"
  }
] as const;

export function ValueSequence() {
  return (
    <div className="value-sequence">
      {values.map((value) => (
        <article className={`value-step value-step--${value.tone}`} key={value.amount}>
          <div className="value-step__number">{value.amount}</div>
          <h3>{value.title}</h3>
          <p>{value.copy}</p>
        </article>
      ))}
    </div>
  );
}
