import { useState } from "react";
import { isDeliveryFact } from "../family/support/delivery";
import { api } from "./api";
import type { Reply } from "./types";
type Props = {
  reply: Reply;
  jobId: string;
  current: boolean;
  busy: boolean;
  act: (operation: () => Promise<void>) => Promise<void>;
};
export function ReplyReview({ reply, jobId, current, busy, act }: Props) {
  const [draft, setDraft] = useState(reply.body);
  return (
    <section className="panel reply">
      <h2>Customer reply</h2>
      <span className={`badge ${reply.status}`}>
        {isDeliveryFact(reply.status)
          ? `Provider ${reply.status}`
          : reply.status}
      </span>
      {reply.status === "proposed" && current ? (
        <>
          <label htmlFor={`reply-${reply.id}`}>Review and edit reply</label>
          <textarea
            id={`reply-${reply.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={20000}
          />
        </>
      ) : (
        <p className="message">{reply.body}</p>
      )}
      {reply.error && <p className="error">{reply.error}</p>}
      {reply.status === "proposed" && current && (
        <button
          className="primary"
          disabled={busy || !draft.trim()}
          onClick={() =>
            void act(async () => {
              await api(`jobs/${jobId}/review`, {
                action: "approve_reply",
                replyId: reply.id,
                reply: draft,
              });
            })
          }
        >
          Approve reply
        </button>
      )}
      {["approved", "failed"].includes(reply.status) && current && (
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await api(`replies/${reply.id}/send`, {});
            })
          }
        >
          {reply.status === "failed"
            ? "Retry rejected reply"
            : "Send authorized reply"}
        </button>
      )}
      {!current &&
        ["proposed", "approved", "failed"].includes(reply.status) && (
          <p className="muted">
            A newer assignment supersedes this reply. Review the current result.
          </p>
        )}
      {reply.status === "accepted" && (
        <p className="muted">
          Accepted by the email provider. Inbox delivery has not been confirmed.
        </p>
      )}
      {["uncertain", "sending"].includes(reply.status) && (
        <Reconcile replyId={reply.id} busy={busy} act={act} />
      )}
    </section>
  );
}
function Reconcile({
  replyId,
  act,
  busy,
}: {
  replyId: string;
  busy: boolean;
  act: Props["act"];
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        void act(async () => {
          await api(`replies/${replyId}/reconcile`, values);
        });
      }}
    >
      <p>
        Check the provider record before deciding. Unknown sends are never
        retried automatically; an active submission must finish or expire before
        reconciliation.
      </p>
      <label>
        Confirmed outcome
        <select name="outcome">
          <option value="accepted">Provider accepted</option>
          <option value="failed">Provider rejected</option>
        </select>
      </label>
      <label>
        Provider receipt ID
        <input name="providerId" />
      </label>
      <label>
        Provider evidence
        <textarea name="evidence" required minLength={10} />
      </label>
      <button disabled={busy}>Record reconciliation</button>
    </form>
  );
}
