# Conversation source

The native admission writer and Durable Object socket are reusable source. A
consumer supplies its actor/project identity and persistent conversation/message
schema, then integrates its own authorization and reply policy. All writers use
conditional revision/frontier admission; retry identity includes immutable intent.
Persistent outbox/replay separates message commits from socket delivery.

Carry this directory, migrations0002/0004/0007 and its conversation tests as listed
in module.json. HTTP routes additionally import the edition's platform auth and
environment interfaces. Copying those routes without an equivalent integration is
not a complete adoption. Widget and autonomous AI reply policy are separate sources;
reviewed-send consumers keep their own mandatory approval rules.
