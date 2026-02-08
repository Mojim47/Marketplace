This folder contains high-level TLA+ style invariants and state transitions for the security flows.

- Rate Limiter Safety: Never allow more than N requests in any sliding window W for a given key.
- Token Rotation Liveness: After rotation, tokens signed with the previous key remain verifiable only within a single rotation window; after two rotations, they must be invalid.

We include pseudo-specifications and checked invariants as part of the final report summary.
