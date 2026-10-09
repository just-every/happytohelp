# Plugin iframe SDK

`createPluginClient({hostOrigin})` retains the original `HappytoHelp` SDK's
`on`, `setMessageContent`, `getConversation`, `resolveConversation`, `setHeight`
and `{happytohelp:true,type,payload}` envelope. Assign the client to
`window.HappytoHelp` when migrating an existing plugin script.

`connectPluginHost({iframe,pluginOrigin,handlers})` binds the dashboard side to
one configured iframe. Both sides require an exact origin and verify the sending
window; outbound messages never use `*`. Heights and command payloads are bounded.
Call `destroy()` when either iframe/client is removed. Host resolve handlers must
use the native authenticated conversation route and enforce current operator
scope; the iframe protocol grants no backend authority.

This ports the original plugin SDK implementation.
The old baked host list and wildcard target origin have been replaced by explicit
edition configuration. No dashboard dependency is needed by a plugin consumer.
