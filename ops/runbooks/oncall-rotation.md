# On-Call Rotation

## Primary Schedule
- Primary (Week 1): Platform Team
- Primary (Week 2): Backend Team
- Primary (Week 3): SRE Team
- Primary (Week 4): Platform Team

## Secondary Schedule
- Secondary mirrors primary with one-week offset.

## Escalation Windows
- `P1`: page immediately, acknowledge in <= 5 minutes.
- `P2`: page immediately, acknowledge in <= 15 minutes.
- `P3`: ticket within business hours.

## Escalation Chain
1. On-call engineer
2. Team lead
3. Engineering manager
4. Incident commander

## Handover Checklist
- Confirm active incidents and ownership.
- Confirm kill-switch status for AI/AR/Checkout/Payment.
- Confirm alert noise budget and muted rules.
- Confirm rollback command and previous release reference.
