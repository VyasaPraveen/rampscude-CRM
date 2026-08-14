# Veggie Cart

## Phase 2 Application Upgrade & Delivery Proposal

**Client document**  
**Prepared:** 13 August 2026  
**Target App Live / Production Deployment Date:** 31 August 2026  
**Reference:** Phase 1 Functional Requirement Document (FRD), 14 pages  
**Product:** Hyperlocal grocery and vegetable delivery application for Tirupati

---

## 1. Project overview

Veggie Cart is a local grocery-delivery platform designed for customers in Tirupati. Phase 1 established the product direction and the foundation for a central-store grocery model, with future support for multiple vendors, scalable inventory, configurable pricing, and role-based operations.

Phase 2 will convert that foundation into a reliable, measurable, and scalable operating system. The priority is to complete the end-to-end commerce journey, strengthen admin, store, and delivery operations, introduce customer retention capabilities, and make the platform ready for controlled multi-vendor expansion.

All approved Phase 2 functionalities covered in this document are targeted for completion and production deployment on or before **31 August 2026**, subject to timely client inputs, approvals, content, credentials, third-party access, and payment-gateway readiness.

This document distinguishes three things:

1. **Phase 1 proposed scope** — what the original FRD required.
2. **Current implementation evidence** — what could be verified from the live public Veggie Cart website and available project material.
3. **Phase 2 scope** — the functionality that should now be completed, hardened, or added.

The authenticated admin-panel state should be confirmed during the Phase 2 kickoff/UAT audit. The remote review session could verify the public website but could not establish a reliable authenticated session against the admin URL; therefore, unverified admin functions are deliberately marked for confirmation rather than incorrectly labelled as completed.

## 2. Product direction

### 2.1 Brand and market

- Product name: **Veggie Cart**
- Business model: local, hyperlocal grocery delivery
- Initial operating geography: Tirupati, Andhra Pradesh
- Initial operating model: central store/single inventory source
- Future model: optional multi-vendor marketplace
- Primary customer promise: fresh local products, dependable delivery slots, transparent pricing, and convenient repeat ordering

### 2.2 Phase 2 outcomes

By the end of Phase 2, the client should be able to:

- manage the catalog, prices, stock, offers, customers, and orders from the admin panel;
- process an order from placement through delivery and cancellation/refund;
- allocate orders for packing and delivery without manual spreadsheet dependence;
- assign, dispatch, and track deliveries through a dedicated Delivery Partner workflow;
- provide customers with dependable status updates, invoices, and support;
- measure sales, margins, stock movement, delivery performance, and customer retention;
- launch loyalty and subscription features in a controlled manner; and
- enable vendor functionality only when the central-store workflow is stable and commercially approved.

## 3. Scope baseline from Phase 1

The Phase 1 FRD defined the following baseline:

### Customer application

- OTP/mobile authentication, with optional email and Google login
- address management and location permission
- home page with an admin-controlled featured section for onion, ginger, garlic, and potato
- categories: vegetables, fruits, honey, spices, offers, and new arrivals
- product listing, pricing, MRP, discount, stock status, quantity selection, and filters
- product details with optional nutrition, storage, return policy, reviews, ratings, related products, and vendor visibility
- cart, coupon, delivery charge calculation, time-slot selection, and payment methods
- order statuses: placed, accepted, packed, out for delivery, delivered, and cancelled
- cancellation before packing, configurable auto-cancellation, and invoice download
- profile, order history, addresses, wishlist, payment methods, notifications, and help/support

### Store manager and admin

- dashboard, product and category management, inventory, daily pricing, bulk Excel operations, order management, invoices, and reports
- vendor records for procurement even when central-store mode is active
- admin-controlled vendor portal toggle and commission settings
- dynamic UI toggles for optional customer-facing fields and modules
- tax, margin, stock threshold, delivery charge, minimum order value, service fee, express fee, cancellation, and refund configuration
- price and inventory audit logs

### Delivery Partner

- secure delivery-partner login and profile;
- view only assigned orders and delivery-relevant customer information;
- accept or reject an assigned delivery with a reason;
- view pickup/store instructions and customer delivery notes;
- update delivery status: assigned, accepted, picked up, out for delivery, delivered, failed, or rescheduled;
- call or message the customer through approved contact controls without exposing unnecessary data;
- navigation/map link to the delivery address;
- proof of delivery using OTP, customer confirmation, signature, or delivery photo as configured;
- failed-delivery reason, reschedule request, return-to-store, and support escalation;
- delivery history, earnings/incentive summary if applicable, and availability/online status;
- push notifications for new assignments, reassignment, cancellation, and priority instructions;
- admin visibility into delivery partner location/status, assignment time, delivery time, and exceptions.

### Vendor and platform foundation

- optional vendor login, own-product management, stock/price updates, order visibility, commission reports, and invoices
- role-based permissions for admin, store manager, vendor, and customer
- JWT authentication, payment security, activity logs, scalable REST APIs, push notifications, payment gateway, cloud hosting, and scalable database design
- future scalability for multi-store, multi-city, multiple vendors per product, subscriptions, and loyalty points

## 4. Current implementation assessment

### 4.1 Publicly verified in the current implementation

The public Veggie Cart website currently presents:

- Veggie Cart branding and Tirupati-focused positioning;
- product categories including vegetables, fruits, honey, spices, special offers, and new arrivals;
- product examples with unit pricing, including tomatoes, carrots, onions, and spinach;
- catalog/search positioning and a 500+ product claim;
- same-day delivery messaging and delivery time windows of morning, afternoon, and evening;
- Tirupati coverage messaging and named localities;
- Android download and iOS PWA installation entry points;
- payment-method messaging covering UPI, cards, net banking, wallets, and COD;
- minimum order, free-delivery threshold, delivery-fee, and order-cancellation messaging;
- live-order-tracking, push-notification, offers, loyalty, and bundle-offer positioning in the customer-facing content; and
- legal/contact content links and customer-support contact information.

These are **public-facing claims or entry points**, not proof that every underlying transaction, admin configuration, or operational workflow is complete.

### 4.2 Not sufficiently evidenced and requiring Phase 2 verification or build

The following could not be confirmed from the available public implementation material and must be tested in the authenticated panel/app:

- working customer registration and OTP authentication;
- real product, stock, price, tax, margin, and category CRUD;
- featured essentials configuration and dynamic UI toggles;
- cart-to-checkout-to-payment transaction flow;
- payment gateway success, failure, refund, and reconciliation handling;
- order acceptance, packing, dispatch, delivery, cancellation, and auto-cancellation;
- invoice generation and download;
- customer profile, saved addresses, wishlist, saved payment methods, and support tickets;
- push notifications and notification templates;
- delivery partner assignment and live location tracking;
- Delivery Partner login, assignment acceptance, pickup confirmation, proof of delivery, and failed-delivery handling;
- store manager permissions and separation from super-admin permissions;
- inventory deduction, low-stock alerts, stock reservation, and adjustment history;
- Excel import/export and bulk price/stock updates;
- procurement vendor records, purchase prices, margins, and vendor reports;
- audit logs for admin activity, price changes, and inventory changes;
- vendor portal activation/deactivation and commission calculations;
- subscriptions and loyalty points; and
- security, performance, backup, monitoring, and recovery controls.

## 5. Phase 2 scope

### P0 — release-critical completion

#### 5.1 Customer authentication and account

- mobile-number OTP login and registration;
- session management, logout, account deletion request, and device/session security;
- profile editing and address book with label, landmark, PIN code, geo-coordinates, and default-address selection;
- serviceability check before checkout;
- clear handling for invalid OTP, expired OTP, unavailable area, and blocked account.

#### 5.2 Catalog, search, and product experience

- production catalog with categories, subcategories, images, units, MRP, selling price, discount, tax, stock status, and description;
- search by product name, category, and common spelling variants;
- filters for price, availability, offers, and rating when ratings are enabled;
- admin-controlled featured essentials section, display order, badge, and global visibility;
- optional product fields controlled by settings without leaving empty UI blocks;
- related products and frequently bought together where commercially approved;
- out-of-stock and low-stock behaviour that prevents invalid ordering.

#### 5.3 Cart, checkout, and payment

- persistent cart for signed-in customers;
- quantity validation, stock re-check, item removal, and price-change handling;
- configurable minimum order value, delivery charge, service charge, express fee, tax, coupon discount, and final payable amount;
- delivery date and time-slot selection with capacity limits;
- payment gateway integration for UPI/cards/net banking/wallets and COD rules;
- payment success, pending, failure, duplicate callback, timeout, retry, and refund states;
- order confirmation page, confirmation notification, and invoice generation.

#### 5.4 Order operations

- order state machine: placed → accepted → packed → out for delivery → delivered;
- cancellation before packing, with configurable policy and customer-visible reason;
- admin/store-manager cancellation with permission and reason capture;
- configurable auto-cancellation for unaccepted orders;
- packing checklist and item-level substitution/shortage handling;
- delivery assignment, delivery notes, proof of delivery, and failed-delivery reason;
- customer order tracking and complete order history;
- invoice download and share-friendly invoice format.

#### 5.5 Delivery Partner operations

- dedicated delivery-partner login with role-based access;
- assignment queue showing order number, customer area, slot, package count, payment mode, and delivery notes;
- accept/reject assignment and automatic reassignment when rejected or timed out;
- pickup confirmation from the store and handover checklist;
- status updates from picked up to out for delivery to delivered;
- customer contact and map navigation using approved integrations;
- delivery OTP or configured proof-of-delivery capture;
- failed delivery, customer unavailable, address issue, damaged package, and reschedule workflows;
- delivery partner availability, active-order list, completed-order history, and operational notifications;
- admin dashboard for assignment, route/status monitoring, delivery SLA, partner performance, and exceptions;
- delivery partner activity and status audit trail.

#### 5.6 Admin and store-manager operations

- dashboard with sales, orders, customers, products, inventory value, low stock, and pending actions;
- product/category management with archive instead of destructive deletion where historical orders exist;
- price and stock updates with validation and effective date/time;
- bulk Excel import/export with row-level error report and safe re-import;
- role-based permissions separating super admin from store manager;
- activity log showing user, action, timestamp, affected record, and before/after values;
- configurable delivery zones, time slots, charges, taxes, minimum order, cancellation, refund, delivery assignment, and proof-of-delivery settings.

### P1 — commercial growth and operational maturity

#### 5.6 Offers, coupons, and merchandising

- coupon creation with code, type, value, validity, usage limit, minimum order, customer eligibility, and category/product restrictions;
- offer banners and campaign scheduling;
- bundle offers and buy-more-save-more rules;
- first-order, repeat-order, and area-specific campaigns;
- prevention of coupon stacking unless explicitly enabled.

#### 5.7 Loyalty points

- configurable earn rules by order value, product, campaign, or referral;
- redemption rules, minimum redemption balance, expiry, reversal on cancellation/refund, and abuse controls;
- customer points ledger and admin adjustment with reason;
- loyalty reporting: issued, redeemed, expired, reversed, and outstanding points.

#### 5.8 Subscription and repeat ordering

- subscription plans for recurring grocery baskets or scheduled deliveries;
- plan frequency, skip, pause, resume, upgrade, downgrade, and cancel actions;
- payment renewal handling and failed-renewal notifications;
- subscription order generation with stock and serviceability validation;
- customer-visible savings and terms;
- admin reporting for active, paused, cancelled, failed, and completed subscriptions.

#### 5.9 Customer communication and support

- push, SMS, and/or email templates for OTP, order status, payment, cancellation, refund, delivery, and promotional messages;
- notification preference controls;
- help centre with FAQs and policy links;
- support ticket/contact form with order reference and status;
- admin response notes and support-resolution reporting.

#### 5.10 Reports and business intelligence

- sales by day, category, product, locality, payment method, and order status;
- gross sales, discounts, delivery fees, taxes, refunds, net sales, and contribution margin;
- product performance and dead-stock report;
- stock movement, low-stock, stock adjustment, and inventory valuation;
- customer acquisition, repeat rate, average order value, and cohort/repeat-order view;
- coupon, loyalty, subscription, cancellation, refund, and delivery performance reports;
- export to Excel/CSV with date filters and role-controlled access.

### P2 — controlled marketplace readiness

- vendor onboarding, approval, KYC/GST, bank details, and active/inactive state;
- vendor portal toggle and vendor self-registration toggle;
- vendor-owned catalog/price/stock permissions;
- vendor order visibility limited to own products/orders;
- commission rules, settlement statement, vendor invoice, and payout status;
- vendor product approval workflow;
- multi-vendor cart/order split rules and customer-facing vendor visibility toggle;
- procurement records and purchase-price history for the central-store model;
- multi-store and multi-city data model readiness without enabling those modes prematurely.

## 6. Functional rules

### 6.1 Inventory and pricing

- stock must be reserved or deducted at the defined order-confirmation point;
- stock cannot become negative through concurrent orders;
- zero stock automatically marks an item unavailable;
- low-stock alert threshold is configurable by product or globally;
- every stock and price change records actor, timestamp, old value, new value, and reason;
- profit is calculated from selling price minus purchase price, with tax/discount treatment explicitly documented;
- a price change during checkout must require customer confirmation before payment.

### 6.2 Delivery

- only serviceable PIN codes/localities may proceed to checkout;
- time slots have configurable start/end times, capacity, cutoff time, and holiday/closure rules;
- same-day delivery availability depends on order time, stock, location, and slot capacity;
- delivery charges are configurable by order value, location, slot, and express requirement;
- failed delivery requires a reason and supports reschedule or cancellation according to policy.
- an order cannot be marked delivered without the configured proof-of-delivery method;
- delivery assignment must record the assigning user, delivery partner, timestamp, and assignment status;
- a delivery partner can access only active assigned orders and minimum necessary customer information;
- customer contact details must be protected and access must be logged;
- delivery partner status changes must be reflected in the customer order timeline and admin panel;
- delivery SLA reports must measure assignment-to-pickup, pickup-to-delivery, total delivery time, failed deliveries, and reschedules;
- if live GPS tracking is enabled, location access requires delivery-partner consent and must stop when the active delivery is completed.

### 6.3 Cancellation, refund, and returns

- customer cancellation is allowed before packing, subject to configured policy;
- refund amount is calculated from payment, discount, delivery fee, and cancelled items according to policy;
- refund status is tracked separately from order status;
- damaged, missing, or quality-related complaints require order/item evidence and resolution status;
- policy text shown in the app must match admin configuration and the approved client policy.

## 7. Role and permission requirements

| Capability | Super Admin | Store Manager | Delivery Partner | Vendor | Customer |
|---|---:|---:|---:|---:|---:|
| Manage categories | Yes | No permanent delete | No | No |
| Manage all products | Yes | Add/edit/update | No | Own/assigned only | No |
| Update price/stock | Yes | Yes | No | Own/assigned only | No |
| View all orders | Yes | Yes | Assigned delivery orders only | Own/assigned only | Own orders |
| Cancel/refund orders | Yes | Configurable | No | No, unless approved | Policy-based cancellation |
| Change system settings | Yes | No | No | No | No |
| Manage users/roles | Yes | No | Own profile only | No | Own profile |
| View audit logs | Yes | Limited operational logs | Own activity only | Own activity only | No |
| Manage vendors/commission | Yes | Procurement view only | No | No | No |
| Configure coupons/loyalty/subscriptions | Yes | Operational view | No | No | Use eligible benefits |
| Update delivery status | Yes | Yes | Assigned orders only | Assigned orders only if enabled | View own status |
| Capture proof of delivery | Yes | Yes | Assigned orders only | Assigned orders only if enabled | Confirm receipt |

All permissions must be enforced server-side and not only hidden in the user interface.

## 8. Non-functional requirements and acceptance targets

- primary customer pages should load within 3 seconds on a normal 4G connection under agreed test conditions;
- API responses for normal catalog and order operations should meet an agreed performance target, with slow-query monitoring;
- target availability: 99% monthly uptime excluding approved maintenance;
- secure HTTPS transport, protected secrets, rate-limited authentication, validated inputs, and least-privilege access;
- no payment card data stored unless handled by a compliant payment provider/tokenization flow;
- daily automated backups with restore testing and defined retention;
- error logging, uptime monitoring, alerting, and admin activity monitoring;
- responsive admin panel for desktop and tablet use;
- Android and iOS/PWA compatibility matrix agreed before release;
- accessibility basics: readable contrast, labels, keyboard navigation in admin, and clear error messages;
- analytics events for search, product view, add-to-cart, checkout start, payment result, order status, coupon, loyalty, and subscription actions.

## 9. Project summary and delivery commitment

| Particulars | Details |
|---|---|
| Client / Product | Veggie Cart — hyperlocal grocery delivery application |
| Development scope | Phase 2 application upgrade, admin operations, store operations, Delivery Partner workflow, stabilization, testing, and deployment |
| Operating geography | Tirupati, Andhra Pradesh, subject to approved service areas |
| Target app live date | **31 August 2026** |
| Delivery condition | All approved functionalities completed, production-ready, and deployed on or before the target date |
| Defect condition at launch | No show-stopper/critical defects blocking login, ordering, payment, order processing, delivery, administration, or deployment |
| Post-live support | Minor bugs and non-blocking issues will be handled in Maintenance mode after launch |
| Third-party charges | Payment gateway, SMS/OTP, maps, hosting, app-store, messaging, and other provider charges are extra unless separately agreed |

### 9.1 Delivery milestones

- Scope confirmation, access, data, credentials, and third-party readiness: immediately after client approval.
- Core development and Delivery Partner workflow: completed within the agreed development window leading to the target date.
- Staging deployment, internal QA, and client UAT: before 31 August 2026.
- Production deployment and handover: on or before **31 August 2026** after UAT approval and required deployment approvals.

The target date depends on timely client feedback, final content/catalog data, policy approval, payment/SMS/maps credentials, app-store access, and no material scope changes after approval.

### 9.2 Launch quality and maintenance terms

- A **show-stopper defect** means a defect that prevents a core user or business flow from operating, creates a material security/payment/data-loss risk, or prevents production deployment.
- No show-stopper defects may remain open at production launch.
- Minor or non-blocking bugs that do not prevent normal business operation may be logged and fixed after launch in Maintenance mode.
- New enhancements, changes in approved behaviour, additional modules, integrations, or policy changes are treated as extra scope and may require separate effort, cost, and timeline approval.
- UAT sign-off confirms that the approved scope is accepted for production deployment; it does not prevent the logging of minor post-live defects.

## 10. Phase 2 delivery priorities

### Release 2A — core commerce stabilization

Authentication, serviceability, catalog, inventory, cart, checkout, payment, order lifecycle, invoices, admin/store-manager permissions, and audit logs.

### Release 2B — growth operations

Coupons, campaigns, notifications, support, loyalty points, subscription plans, and management reports.

### Release 2C — marketplace readiness

Vendor onboarding, vendor portal, commissions, settlements, procurement controls, and multi-vendor order logic.

The client may approve Release 2A independently so that the central-store business can operate while Release 2B/2C are developed.

## 11. Acceptance and UAT scenarios

The Phase 2 release will be accepted only after the following scenarios pass in staging and production-readiness testing:

1. A new customer registers with OTP, adds an address, and passes serviceability validation.
2. A customer browses/searches, adds an in-stock item, changes quantity, applies a valid coupon, and sees correct charges.
3. A successful online payment creates one order and one invoice without duplication.
4. A failed or pending payment does not create an incorrectly paid order.
5. Stock is correctly reserved/deducted and a zero-stock item cannot be oversold.
6. Store manager accepts, packs, and dispatches an order without accessing restricted settings.
7. Delivery partner receives an assignment, accepts it, views the pickup/delivery details, and confirms pickup.
8. Delivery partner updates out-for-delivery status, completes proof of delivery, and the customer sees the delivered status.
9. A failed delivery is recorded with a reason and can be rescheduled or escalated.
10. Customer receives status updates and can track order history.
11. Cancellation before packing follows policy and produces the correct refund state.
12. Admin changes price/stock and the audit log records before/after values and actor.
13. A coupon, loyalty redemption, refund, and subscription renewal handle edge cases correctly.
14. A vendor, when enabled, cannot view or modify another vendor’s data.
15. Reports reconcile with order, payment, inventory, refund, commission, and delivery records.

## 12. Client decisions required before development

- confirm Tirupati service areas and future expansion sequence;
- confirm final delivery slots, cutoffs, capacity, charges, minimum order, tax, and free-delivery threshold;
- confirm Delivery Partner model, partner count, assignment rules, delivery zones, payout/incentive rules, and proof-of-delivery method;
- provide delivery-partner user details, vehicle/ID information if required, and operational contact/escalation details;
- confirm payment gateway and refund settlement process;
- confirm whether the first Phase 2 release remains central-store only;
- approve cancellation, refund, quality complaint, and substitution policies;
- approve loyalty earn/redeem values, expiry, and liability treatment;
- approve subscription products, frequency, payment renewal, and pause rules;
- approve admin/store-manager users and permission boundaries;
- provide final catalog, images, units, prices, stock, MRP, tax, purchase price, and supplier data;
- provide notification sender details, SMS/email provider, analytics accounts, and app-store ownership/access;
- confirm legal text, privacy/consent wording, terms, refund policy, and customer support SLA.

## 13. Assumptions and exclusions

- Phase 2 starts from the existing Veggie Cart codebase, database, deployment, and app distribution assets after a technical audit.
- Third-party gateway, SMS, maps, hosting, app-store, messaging, and analytics fees are excluded from development estimates unless separately agreed.
- Multi-vendor functionality is designed as a controlled feature and is not assumed to be enabled at launch.
- Live delivery tracking requires a delivery-partner workflow, location permissions, maps provider, and operational staffing; the customer-facing claim alone is not treated as completion.
- Final effort, milestones, and commercials should be issued after a code/database/admin-panel audit and a complete staging walkthrough.
- Delivery Partner GPS tracking, SMS, maps, and contact integrations require the relevant third-party accounts, permissions, and provider charges.

## 14. Recommended Phase 2 definition of done

Phase 2 is complete when:

- all approved P0 stories pass UAT;
- all approved Phase 2 functionalities, including Delivery Partner operations, pass UAT;
- no show-stopper/critical defects remain open at launch;
- all known minor bugs are documented in the Maintenance backlog with priority and owner;
- production configuration, backups, monitoring, and rollback procedures are documented;
- admin and store-manager training is completed;
- catalog, policy, pricing, payment, and delivery data are loaded and reconciled;
- app and PWA builds are released through the agreed distribution channels;
- reports reconcile to test orders and payment records;
- security and permission tests pass;
- the client signs the UAT acceptance report and production handover checklist.

## 15. Client acceptance

By approving this document, the client confirms the Phase 2 scope, Delivery Partner functionality, target live date of **31 August 2026**, launch-quality condition, and post-live Maintenance mode treatment described above.

| Approval item | Client confirmation |
|---|---|
| Approved Phase 2 scope |  |
| Target app live date: 31 August 2026 |  |
| Delivery Partner module included |  |
| No show-stopper defects at launch |  |
| Minor bugs handled in Maintenance mode after launch |  |
| Client name / designation |  |
| Date |  |
| Client signature and company seal |  |

## Appendix A — evidence classification

| Classification | Meaning |
|---|---|
| Publicly verified | Visible in the public Veggie Cart website or download entry points during review |
| FRD proposed | Required in the Phase 1 requirement document, but not proof of implementation |
| Admin verification required | Must be confirmed by authenticated panel walkthrough or test evidence |
| Phase 2 build | Recommended upgrade scope in this document |

## Appendix B — source references

- Phase 1 source document: *Vegies Mart Mobile Application Requirement Doc.pdf*, supplied by the client.
- Current public product presence reviewed: https://veggie-cart.com/
- Authenticated admin review: credentials supplied separately by the client; no credentials are reproduced in this document.
