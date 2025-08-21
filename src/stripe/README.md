# Stripe and Plan Management Architecture

This document describes the refactored architecture for Stripe integration and plan management, following SOLID principles.

## Architecture Overview

The refactored system is organized into several focused services, each with a single responsibility:

### Core Services

1. **StripeService** - Main orchestrator for Stripe operations
2. **CustomerService** - Manages Stripe customer operations
3. **SubscriptionService** - Handles subscription data and status
4. **WebhookProcessorService** - Routes webhook events to appropriate handlers
5. **WebhookHandlerService** - Processes specific webhook event types
6. **PlanManagementService** - Manages plan limits and configurations

### Key Benefits

- **Single Responsibility Principle**: Each service has one clear purpose
- **Dependency Inversion**: Services depend on interfaces, not concrete implementations
- **Open/Closed Principle**: Easy to extend with new webhook handlers or payment providers
- **Interface Segregation**: Clean, focused interfaces for each service
- **Dependency Injection**: Proper dependency management through NestJS

## Service Responsibilities

### StripeService
- Orchestrates checkout session creation
- Manages webhook signature verification
- Coordinates between different services

### CustomerService
- Creates and manages Stripe customers
- Links users to Stripe customer IDs
- Updates customer metadata

### SubscriptionService
- Manages subscription data in the database
- Provides subscription status information
- Handles subscription CRUD operations

### WebhookProcessorService
- Routes incoming webhook events
- Delegates to appropriate handlers
- Provides error handling and logging

### WebhookHandlerService
- Processes checkout.session.completed events
- Handles subscription lifecycle events (created, updated, deleted)
- Maps Stripe statuses to internal statuses

### PlanManagementService
- Manages plan limits (FREE, BASIC, PRO)
- Validates plan configurations
- Provides CRUD operations for plan limits

## Webhook Flow

1. **Webhook Received**: Stripe sends webhook to `/stripe/webhook`
2. **Signature Verification**: Webhook signature is verified
3. **Event Routing**: Event is routed to appropriate handler
4. **Data Processing**: Handler processes the event and updates database
5. **Subscription Update**: User's subscription status is updated

## Subscription Lifecycle

1. **Checkout**: User selects plan and completes payment
2. **Webhook**: Stripe sends `checkout.session.completed` event
3. **Subscription Creation**: Subscription is created in database
4. **Status Updates**: Subsequent webhooks update subscription status
5. **Plan Enforcement**: Plan limits are enforced based on subscription

## Plan Limits

- **FREE**: 2 interviews, 50 chat messages, 1 resume upload
- **BASIC**: 10 interviews/month, 200 chat messages/month, 5 resume uploads/month
- **PRO**: Unlimited interviews, unlimited chat messages, unlimited resume uploads

## Error Handling

- Webhook signature verification failures
- Missing metadata in webhook events
- Database operation failures
- Stripe API errors

## Future Enhancements

- Support for additional payment providers
- Subscription upgrade/downgrade flows
- Usage analytics and reporting
- Automated billing notifications
- Plan customization options
