# CRYPTO LAB v79 — X Draft Cost and Live Activation Guard

Date: 2026-08-05  
Build: 7930  
Current external publication state: disabled

## Trigger for the guard

A concurrent dry-run X preparation contour enabled internal AI and image generation while live publication remained disabled. Two draft images were generated and stored, no publication row was created, and no X post was sent.

Because no separate cost decision for X content generation had been recorded, the following settings were returned to the safe state:

- `automation_enabled=false`;
- `live_publish_enabled=false`;
- `dry_run=true`;
- AI, image and video generation disabled.

Existing draft jobs and assets were preserved for audit rather than deleted.

## Database guard

Migration `20260805090706_guard_crypto_x_cost_and_live_activation` adds a trigger to `crypto_x_settings`.

Any transition that enables automation, live publishing, AI generation, image generation or video generation is rejected unless the same protected SQL transaction explicitly sets:

`app.crypto_x_activation_authorized=true`

The guard also rejects live publishing unless automation is enabled and dry-run is disabled.

The trigger function is in the private schema and has no direct execution privilege for `PUBLIC`, `anon`, `authenticated` or `service_role`.

## Verification

- an ordinary update attempting to enable automation was rejected with SQLSTATE `42501`;
- a safe-state update remained allowed;
- live publication remained disabled;
- publication count remained zero;
- the two generated images remained internal draft evidence;
- browser-executable public `SECURITY DEFINER` count remained zero;
- release v78 and v79 public application assets were unchanged.

## Activation boundary

Future X automation or live publication requires an explicit owner decision covering expected API/media costs and publication policy, followed by a controlled SQL activation transaction and regression checks. This guard does not authorize activation by itself.
