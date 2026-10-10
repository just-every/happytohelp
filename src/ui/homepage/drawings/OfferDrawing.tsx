import { BrandMark } from '../BrandMark';
import { Blob } from './Blob';
import { Icon } from './Icons';
import { Drawing, SketchWindow } from './Sketch';

// A checkout page, kept in its window but cut to the essentials, and the widget's one small offer floating over its corner:
// the speech-bubble mark as the avatar, the message (typing dots hold its place first) and its two choices.
export function OfferDrawing() {
  return <Drawing className="offer-art" reveal label="Drawing of a checkout page where the chat widget asks: Looks like you might be stuck. Would you like a hand with checkout? with Yes please and No thanks.">
    <Blob shape="right" />
    <SketchWindow className="offer-window">
      <div className="offer-checkout">
        <span className="offer-title"><Icon name="cart" />Checkout</span>
        <span className="sk-field" /><span className="sk-field" />
        <span className="sk-pay">Pay now</span>
      </div>
    </SketchWindow>
    <div className="offer-widget">
      <div className="offer-message">
        <span className="offer-avatar"><BrandMark /></span>
        <div className="offer-say">
          <span className="offer-typing"><i /><i /><i /></span>
          <p className="offer-bubble">Looks like you might be stuck. Would you like a hand with checkout?</p>
        </div>
      </div>
      <div className="offer-choices"><span className="d-btn d-btn--ink">Yes please</span><span className="d-btn">No thanks</span></div>
    </div>
  </Drawing>;
}
