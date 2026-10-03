# Purchase Order Lifecycle

Core transitions:

- `ISSUED → ACCEPTED` by supplier
- `ISSUED → REJECTED` by supplier
- `ACCEPTED → IN_PROGRESS` by supplier
- `ISSUED → CANCELLED` by buyer before acceptance
- `IN_PROGRESS → PARTIALLY_DELIVERED / DELIVERED` through buyer goods receipts

Delivery status is buyer-receipt-driven; suppliers cannot mark goods as received themselves.
