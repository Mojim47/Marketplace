export interface RequestLike { socket?: { authorized?: boolean; getPeerCertificate?: ()=>any } }
export class MtlsGuard {
  canActivate(req: RequestLike): boolean {
    if (!req?.socket?.authorized) return false
    const cert = req.socket.getPeerCertificate ? req.socket.getPeerCertificate() : null
    return !!cert
  }
}
