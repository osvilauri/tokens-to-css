---
"tokens-to-css": patch
---

Fixes remote sources against real hostnames. The custom DNS lookup answered with
a single address where Node expects an array, so any URL naming a host — rather
than a literal IP — failed to connect.
