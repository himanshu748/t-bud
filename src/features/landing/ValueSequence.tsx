const values = [
  {
    amount: "₹16,000",
    title: "Base trek",
    copy: "Four places on a two-day guided Hampta introduction.",
    tone: "base"
  },
  {
    amount: "+₹3,600",
    title: "Requested add-ons",
    copy: "Manali pickup and upgraded trail meals come from the merchant catalog.",
    tone: "base"
  },
  {
    amount: "₹19,600",
    title: "Live eligible quote",
    copy: "The budget policy leaves ₹400 headroom before the itinerary reaches a human.",
    tone: "approved"
  }
] as const;

export function ValueSequence() {
  return (
    <div className="value-sequence">
      {values.map((value, index) => (
        <article className={`value-step value-step--${value.tone}`} key={value.amount}>
          <span className="value-step__index">0{index + 1}</span>
          <div className="value-step__number">{value.amount}</div>
          <h3>{value.title}</h3>
          <p>{value.copy}</p>
        </article>
      ))}
    </div>
  );
}
