import { Icon } from './Icons';
import { Drawing, SketchMarks, SketchWindow } from './Sketch';

// A checkout page with the widget's one small offer: the message and its two choices.
export function OfferDrawing() {
  return <Drawing className="offer-art" label="Drawing of a checkout page where the chat widget asks: Looks like you might be stuck. Would you like a hand with checkout? with Yes please and No thanks.">
    <SketchMarks variant="spark" />
    <SketchWindow>
      <div className="offer-page">
        <div className="offer-checkout">
          <span className="offer-title"><Icon name="cart" />Checkout</span>
          <span className="sk-field" /><span className="sk-field" />
          <i className="sk-line w70" /><i className="sk-line w50" />
          <span className="sk-pay">Pay now</span>
        </div>
        <div className="offer-widget">
          <p className="offer-bubble">Looks like you might be stuck. Would you like a hand with checkout?</p>
          <div className="offer-choices"><span className="d-btn d-btn--ink">Yes please</span><span className="d-btn">No thanks</span></div>
        </div>
      </div>
    </SketchWindow>
  </Drawing>;
}
