-- The ticket history trigger checks each conversation's history by conversation and time;
-- without this index every conversation insert or ticket change scanned the whole table.
CREATE INDEX ticket_history_conversation_at ON ticket_history(conversation_id,at);
