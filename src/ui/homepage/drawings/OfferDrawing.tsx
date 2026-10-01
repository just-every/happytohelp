import { Icon } from './Icons';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';

// A checkout page with the widget's insight: one message, a close control, the offer's buttons and the AI's name and role.
export function OfferDrawing() {
  return <Drawing className="offer-art" label="Drawing of a checkout page where the chat widget makes one small offer: a message asking whether the visitor would like help, with the choices Yes please and No thanks, a close control and the name and role of the assistant. A person can always take over.">
    <SketchMarks variant="spark" />
    <SketchWindow>
      <div className="offer-page">
        <div className="offer-checkout">
          <span className="offer-title"><Icon name="cart" />Checkout</span>
          <i className="sk-line w70" /><i className="sk-line w50" /><i className="sk-line w60" />
          <span className="sk-field" /><span className="sk-field" />
          <span className="sk-pay">Pay now</span>
        </div>
        <div className="offer-widget">
          <span className="offer-close"><Icon name="close" /></span>
          <p className="offer-bubble">Looks like you might be stuck. Would you like a hand with checkout?</p>
          <div className="offer-choices"><span className="d-btn d-btn--ink">Yes please</span><span className="d-btn">No thanks</span></div>
          <p className="offer-agent"><b>Casey</b> • Support assistant</p>
        </div>
      </div>
    </SketchWindow>
  </Drawing>;
}
