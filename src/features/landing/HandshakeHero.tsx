export function HandshakeHero() {
  return (
    <section className="booking-preview" aria-label="Illustrative agent booking exchange">
      <header className="booking-preview__header">
        <span>One brief. One clear quote.</span>
        <span className="booking-preview__caption">Illustrative booking · A2A v1</span>
      </header>

      <div className="booking-preview__exchange">
        <section className="booking-preview__request" aria-labelledby="preview-request">
          <div className="booking-preview__byline">
            <span className="booking-preview__initial" aria-hidden="true">You</span>
            <h2 id="preview-request">The group’s brief</h2>
            <span>via your agent</span>
          </div>
          <blockquote>
            “Two days in Manali. Four friends.<br className="booking-preview__break" /> Keep us under ₹20,000.”
          </blockquote>
          <p>Occasional hikers, with pickup and upgraded meals.</p>
          <dl className="booking-preview__details">
            <div><dt>Trip</dt><dd>2 days / 1 night</dd></div>
            <div><dt>Group</dt><dd>4 travellers</dd></div>
            <div><dt>Budget</dt><dd>₹20,000 total</dd></div>
          </dl>
          <p className="booking-preview__handoff">Request sent to the merchant <span aria-hidden="true">→</span></p>
        </section>

        <section className="booking-preview__quote" aria-labelledby="preview-quote">
          <div className="booking-preview__byline">
            <span className="booking-preview__initial booking-preview__initial--merchant" aria-hidden="true">T</span>
            <h2 id="preview-quote">T-Bud’s quote</h2>
            <span>merchant prices</span>
          </div>
          <dl className="booking-preview__items">
            <div><dt>Trek for four <span>₹4,000 per person</span></dt><dd>₹16,000</dd></div>
            <div><dt>Group pickup</dt><dd>₹2,000</dd></div>
            <div><dt>Upgraded meals <span>₹400 per person</span></dt><dd>₹1,600</dd></div>
          </dl>
          <div className="booking-preview__total">
            <div><span>Group total</span><strong>₹19,600</strong></div>
            <p>₹400 within budget<br /><span>Seats are not held yet</span></p>
          </div>
        </section>
      </div>

      <footer className="booking-preview__approval">
        <div className="booking-preview__approval-copy">
          <span className="booking-preview__step">01 / Your decision</span>
          <strong>Review the quote. Then give the go-ahead.</strong>
          <p>The seat hold and payment each need your separate approval.</p>
        </div>
        <a className="button button--primary" href="/book">Try your own request <span aria-hidden="true">→</span></a>
      </footer>
    </section>
  );
}
