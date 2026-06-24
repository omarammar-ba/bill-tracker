# Security Specification - Al-Daftar

## Data Invariants
1. A transaction (invoice/payment) must belong to an existing customer.
2. An invoice cannot be deleted if it has associated payments (or we handle deletion cascades carefully).
3. The `paidAmount` in an invoice should be the sum of related payments (though for simplicity in rules we just validate types).
4. `amount` and `totalAmount` must be non-negative.

## The Dirty Dozen Payloads
1. Create an invoice with a negative `totalAmount`. (Denominator Denial)
2. Create a customer without a `type`. (Schema Gap)
3. Update an invoice `customerId` to target someone else's data. (Identity Spoofing)
4. Create a payment for a non-existent customer ID. (Orphaned Record)
5. Create a product with a 2MB name string. (Denial of Wallet)
6. Update a payment `amount` without updating the `date`. (State Inconsistency)
7. An unauthenticated user tries to read customers. (Auth bypass)
8. Authenticated user tries to create an invoice with a future date. (Temporal integrity)
9. Re-write `createdAt` on an existing customer. (Immutability violation)
10. Inject a field `isAdmin: true` into a customer document. (Schema Poisoning)
11. List invoices without filtering by customer (if we had multiple users, but here we enforce auth).
12. Delete an admin record (if existed).

## Test Runner (Draft)
The tests would verify `PERMISSION_DENIED` for all above except for authenticated legitimate users.
