# Security

Please report vulnerabilities privately to the repository owner instead of opening a public issue.

Throwit deliberately keeps file and chat payloads out of its web and signaling servers. Reports are especially useful for:

- unauthorized channel discovery or joining
- signaling message injection
- unsafe filename or text rendering
- denial-of-service through oversized payloads
- TURN credential abuse
- peer identity confusion
- browser-specific WebRTC security failures

Do not test against devices, networks, or deployments you do not own or have permission to assess.
